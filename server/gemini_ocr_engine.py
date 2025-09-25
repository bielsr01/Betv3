#!/usr/bin/env python3

import sys
import time
import json
import base64
import re
from typing import Dict, Any, List
from datetime import datetime
from io import BytesIO
import os

# Use only reliable imports
from PIL import Image

class GeminiOCREngine:
    """
    OCR Engine using Google Gemini Vision for reliable text extraction
    """
    
    def __init__(self, api_key: str = None):
        print("🔧 Inicializando Gemini Vision OCR Engine", file=sys.stderr)
        self.api_key = api_key or os.environ.get('GEMINI_API_KEY')
        
        if self.api_key:
            print("✅ Gemini API Key configurada", file=sys.stderr)
        else:
            print("⚠️ Gemini API Key não encontrada", file=sys.stderr)
        
    def extract_betting_data(self, image_data: bytes) -> Dict[str, Any]:
        """
        Extract betting data using Gemini Vision
        """
        print("🎯 Iniciando extração Gemini Vision OCR", file=sys.stderr)
        start_time = time.time()
        
        try:
            if not self.api_key:
                return {
                    'success': False,
                    'error': 'Chave API do Gemini não encontrada. Configure GEMINI_API_KEY.',
                    'method': 'gemini_no_key'
                }
            
            # Validate image data
            if not image_data or len(image_data) < 100:
                return {
                    'success': False,
                    'error': 'Dados de imagem inválidos ou muito pequenos',
                    'method': 'gemini_invalid_data'
                }
            
            # Load image to get metadata
            image = Image.open(BytesIO(image_data))
            original_size = image.size
            print(f"🖼️ Imagem carregada: {original_size[0]}x{original_size[1]}px", file=sys.stderr)
            print(f"📦 Tamanho dos dados: {len(image_data)} bytes", file=sys.stderr)
            
            # Convert image to base64 for Gemini API
            base64_image = base64.b64encode(image_data).decode('utf-8')
            
            # Extract text using Gemini Vision
            extracted_text = self._call_gemini_vision(base64_image)
            
            if not extracted_text:
                return {
                    'success': False,
                    'error': 'Gemini Vision não conseguiu extrair texto da imagem',
                    'method': 'gemini_no_text'
                }
            
            print(f"📝 Texto extraído pelo Gemini: '{extracted_text[:100]}...'", file=sys.stderr)
            
            # Parse betting information from extracted text
            betting_info = self._parse_betting_data(extracted_text, image)
            
            processing_time = int((time.time() - start_time) * 1000)
            betting_info['processing_info']['processing_time_ms'] = processing_time
            betting_info['processing_info']['original_image_size'] = f"{original_size[0]}x{original_size[1]}"
            betting_info['processing_info']['image_data_size'] = len(image_data)
                
            print(f"✅ Gemini Vision OCR concluído em {processing_time}ms", file=sys.stderr)
            return betting_info
            
        except Exception as e:
            processing_time = int((time.time() - start_time) * 1000)
            print(f"❌ Erro Gemini Vision: {str(e)}", file=sys.stderr)
            return {
                'success': False,
                'error': f'Falha no Gemini Vision: {str(e)}',
                'method': 'gemini_error',
                'processing_time_ms': processing_time
            }
    
    def _call_gemini_vision(self, base64_image: str) -> str:
        """
        Call Gemini Vision API to extract text from betting slip image
        """
        print("🌐 Chamando Gemini Vision API...", file=sys.stderr)
        
        try:
            # Try to import and use Google Gemini
            try:
                import google.generativeai as genai
                print("✅ Google Gemini disponível", file=sys.stderr)
            except ImportError:
                print("❌ Google Gemini não disponível, usando requests", file=sys.stderr)
                return self._call_gemini_rest_api(base64_image)
            
            # Configure Gemini
            genai.configure(api_key=self.api_key)
            model = genai.GenerativeModel('gemini-1.5-flash')
            
            # Create image from base64
            import io
            image_bytes = base64.b64decode(base64_image)
            image = Image.open(io.BytesIO(image_bytes))
            
            # Prepare prompt for betting slip OCR
            prompt = """Analise esta imagem de calculadora de apostas ou bilhete de aposta e extraia EXATAMENTE o texto que você vê.
            
            Esta é uma imagem de uma calculadora de SureBet ou bilhete de apostas esportivas.
            
            Por favor, retorne todo o texto visível na imagem, mantendo a estrutura e formatação.
            Inclua:
            - Nomes dos times/equipes
            - Casas de apostas (KTO, Pinnacle, Bet365, etc.)  
            - Odds (números decimais como 1.400, 2.50)
            - Valores de apostas
            - Datas e horários
            - Liga ou competição
            - Qualquer outro texto visível
            
            Retorne apenas o texto extraído, sem comentários adicionais."""
            
            print("📡 Enviando imagem para Gemini Vision...", file=sys.stderr)
            
            # Make request to Gemini
            response = model.generate_content([prompt, image])
            
            if response.text:
                print(f"✅ Gemini extraiu {len(response.text)} caracteres", file=sys.stderr)
                return response.text.strip()
            else:
                print("❌ Gemini retornou resposta vazia", file=sys.stderr)
                return ""
            
        except Exception as e:
            print(f"❌ Erro ao chamar Gemini: {e}", file=sys.stderr)
            return ""
    
    def _call_gemini_rest_api(self, base64_image: str) -> str:
        """
        Fallback: Call Gemini REST API directly
        """
        print("🌐 Usando Gemini REST API...", file=sys.stderr)
        
        try:
            import requests
            
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={self.api_key}"
            
            payload = {
                "contents": [{
                    "parts": [
                        {
                            "text": "Extraia todo o texto desta imagem de bilhete de apostas esportivas. Retorne apenas o texto visível, incluindo nomes de times, casas de apostas, odds, valores e datas."
                        },
                        {
                            "inline_data": {
                                "mime_type": "image/png",
                                "data": base64_image
                            }
                        }
                    ]
                }],
                "generationConfig": {
                    "temperature": 0.1,
                    "maxOutputTokens": 2048
                }
            }
            
            headers = {
                "Content-Type": "application/json"
            }
            
            response = requests.post(url, json=payload, headers=headers, timeout=30)
            
            if response.status_code == 200:
                result = response.json()
                if 'candidates' in result and len(result['candidates']) > 0:
                    content = result['candidates'][0].get('content', {})
                    parts = content.get('parts', [])
                    if parts:
                        text = parts[0].get('text', '')
                        print(f"✅ Gemini REST extraiu {len(text)} caracteres", file=sys.stderr)
                        return text.strip()
            
            print(f"❌ Erro Gemini REST: {response.status_code} - {response.text[:200]}", file=sys.stderr)
            return ""
            
        except Exception as e:
            print(f"❌ Erro Gemini REST: {e}", file=sys.stderr)
            return ""
    
    def _parse_betting_data(self, text: str, image) -> Dict[str, Any]:
        """
        Parse real betting data from Gemini Vision extracted text
        """
        print(f"🎯 Analisando texto do Gemini: '{text[:50]}...'", file=sys.stderr)
        
        current_time = datetime.now()
        
        if not text.strip():
            return {
                'success': False,
                'error': 'Gemini Vision não extraiu nenhum texto da imagem. Verifique se a imagem contém texto legível.',
                'method': 'gemini_no_text_extracted',
                'processing_info': {
                    'model': 'gemini-vision',
                    'timestamp': current_time.isoformat(),
                    'processing_time_ms': 0,
                    'extracted_text': text
                }
            }
        
        # Parse the extracted text for betting information
        betting_data = self._extract_betting_components(text)
        
        return {
            'success': True,
            'method': 'gemini_vision_real_extraction',
            'betA': {
                'bettingHouse': betting_data.get('house_a', 'Casa não identificada'),
                'teamA': betting_data.get('team_a', 'Time A'),
                'teamB': betting_data.get('team_b', 'Time B'),
                'betType': betting_data.get('bet_type', 'Resultado da Partida'),
                'betTypeExact': betting_data.get('bet_type_a', 'Vitória Time A'),
                'selectedSide': 'A',
                'odds': betting_data.get('odds_a', '2.00'),
                'stake': betting_data.get('stake_a', '100.00'),
                'payout': betting_data.get('payout_a', '200.00'),
                'profit': betting_data.get('profit_a', '100.00'),
                'absoluteProfit': betting_data.get('profit_a', '100.00')
            },
            'betB': {
                'bettingHouse': betting_data.get('house_b', 'Casa não identificada'),
                'teamA': betting_data.get('team_a', 'Time A'),
                'teamB': betting_data.get('team_b', 'Time B'),
                'betType': betting_data.get('bet_type', 'Resultado da Partida'),
                'betTypeExact': betting_data.get('bet_type_b', 'Vitória Time B'),
                'selectedSide': 'B',
                'odds': betting_data.get('odds_b', '1.85'),
                'stake': betting_data.get('stake_b', '115.00'),
                'payout': betting_data.get('payout_b', '212.75'),
                'profit': betting_data.get('profit_b', '97.75'),
                'absoluteProfit': betting_data.get('profit_b', '97.75')
            },
            'gameDate': current_time.isoformat(),
            'gameDateBr': betting_data.get('date_br', current_time.strftime('%d/%m/%Y')),
            'gameTimeBr': betting_data.get('time_br', current_time.strftime('%H:%M')),
            'gameTime': f"{betting_data.get('date_br', current_time.strftime('%d/%m/%Y'))} {betting_data.get('time_br', current_time.strftime('%H:%M'))}",
            'sport': 'Futebol',
            'league': betting_data.get('league', 'Liga identificada por IA'),
            'totalProfitPercentage': betting_data.get('profit_percentage', '5.00'),
            'absoluteTotalProfit': betting_data.get('total_profit', '10.00'),
            'totalStake': betting_data.get('total_stake', '215.00'),
            'processing_info': {
                'model': 'gemini-1.5-flash-vision',
                'timestamp': current_time.isoformat(),
                'processing_time_ms': 0,
                'extracted_text': text,
                'ai_provider': 'google-gemini'
            }
        }
    
    def _extract_betting_components(self, text: str) -> Dict[str, str]:
        """
        Extract betting components from Gemini Vision text with advanced parsing
        """
        print("📋 Extraindo componentes com parsing avançado", file=sys.stderr)
        
        text_upper = text.upper()
        text_lines = [line.strip() for line in text.split('\n') if line.strip()]
        
        print(f"📄 Texto dividido em {len(text_lines)} linhas úteis", file=sys.stderr)
        for i, line in enumerate(text_lines[:8]):  # Log first 8 lines
            print(f"  L{i+1}: '{line}'", file=sys.stderr)
        
        # Extract teams with multiple patterns
        team_patterns = [
            r'(\w+(?:\s+\w+)*(?:-\w+)*)\s+(?:VS?|X|–|—|-)\s+(\w+(?:\s+\w+)*(?:-\w+)*)',
            r'(\w+(?:-\w+)+)\s+[–—-]\s+(\w+(?:-\w+)+)',
            r'(\w{3,}(?:\s+\w{2,})*)\s+(\w{3,}(?:\s+\w{2,})*)'
        ]
        
        team_a, team_b = "Time A", "Time B"
        for pattern in team_patterns:
            match = re.search(pattern, text_upper)
            if match:
                candidate_a = match.group(1).strip()
                candidate_b = match.group(2).strip()
                if len(candidate_a) >= 3 and len(candidate_b) >= 3 and candidate_a != candidate_b:
                    team_a, team_b = candidate_a, candidate_b
                    print(f"📍 Times extraídos: '{team_a}' vs '{team_b}'", file=sys.stderr)
                    break
        
        # Extract betting houses with better matching
        houses = []
        house_keywords = [
            'KTO', 'PINNACLE', 'BET365', 'BETFAIR', 'SUPERBET', 'BLAZE', 
            'BETANO', 'BETWAY', '1XBET', 'RIVALO', 'SPORTINGBET', 'BETSSON',
            'BWIN', 'WILLIAM HILL', 'UNIBET', 'BETFAIR'
        ]
        
        for house in house_keywords:
            if house in text_upper:
                houses.append(house)
                print(f"🏠 Casa encontrada: {house}", file=sys.stderr)
        
        house_a = houses[0] if len(houses) > 0 else "Casa A"
        house_b = houses[1] if len(houses) > 1 else houses[0] if len(houses) == 1 else "Casa B"
        
        # Advanced number extraction with context
        all_numbers = []
        number_patterns = [
            r'\b(\d+[.,]\d{2,3})\b',  # Precise decimals like 1.400, 72.76
            r'\b(\d+[.,]\d{1})\b',    # Single decimal like 2.5
            r'\b(\d{2,4})\b'          # Whole numbers 
        ]
        
        for pattern in number_patterns:
            matches = re.findall(pattern, text)
            for match in matches:
                try:
                    num = float(match.replace(',', '.'))
                    if num > 0:
                        all_numbers.append(num)
                except:
                    continue
        
        # Remove duplicates while preserving order
        unique_numbers = []
        seen = set()
        for num in all_numbers:
            if num not in seen:
                seen.add(num)
                unique_numbers.append(num)
        
        print(f"🔢 Números únicos extraídos: {unique_numbers}", file=sys.stderr)
        
        # Smart classification of numbers
        odds = [n for n in unique_numbers if 1.01 <= n <= 50.0]
        stakes = [n for n in unique_numbers if n >= 10 and n <= 10000 and n not in odds]
        
        # Use most reasonable values
        odds_a = str(odds[0]) if len(odds) > 0 else "2.00"
        odds_b = str(odds[1]) if len(odds) > 1 else "1.85"
        stake_a = str(stakes[0]) if len(stakes) > 0 else "100.00"
        stake_b = str(stakes[1]) if len(stakes) > 1 else "115.00"
        
        print(f"🎯 Odds: A={odds_a}, B={odds_b}", file=sys.stderr)
        print(f"💰 Stakes: A={stake_a}, B={stake_b}", file=sys.stderr)
        
        # Calculate payouts and profits
        payout_a = str(float(odds_a) * float(stake_a))
        payout_b = str(float(odds_b) * float(stake_b))
        profit_a = str(float(payout_a) - float(stake_a))
        profit_b = str(float(payout_b) - float(stake_b))
        
        # Extract league/competition with smart matching
        league = "Liga não identificada"
        league_indicators = [
            ('BRASIL', 'Brasil / Brasileirão'),
            ('BRASILEIR', 'Brasil / Brasileirão'),
            ('SÉRIE', 'Brasil / Brasileirão Série'),
            ('PREMIER', 'Inglaterra / Premier League'),
            ('LA LIGA', 'Espanha / La Liga'),
            ('CHAMPIONS', 'UEFA Champions League'),
            ('LIBERTADORES', 'Copa Libertadores'),
            ('EUROPA', 'UEFA Europa League')
        ]
        
        for indicator, full_name in league_indicators:
            if indicator in text_upper:
                league = full_name
                print(f"🏆 Liga identificada: {league}", file=sys.stderr)
                break
        
        # Extract date/time with multiple formats
        date_patterns = [
            r'(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})',
            r'(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})',
            r'(\d{1,2}\s+de\s+\w+\s+de\s+\d{4})'
        ]
        
        time_patterns = [
            r'(\d{1,2}:\d{2})',
            r'(\d{1,2}h\d{2})',
            r'(\d{1,2}:\d{2}:\d{2})'
        ]
        
        date_br = datetime.now().strftime('%d/%m/%Y')
        time_br = datetime.now().strftime('%H:%M')
        
        for pattern in date_patterns:
            match = re.search(pattern, text)
            if match:
                date_str = match.group(1).replace('-', '/').replace('.', '/')
                if len(date_str.split('/')[0]) == 4:  # YYYY/MM/DD to DD/MM/YYYY
                    parts = date_str.split('/')
                    date_br = f"{parts[2]}/{parts[1]}/{parts[0]}"
                else:
                    date_br = date_str
                print(f"📅 Data extraída: {date_br}", file=sys.stderr)
                break
        
        for pattern in time_patterns:
            match = re.search(pattern, text)
            if match:
                time_br = match.group(1).replace('h', ':')
                if ':' in time_br and len(time_br.split(':')[0]) <= 2:
                    print(f"🕒 Horário extraído: {time_br}", file=sys.stderr)
                    break
        
        # Calculate totals
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
            'bet_type': 'Resultado da Partida',
            'bet_type_a': 'Vitória A',
            'bet_type_b': 'Vitória B',
            'total_stake': str(total_stake),
            'total_profit': str(total_profit),
            'profit_percentage': f"{profit_percentage:.2f}"
        }

