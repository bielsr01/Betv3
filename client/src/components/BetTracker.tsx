import { useState, useEffect } from 'react';
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { Home, Upload, BarChart3, Settings, Target, FileText, TestTube } from 'lucide-react';
import { OCRData, Bet } from '@shared/schema';
import ImageUpload from './ImageUpload';
import OCRVerification from './OCRVerification';
import Dashboard from './Dashboard';
import BetManagement from './BetManagement';
import Reports from './Reports';
import TestUpload from './TestUpload';
import { ThemeToggle } from './ThemeToggle';
// Using Claude AI for OCR processing
import { apiRequest } from '@/lib/queryClient';

type AppState = 'upload' | 'verification' | 'dashboard' | 'management' | 'reports' | 'test-upload';

// OCR function using Claude AI - ONLY Claude, no fallbacks
const processOCRFromImage = async (file: File): Promise<OCRData> => {
  try {
    console.log('Starting Claude AI OCR processing...');
    
    // Convert file to base64
    const base64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data:image/png;base64, prefix
        const base64Data = result.split(',')[1];
        resolve(base64Data);
      };
      reader.readAsDataURL(file);
    });
    
    // Call backend API for Claude AI analysis - NO FALLBACKS
    const response = await fetch('/api/ocr/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imageBase64: base64 }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to analyze image with Claude AI');
    }
    
    const claudeData = await response.json();
    console.log('Claude AI OCR result:', claudeData);
    
    // Convert Claude response to our OCRData format
    return convertClaudeToOCRFormat(claudeData);
    
  } catch (error) {
    console.error('Claude AI OCR processing failed:', error);
    throw new Error('Falha ao processar imagem com IA. Tente novamente.');
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
      odds: '0',
      stake: '0',
      profit: '0'
    },
    betB: {
      bettingHouse: '',
      teamA: '',
      teamB: '',
      betType: '',
      odds: '0',
      stake: '0',
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
      // CORRIGIDO: Usar string no formato DD-MM-YYYY em vez de Date object para evitar timezone
      result.gameDate = `${day}-${month}-${year}`;
      result.gameTime = `${hour.padStart(2, '0')}:${minute}`;
    }
    
    // Extract teams - detect ONLY the specific en dash "–" from SureBet
    const teamPattern = /([A-Za-zÀ-ÿ0-9]+(?:[ .'-][A-Za-zÀ-ÿ0-9]+)*)\s*–\s*([A-Za-zÀ-ÿ0-9]+(?:[ .'-][A-Za-zÀ-ÿ0-9]+)*)/i;
    const teamsMatch = text.match(teamPattern);
    if (teamsMatch) {
      result.betA.teamA = teamsMatch[1].trim();
      result.betA.teamB = teamsMatch[2].trim();
      result.betB.teamA = teamsMatch[1].trim();
      result.betB.teamB = teamsMatch[2].trim();
    } else {
      // Fallback: find line with the specific en dash "–" and split
      const dashLine = lines.find(line => /–/.test(line));
      if (dashLine) {
        const parts = dashLine.split('–').map(p => p.trim());
        if (parts.length >= 2) {
          result.betA.teamA = parts[0];
          result.betA.teamB = parts[1];
          result.betB.teamA = parts[0];
          result.betB.teamB = parts[1];
        }
      }
    }
    
    // Extract sport and league (expanded for SureBet)
    const sportLeagueMatch = text.match(/(Futebol|Football|Basquete|Basketball|Futebol americano|Tennis|Volei)\s*\/\s*([^\n]+)/i);
    if (sportLeagueMatch) {
      result.sport = sportLeagueMatch[1];
      result.league = sportLeagueMatch[2].trim();
    }
    
    // Extract total profit percentage
    const profitMatch = text.match(/(\d+\.\d+)%/i);
    if (profitMatch) {
      result.totalProfitPercentage = profitMatch[1];
    }
    
    // Ensure teams are extracted correctly if missed in first attempt
    if (!result.betA.teamA || !result.betA.teamB) {
      // Look for team pattern in early lines (before percentage)
      const earlyLines = lines.slice(0, 3);
      for (const line of earlyLines) {
        const teamMatch = line.match(/([A-Za-zÀ-ÿ0-9]+(?:[ .'-][A-Za-zÀ-ÿ0-9]+)*)\s*–\s*([A-Za-zÀ-ÿ0-9]+(?:[ .'-][A-Za-zÀ-ÿ0-9]+)*)/i);
        if (teamMatch) {
          result.betA.teamA = teamMatch[1].trim();
          result.betA.teamB = teamMatch[2].trim();
          result.betB.teamA = teamMatch[1].trim();
          result.betB.teamB = teamMatch[2].trim();
          break;
        }
      }
    }
    
    // Parse betting lines - Look for SureBet format with [E pattern
    const bettingLines = text.split('\n').filter(line => {
      // Look for lines with: BettingHouse + bet info + [E + stake + USD
      return /(?:Pinnacle|BravoBet|Betfast|Blaze|KTO|Betano|1xBet|22Bet|VBet|Bet365|Betnacional|Novibet|Sportingbet).*?\[E.*?USD/i.test(line);
    });
    
    if (bettingLines && bettingLines.length >= 1) {
      // Parse first betting line (Bet A) - SureBet format
      if (bettingLines.length >= 1) {
        const line = bettingLines[0];
        
        // Extract betting house (first column)
        const houseMatch = line.match(/(Pinnacle|BravoBet|Betfast|Blaze|KTO|Betano|1xBet|22Bet|VBet|Bet365|Betnacional|Novibet|Sportingbet)/i);
        if (houseMatch) result.betA.bettingHouse = houseMatch[1].trim();
        
        // Parse SureBet format: Pinnacle (Br) H2(+2.5) Tempo Extra 2.250 o [E 46.68 USD v [>] 5.03
        const betTypeMatch = line.match(/(?:Pinnacle|BravoBet|Betfast|Blaze|KTO|Betano|1xBet|22Bet|VBet|Bet365|Betnacional|Novibet|Sportingbet)\s*(?:\([^)]+\))?\s+([^\d]+?)\s+(\d+\.\d+)\s+.*?\[E\s+(\d+\.\d+)\s+USD.*?(\d+\.\d+)/i);
        if (betTypeMatch) {
          result.betA.betType = betTypeMatch[1].trim();
          result.betA.odds = sanitizeNumber(betTypeMatch[2]);
          result.betA.stake = sanitizeNumber(betTypeMatch[3]);
          result.betA.profit = sanitizeNumber(betTypeMatch[4]);
        }
        
        // Calculate payout and profit
        if (result.betA.odds && result.betA.stake) {
          const payout = parseFloat(result.betA.stake) * parseFloat(result.betA.odds);
          // Payout calculation: already handled in profit calculation
          result.betA.profit = (payout - parseFloat(result.betA.stake)).toFixed(2);
        }
      }
      
      // Parse second betting line (Bet B) - SureBet format
      if (bettingLines.length >= 2) {
        const line = bettingLines[1];
        
        // Extract betting house (first column)
        const houseMatch = line.match(/(Pinnacle|BravoBet|Betfast|Blaze|KTO|Betano|1xBet|22Bet|VBet|Bet365|Betnacional|Novibet|Sportingbet)/i);
        if (houseMatch) result.betB.bettingHouse = houseMatch[1].trim();
        
        // Parse SureBet format: Betfast H1(-2.5) Tempo Extra 1.970 e [E 53.32 USD v Q 5.04
        const betTypeMatch = line.match(/(?:Pinnacle|BravoBet|Betfast|Blaze|KTO|Betano|1xBet|22Bet|VBet|Bet365|Betnacional|Novibet|Sportingbet)\s*(?:\([^)]+\))?\s+([^\d]+?)\s+(\d+\.\d+)\s+.*?\[E\s+(\d+\.\d+)\s+USD.*?(\d+\.\d+)/i);
        if (betTypeMatch) {
          result.betB.betType = betTypeMatch[1].trim();
          result.betB.odds = sanitizeNumber(betTypeMatch[2]);
          result.betB.stake = sanitizeNumber(betTypeMatch[3]);
          result.betB.profit = sanitizeNumber(betTypeMatch[4]);
        }
        
        // Calculate payout and profit
        if (result.betB.odds && result.betB.stake) {
          const payout = parseFloat(result.betB.stake) * parseFloat(result.betB.odds);
          // Payout calculation: already handled in profit calculation
          result.betB.profit = (payout - parseFloat(result.betB.stake)).toFixed(2);
        }
      }
    } else {
      // Enhanced fallback for SureBet format when structured parsing fails
      
      // Try to extract betting houses from text
      const houseMatches = text.match(/(Pinnacle|BravoBet|Betfast|Blaze|KTO|Betano|1xBet|22Bet|VBet|Bet365|Betnacional|Novibet|Sportingbet)/gi);
      if (houseMatches && houseMatches.length >= 1) {
        result.betA.bettingHouse = houseMatches[0];
        if (houseMatches.length >= 2) {
          result.betB.bettingHouse = houseMatches[1];
        }
      }
      
      // Extract bet types (SureBet patterns)
      const betTypePattern = /(H[12]\([^)]+\)|Acima|Abaixo|Over|Under|Gols:\s*Sim|2\s*-\s*escanteios)/gi;
      const betTypeMatches = text.match(betTypePattern);
      if (betTypeMatches && betTypeMatches.length >= 1) {
        result.betA.betType = betTypeMatches[0].trim();
        if (betTypeMatches.length >= 2) {
          result.betB.betType = betTypeMatches[1].trim();
        }
      }
      
      // Extract from [E pattern lines (SureBet format)
      const eLines = lines.filter(line => /\[E\s+\d+\.\d+\s+USD/.test(line));
      if (eLines.length >= 1) {
        // Parse first [E line - extract house + bet type + odds + stake + profit
        const firstMatch = eLines[0].match(/(Pinnacle|BravoBet|Betfast|Blaze|KTO|Betano|1xBet|22Bet|VBet|Bet365|Betnacional|Novibet|Sportingbet)\s*(?:\([^)]+\))?\s+([^\d]+?)\s+(\d+\.\d+)\s+.*?\[E\s+(\d+\.\d+)\s+USD.*?(\d+\.\d+)/i);
        if (firstMatch) {
          result.betA.bettingHouse = firstMatch[1].trim();
          result.betA.betType = firstMatch[2].trim();
          result.betA.odds = sanitizeNumber(firstMatch[3]);
          result.betA.stake = sanitizeNumber(firstMatch[4]);
          result.betA.profit = sanitizeNumber(firstMatch[5]);
        }
        
        if (eLines.length >= 2) {
          // Parse second [E line
          const secondMatch = eLines[1].match(/(Pinnacle|BravoBet|Betfast|Blaze|KTO|Betano|1xBet|22Bet|VBet|Bet365|Betnacional|Novibet|Sportingbet)\s*(?:\([^)]+\))?\s+([^\d]+?)\s+(\d+\.\d+)\s+.*?\[E\s+(\d+\.\d+)\s+USD.*?(\d+\.\d+)/i);
          if (secondMatch) {
            result.betB.bettingHouse = secondMatch[1].trim();
            result.betB.betType = secondMatch[2].trim();
            result.betB.odds = sanitizeNumber(secondMatch[3]);
            result.betB.stake = sanitizeNumber(secondMatch[4]);
            result.betB.profit = sanitizeNumber(secondMatch[5]);
          }
        }
      }
    }
    
    // Calculate profit if not extracted: profit = (stake × odds) - stake
    if (result.betA.odds && result.betA.stake) {
      // If profit wasn't extracted, calculate it
      if (!result.betA.profit || result.betA.profit === '0') {
        const payout = parseFloat(result.betA.stake) * parseFloat(result.betA.odds);
        result.betA.profit = (payout - parseFloat(result.betA.stake)).toFixed(2);
      }
    }
    
    if (result.betB.odds && result.betB.stake) {
      // If profit wasn't extracted, calculate it
      if (!result.betB.profit || result.betB.profit === '0') {
        const payout = parseFloat(result.betB.stake) * parseFloat(result.betB.odds);
        result.betB.profit = (payout - parseFloat(result.betB.stake)).toFixed(2);
      }
    }
    
    console.log('Parsed OCR result:', result);
    return result;
    
  } catch (error) {
    console.error('Error parsing OCR text:', error);
    throw new Error('Erro ao analisar texto da imagem');
  }
};

