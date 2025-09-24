import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, DollarSign, Target, Filter, Search, Plus } from 'lucide-react';
import BetCard from './BetCard';
import { Bet } from '@shared/schema';

interface DashboardProps {
  bets: Bet[];
  onResolveBet: (betId: string, status: 'won' | 'lost' | 'returned') => void;
  onAddBet: () => void;
}

export default function Dashboard({ bets, onResolveBet, onAddBet }: DashboardProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<string>('date');

  // Filter and sort bets
  const filteredBets = bets
    .filter(bet => {
      const matchesStatus = statusFilter === 'all' || bet.status === statusFilter;
      const matchesSearch = bet.bettingHouse.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           bet.betType.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesStatus && matchesSearch;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(b.gameDate).getTime() - new Date(a.gameDate).getTime();
        case 'stake':
          return Number(b.stake) - Number(a.stake);
        case 'odds':
          return Number(b.odds) - Number(a.odds);
        default:
          return 0;
      }
    });

  // Calculate statistics
  const stats = {
    totalBets: bets.length,
    pendingBets: bets.filter(bet => bet.status === 'pending').length,
    wonBets: bets.filter(bet => bet.status === 'won').length,
    lostBets: bets.filter(bet => bet.status === 'lost').length,
    totalStaked: bets.reduce((acc, bet) => acc + Number(bet.stake), 0),
    totalProfit: bets
      .filter(bet => bet.status === 'won')
      .reduce((acc, bet) => acc + (Number(bet.payout) - Number(bet.stake)), 0),
    totalLoss: bets
      .filter(bet => bet.status === 'lost')
      .reduce((acc, bet) => acc + Number(bet.stake), 0)
  };

  const netProfit = stats.totalProfit - stats.totalLoss;
  const winRate = stats.totalBets > 0 ? ((stats.wonBets / (stats.wonBets + stats.lostBets)) * 100) : 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-dashboard-title">
            Painel de Apostas
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie e acompanhe suas apostas esportivas
          </p>
        </div>
        <Button onClick={onAddBet} size="lg" data-testid="button-add-bet">
          <Plus className="w-5 h-5 mr-2" />
          Nova Aposta
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Apostas</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-bets">
              {stats.totalBets}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.pendingBets} pendentes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total Apostado</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-staked">
              {formatCurrency(stats.totalStaked)}
            </div>
            <p className="text-xs text-muted-foreground">
              Total investido
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lucro/Prejuízo</CardTitle>
            {netProfit >= 0 ? (
              <TrendingUp className="h-4 w-4 text-success" />
            ) : (
              <TrendingDown className="h-4 w-4 text-destructive" />
            )}
          </CardHeader>
          <CardContent>
            <div 
              className={`text-2xl font-bold ${
                netProfit >= 0 ? 'text-success' : 'text-destructive'
              }`}
              data-testid="text-net-profit"
            >
              {formatCurrency(netProfit)}
            </div>
            <p className="text-xs text-muted-foreground">
              {netProfit >= 0 ? 'Lucro líquido' : 'Prejuízo líquido'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Acerto</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-win-rate">
              {winRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.wonBets} vitórias de {stats.wonBets + stats.lostBets} finalizadas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Buscar por casa de aposta ou tipo de aposta..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-bets"
                />
              </div>
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48" data-testid="select-status-filter">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="won">Ganhas</SelectItem>
                <SelectItem value="lost">Perdidas</SelectItem>
                <SelectItem value="returned">Devolvidas</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full sm:w-48" data-testid="select-sort-by">
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Data do jogo</SelectItem>
                <SelectItem value="stake">Valor apostado</SelectItem>
                <SelectItem value="odds">Odds</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Bets Grid */}
      {filteredBets.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Target className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2" data-testid="text-no-bets">
              {bets.length === 0 ? 'Nenhuma aposta cadastrada' : 'Nenhuma aposta encontrada'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {bets.length === 0 
                ? 'Comece adicionando sua primeira aposta com um comprovante'
                : 'Tente ajustar os filtros para encontrar suas apostas'
              }
            </p>
            {bets.length === 0 && (
              <Button onClick={onAddBet} data-testid="button-add-first-bet">
                <Plus className="w-4 h-4 mr-2" />
                Adicionar primeira aposta
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBets.map((bet) => {
            // Find the paired bet
            const pairedBet = bets.find(b => 
              b.pairId === bet.pairId && 
              b.id !== bet.id
            );
            
            return (
              <BetCard
                key={bet.id}
                bet={bet}
                pairedBet={pairedBet}
                onResolve={onResolveBet}
                showResolveActions={bet.status === 'pending'}
              />
            );
          })}
        </div>
      )}

      {filteredBets.length > 0 && (
        <div className="text-center text-sm text-muted-foreground">
          Mostrando {filteredBets.length} de {bets.length} apostas
        </div>
      )}
    </div>
  );
}