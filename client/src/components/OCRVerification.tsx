import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, Check, X, ArrowLeft, Target } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { OCRData, SingleBetOCR } from '@shared/schema';

interface OCRVerificationProps {
  imageUrl: string;
  ocrData: OCRData;
  onConfirm: (data: OCRData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function OCRVerification({ 
  imageUrl, 
  ocrData, 
  onConfirm, 
  onCancel, 
  isLoading 
}: OCRVerificationProps) {
  // Initialize form data - Claude returns correct format, no conversion needed
  const initializeFormData = (data: OCRData): OCRData => {
    return { ...data };
  };

  const [formData, setFormData] = useState<OCRData>(initializeFormData(ocrData));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    // Validate Bet A
    if (!formData.betA.bettingHouse.trim()) newErrors['betA.bettingHouse'] = 'Casa de aposta é obrigatória';
    if (!formData.betA.teamA.trim()) newErrors['betA.teamA'] = 'Time A é obrigatório';
    if (!formData.betA.teamB.trim()) newErrors['betA.teamB'] = 'Time B é obrigatório';
    if (!formData.betA.betType.trim()) newErrors['betA.betType'] = 'Tipo de aposta é obrigatório';
    if (!formData.betA.odds || isNaN(Number(formData.betA.odds)) || Number(formData.betA.odds) <= 0) {
      newErrors['betA.odds'] = 'Odd deve ser um número válido maior que 0';
    }
    if (!formData.betA.stake || isNaN(Number(formData.betA.stake)) || Number(formData.betA.stake) <= 0) {
      newErrors['betA.stake'] = 'Valor da aposta deve ser um número válido maior que 0';
    }
    if (!formData.betA.profit || isNaN(Number(formData.betA.profit))) {
      newErrors['betA.profit'] = 'Lucro deve ser um número válido';
    }

    // Validate Bet B
    if (!formData.betB.bettingHouse.trim()) newErrors['betB.bettingHouse'] = 'Casa de aposta é obrigatória';
    if (!formData.betB.teamA.trim()) newErrors['betB.teamA'] = 'Time A é obrigatório';
    if (!formData.betB.teamB.trim()) newErrors['betB.teamB'] = 'Time B é obrigatório';
    if (!formData.betB.betType.trim()) newErrors['betB.betType'] = 'Tipo de aposta é obrigatório';
    if (!formData.betB.odds || isNaN(Number(formData.betB.odds)) || Number(formData.betB.odds) <= 0) {
      newErrors['betB.odds'] = 'Odd deve ser um número válido maior que 0';
    }
    if (!formData.betB.stake || isNaN(Number(formData.betB.stake)) || Number(formData.betB.stake) <= 0) {
      newErrors['betB.stake'] = 'Valor da aposta deve ser um número válido maior que 0';
    }
    if (!formData.betB.profit || isNaN(Number(formData.betB.profit))) {
      newErrors['betB.profit'] = 'Lucro deve ser um número válido';
    }

    // Validate Game Info
    if (!formData.gameDate) newErrors.gameDate = 'Data do jogo é obrigatória';
    if (!formData.sport || !formData.sport.trim()) newErrors.sport = 'Esporte é obrigatório';
    if (!formData.league || !formData.league.trim()) newErrors.league = 'Liga é obrigatória';
    if (!formData.totalProfitPercentage || isNaN(Number(formData.totalProfitPercentage))) {
      newErrors.totalProfitPercentage = 'Porcentagem de lucro total deve ser um número válido';
    }

    // Cross validation - normalize team names for comparison
    const normalizeTeam = (team: string) => team.trim().toLowerCase();
    if (normalizeTeam(formData.betA.teamA) !== normalizeTeam(formData.betB.teamA) || 
        normalizeTeam(formData.betA.teamB) !== normalizeTeam(formData.betB.teamB)) {
      newErrors.teams = 'Os times devem ser iguais em ambas as apostas';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      onConfirm(formData);
    }
  };

  const updateBetField = (bet: 'betA' | 'betB', field: keyof SingleBetOCR, value: string) => {
    setFormData(prev => ({
      ...prev,
      [bet]: { ...prev[bet], [field]: value }
    }));
    
    const errorKey = `${bet}.${field}`;
    if (errors[errorKey]) {
      setErrors(prev => ({ ...prev, [errorKey]: '' }));
    }
  };

  const updateGameField = (field: 'gameDate' | 'gameTime' | 'sport' | 'league' | 'totalProfitPercentage', value: Date | string) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      
      // If gameDate is being updated, synchronize the formatted date fields
      if (field === 'gameDate' && value instanceof Date) {
        // CORRIGIDO: Usar UTC methods para evitar timezone offset
        const day = value.getUTCDate().toString().padStart(2, '0');
        const month = (value.getUTCMonth() + 1).toString().padStart(2, '0');
        const year = value.getUTCFullYear().toString();
        
        updated.gameDateFormatted = `${day}-${month}-${year}`;
        
        // If we have a game time, combine it with the new date
        if (prev.gameTime) {
          updated.gameDateTime = `${day}-${month}-${year} ${prev.gameTime}`;
        } else {
          updated.gameDateTime = `${day}-${month}-${year}`;
        }
      }
      
      // If gameTime is being updated and we have a date, update the combined dateTime
      if (field === 'gameTime' && typeof value === 'string' && prev.gameDateFormatted) {
        updated.gameDateTime = `${prev.gameDateFormatted} ${value}`;
      }
      
      return updated;
    });
    
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // Helper function to get display date - shows only DD-MM-YYYY (without time)
  const getDisplayDate = () => {
    if (formData.gameDateFormatted) {
      // Show only DD-MM-YYYY format (no time)
      return formData.gameDateFormatted;
    }
    if (formData.gameDate) {
      // Handle DD/MM/YYYY format that Claude returns
      if (typeof formData.gameDate === 'string' && formData.gameDate.includes('/')) {
        // Convert DD/MM/YYYY to DD-MM-YYYY for display
        return formData.gameDate.replace(/\//g, '-');
      }
      // Fallback to standard date formatting (no time)
      try {
        // If gameDate is in DD-MM-YYYY format, convert to a proper Date object
        if (typeof formData.gameDate === 'string' && formData.gameDate.includes('-')) {
          const [day, month, year] = formData.gameDate.split('-');
          const date = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
          return format(date, 'dd-MM-yyyy', { locale: ptBR });
        }
        return format(new Date(formData.gameDate), 'dd-MM-yyyy', { locale: ptBR });
      } catch (error) {
        console.warn('Error formatting date:', formData.gameDate, error);
        // Return the original string if all else fails
        return typeof formData.gameDate === 'string' ? formData.gameDate : null;
      }
    }
    return null;
  };

  // Helper function to get calendar date - converts to proper Date object
  const getCalendarDate = () => {
    if (formData.gameDate) {
      // If gameDate is already a Date object, use it directly
      if (formData.gameDate instanceof Date) {
        return formData.gameDate;
      }
      // If gameDate is a string, handle both DD/MM/YYYY and DD-MM-YYYY formats
      if (typeof formData.gameDate === 'string') {
        let day: string, month: string, year: string;
        
        if (formData.gameDate.includes('/')) {
          // Handle DD/MM/YYYY format from Claude
          [day, month, year] = formData.gameDate.split('/');
        } else if (formData.gameDate.includes('-')) {
          // Handle DD-MM-YYYY format
          [day, month, year] = formData.gameDate.split('-');
        } else {
          console.warn('Unexpected date format:', formData.gameDate);
          return undefined;
        }
        
        // Convert to Date using UTC to avoid timezone offset
        try {
          return new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
        } catch (error) {
          console.warn('Error parsing date:', formData.gameDate, error);
          return undefined;
        }
      }
    }
    return undefined;
  };

  const renderBetForm = (bet: 'betA' | 'betB', title: string) => {
    const betData = formData[bet];
    const isA = bet === 'betA';
    
    return (
      <Card className={`${isA ? 'border-blue-200 dark:border-blue-800' : 'border-green-200 dark:border-green-800'}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className={`h-5 w-5 ${isA ? 'text-blue-600' : 'text-green-600'}`} />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Betting House */}
          <div className="space-y-2">
            <Label htmlFor={`${bet}-house`}>Casa de Aposta</Label>
            <Input
              id={`${bet}-house`}
              value={betData.bettingHouse}
              onChange={(e) => updateBetField(bet, 'bettingHouse', e.target.value)}
              placeholder="Ex: Bet365, Betano..."
              className={errors[`${bet}.bettingHouse`] ? 'border-destructive' : ''}
              data-testid={`input-${bet}-house`}
            />
            {errors[`${bet}.bettingHouse`] && (
              <p className="text-sm text-destructive">{errors[`${bet}.bettingHouse`]}</p>
            )}
          </div>

          {/* Teams */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label htmlFor={`${bet}-teamA`}>Time A (Casa)</Label>
              <Input
                id={`${bet}-teamA`}
                value={betData.teamA}
                onChange={(e) => updateBetField(bet, 'teamA', e.target.value)}
                placeholder="Time da casa"
                className={errors[`${bet}.teamA`] ? 'border-destructive' : ''}
                data-testid={`input-${bet}-teamA`}
              />
              {errors[`${bet}.teamA`] && (
                <p className="text-sm text-destructive">{errors[`${bet}.teamA`]}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${bet}-teamB`}>Time B (Visitante)</Label>
              <Input
                id={`${bet}-teamB`}
                value={betData.teamB}
                onChange={(e) => updateBetField(bet, 'teamB', e.target.value)}
                placeholder="Time visitante"
                className={errors[`${bet}.teamB`] ? 'border-destructive' : ''}
                data-testid={`input-${bet}-teamB`}
              />
              {errors[`${bet}.teamB`] && (
                <p className="text-sm text-destructive">{errors[`${bet}.teamB`]}</p>
              )}
            </div>
          </div>

          {/* Bet Type */}
          <div className="space-y-2">
            <Label htmlFor={`${bet}-type`}>Tipo de Aposta</Label>
            <Input
              id={`${bet}-type`}
              value={betData.betType}
              onChange={(e) => updateBetField(bet, 'betType', e.target.value)}
              placeholder="Ex: 1x2, Over/Under, Handicap..."
              className={errors[`${bet}.betType`] ? 'border-destructive' : ''}
              data-testid={`input-${bet}-type`}
            />
            {errors[`${bet}.betType`] && (
              <p className="text-sm text-destructive">{errors[`${bet}.betType`]}</p>
            )}
          </div>

          {/* Note: selectedSide field removed from schema - bet type now contains this info */}

          {/* Financial Data */}
          <div className="grid grid-cols-4 gap-2">
            <div className="space-y-2">
              <Label htmlFor={`${bet}-odds`}>Odd</Label>
              <Input
                id={`${bet}-odds`}
                type="number"
                step="0.01"
                value={betData.odds}
                onChange={(e) => updateBetField(bet, 'odds', e.target.value)}
                placeholder="2.50"
                className={errors[`${bet}.odds`] ? 'border-destructive' : ''}
                data-testid={`input-${bet}-odds`}
              />
              {errors[`${bet}.odds`] && (
                <p className="text-sm text-destructive">{errors[`${bet}.odds`]}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${bet}-stake`}>Valor (R$)</Label>
              <Input
                id={`${bet}-stake`}
                type="number"
                step="0.01"
                value={betData.stake}
                onChange={(e) => updateBetField(bet, 'stake', e.target.value)}
                placeholder="100.00"
                className={errors[`${bet}.stake`] ? 'border-destructive' : ''}
                data-testid={`input-${bet}-stake`}
              />
              {errors[`${bet}.stake`] && (
                <p className="text-sm text-destructive">{errors[`${bet}.stake`]}</p>
              )}
            </div>

            {/* Payout calculated automatically from stake × odds */}
            <div className="space-y-2">
              <Label>Retorno (R$)</Label>
              <Input
                type="text"
                value={betData.stake && betData.odds ? 
                  (parseFloat(betData.stake) * parseFloat(betData.odds)).toFixed(2) : '0.00'}
                disabled
                className="bg-muted"
                placeholder="Calculado automaticamente"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${bet}-profit`}>Lucro (R$)</Label>
              <Input
                id={`${bet}-profit`}
                type="number"
                step="0.01"
                value={betData.profit}
                onChange={(e) => updateBetField(bet, 'profit', e.target.value)}
                placeholder="2.50"
                className={errors[`${bet}.profit`] ? 'border-destructive' : ''}
                data-testid={`input-${bet}-profit`}
              />
              {errors[`${bet}.profit`] && (
                <p className="text-sm text-destructive">{errors[`${bet}.profit`]}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Cross-validation Errors */}
      {(errors.teams || errors.sides) && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="space-y-2">
              {errors.teams && <p className="text-sm text-destructive">⚠️ {errors.teams}</p>}
              {errors.sides && <p className="text-sm text-destructive">⚠️ {errors.sides}</p>}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Image Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Comprovante
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="aspect-[3/4] bg-muted rounded-lg overflow-hidden">
              <img
                src={imageUrl}
                alt="Comprovante de aposta"
                className="w-full h-full object-contain"
                data-testid="img-bet-proof"
              />
            </div>
          </CardContent>
        </Card>

        {/* Bet Forms */}
        <div className="lg:col-span-2 space-y-6">
          {/* Game Information */}
          <Card>
            <CardHeader>
              <CardTitle>Informações do Jogo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data do Jogo</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={`w-full justify-start text-left font-normal ${!formData.gameDate ? 'text-muted-foreground' : ''} ${errors.gameDate ? 'border-destructive' : ''}`}
                        data-testid="button-game-date"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.gameDate ? (
                          getDisplayDate() || format(getCalendarDate() || new Date(), 'PPP', { locale: ptBR })
                        ) : 'Selecione a data'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={getCalendarDate()}
                        onSelect={(date) => date && updateGameField('gameDate', date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {errors.gameDate && <p className="text-sm text-destructive">{errors.gameDate}</p>}
                  
                  {/* Show formatted date info if available */}
                  {(formData.gameDateFormatted || formData.gameDateTime) && (
                    <div className="text-xs text-muted-foreground">
                      📅 Data extraída: {formData.gameDateTime || formData.gameDateFormatted}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="game-time">Horário do Jogo</Label>
                  <Input
                    id="game-time"
                    type="time"
                    value={formData.gameTime || ''}
                    onChange={(e) => updateGameField('gameTime', e.target.value)}
                    data-testid="input-game-time"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sport">Esporte</Label>
                  <Input
                    id="sport"
                    value={formData.sport || ''}
                    onChange={(e) => updateGameField('sport', e.target.value)}
                    placeholder="Ex: Futebol"
                    className={errors.sport ? 'border-destructive' : ''}
                    data-testid="input-sport"
                  />
                  {errors.sport && <p className="text-sm text-destructive">{errors.sport}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="league">Liga</Label>
                  <Input
                    id="league"
                    value={formData.league || ''}
                    onChange={(e) => updateGameField('league', e.target.value)}
                    placeholder="Ex: Itália - Série C"
                    className={errors.league ? 'border-destructive' : ''}
                    data-testid="input-league"
                  />
                  {errors.league && <p className="text-sm text-destructive">{errors.league}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="total-profit">Lucro Total (%)</Label>
                  <Input
                    id="total-profit"
                    type="number"
                    step="0.01"
                    value={formData.totalProfitPercentage || ''}
                    onChange={(e) => updateGameField('totalProfitPercentage', e.target.value)}
                    placeholder="2.52"
                    className={errors.totalProfitPercentage ? 'border-destructive' : ''}
                    data-testid="input-total-profit"
                  />
                  {errors.totalProfitPercentage && <p className="text-sm text-destructive">{errors.totalProfitPercentage}</p>}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Both Bets Side by Side */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {renderBetForm('betA', 'Aposta A')}
            {renderBetForm('betB', 'Aposta B')}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-6 border-t">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
          data-testid="button-cancel-verification"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Cancelar
        </Button>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setFormData(initializeFormData(ocrData))}
            disabled={isLoading}
            data-testid="button-reset-verification"
          >
            <X className="w-4 h-4 mr-2" />
            Resetar
          </Button>
          
          <Button
            onClick={handleSubmit}
            disabled={isLoading}
            data-testid="button-confirm-verification"
          >
            <Check className="w-4 h-4 mr-2" />
            {isLoading ? 'Salvando...' : 'Confirmar e Salvar'}
          </Button>
        </div>
      </div>
    </div>
  );
}