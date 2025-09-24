import { useState, useEffect } from 'react';
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { Home, Upload, BarChart3, Settings, Target, FileText } from 'lucide-react';
import { OCRData, Bet } from '@shared/schema';
import ImageUpload from './ImageUpload';
import OCRVerification from './OCRVerification';
import Dashboard from './Dashboard';
import BetManagement from './BetManagement';
import Reports from './Reports';
import { ThemeToggle } from './ThemeToggle';
import Tesseract from 'tesseract.js';
import { apiRequest } from '@/lib/queryClient';

type AppState = 'upload' | 'verification' | 'dashboard' | 'management' | 'reports';

// OCR function to extract data from SureBet calculator images using Tesseract.js
const processOCRFromImage = async (file: File): Promise<OCRData> => {
  try {
    console.log('Starting OCR processing...');
    
    // Convert file to image URL for processing
    const imageUrl = URL.createObjectURL(file);
    
    // Run OCR on the image
    const { data: { text } } = await Tesseract.recognize(imageUrl, 'por+eng', {
      logger: m => console.log(m)
    });
    
    console.log('OCR Text extracted:', text);
    
    // Clean the URL object
    URL.revokeObjectURL(imageUrl);
    
    // Parse the extracted text to get betting data
    return parseOCRText(text);
    
  } catch (error) {
    console.error('OCR processing failed:', error);
    throw new Error('Falha ao processar OCR da imagem');
  }
};

// Helper function to normalize numbers from OCR (handles commas, all spaces)
const sanitizeNumber = (str: string): string => {
  return str.replace(/[\u00A0\u2009\u202F\s]/g, '').replace(/,/g, '.');
};