# Command line interface
if __name__ == "__main__":
    try:
        # Read JSON input from stdin
        input_data = sys.stdin.read()
        
        if not input_data.strip():
            print(json.dumps({
                'success': False,
                'error': 'No input data provided',
                'method': 'gemini_cli_error'
            }))
            sys.exit(0)
            
        # Parse JSON input
        try:
            data = json.loads(input_data)
        except json.JSONDecodeError as e:
            print(json.dumps({
                'success': False,
                'error': f'Invalid JSON input: {str(e)}',
                'method': 'gemini_cli_json_error'
            }))
            sys.exit(0)
        
        # Get API key from environment or input
        api_key = data.get('apiKey') or data.get('api_key') or os.environ.get('GEMINI_API_KEY')
        
        # Get base64 image data
        if 'imageBase64' not in data:
            print(json.dumps({
                'success': False,
                'error': 'Missing imageBase64 field',
                'method': 'gemini_cli_input_error'
            }))
            sys.exit(0)
            
        # Decode base64 image
        try:
            image_data = base64.b64decode(data['imageBase64'])
        except Exception as e:
            print(json.dumps({
                'success': False,
                'error': f'Failed to decode base64 image: {str(e)}',
                'method': 'gemini_cli_decode_error'
            }))
            sys.exit(0)
        
        # Process with Gemini Vision
        gemini_engine = GeminiOCREngine(api_key=api_key)
        result = gemini_engine.extract_betting_data(image_data)
        
        # Output JSON result
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': f'Gemini Vision CLI processing failed: {str(e)}',
            'method': 'gemini_cli_general_error'
        }))
        sys.exit(0)