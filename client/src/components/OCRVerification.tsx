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
  const [formData, setFormData] = useState<OCRData>(ocrData);
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
    if (!formData.betA.payout || isNaN(Number(formData.betA.payout)) || Number(formData.betA.payout) <= 0) {
      newErrors['betA.payout'] = 'Retorno deve ser um número válido maior que 0';
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
    if (!formData.betB.payout || isNaN(Number(formData.betB.payout)) || Number(formData.betB.payout) <= 0) {
      newErrors['betB.payout'] = 'Retorno deve ser um número válido maior que 0';
    }

    // Validate Game Info
    if (!formData.gameDate) newErrors.gameDate = 'Data do jogo é obrigatória';

    // Cross validation - normalize team names for comparison
    const normalizeTeam = (team: string) => team.trim().toLowerCase();
    if (normalizeTeam(formData.betA.teamA) !== normalizeTeam(formData.betB.teamA) || 
        normalizeTeam(formData.betA.teamB) !== normalizeTeam(formData.betB.teamB)) {
      newErrors.teams = 'Os times devem ser iguais em ambas as apostas';
    }
    if (formData.betA.selectedSide === formData.betB.selectedSide) {
      newErrors.sides = 'As apostas devem ser em lados opostos';
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

  const updateGameField = (field: 'gameDate' | 'gameTime', value: Date | string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
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

          {/* Selected Side */}
          <div className="space-y-2">
            <Label htmlFor={`${bet}-side`}>Lado Selecionado</Label>
            <Select value={betData.selectedSide} onValueChange={(value: 'A' | 'B') => updateBetField(bet, 'selectedSide', value)}>
              <SelectTrigger data-testid={`select-${bet}-side`}>
                <SelectValue placeholder="Selecione o lado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="A">Time A ({betData.teamA || 'Casa'})</SelectItem>
                <SelectItem value="B">Time B ({betData.teamB || 'Visitante'})</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Financial Data */}
          <div className="grid grid-cols-3 gap-2">
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

            <div className="space-y-2">
              <Label htmlFor={`${bet}-payout`}>Retorno (R$)</Label>
              <Input
                id={`${bet}-payout`}
                type="number"
                step="0.01"
                value={betData.payout}
                onChange={(e) => updateBetField(bet, 'payout', e.target.value)}
                placeholder="250.00"
                className={errors[`${bet}.payout`] ? 'border-destructive' : ''}
                data-testid={`input-${bet}-payout`}
              />
              {errors[`${bet}.payout`] && (
                <p className="text-sm text-destructive">{errors[`${bet}.payout`]}</p>
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
                        {formData.gameDate ? format(formData.gameDate, 'PPP', { locale: ptBR }) : 'Selecione a data'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={formData.gameDate}
                        onSelect={(date) => date && updateGameField('gameDate', date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {errors.gameDate && <p className="text-sm text-destructive">{errors.gameDate}</p>}
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
            onClick={() => setFormData(ocrData)}
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