// Function to parse OCR text and extract betting information
const parseOCRText = (text: string): OCRData => {
  console.log('Parsing OCR text:', text);
  
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  // Initialize default data structure
  const result: OCRData = {
    betA: {
      bettingHouse: '',
      teamA: '',
      teamB: '',
      betType: '',
      selectedSide: 'A',
      odds: '0',
      stake: '0',
      payout: '0',
      profit: '0'
    },
    betB: {
      bettingHouse: '',
      teamA: '',
      teamB: '',
      betType: '',
      selectedSide: 'B',
      odds: '0',
      stake: '0',
      payout: '0',
      profit: '0'
    },
    gameDate: new Date(),
    gameTime: '',
    sport: '',
    league: '',
    totalProfitPercentage: '0'
  };
  
  try {
    // Extract date and time from the header (formato: 2025-09-26 12:00)
    const dateTimeMatch = text.match(/(\d{4})-?(\d{2})-?(\d{2})\s+(\d{1,2}):?(\d{2})/i);
    if (dateTimeMatch) {
      const [, year, month, day, hour, minute] = dateTimeMatch;
      result.gameDate = new Date(`${year}-${month}-${day}T${hour.padStart(2, '0')}:${minute}:00`);
      result.gameTime = `${hour.padStart(2, '0')}:${minute}`;
    }
    
    // Extract teams - support multiple dash types (em-dash, en-dash, hyphen)
    const teamPattern = /([A-Za-zÀ-ÿ0-9]+(?:[ .'-][A-Za-zÀ-ÿ0-9]+)*)\s*[—–-]\s*([A-Za-zÀ-ÿ0-9]+(?:[ .'-][A-Za-zÀ-ÿ0-9]+)*)/i;
    const teamsMatch = text.match(teamPattern);
    if (teamsMatch) {
      result.betA.teamA = teamsMatch[1].trim();
      result.betA.teamB = teamsMatch[2].trim();
      result.betB.teamA = teamsMatch[1].trim();
      result.betB.teamB = teamsMatch[2].trim();
    } else {
      // Fallback: find any line with dashes and split
      const dashLine = lines.find(line => /[\u2014\u2013-]/.test(line));
      if (dashLine) {
        const parts = dashLine.split(/[\u2014\u2013-]/).map(p => p.trim());
        if (parts.length >= 2) {
          result.betA.teamA = parts[0];
          result.betA.teamB = parts[1];
          result.betB.teamA = parts[0];
          result.betB.teamB = parts[1];
        }
      }
    }
    
    // Extract sport and league
    const sportLeagueMatch = text.match(/(Futebol|Football)\s*\/\s*([^\n]+)/i);
    if (sportLeagueMatch) {
      result.sport = sportLeagueMatch[1];
      result.league = sportLeagueMatch[2].trim();
    }
    
    // Extract total profit percentage
    const profitMatch = text.match(/(\d+\.\d+)%/i);
    if (profitMatch) {
      result.totalProfitPercentage = profitMatch[1];
    }
    
    // Parse betting lines - Look for lines containing betting houses and [E]
    const bettingLines = text.split('\n').filter(line => 
      /([A-Za-z0-9][A-Za-z0-9 .'-]*)\s*(?:\(\s*BR\s*\)|\bBR\b)?.*?\[\s*E\s*\]/.test(line)
    );
    
    if (bettingLines && bettingLines.length >= 1) {
      // Parse first betting line (Bet A)
      if (bettingLines.length >= 1) {
        const line = bettingLines[0];
        
        // Extract betting house
        const houseMatch = line.match(/([A-Za-z0-9][A-Za-z0-9 .'-]*)\s*(?:\(\s*BR\s*\)|\bBR\b)?/);
        if (houseMatch) result.betA.bettingHouse = houseMatch[1].trim();
        
        // Extract bet type (everything after house/BR and before last decimal before [E])
        const betTypeMatch = line.match(/(?:(?:BR\s*\)|\bBR\b)\s+|(?:[A-Za-z0-9 .'-]+)\s+)(.+?)(?=\s+\d+[\.,]\d+(?:[^\d\n]*\[\s*E\s*\]))/);
        if (betTypeMatch) result.betA.betType = betTypeMatch[1].trim();
        
        // Extract odds (last decimal before [E])
        const oddsMatch = line.match(/(\d+(?:[.,]\d+))(?=[^\d\n]*\[\s*E\s*\])/);
        if (oddsMatch) result.betA.odds = sanitizeNumber(oddsMatch[1]);
        
        // Extract stake (decimal after [E])
        const stakeMatch = line.match(/\[\s*E\s*\]\s*(\d+(?:[.,]\d+))/);
        if (stakeMatch) result.betA.stake = sanitizeNumber(stakeMatch[1]);
        
        // Calculate payout and profit
        if (result.betA.odds && result.betA.stake) {
          const payout = parseFloat(result.betA.stake) * parseFloat(result.betA.odds);
          result.betA.payout = payout.toFixed(2);
          result.betA.profit = (payout - parseFloat(result.betA.stake)).toFixed(2);
        }
      }
      
      // Parse second betting line (Bet B)
      if (bettingLines.length >= 2) {
        const line = bettingLines[1];
        
        // Extract betting house
        const houseMatch = line.match(/([A-Za-z0-9][A-Za-z0-9 .'-]*)\s*(?:\(\s*BR\s*\)|\bBR\b)?/);
        if (houseMatch) result.betB.bettingHouse = houseMatch[1].trim();
        
        // Extract bet type (everything after house/BR and before last decimal before [E])
        const betTypeMatch = line.match(/(?:(?:BR\s*\)|\bBR\b)\s+|(?:[A-Za-z0-9 .'-]+)\s+)(.+?)(?=\s+\d+[\.,]\d+(?:[^\d\n]*\[\s*E\s*\]))/);
        if (betTypeMatch) result.betB.betType = betTypeMatch[1].trim();
        
        // Extract odds (last decimal before [E])
        const oddsMatch = line.match(/(\d+(?:[.,]\d+))(?=[^\d\n]*\[\s*E\s*\])/);
        if (oddsMatch) result.betB.odds = sanitizeNumber(oddsMatch[1]);
        
        // Extract stake (decimal after [E])
        const stakeMatch = line.match(/\[\s*E\s*\]\s*(\d+(?:[.,]\d+))/);
        if (stakeMatch) result.betB.stake = sanitizeNumber(stakeMatch[1]);
        
        // Calculate payout and profit
        if (result.betB.odds && result.betB.stake) {
          const payout = parseFloat(result.betB.stake) * parseFloat(result.betB.odds);
          result.betB.payout = payout.toFixed(2);
          result.betB.profit = (payout - parseFloat(result.betB.stake)).toFixed(2);
        }
      }
    } else {
      // Fallback: try to extract betting houses separately (support houses with numbers)
      const houseMatches = text.match(/(SuperBet|Pinnacle|VBet|VBET|KTO|Bet365|Betano|Aposta1|Betnacional|1xBet|22Bet|Novibet|Sportingbet)/gi);
      if (houseMatches && houseMatches.length >= 2) {
        result.betA.bettingHouse = houseMatches[0];
        result.betB.bettingHouse = houseMatches[1];
      }
      
      // Extract bet types (look for specific patterns)
      const betTypePattern = /(Acima|Abaixo|Over|Under|H1|H2)\s*[\d\.]*[^\d]*?(?=\s+\d+\.\d+)/gi;
      const betTypeMatches = text.match(betTypePattern);
      if (betTypeMatches && betTypeMatches.length >= 2) {
        result.betA.betType = betTypeMatches[0].trim();
        result.betB.betType = betTypeMatches[1].trim();
      }
      
      // Extract odds - look for decimal numbers in betting context
      const oddsPattern = /\b(\d+\.\d{2,3})\b/g;
      const oddsMatches = text.match(oddsPattern);
      if (oddsMatches && oddsMatches.length >= 2) {
        // Filter out percentages and dates
        const validOdds = oddsMatches.filter(o => {
          const num = parseFloat(o);
          return num >= 1.1 && num <= 50; // reasonable odds range
        });
        if (validOdds.length >= 2) {
          result.betA.odds = validOdds[0];
          result.betB.odds = validOdds[1];
        }
      }
      
      // Fallback: Extract stakes from [E] value USD/R$ pattern with normalization
      const stakePattern = /\[\s*E\s*\]\s*(\d+[\.,]\d+)\s*(?:USD|R\$)?/gi;
      const stakeMatches = text.match(stakePattern);
      if (stakeMatches && stakeMatches.length >= 2) {
        const stakes = stakeMatches.map(v => {
          const match = v.match(/\d+[\.,]\d+/);
          return match ? sanitizeNumber(match[0]) : '0';
        });
        result.betA.stake = stakes[0];
        result.betB.stake = stakes[1];
        
        // Calculate payouts correctly: stake × odds (retorno = odd × stake)
        if (result.betA.odds && result.betA.stake) {
          const payout = parseFloat(result.betA.stake) * parseFloat(result.betA.odds);
          result.betA.payout = payout.toFixed(2);
          result.betA.profit = (payout - parseFloat(result.betA.stake)).toFixed(2);
        }
        if (result.betB.odds && result.betB.stake) {
          const payout = parseFloat(result.betB.stake) * parseFloat(result.betB.odds);
          result.betB.payout = payout.toFixed(2);
          result.betB.profit = (payout - parseFloat(result.betB.stake)).toFixed(2);
        }
      }
    }
    
    console.log('Parsed OCR result:', result);
    return result;
    
  } catch (error) {
    console.error('Error parsing OCR text:', error);
    throw new Error('Erro ao analisar texto da imagem');
  }
};

export default function BetTracker() {
  const [currentState, setCurrentState] = useState<AppState>('dashboard');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState<string>('');
  const [currentOCRData, setCurrentOCRData] = useState<OCRData | null>(null);
  const [bets, setBets] = useState<Bet[]>([]); //todo: remove mock functionality - replace with API calls

  // Sidebar navigation items
  const sidebarItems = [
    {
      title: 'Dashboard',
      icon: Home,
      id: 'dashboard' as AppState,
      active: currentState === 'dashboard'
    },
    {
      title: 'Nova Aposta',
      icon: Upload,
      id: 'upload' as AppState,
      active: currentState === 'upload'
    },
    {
      title: 'Gestão de Apostas',
      icon: Settings,
      id: 'management' as AppState,
      active: currentState === 'management'
    },
    {
      title: 'Relatórios',
      icon: BarChart3,
      id: 'reports' as AppState,
      active: currentState === 'reports'
    }
  ];

  const handleImageUpload = async (file: File) => {
    setIsProcessing(true);
    
    // Create image URL for preview
    const imageUrl = URL.createObjectURL(file);
    setCurrentImageUrl(imageUrl);
    
    try {
      // Real OCR processing using Tesseract.js
      const ocrData = await processOCRFromImage(file);
      setCurrentOCRData(ocrData);
      setCurrentState('verification');
    } catch (error) {
      console.error('OCR processing failed:', error);
      // Handle error - could show toast notification
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOCRConfirm = async (data: OCRData) => {
    try {
      // Generate pair ID for the two bets
      const pairId = Math.random().toString(36).substr(2, 9);
      
      // Calculate pair metrics
      const stakeA = Number(data.betA.stake);
      const stakeB = Number(data.betB.stake);
      const payoutA = Number(data.betA.payout);
      const payoutB = Number(data.betB.payout);
      const totalStake = stakeA + stakeB;
      // Profit percentage if this bet wins: (winning payout - total invested) / total invested
      const profitPercentageA = totalStake > 0 ? ((payoutA - totalStake) / totalStake) * 100 : 0;
      const profitPercentageB = totalStake > 0 ? ((payoutB - totalStake) / totalStake) * 100 : 0;
      
      // Create bet A via API
      const betAData = {
        bettingHouse: data.betA.bettingHouse,
        teamA: data.betA.teamA,
        teamB: data.betA.teamB,
        betType: data.betA.betType,
        selectedSide: data.betA.selectedSide,
        odds: data.betA.odds,
        stake: data.betA.stake,
        payout: data.betA.payout,
        gameDate: data.gameDate,
        status: 'pending' as const,
        isVerified: true,
        pairId: pairId,
        betPosition: 'A' as const,
        totalPairStake: totalStake.toString(),
        profitPercentage: profitPercentageA.toString()
      };
      
      // Create bet B via API
      const betBData = {
        bettingHouse: data.betB.bettingHouse,
        teamA: data.betB.teamA,
        teamB: data.betB.teamB,
        betType: data.betB.betType,
        selectedSide: data.betB.selectedSide,
        odds: data.betB.odds,
        stake: data.betB.stake,
        payout: data.betB.payout,
        gameDate: data.gameDate,
        status: 'pending' as const,
        isVerified: true,
        pairId: pairId,
        betPosition: 'B' as const,
        totalPairStake: totalStake.toString(),
        profitPercentage: profitPercentageB.toString()
      };
      
      // Save both bets via API
      const responseA = await apiRequest('POST', '/api/bets', betAData);
      const responseB = await apiRequest('POST', '/api/bets', betBData);
      
      const betA = await responseA.json();
      const betB = await responseB.json();
      
      console.log('Bet pair saved via API:', { betA, betB });
      
      // Clean up and navigate to dashboard
      setCurrentImageUrl('');
      setCurrentOCRData(null);
      setCurrentState('dashboard');
      
      // Reload bets to show the new ones
      await loadBets();
      
    } catch (error) {
      console.error('Error saving bets:', error);
      // Handle error - could show toast notification
    }
  };

  const handleOCRCancel = () => {
    setCurrentImageUrl('');
    setCurrentOCRData(null);
    setCurrentState('upload');
  };

  const handleResolveBet = async (betId: string, status: 'won' | 'lost' | 'returned') => {
    try {
      await apiRequest('PUT', `/api/bets/${betId}/status`, { status });
      await loadBets(); // Reload bets after status update
      console.log(`Bet ${betId} resolved as: ${status}`);
    } catch (error) {
      console.error('Error updating bet status:', error);
    }
  };
  
  const loadBets = async () => {
    try {
      const response = await apiRequest('GET', '/api/bets');
      const betsData = await response.json();
      setBets(betsData);
    } catch (error) {
      console.error('Error loading bets:', error);
    }
  };
  
  // Load bets on component mount
  useEffect(() => {
    loadBets();
  }, []);

  const handleAddBet = () => {
    setCurrentState('upload');
  };

  const renderMainContent = () => {
    switch (currentState) {
      case 'upload':
        return (
          <div className="max-w-4xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2">Adicionar Nova Aposta</h1>
              <p className="text-muted-foreground">
                Faça upload de um comprovante de aposta para extrair os dados automaticamente
              </p>
            </div>
            <ImageUpload 
              onImageUpload={handleImageUpload} 
              isProcessing={isProcessing}
            />
          </div>
        );
      
      case 'verification':
        return currentOCRData && currentImageUrl ? (
          <div className="max-w-7xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2">Verificar Dados Extraídos</h1>
              <p className="text-muted-foreground">
                Revise e corrija os dados antes de salvar no sistema
              </p>
            </div>
            <OCRVerification
              imageUrl={currentImageUrl}
              ocrData={currentOCRData}
              onConfirm={handleOCRConfirm}
              onCancel={handleOCRCancel}
            />
          </div>
        ) : null;
      
      case 'management':
        return <BetManagement />;
      
      case 'reports':
        return <Reports />;
      
      case 'dashboard':
      default:
        return (
          <Dashboard
            bets={bets}
            onResolveBet={handleResolveBet}
            onAddBet={handleAddBet}
          />
        );
    }
  };

  return (
    <div className="flex h-screen w-full">
      {/* Sidebar */}
      <Sidebar>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel className="flex items-center gap-2 px-2 py-2">
              <Target className="h-5 w-5" />
              <span className="font-semibold">BetTracker</span>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {sidebarItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild
                      className={item.active ? 'bg-sidebar-accent' : ''}
                    >
                      <button
                        onClick={() => setCurrentState(item.id)}
                        className="w-full"
                        data-testid={`nav-${item.title.toLowerCase().replace(' ', '-')}`}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </button>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      {/* Main Content */}
      <div className="flex flex-col flex-1">
        {/* Header */}
        <header className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center gap-2">
            {currentState !== 'dashboard' && (
              <button 
                onClick={() => setCurrentState('dashboard')}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                data-testid="link-back-dashboard"
              >
                ← Voltar ao Dashboard
              </button>
            )}
          </div>
          <ThemeToggle />
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6 bg-background">
          {renderMainContent()}
        </main>
      </div>
    </div>
  );
}