// Helper function to convert Claude response to our format - NO FALLBACKS
const convertClaudeToOCRFormat = (claudeData: any): OCRData => {
  // Clean percentage value - remove % symbol if present
  const cleanPercentage = (claudeData.totalProfitPercentage || '0').replace('%', '');

  // Convert DD/MM/YYYY to DD-MM-YYYY format for schema compatibility
  const gameDate = claudeData.gameDate ? claudeData.gameDate.replace(/\//g, '-') : '';

  return {
    betA: {
      bettingHouse: claudeData.betA.bettingHouse || '',
      teamA: claudeData.teamA || '',
      teamB: claudeData.teamB || '',
      betType: claudeData.betA.betType || '',
      odds: claudeData.betA.odds || '0',
      stake: claudeData.betA.stake || '0',
      profit: claudeData.betA.profit || '0'
    },
    betB: {
      bettingHouse: claudeData.betB.bettingHouse || '',
      teamA: claudeData.teamA || '',
      teamB: claudeData.teamB || '',
      betType: claudeData.betB.betType || '',
      odds: claudeData.betB.odds || '0',
      stake: claudeData.betB.stake || '0',
      profit: claudeData.betB.profit || '0'
    },
    gameDate: gameDate,
    gameTime: claudeData.gameTime || '00:00',
    sport: claudeData.sport || '',
    league: claudeData.league || '',
    totalProfitPercentage: cleanPercentage
  };
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
    },
    {
      title: 'Teste Upload',
      icon: TestTube,
      id: 'test-upload' as AppState,
      active: currentState === 'test-upload'
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
      const payoutA = Number(data.betA.stake) * Number(data.betA.odds);
      const payoutB = Number(data.betB.stake) * Number(data.betB.odds);
      const totalStake = stakeA + stakeB;
      // Profit percentage if this bet wins: (winning payout - total invested) / total invested
      const profitPercentageA = totalStake > 0 ? ((payoutA - totalStake) / totalStake) * 100 : 0;
      const profitPercentageB = totalStake > 0 ? ((payoutB - totalStake) / totalStake) * 100 : 0;
      
      // Helper function to ensure gameDate is in DD-MM-YYYY string format
      const formatGameDate = (gameDate: string | Date): string => {
        if (gameDate instanceof Date) {
          const day = gameDate.getUTCDate().toString().padStart(2, '0');
          const month = (gameDate.getUTCMonth() + 1).toString().padStart(2, '0');
          const year = gameDate.getUTCFullYear().toString();
          return `${day}-${month}-${year}`;
        }
        // If it's already a string, ensure it's in DD-MM-YYYY format
        if (typeof gameDate === 'string') {
          if (gameDate.includes('/')) {
            // Convert DD/MM/YYYY to DD-MM-YYYY
            return gameDate.replace(/\//g, '-');
          }
          return gameDate; // Already in DD-MM-YYYY format
        }
        return '';
      };

      // Create bet A via API
      const betAData = {
        bettingHouse: data.betA.bettingHouse,
        teamA: data.betA.teamA,
        teamB: data.betA.teamB,
        betType: data.betA.betType,
        selectedSide: data.betA.betType, // Use bet type as selected side for now
        odds: data.betA.odds,
        stake: data.betA.stake,
        payout: (Number(data.betA.stake) * Number(data.betA.odds)).toFixed(2),
        gameDate: formatGameDate(data.gameDate),
        gameTime: data.gameTime || '00:00',
        sport: data.sport,
        league: data.league,
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
        selectedSide: data.betB.betType, // Use bet type as selected side for now
        odds: data.betB.odds,
        stake: data.betB.stake,
        payout: (Number(data.betB.stake) * Number(data.betB.odds)).toFixed(2),
        gameDate: formatGameDate(data.gameDate),
        gameTime: data.gameTime || '00:00',
        sport: data.sport,
        league: data.league,
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
      
      case 'test-upload':
        return <TestUpload />;
      
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