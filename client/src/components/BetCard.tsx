import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, TrendingUp, TrendingDown, Clock, CheckCircle2, XCircle, RotateCcw, Link2, Target, Users } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Bet } from '@shared/schema';

interface BetCardProps {
  bet: Bet;
  pairedBet?: Bet; // The opposing bet in the pair
  onResolve: (betId: string, status: 'won' | 'lost' | 'returned') => void;
  showResolveActions?: boolean;
}

export default function BetCard({ bet, pairedBet, onResolve, showResolveActions = true }: BetCardProps) {
  const statusConfig = {
    pending: {
      icon: Clock,
      label: 'Pendente',
      className: 'bg-warning text-warning-foreground',
      textColor: 'text-warning'
    },
    won: {
      icon: CheckCircle2,
      label: 'Ganhou',
      className: 'bg-success text-success-foreground',
      textColor: 'text-success'
    },
    lost: {
      icon: XCircle,
      label: 'Perdeu',
      className: 'bg-destructive text-destructive-foreground',
      textColor: 'text-destructive'
    },
    returned: {
      icon: RotateCcw,
      label: 'Devolvido',
      className: 'bg-muted text-muted-foreground',
      textColor: 'text-muted-foreground'
    }
  };

  const config = statusConfig[bet.status];
  const StatusIcon = config.icon;
  
  const formatCurrency = (value: string | number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(Number(value));
  };

  const formatDate = (date: Date) => {
    return format(new Date(date), 'dd/MM/yyyy às HH:mm', { locale: ptBR });
  };

  const calculateNetProfit = () => {
    const stake = Number(bet.stake);
    const payout = Number(bet.payout);
    return payout - stake;
  };

  const getSelectedTeam = () => {
    return bet.selectedSide === 'A' ? bet.teamA : bet.teamB;
  };

  const getBetPositionInfo = () => {
    const isA = bet.betPosition === 'A';
    return {
      label: `Aposta ${bet.betPosition}`,
      color: isA ? 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-700' : 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900 dark:text-green-200 dark:border-green-700'
    };
  };

  const getPairProfitInfo = () => {
    if (!bet.totalPairStake || !bet.profitPercentage) return null;
    
    const totalStake = Number(bet.totalPairStake);
    const profitPercentage = Number(bet.profitPercentage);
    const payout = Number(bet.payout);
    const netProfit = payout - totalStake;
    
    return {
      totalStake,
      profitPercentage,
      netProfit,
      isPositive: netProfit > 0
    };
  };

  const positionInfo = getBetPositionInfo();
  const pairInfo = getPairProfitInfo();

  return (
    <Card className="hover-elevate transition-all duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="font-medium">
                {bet.bettingHouse}
              </Badge>
              <Badge className={config.className}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {config.label}
              </Badge>
              <Badge variant="outline" className={positionInfo.color}>
                <Target className="w-3 h-3 mr-1" />
                {positionInfo.label}
              </Badge>
              {pairedBet && (
                <Badge variant="outline" className="text-muted-foreground">
                  <Link2 className="w-3 h-3 mr-1" />
                  Par
                </Badge>
              )}
            </div>
            
            {/* Teams Display */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{bet.teamA} vs {bet.teamB}</span>
              </div>
              <div className="text-sm text-muted-foreground">
                Apostou em: <span className="font-medium text-foreground">{getSelectedTeam()}</span>
              </div>
            </div>
            
            <h3 className="font-semibold text-base leading-tight" data-testid={`text-bet-type-${bet.id}`}>
              {bet.betType}
            </h3>
          </div>
          
          <div className="text-right">
            <div className="text-2xl font-bold" data-testid={`text-odds-${bet.id}`}>
              {Number(bet.odds).toFixed(2)}
            </div>
            <div className="text-xs text-muted-foreground">odd</div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Financial Information */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Valor apostado</div>
            <div className="font-semibold text-lg" data-testid={`text-stake-${bet.id}`}>
              {formatCurrency(bet.stake)}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Retorno potencial</div>
            <div className="font-semibold text-lg" data-testid={`text-payout-${bet.id}`}>
              {formatCurrency(bet.payout)}
            </div>
          </div>
        </div>

        {/* Pair Information */}
        {pairInfo && (
          <div className="p-3 bg-muted/50 rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Link2 className="w-4 h-4" />
              Informações do Par
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Total investido</div>
                <div className="font-semibold">{formatCurrency(pairInfo.totalStake)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">ROI se ganhar</div>
                <div className={`font-semibold flex items-center gap-1 ${pairInfo.isPositive ? 'text-success' : 'text-destructive'}`}>
                  {pairInfo.isPositive ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  {pairInfo.profitPercentage.toFixed(2)}%
                </div>
              </div>
            </div>
            {pairInfo.isPositive && (
              <div className="text-xs text-muted-foreground">
                Lucro líquido: {formatCurrency(pairInfo.netProfit)}
              </div>
            )}
          </div>
        )}

        {/* Paired Bet Info */}
        {pairedBet && (
          <div className="p-3 border rounded-lg space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="font-medium">Aposta pareada ({pairedBet.betPosition})</div>
              <Badge className={statusConfig[pairedBet.status].className}>
                {statusConfig[pairedBet.status].label}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">{pairedBet.bettingHouse}</div>
                <div className="font-medium">{pairedBet.selectedSide === 'A' ? pairedBet.teamA : pairedBet.teamB}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Odd {Number(pairedBet.odds).toFixed(2)}</div>
                <div className="font-medium">{formatCurrency(pairedBet.stake)}</div>
              </div>
            </div>
          </div>
        )}

        {/* Game Date */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="w-4 h-4" />
          <span data-testid={`text-game-date-${bet.id}`}>
            {formatDate(bet.gameDate)}
          </span>
        </div>

        {/* Resolve Actions */}
        {showResolveActions && bet.status === 'pending' && (
          <div className="flex gap-2 pt-2">
            <Button
              size="sm"
              variant="default"
              onClick={() => onResolve(bet.id, 'won')}
              className="flex-1 bg-success hover:bg-success/90 text-success-foreground"
              data-testid={`button-resolve-won-${bet.id}`}
            >
              <CheckCircle2 className="w-4 h-4 mr-1" />
              Ganhou
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => onResolve(bet.id, 'lost')}
              className="flex-1"
              data-testid={`button-resolve-lost-${bet.id}`}
            >
              <XCircle className="w-4 h-4 mr-1" />
              Perdeu
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onResolve(bet.id, 'returned')}
              data-testid={`button-resolve-returned-${bet.id}`}
            >
              <RotateCcw className="w-4 h-4 mr-1" />
              Devolvido
            </Button>
          </div>
        )}

        {/* Result Display */}
        {bet.status !== 'pending' && (
          <div className={`p-3 rounded-lg border text-center ${config.textColor}`}>
            <StatusIcon className="w-5 h-5 mx-auto mb-1" />
            <div className="font-medium">
              {bet.status === 'won' && pairInfo && (
                <>
                  <div>Lucro líquido: {formatCurrency(pairInfo.netProfit)}</div>
                  <div className="text-xs mt-1">ROI: {pairInfo.profitPercentage.toFixed(2)}%</div>
                </>
              )}
              {bet.status === 'won' && !pairInfo && (
                `Lucro: ${formatCurrency(calculateNetProfit())}`
              )}
              {bet.status === 'lost' && `Perda: ${formatCurrency(bet.stake)}`}
              {bet.status === 'returned' && `Valor devolvido: ${formatCurrency(bet.stake)}`}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}