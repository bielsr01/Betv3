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
    
    // Extract teams - improved regex to handle hyphens in team names
    // Look for pattern: Team A (possibly with hyphens) — Team B (possibly with hyphens)
    const teamPattern = /([A-Za-z][A-Za-z\s\-]+?)\s*[—–]\s*([A-Za-z][A-Za-z\s\-]+?)(?=\s|\d|%|$)/i;
    const teamsMatch = text.match(teamPattern);
    if (teamsMatch) {
      result.betA.teamA = teamsMatch[1].trim();
      result.betA.teamB = teamsMatch[2].trim();
      result.betB.teamA = teamsMatch[1].trim();
      result.betB.teamB = teamsMatch[2].trim();
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
    
    // Parse betting lines - Look for pattern: BettingHouse (BR) BetType Odds ... Value ... Profit
    const bettingLines = text.match(/([A-Za-z]+)\s*\(BR\)\s+([^\d]+?)\s+(\d+\.\d+).*?(\d+\.\d+).*?USD.*?(\d+\.\d+)/gi);
    
    if (bettingLines && bettingLines.length >= 2) {
      // Parse first betting line (Bet A)
      const betAMatch = bettingLines[0].match(/([A-Za-z]+)\s*\(BR\)\s+([^\d]+?)\s+(\d+\.\d+).*?(\d+\.\d+).*?USD.*?(\d+\.\d+)/i);
      if (betAMatch) {
        result.betA.bettingHouse = betAMatch[1];
        result.betA.betType = betAMatch[2].trim();
        result.betA.odds = betAMatch[3];
        result.betA.stake = betAMatch[4];
        result.betA.profit = betAMatch[5];
        // Calculate payout: stake × odds
        result.betA.payout = (parseFloat(betAMatch[4]) * parseFloat(betAMatch[3])).toFixed(2);
      }
      
      // Parse second betting line (Bet B)
      const betBMatch = bettingLines[1].match(/([A-Za-z]+)\s*\(BR\)\s+([^\d]+?)\s+(\d+\.\d+).*?(\d+\.\d+).*?USD.*?(\d+\.\d+)/i);
      if (betBMatch) {
        result.betB.bettingHouse = betBMatch[1];
        result.betB.betType = betBMatch[2].trim();
        result.betB.odds = betBMatch[3];
        result.betB.stake = betBMatch[4];
        result.betB.profit = betBMatch[5];
        // Calculate payout: stake × odds
        result.betB.payout = (parseFloat(betBMatch[4]) * parseFloat(betBMatch[3])).toFixed(2);
      }
    } else {
      // Fallback: try to extract betting houses separately
      const houseMatches = text.match(/(SuperBet|Pinnacle|VBet|VBET|KTO|Bet365|Betano|Aposta1|Betnacional|1xBet)/gi);
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
      
      // Extract stakes and profits
      const valuePattern = /(\d+\.\d+)\s*USD/gi;
      const valueMatches = text.match(valuePattern);
      if (valueMatches && valueMatches.length >= 4) {
        // Extract just the numbers
        const values = valueMatches.map(v => v.replace(/[^\d\.]/g, ''));
        result.betA.stake = values[0];
        result.betA.profit = values[1];
        result.betB.stake = values[2];
        result.betB.profit = values[3];
        
        // Calculate payouts correctly: stake × odds
        if (result.betA.odds && result.betA.stake) {
          result.betA.payout = (parseFloat(result.betA.stake) * parseFloat(result.betA.odds)).toFixed(2);
        }
        if (result.betB.odds && result.betB.stake) {
          result.betB.payout = (parseFloat(result.betB.stake) * parseFloat(result.betB.odds)).toFixed(2);
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