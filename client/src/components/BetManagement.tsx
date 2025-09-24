import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, TrendingUp, TrendingDown, Clock, CheckCircle2, XCircle, RotateCcw, Settings } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Bet } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';

export default function BetManagement() {
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    loadBets();
  }, []);

  const loadBets = async () => {
    try {
      setLoading(true);
      const response = await apiRequest('GET', '/api/bets');
      const betsData = await response.json();
      setBets(betsData);
    } catch (err) {
      console.error('Error loading bets:', err);
      setError('Erro ao carregar apostas');
    } finally {
      setLoading(false);
    }
  };

  const updateBetStatus = async (betId: string, status: 'pending' | 'won' | 'lost' | 'returned') => {
    try {
      await apiRequest('PUT', `/api/bets/${betId}/status`, { status });
      await loadBets(); // Reload bets after update
    } catch (err) {
      console.error('Error updating bet status:', err);
      setError('Erro ao atualizar status da aposta');
    }
  };

  const groupBetsByPair = (bets: Bet[]) => {
    const pairs: { [key: string]: Bet[] } = {};
    bets.forEach(bet => {
      if (!pairs[bet.pairId]) {
        pairs[bet.pairId] = [];
      }
      pairs[bet.pairId].push(bet);
    });
    return Object.values(pairs).filter(pair => pair.length === 2);
  };

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

  const formatCurrency = (value: string | number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(Number(value));
  };

  const formatDate = (date: Date) => {
    return format(new Date(date), 'dd/MM/yyyy às HH:mm', { locale: ptBR });
  };

  const calculatePairStatus = (betA: Bet, betB: Bet) => {
    if (betA.status === 'pending' || betB.status === 'pending') {
      return 'pending';
    }
    if (betA.status === 'won' || betB.status === 'won') {
      return 'resolved';
    }
    return 'resolved';
  };

  const renderBetPair = (betPair: Bet[]) => {
    const [betA, betB] = betPair.sort((a, b) => a.betPosition === 'A' ? -1 : 1);
    const pairStatus = calculatePairStatus(betA, betB);
    
    return (
      <Card key={betA.pairId} className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              {betA.teamA} vs {betA.teamB}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {formatDate(betA.gameDate)}
              </Badge>
              <Badge className={pairStatus === 'pending' ? 'bg-warning' : 'bg-success'}>
                {pairStatus === 'pending' ? 'Pendente' : 'Resolvido'}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Bet A */}
            <div className="border rounded-lg p-4 border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-blue-600">Aposta A - {betA.bettingHouse}</h4>
                <Badge className={statusConfig[betA.status].className}>
                  {React.createElement(statusConfig[betA.status].icon, { className: 'w-3 h-3 mr-1' })}
                  {statusConfig[betA.status].label}
                </Badge>
              </div>
              <div className="space-y-2 text-sm">
                <div><strong>Tipo:</strong> {betA.betType}</div>
                <div><strong>Odd:</strong> {betA.odds}</div>
                <div><strong>Valor:</strong> {formatCurrency(betA.stake)}</div>
                <div><strong>Retorno:</strong> {formatCurrency(betA.payout)}</div>
              </div>
              {betA.status === 'pending' && (
                <div className="flex gap-2 mt-3">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="text-success border-success hover:bg-success/10"
                    onClick={() => updateBetStatus(betA.id, 'won')}
                  >
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Ganhou
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="text-destructive border-destructive hover:bg-destructive/10"
                    onClick={() => updateBetStatus(betA.id, 'lost')}
                  >
                    <XCircle className="w-3 h-3 mr-1" />
                    Perdeu
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="text-muted-foreground border-muted-foreground hover:bg-muted/10"
                    onClick={() => updateBetStatus(betA.id, 'returned')}
                  >
                    <RotateCcw className="w-3 h-3 mr-1" />
                    Devolvido
                  </Button>
                </div>
              )}
            </div>

            {/* Bet B */}
            <div className="border rounded-lg p-4 border-green-200 dark:border-green-800">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-green-600">Aposta B - {betB.bettingHouse}</h4>
                <Badge className={statusConfig[betB.status].className}>
                  {React.createElement(statusConfig[betB.status].icon, { className: 'w-3 h-3 mr-1' })}
                  {statusConfig[betB.status].label}
                </Badge>
              </div>
              <div className="space-y-2 text-sm">
                <div><strong>Tipo:</strong> {betB.betType}</div>
                <div><strong>Odd:</strong> {betB.odds}</div>
                <div><strong>Valor:</strong> {formatCurrency(betB.stake)}</div>
                <div><strong>Retorno:</strong> {formatCurrency(betB.payout)}</div>
              </div>
              {betB.status === 'pending' && (
                <div className="flex gap-2 mt-3">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="text-success border-success hover:bg-success/10"
                    onClick={() => updateBetStatus(betB.id, 'won')}
                  >
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Ganhou
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="text-destructive border-destructive hover:bg-destructive/10"
                    onClick={() => updateBetStatus(betB.id, 'lost')}
                  >
                    <XCircle className="w-3 h-3 mr-1" />
                    Perdeu
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="text-muted-foreground border-muted-foreground hover:bg-muted/10"
                    onClick={() => updateBetStatus(betB.id, 'returned')}
                  >
                    <RotateCcw className="w-3 h-3 mr-1" />
                    Devolvido
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Pair Summary */}
          {betA.totalPairStake && betA.profitPercentage && (
            <div className="mt-4 p-3 bg-muted/30 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Total Investido:</span>
                <span className="font-bold">{formatCurrency(betA.totalPairStake)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Lucro Esperado:</span>
                <span className="font-bold text-success">{Number(betA.profitPercentage).toFixed(2)}%</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Carregando apostas...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <p className="text-destructive">{error}</p>
          <Button onClick={loadBets} className="mt-2">
            Tentar Novamente
          </Button>
        </div>
      </div>
    );
  }

  const betPairs = groupBetsByPair(bets);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Gestão de Apostas</h1>
        <Button onClick={loadBets} variant="outline">
          <RotateCcw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {betPairs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Nenhuma aposta encontrada.</p>
          </CardContent>
        </Card>
      ) : (
        <div>
          {betPairs.map(renderBetPair)}
        </div>
      )}
    </div>
  );
}