#!/usr/bin/env python3

import sys
import time
import json
import base64
import re
from typing import Dict, Any, List
from datetime import datetime
from io import BytesIO

# Import EasyOCR and dependencies
try:
    import easyocr
    EASYOCR_AVAILABLE = True
    print("✅ EasyOCR available", file=sys.stderr)
except ImportError as e:
    EASYOCR_AVAILABLE = False
    print(f"❌ EasyOCR not available: {e}", file=sys.stderr)

# Use PIL which works reliably
from PIL import Image

class EasyOCREngine:
    """
    EasyOCR Engine for reading betting slip text
    """
    
    def __init__(self):
        print("🔧 Inicializando EasyOCR Engine", file=sys.stderr)
        self.reader = None
        
        if EASYOCR_AVAILABLE:
            try:
                print("📚 Carregando modelos EasyOCR (português/inglês)...", file=sys.stderr)
                # Initialize with Portuguese and English
                self.reader = easyocr.Reader(['pt', 'en'], gpu=False)
                print("✅ EasyOCR Reader inicializado com sucesso", file=sys.stderr)
            except Exception as e:
                print(f"❌ Erro inicializando EasyOCR: {e}", file=sys.stderr)
                self.reader = None
        
    def extract_betting_data(self, image_data: bytes) -> Dict[str, Any]:
        """
        Extract betting data using EasyOCR
        """
        print("🎯 Iniciando extração com EasyOCR", file=sys.stderr)
        start_time = time.time()
        
        try:
            # Load image
            image = Image.open(BytesIO(image_data))
            print(f"🖼️ Imagem carregada: {image.size[0]}x{image.size[1]}px", file=sys.stderr)
            
            if self.reader is None:
                return self._fallback_analysis(image)
            
            # Convert PIL image to format EasyOCR can use
            import numpy as np
            
            # Try to use numpy - if not available, use fallback
            try:
                img_array = np.array(image)
                print("✅ Convertido para array numpy", file=sys.stderr)
            except Exception as e:
                print(f"❌ Erro numpy: {e}, usando fallback", file=sys.stderr)
                return self._fallback_analysis(image)
            
            # Extract text with EasyOCR
            print("🔍 Executando OCR com EasyOCR...", file=sys.stderr)
            results = self.reader.readtext(img_array)
            
            # Process results
            extracted_text = self._process_easyocr_results(results)
            print(f"📝 Texto extraído: '{extracted_text[:100]}...'", file=sys.stderr)
            
            # Analyze betting data
            betting_data = self._analyze_betting_text(extracted_text, image)
            
            processing_time = int((time.time() - start_time) * 1000)
            if 'processing_info' in betting_data:
                betting_data['processing_info']['processing_time_ms'] = processing_time
                
            print(f"✅ EasyOCR concluído em {processing_time}ms", file=sys.stderr)
            return betting_data
            
        except Exception as e:
            processing_time = int((time.time() - start_time) * 1000)
            print(f"❌ Erro EasyOCR: {str(e)}", file=sys.stderr)
            return {
                'success': False,
                'error': f'Falha no EasyOCR: {str(e)}',
                'method': 'easyocr_error',
                'processing_time_ms': processing_time
            }
    
    def _process_easyocr_results(self, results: List) -> str:
        """
        Process EasyOCR results to extract text
        """
        print(f"📋 Processando {len(results)} detecções do EasyOCR", file=sys.stderr)
        
        # Sort results by position (top to bottom, left to right)
        sorted_results = sorted(results, key=lambda x: (x[0][0][1], x[0][0][0]))
        
        extracted_text = ""
        for detection in sorted_results:
            bbox, text, confidence = detection
            
            # Only use high-confidence detections
            if confidence > 0.5:
                print(f"  📝 '{text}' (confiança: {confidence:.2f})", file=sys.stderr)
                extracted_text += text + " "
        
        return extracted_text.strip()
    
    def _fallback_analysis(self, image: Image.Image) -> Dict[str, Any]:
        """
        Fallback when EasyOCR is not available
        """
        print("⚠️ Usando análise de fallback (EasyOCR indisponível)", file=sys.stderr)
        
        return {
            'success': False,
            'error': 'EasyOCR não está disponível no sistema. Instale as dependências necessárias.',
            'method': 'easyocr_fallback',
            'suggestion': 'Verifique a instalação do EasyOCR, numpy e PyTorch.'
        }
    
    def _analyze_betting_text(self, text: str, image: Image.Image) -> Dict[str, Any]:
        """
        Analyze extracted text for betting information
        """
        print(f"🎯 Analisando texto extraído: '{text[:50]}...'", file=sys.stderr)
        
        if not text.strip():
            return {
                'success': False,
                'error': 'Nenhum texto foi extraído da imagem. Verifique se a imagem contém texto legível.',
                'method': 'easyocr_no_text'
            }
        
        # Parse betting data from text
        betting_data = self._parse_betting_information(text)
        
        current_time = datetime.now()
        
        return {
            'success': True,
            'method': 'easyocr_extraction',
            'betA': {
                'bettingHouse': betting_data.get('house_a', 'Casa A'),
                'teamA': betting_data.get('team_a', 'Time A'),
                'teamB': betting_data.get('team_b', 'Time B'),
                'betType': betting_data.get('bet_type', 'Resultado'),
                'betTypeExact': betting_data.get('bet_type_a', 'Vitória A'),
                'selectedSide': 'A',
                'odds': betting_data.get('odds_a', '2.00'),
                'stake': betting_data.get('stake_a', '100.00'),
                'payout': betting_data.get('payout_a', '200.00'),
                'profit': betting_data.get('profit_a', '100.00'),
                'absoluteProfit': betting_data.get('profit_a', '100.00')
            },
            'betB': {
                'bettingHouse': betting_data.get('house_b', 'Casa B'),
                'teamA': betting_data.get('team_a', 'Time A'),
                'teamB': betting_data.get('team_b', 'Time B'),
                'betType': betting_data.get('bet_type', 'Resultado'),
                'betTypeExact': betting_data.get('bet_type_b', 'Vitória B'),
                'selectedSide': 'B',
                'odds': betting_data.get('odds_b', '1.90'),
                'stake': betting_data.get('stake_b', '110.00'),
                'payout': betting_data.get('payout_b', '209.00'),
                'profit': betting_data.get('profit_b', '99.00'),
                'absoluteProfit': betting_data.get('profit_b', '99.00')
            },
            'gameDate': current_time.isoformat(),
            'gameDateBr': betting_data.get('date_br', current_time.strftime('%d/%m/%Y')),
            'gameTimeBr': betting_data.get('time_br', current_time.strftime('%H:%M')),
            'gameTime': f"{betting_data.get('date_br', current_time.strftime('%d/%m/%Y'))} {betting_data.get('time_br', current_time.strftime('%H:%M'))}",
            'sport': 'Futebol',
            'league': betting_data.get('league', 'Liga Detectada'),
            'totalProfitPercentage': betting_data.get('profit_percentage', '5.00'),
            'absoluteTotalProfit': betting_data.get('total_profit', '10.00'),
            'totalStake': betting_data.get('total_stake', '210.00'),
            'processing_info': {
                'model': 'easyocr-engine',
                'timestamp': current_time.isoformat(),
                'processing_time_ms': 0,
                'extracted_text': text,
                'text_length': len(text)
            }
        }
    
    def _parse_betting_information(self, text: str) -> Dict[str, str]:
        """
        Parse betting information from extracted text
        """
        print("📋 Fazendo parsing de informações de aposta", file=sys.stderr)
        
        text_upper = text.upper()
        
        # Extract teams
        team_patterns = [
            r'(\w+(?:\s+\w+)*)\s+(?:VS?|X|-)\s+(\w+(?:\s+\w+)*)',
            r'(\w+)\s+(\w+)',  # Simple two-word pattern
        ]
        
        team_a, team_b = "Time A", "Time B"
        for pattern in team_patterns:
            match = re.search(pattern, text_upper)
            if match:
                team_a, team_b = match.group(1).strip(), match.group(2).strip()
                print(f"📍 Times encontrados: {team_a} vs {team_b}", file=sys.stderr)
                break
        
        # Extract betting houses
        houses = []
        house_keywords = ['BET365', 'BETFAIR', 'PINNACLE', 'SUPERBET', 'BLAZE', 'KTO', 
                         'BETANO', 'BETWAY', '1XBET', 'RIVALO', 'SPORTINGBET']
        
        for house in house_keywords:
            if house in text_upper:
                houses.append(house)
                print(f"🏠 Casa encontrada: {house}", file=sys.stderr)
        
        house_a = houses[0] if len(houses) > 0 else "Casa A"
        house_b = houses[1] if len(houses) > 1 else houses[0] if len(houses) == 1 else "Casa B"
        
        # Extract numbers (odds and stakes)
        numbers = re.findall(r'\b\d+[.,]?\d*\b', text)
        numbers = [float(n.replace(',', '.')) for n in numbers if float(n.replace(',', '.')) > 0]
        
        print(f"🔢 Números encontrados: {numbers}", file=sys.stderr)
        
        # Classify numbers into odds and stakes
        odds = [n for n in numbers if 1.01 <= n <= 20.0]
        stakes = [n for n in numbers if n >= 10 and n not in odds]
        
        odds_a = str(odds[0]) if len(odds) > 0 else "2.00"
        odds_b = str(odds[1]) if len(odds) > 1 else "1.85"
        stake_a = str(stakes[0]) if len(stakes) > 0 else "100.00"
        stake_b = str(stakes[1]) if len(stakes) > 1 else "120.00"
        
        # Calculate payouts
        payout_a = str(float(odds_a) * float(stake_a))
        payout_b = str(float(odds_b) * float(stake_b))
        profit_a = str(float(payout_a) - float(stake_a))
        profit_b = str(float(payout_b) - float(stake_b))
        
        # Extract league information
        league = "Liga Internacional"
        if any(keyword in text_upper for keyword in ['BRASIL', 'BRASILEIR']):
            league = "Brasil / Brasileirão"
        elif any(keyword in text_upper for keyword in ['PREMIER', 'ENGLAND']):
            league = "Inglaterra / Premier League"
        elif any(keyword in text_upper for keyword in ['LA LIGA', 'ESPAÑA']):
            league = "Espanha / La Liga"
        
        # Extract date/time if present
        date_match = re.search(r'(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})', text)
        time_match = re.search(r'(\d{1,2}:\d{2})', text)
        
        date_br = date_match.group(1).replace('-', '/') if date_match else datetime.now().strftime('%d/%m/%Y')
        time_br = time_match.group(1) if time_match else datetime.now().strftime('%H:%M')
        
        total_stake = float(stake_a) + float(stake_b)
        total_profit = float(profit_a) + float(profit_b)
        profit_percentage = (total_profit / total_stake) * 100 if total_stake > 0 else 0
        
        return {
            'team_a': team_a,
            'team_b': team_b,
            'house_a': house_a,
            'house_b': house_b,
            'odds_a': odds_a,
            'odds_b': odds_b,
            'stake_a': stake_a,
            'stake_b': stake_b,
            'payout_a': payout_a,
            'payout_b': payout_b,
            'profit_a': profit_a,
            'profit_b': profit_b,
            'league': league,
            'date_br': date_br,
            'time_br': time_br,
            'bet_type': 'Match Result',
            'bet_type_a': 'Vitória A',
            'bet_type_b': 'Vitória B',
            'total_stake': str(total_stake),
            'total_profit': str(total_profit),
            'profit_percentage': f"{profit_percentage:.2f}"
        }

# Global instance
easyocr_engine = EasyOCREngine()

def extract_betting_data(image_data: bytes) -> Dict[str, Any]:
    """Main entry point for EasyOCR extraction"""
    return easyocr_engine.extract_betting_data(image_data)

# Command line interface
if __name__ == "__main__":
    try:
        # Read JSON input from stdin
        input_data = sys.stdin.read()
        
        if not input_data.strip():
            print(json.dumps({
                'success': False,
                'error': 'No input data provided',
                'method': 'easyocr_cli_error'
            }))
            sys.exit(0)
        
        data = json.loads(input_data)
        image_data = base64.b64decode(data['imageBase64'])
        result = extract_betting_data(image_data)
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': f'EasyOCR CLI failed: {str(e)}',
            'method': 'easyocr_cli_general_error'
        }))
        sys.exit(0)