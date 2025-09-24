import BetCard from '../BetCard';
import { Bet } from '@shared/schema';

export default function BetCardExample() {
  // Mock bet data
  const mockBet: Bet = {
    id: '1',
    bettingHouse: 'Bet365',
    teamA: 'Barcelona',
    teamB: 'Real Madrid',
    betType: '1x2 - Vitória do Mandante',
    selectedSide: 'A',
    odds: '2.75',
    stake: '150.00',
    payout: '412.50',
    gameDate: new Date('2024-12-15T20:00:00'),
    status: 'pending',
    isVerified: true,
    pairId: 'pair-123',
    betPosition: 'A',
    totalPairStake: '275.00',
    profitPercentage: '30.00',
    createdAt: new Date()
  };

  // Mock paired bet
  const mockPairedBet: Bet = {
    id: '2',
    bettingHouse: 'Betano',
    teamA: 'Barcelona',
    teamB: 'Real Madrid',
    betType: '1x2 - Vitória do Visitante',
    selectedSide: 'B',
    odds: '3.20',
    stake: '125.00',
    payout: '400.00',
    gameDate: new Date('2024-12-15T20:00:00'),
    status: 'pending',
    isVerified: true,
    pairId: 'pair-123',
    betPosition: 'B',
    totalPairStake: '275.00',
    profitPercentage: '45.45',
    createdAt: new Date()
  };

  const handleResolve = (betId: string, status: 'won' | 'lost' | 'returned') => {
    console.log(`Bet ${betId} resolved as: ${status}`);
  };

  return (
    <div className="max-w-md mx-auto p-4">
      <BetCard 
        bet={mockBet}
        pairedBet={mockPairedBet}
        onResolve={handleResolve}
        showResolveActions={true}
      />
    </div>
  );
}