import { useState } from 'react';
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { Home, Upload, BarChart3, Settings, Target } from 'lucide-react';
import { OCRData, Bet } from '@shared/schema';
import ImageUpload from './ImageUpload';
import OCRVerification from './OCRVerification';
import Dashboard from './Dashboard';
import { ThemeToggle } from './ThemeToggle';

type AppState = 'upload' | 'verification' | 'dashboard';

// Mock OCR function //todo: remove mock functionality
const mockOCRProcess = (file: File): Promise<OCRData> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        betA: {
          bettingHouse: 'Bet365',
          teamA: 'Barcelona',
          teamB: 'Real Madrid',
          betType: '1x2 - Vitória do Mandante',
          selectedSide: 'A',
          odds: '2.75',
          stake: '150.00',
          payout: '412.50'
        },
        betB: {
          bettingHouse: 'Betano',
          teamA: 'Barcelona',
          teamB: 'Real Madrid',
          betType: '1x2 - Vitória do Visitante',
          selectedSide: 'B',
          odds: '3.20',
          stake: '125.00',
          payout: '400.00'
        },
        gameDate: new Date('2024-12-15T20:00:00'),
        gameTime: '20:00'
      });
    }, 2000);
  });
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
      title: 'Relatórios',
      icon: BarChart3,
      id: 'dashboard' as AppState, // For now, redirect to dashboard
      active: false
    }
  ];

  const handleImageUpload = async (file: File) => {
    setIsProcessing(true);
    
    // Create image URL for preview
    const imageUrl = URL.createObjectURL(file);
    setCurrentImageUrl(imageUrl);
    
    try {
      // Mock OCR processing //todo: replace with actual OCR
      const ocrData = await mockOCRProcess(file);
      setCurrentOCRData(ocrData);
      setCurrentState('verification');
    } catch (error) {
      console.error('OCR processing failed:', error);
      // Handle error - could show toast notification
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOCRConfirm = (data: OCRData) => {
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
    
    // Create bet A //todo: replace with API call
    const betA: Bet = {
      id: Math.random().toString(36).substr(2, 9),
      bettingHouse: data.betA.bettingHouse,
      teamA: data.betA.teamA,
      teamB: data.betA.teamB,
      betType: data.betA.betType,
      selectedSide: data.betA.selectedSide,
      odds: data.betA.odds,
      stake: data.betA.stake,
      payout: data.betA.payout,
      gameDate: data.gameDate,
      status: 'pending',
      isVerified: true,
      pairId: pairId,
      betPosition: 'A',
      totalPairStake: totalStake.toString(),
      profitPercentage: profitPercentageA.toString(),
      createdAt: new Date()
    };
    
    // Create bet B //todo: replace with API call
    const betB: Bet = {
      id: Math.random().toString(36).substr(2, 9),
      bettingHouse: data.betB.bettingHouse,
      teamA: data.betB.teamA,
      teamB: data.betB.teamB,
      betType: data.betB.betType,
      selectedSide: data.betB.selectedSide,
      odds: data.betB.odds,
      stake: data.betB.stake,
      payout: data.betB.payout,
      gameDate: data.gameDate,
      status: 'pending',
      isVerified: true,
      pairId: pairId,
      betPosition: 'B',
      totalPairStake: totalStake.toString(),
      profitPercentage: profitPercentageB.toString(),
      createdAt: new Date()
    };
    
    setBets(prev => [betA, betB, ...prev]);
    
    // Clean up and navigate to dashboard
    setCurrentImageUrl('');
    setCurrentOCRData(null);
    setCurrentState('dashboard');
    
    console.log('Bet pair saved:', { betA, betB });
  };

  const handleOCRCancel = () => {
    setCurrentImageUrl('');
    setCurrentOCRData(null);
    setCurrentState('upload');
  };

  const handleResolveBet = (betId: string, status: 'won' | 'lost' | 'returned') => {
    //todo: replace with API call
    setBets(prev => {
      const updatedBets = prev.map(bet => {
        if (bet.id === betId) {
          return { ...bet, status };
        }
        return bet;
      });
      
      // If this bet won, automatically set its pair to lost (for opposing bets)
      if (status === 'won') {
        const resolvedBet = prev.find(bet => bet.id === betId);
        if (resolvedBet?.pairId) {
          return updatedBets.map(bet => {
            if (bet.pairId === resolvedBet.pairId && bet.id !== betId && bet.status === 'pending') {
              return { ...bet, status: 'lost' };
            }
            return bet;
          });
        }
      }
      
      return updatedBets;
    });
    console.log(`Bet ${betId} resolved as: ${status}`);
  };

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