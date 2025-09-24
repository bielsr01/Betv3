import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, Filter, Download, TrendingUp, TrendingDown, Target, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Bet } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';

interface ReportFilters {
  status: 'all' | 'pending' | 'won' | 'lost' | 'returned';
  dateFrom?: Date;
  dateTo?: Date;
  minStake?: number;
  maxStake?: number;
  minProfit?: number;
  maxProfit?: number;
}

export default function Reports() {
  const [bets, setBets] = useState<Bet[]>([]);
  const [filteredBets, setFilteredBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [filters, setFilters] = useState<ReportFilters>({
    status: 'all',
  });

  useEffect(() => {
    loadBets();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [bets, filters]);

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

  const applyFilters = () => {
    let filtered = [...bets];

    // Filter by status
    if (filters.status && filters.status !== 'all') {
      filtered = filtered.filter(bet => bet.status === filters.status);
    }

    // Filter by date range
    if (filters.dateFrom) {
      filtered = filtered.filter(bet => new Date(bet.gameDate) >= filters.dateFrom!);
    }
    if (filters.dateTo) {
      filtered = filtered.filter(bet => new Date(bet.gameDate) <= filters.dateTo!);
    }

    // Filter by stake range
    if (filters.minStake !== undefined) {
      filtered = filtered.filter(bet => Number(bet.stake) >= filters.minStake!);
    }
    if (filters.maxStake !== undefined) {
      filtered = filtered.filter(bet => Number(bet.stake) <= filters.maxStake!);
    }

    // Filter by profit range
    if (filters.minProfit !== undefined) {
      filtered = filtered.filter(bet => {
        const profit = Number(bet.payout) - Number(bet.stake);
        return profit >= filters.minProfit!;
      });
    }
    if (filters.maxProfit !== undefined) {
      filtered = filtered.filter(bet => {
        const profit = Number(bet.payout) - Number(bet.stake);
        return profit <= filters.maxProfit!;
      });
    }

    setFilteredBets(filtered);
  };

  const clearFilters = () => {
    setFilters({
      status: 'all',
    });
  };

  const calculateSummary = () => {
    const grouped = groupBetsByPair(filteredBets);
    
    let totalStake = 0;
    let totalPayout = 0;
    let resolvedPairs = 0;
    let pendingPairs = 0;
    let wonPairs = 0;
    let lostPairs = 0;
    
    grouped.forEach(pair => {
      const [betA, betB] = pair;
      const pairStake = Number(betA.stake) + Number(betB.stake);
      totalStake += pairStake;
      
      if (betA.status === 'pending' || betB.status === 'pending') {
        pendingPairs++;
      } else {
        resolvedPairs++;
        if (betA.status === 'won' || betB.status === 'won') {
          wonPairs++;
          const winningBet = betA.status === 'won' ? betA : betB;
          totalPayout += Number(winningBet.payout);
        } else {
          lostPairs++;
        }
      }
    });
    
    const totalProfit = totalPayout - totalStake;
    const profitPercentage = totalStake > 0 ? (totalProfit / totalStake) * 100 : 0;
    
    return {
      totalPairs: grouped.length,
      pendingPairs,
      resolvedPairs,
      wonPairs,
      lostPairs,
      totalStake,
      totalPayout,
      totalProfit,
      profitPercentage
    };
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (date: Date) => {
    return format(new Date(date), 'dd/MM/yyyy', { locale: ptBR });
  };

  const statusConfig = {
    pending: { label: 'Pendente', className: 'bg-warning text-warning-foreground' },
    won: { label: 'Ganhou', className: 'bg-success text-success-foreground' },
    lost: { label: 'Perdeu', className: 'bg-destructive text-destructive-foreground' },
    returned: { label: 'Devolvido', className: 'bg-muted text-muted-foreground' }
  };

  const summary = calculateSummary();
  const betPairs = groupBetsByPair(filteredBets);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Carregando relatórios...</p>
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <Button onClick={loadBets} variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Atualizar Dados
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value as any }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="won">Ganhou</SelectItem>
                  <SelectItem value="lost">Perdeu</SelectItem>
                  <SelectItem value="returned">Devolvido</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Data Inicial</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.dateFrom ? format(filters.dateFrom, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecionar'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={filters.dateFrom}
                    onSelect={(date) => setFilters(prev => ({ ...prev, dateFrom: date }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Data Final</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.dateTo ? format(filters.dateTo, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecionar'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={filters.dateTo}
                    onSelect={(date) => setFilters(prev => ({ ...prev, dateTo: date }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex items-end">
              <Button onClick={clearFilters} variant="outline" className="w-full">
                Limpar Filtros
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            <div className="space-y-2">
              <Label>Valor Mín. (R$)</Label>
              <Input
                type="number"
                placeholder="0"
                value={filters.minStake || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, minStake: e.target.value ? Number(e.target.value) : undefined }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Valor Máx. (R$)</Label>
              <Input
                type="number"
                placeholder="999999"
                value={filters.maxStake || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, maxStake: e.target.value ? Number(e.target.value) : undefined }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Lucro Mín. (R$)</Label>
              <Input
                type="number"
                placeholder="0"
                value={filters.minProfit || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, minProfit: e.target.value ? Number(e.target.value) : undefined }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Lucro Máx. (R$)</Label>
              <Input
                type="number"
                placeholder="999999"
                value={filters.maxProfit || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, maxProfit: e.target.value ? Number(e.target.value) : undefined }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Target className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total de Pares</p>
                <p className="text-2xl font-bold">{summary.totalPairs}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Investido</p>
                <p className="text-2xl font-bold">{formatCurrency(summary.totalStake)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              {summary.totalProfit >= 0 ? (
                <TrendingUp className="h-8 w-8 text-green-600" />
              ) : (
                <TrendingDown className="h-8 w-8 text-red-600" />
              )}
              <div>
                <p className="text-sm font-medium text-muted-foreground">Lucro Total</p>
                <p className={`text-2xl font-bold ${summary.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(summary.totalProfit)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              {summary.profitPercentage >= 0 ? (
                <TrendingUp className="h-8 w-8 text-green-600" />
              ) : (
                <TrendingDown className="h-8 w-8 text-red-600" />
              )}
              <div>
                <p className="text-sm font-medium text-muted-foreground">Rentabilidade</p>
                <p className={`text-2xl font-bold ${summary.profitPercentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {summary.profitPercentage.toFixed(2)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Table */}
      <Card>
        <CardHeader>
          <CardTitle>Apostas Detalhadas</CardTitle>
        </CardHeader>
        <CardContent>
          {betPairs.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Nenhuma aposta encontrada com os filtros aplicados.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {betPairs.map(pair => {
                const [betA, betB] = pair.sort((a, b) => a.betPosition === 'A' ? -1 : 1);
                const pairStake = Number(betA.stake) + Number(betB.stake);
                const pairProfit = betA.status === 'won' ? Number(betA.payout) - pairStake :
                                 betB.status === 'won' ? Number(betB.payout) - pairStake : 0;
                
                return (
                  <div key={betA.pairId} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold">{betA.teamA} vs {betA.teamB}</h4>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{formatDate(betA.gameDate)}</Badge>
                        <Badge className={
                          (betA.status === 'pending' || betB.status === 'pending') ? 'bg-warning' : 
                          pairProfit > 0 ? 'bg-success' : 'bg-destructive'
                        }>
                          {(betA.status === 'pending' || betB.status === 'pending') ? 'Pendente' :
                           pairProfit > 0 ? 'Lucro' : 'Prejuízo'}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-blue-600">Aposta A - {betA.bettingHouse}</p>
                        <div className="flex justify-between text-sm">
                          <span>Tipo:</span>
                          <span>{betA.betType}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Odd:</span>
                          <span>{betA.odds}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Valor:</span>
                          <span>{formatCurrency(Number(betA.stake))}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Status:</span>
                          <Badge className={statusConfig[betA.status].className}>
                            {statusConfig[betA.status].label}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-green-600">Aposta B - {betB.bettingHouse}</p>
                        <div className="flex justify-between text-sm">
                          <span>Tipo:</span>
                          <span>{betB.betType}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Odd:</span>
                          <span>{betB.odds}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Valor:</span>
                          <span>{formatCurrency(Number(betB.stake))}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Status:</span>
                          <Badge className={statusConfig[betB.status].className}>
                            {statusConfig[betB.status].label}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    
                    <div className="border-t pt-3 mt-3">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Total Investido:</span>
                        <span className="font-bold">{formatCurrency(pairStake)}</span>
                      </div>
                      {(betA.status !== 'pending' && betB.status !== 'pending') && (
                        <div className="flex justify-between items-center">
                          <span className="font-medium">Resultado:</span>
                          <span className={`font-bold ${pairProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(pairProfit)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}