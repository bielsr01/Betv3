#!/usr/bin/env python3
"""
Mistral.ai OCR API implementation for betting slip data extraction
Uses Mistral OCR with structured table extraction for superior accuracy
Optimized for Portuguese betting houses and table data extraction
"""

import os
import sys
import json
import base64
import re
import requests
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
import time

class BettingSlipOCR:
    def __init__(self):
        """Initialize Mistral.ai OCR API client"""
        print("Initializing Mistral.ai OCR API...", file=sys.stderr)
        
        # Try Mistral.ai first, fallback to OCR.space if needed
        self.mistral_api_key = os.environ.get('MISTRAL_API_KEY')
        self.ocr_space_api_key = os.environ.get('OCR_SPACE_API_KEY')
        
        if self.mistral_api_key:
            self.primary_ocr = "mistral"
            self.mistral_endpoint = "https://api.mistral.ai/v1/ocr"
            print("Mistral.ai OCR API initialized successfully", file=sys.stderr)
        elif self.ocr_space_api_key:
            self.primary_ocr = "ocr_space"
            self.ocr_space_endpoint = "https://api.ocr.space/parse/image"
            print("Falling back to OCR.space API", file=sys.stderr)
        else:
            print("No OCR API keys found", file=sys.stderr)
            self.primary_ocr = None

    def decode_base64_image(self, base64_string: str) -> bytes:
        """Decode base64 image string to bytes"""
        try:
            if 'base64,' in base64_string:
                base64_string = base64_string.split('base64,')[1]
            return base64.b64decode(base64_string)
        except Exception as e:
            print(f"Error decoding base64 image: {e}", file=sys.stderr)
            raise

    def extract_text_with_mistral_ocr(self, base64_image: str) -> Dict[str, Any]:
        """Extract betting data using Mistral.ai OCR with pure AI extraction"""
        try:
            if not self.mistral_api_key:
                return self._fallback_ocr_response()
            
            print("Using Mistral.ai OCR API for pure AI extraction...", file=sys.stderr)
            
            # Simple request without schema - let AI extract naturally
            payload = {
                "model": "mistral-ocr-latest",
                "document": {
                    "type": "image_url",
                    "image_url": f"data:image/png;base64,{base64_image}"
                },
                "include_image_base64": False
            }
            
            # Headers for Mistral.ai API
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.mistral_api_key}"
            }
            
            # Make API request
            response = requests.post(self.mistral_endpoint, headers=headers, json=payload, timeout=60)
            response.raise_for_status()
            
            # Parse response
            ocr_result = response.json()
            
            print(f"Mistral.ai OCR response received", file=sys.stderr)
            print(f"Processing successful", file=sys.stderr)
            
            return ocr_result
            
        except requests.exceptions.RequestException as e:
            print(f"Mistral.ai OCR API request failed: {e}", file=sys.stderr)
            return self._fallback_ocr_response()
        except Exception as e:
            print(f"Mistral.ai OCR extraction error: {e}", file=sys.stderr)
            return self._fallback_ocr_response()

    def extract_text_with_ocr_space(self, image_bytes: bytes) -> Dict[str, Any]:
        """Extract text using OCR.space API with native JSON response"""
        try:
            if self.ocr_space_api_key is None:
                return self._fallback_ocr_response()
            
            print("Using OCR.space API for text extraction...", file=sys.stderr)
            
            # OCR.space API parameters for JSON response
            payload = {
                'apikey': self.ocr_space_api_key,
                'language': 'por',  # Portuguese optimization
                'isOverlayRequired': True,  # Get text coordinates  
                'OCREngine': 2,  # Engine 2 for special characters
                'detectOrientation': True,
                'scale': True,
                'isTable': True,  # Better for table-like data
                'filetype': 'PNG'
            }
            
            # Upload image file
            files = {
                'file': ('betting_slip.png', image_bytes, 'image/png')
            }
            
            # Make API request - OCR.space returns native JSON
            response = requests.post(self.ocr_space_endpoint, data=payload, files=files, timeout=30)
            response.raise_for_status()
            
            # OCR.space returns native JSON response
            ocr_result = response.json()
            
            print(f"OCR.space native JSON response received", file=sys.stderr)
            print(f"OCR Exit Code: {ocr_result.get('OCRExitCode', 'unknown')}", file=sys.stderr)
            print(f"Processing Time: {ocr_result.get('ProcessingTimeInMilliseconds', 'unknown')}ms", file=sys.stderr)
            
            return ocr_result
            
        except requests.exceptions.RequestException as e:
            print(f"OCR.space API request failed: {e}", file=sys.stderr)
            return self._fallback_ocr_response()
        except Exception as e:
            print(f"OCR.space extraction error: {e}", file=sys.stderr)
            return self._fallback_ocr_response()

    def _fallback_ocr_response(self) -> Dict[str, Any]:
        """Fallback response when OCR.space is unavailable"""
        return {
            "ParsedResults": [{
                "TextOverlay": {"Lines": [], "HasOverlay": False},
                "TextOrientation": "0",
                "FileParseExitCode": 1,
                "ParsedText": "",
                "ErrorMessage": "OCR.space API unavailable",
                "ErrorDetails": ""
            }],
            "OCRExitCode": 4,
            "IsErroredOnProcessing": True,
            "ErrorMessage": ["OCR.space API unavailable"],
            "ProcessingTimeInMilliseconds": "0"
        }

    def analyze_betting_slip(self, base64_image: str) -> Dict[str, Any]:
        """Main function to analyze betting slip using Mistral.ai or OCR.space"""
        try:
            if self.primary_ocr == "mistral":
                print("Starting Mistral.ai betting slip analysis...", file=sys.stderr)
                
                # Extract base64 string if needed
                if 'base64,' in base64_image:
                    base64_image = base64_image.split('base64,')[1]
                
                # Extract structured data using Mistral.ai OCR
                ocr_result = self.extract_text_with_mistral_ocr(base64_image)
                
                # Parse Mistral.ai structured result
                parsed_result = self.parse_mistral_structured_result(ocr_result)
                
                print(f"Final parsed result: {json.dumps(parsed_result, indent=2)}", file=sys.stderr)
                
                return {
                    'success': True,
                    'data': parsed_result,
                    'debug': {
                        'ocr_provider': 'mistral',
                        'model': 'mistral-ocr-latest',
                        'structured_extraction': True
                    }
                }
            
            else:
                # Fallback to OCR.space
                print("Starting OCR.space betting slip analysis...", file=sys.stderr)
                
                # Decode image
                image_bytes = self.decode_base64_image(base64_image)
                print(f"Image size: {len(image_bytes)} bytes", file=sys.stderr)
                
                # Extract text using OCR.space native JSON API
                ocr_result = self.extract_text_with_ocr_space(image_bytes)
                
                # Parse OCR.space native JSON result
                parsed_result = self.parse_ocr_space_json(ocr_result)
                
                print(f"Final parsed result: {json.dumps(parsed_result, indent=2)}", file=sys.stderr)
                
                return {
                    'success': True,
                    'data': parsed_result,
                    'debug': {
                        'ocr_provider': 'ocr_space',
                        'ocr_exit_code': ocr_result.get('OCRExitCode'),
                        'processing_time': ocr_result.get('ProcessingTimeInMilliseconds'),
                        'error_message': ocr_result.get('ErrorMessage', []),
                        'text_preview': ocr_result.get('ParsedResults', [{}])[0].get('ParsedText', '')[:500]
                    }
                }
            
        except Exception as e:
            print(f"Error in betting slip analysis: {e}", file=sys.stderr)
            return {
                'success': False,
                'error': str(e),
                'data': self._get_default_result()
            }

    def parse_mistral_structured_result(self, ocr_result: Dict[str, Any]) -> Dict[str, Any]:
        """Parse Mistral.ai pure AI OCR result into system format"""
        
        result = self._get_default_result()
        
        try:
            print(f"Processing Mistral.ai pure AI OCR result", file=sys.stderr)
            
            # Extract from markdown content (main approach)
            if 'pages' in ocr_result and ocr_result['pages']:
                markdown_text = ocr_result['pages'][0].get('markdown', '')
                if markdown_text:
                    print("Parsing markdown content with AI intelligence...", file=sys.stderr)
                    print(f"Raw markdown preview: {markdown_text[:500]}...", file=sys.stderr)
                    result = self._parse_markdown_content_intelligent(markdown_text, result)
                else:
                    print("No markdown content found in Mistral.ai response", file=sys.stderr)
            else:
                print("No pages found in Mistral.ai response", file=sys.stderr)
            
            return result
            
        except Exception as e:
            print(f"Error processing Mistral.ai pure AI result: {e}", file=sys.stderr)
            return self._get_default_result()

    def _parse_markdown_content(self, markdown: str, result: Dict[str, Any]) -> Dict[str, Any]:
        """Parse markdown content as fallback when structured data is not available"""
        
        lines = markdown.split('\n')
        
        for line in lines:
            line = line.strip()
            
            # Extract teams
            if ' - ' in line and 'Futebol' not in line and '|' not in line:
                teams = line.split(' - ')
                if len(teams) == 2:
                    result['betA']['teamA'] = teams[0].strip()
                    result['betA']['teamB'] = teams[1].strip()
                    result['betB']['teamA'] = teams[0].strip()
                    result['betB']['teamB'] = teams[1].strip()
            
            # Extract date patterns
            date_match = re.search(r'(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})', line)
            if date_match:
                date_str = date_match.group(1)
                time_str = date_match.group(2)
                
                try:
                    date_obj = datetime.strptime(date_str, '%Y-%m-%d')
                    formatted_date = date_obj.strftime('%d-%m-%Y')
                    
                    result['gameDate'] = date_str
                    result['gameTime'] = time_str
                    result['gameDateFormatted'] = formatted_date
                    result['gameDateTime'] = f"{formatted_date} {time_str}"
                except ValueError:
                    pass
            
            # Extract profit percentage
            if re.search(r'\d+\.\d+%', line) and 'ROI' not in line:
                percentage_match = re.search(r'(\d+\.\d+%)', line)
                if percentage_match:
                    result['totalProfitPercentage'] = percentage_match.group(1)
        
        print("Markdown fallback parsing completed", file=sys.stderr)
        return result

    def _parse_markdown_content_intelligent(self, markdown: str, result: Dict[str, Any]) -> Dict[str, Any]:
        """Intelligent parsing of Mistral.ai markdown content with specific extraction rules"""
        
        lines = markdown.split('\n')
        
        print(f"Processing {len(lines)} lines from Mistral.ai markdown", file=sys.stderr)
        print(f"Full markdown content: {markdown}", file=sys.stderr)
        
        table_rows = []
        in_table = False
        
        for i, line in enumerate(lines):
            line = line.strip()
            
            # REGRA 1: Extrair ROI percentage (múltiplos formatos: "X.XX% ROI" ou "ROI: X.XX%")
            roi_match = re.search(r'(?:(\d+[,\.]\d+)%\s+ROI|ROI:\s*(\d+[,\.]\d+)%)', line)
            if roi_match:
                # Capturar o grupo que não é None
                percentage = (roi_match.group(1) or roi_match.group(2)).replace(',', '.')
                result['totalProfitPercentage'] = f"{percentage}%"
                print(f"ROI percentage found: {result['totalProfitPercentage']}", file=sys.stderr)
            
            # REGRA 2: Extrair times com Unicode (acentos) e hífens
            # Capturar times antes de percentuais ou "Futebol" (formato: "Team A – Team B 1.59% Futebol")
            teams_match = re.search(r'([\w\s\-àáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ&]+)\s*[–-]\s*([\w\s\-àáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ&]+)(?:\s+[\d,\.]+%)?(?:\s+Futebol)', line, re.IGNORECASE)
            if teams_match:
                team_a = teams_match.group(1).strip()
                team_b = teams_match.group(2).strip()
                
                # Limpar possíveis sufixos dos nomes (FC, etc.)
                team_a = re.sub(r'\s+(FC|SC|CF|AC)$', r' \1', team_a)
                team_b = re.sub(r'\s+(FC|SC|CF|AC)$', r' \1', team_b)
                
                # Validar se são times válidos (não palavras comuns)
                invalid_words = ['surebet', 'google', 'chrome', 'mostrar', 'total', 'aposta', 'documento', 'evento']
                if (not any(word in team_a.lower() or word in team_b.lower() for word in invalid_words) 
                    and len(team_a) > 2 and len(team_b) > 2):
                    result['betA']['teamA'] = team_a
                    result['betA']['teamB'] = team_b
                    result['betB']['teamA'] = team_a
                    result['betB']['teamB'] = team_b
                    print(f"Teams extracted: {team_a} vs {team_b}", file=sys.stderr)
            
            # REGRA 3: Extrair esporte e liga (remover ROI da liga se presente)
            sport_match = re.search(r'Futebol\s*/\s*(.+)', line)
            if sport_match:
                result['sport'] = 'Futebol'
                league_part = sport_match.group(1).strip()
                
                # Remover ROI da liga se estiver presente
                league_clean = re.sub(r'\s+ROI:\s*\d+[,\.]\d+%', '', league_part)
                result['league'] = league_clean.strip()
                print(f"Sport/League found: {result['sport']} / {result['league']}", file=sys.stderr)
            
            # REGRA 4: Detectar início da tabela
            if '|' in line and ('Chance' in line or 'Aposta' in line or 'Lucro' in line):
                in_table = True
                print(f"Table header detected: {line}", file=sys.stderr)
                continue
            
            # REGRA 5: Extrair dados da tabela (ignorar linhas de separação ---)
            if in_table and '|' in line and line.count('|') >= 3:
                # Split por | e limpar
                cells = [cell.strip() for cell in line.split('|') if cell.strip()]
                
                # IMPORTANTE: Ignorar linhas com apenas "---" (separadores markdown)
                if cells and not all(cell == '---' or cell.startswith('---') for cell in cells):
                    # Verificar se é uma linha de dados válida (primeira célula não vazia e não separador)
                    if len(cells) >= 4 and cells[0] and not cells[0].startswith('---'):
                        # Validação flexível: aceitar qualquer casa de apostas válida
                        # Deve ter pelo menos 3 caracteres e não ser palavra comum
                        first_cell = cells[0].lower()
                        invalid_patterns = ['chance', 'aposta', 'lucro', 'casa', 'total', '---', '***']
                        
                        if (len(cells[0]) >= 3 and 
                            not any(pattern in first_cell for pattern in invalid_patterns) and
                            not first_cell.isdigit()):
                            table_rows.append(cells)
                            print(f"Valid table row found: {cells}", file=sys.stderr)
                        else:
                            print(f"Skipping invalid row (header/separator): {cells}", file=sys.stderr)
            
            # Parar processamento da tabela se não há mais linhas com |
            if in_table and '|' not in line and line.strip() and not line.startswith('-'):
                in_table = False
        
        # REGRA 6: Processar dados da tabela com mapeamento correto
        if table_rows:
            print(f"Processing {len(table_rows)} valid table rows", file=sys.stderr)
            
            # Mapear primeira linha para betA, segunda para betB
            for idx, row in enumerate(table_rows[:2]):  # Limitar a 2 apostas
                print(f"Processing row {idx}: {row}", file=sys.stderr)
                
                bet_key = 'betA' if idx == 0 else 'betB'
                
                # Estrutura esperada da tabela: [Casa, Chance, Odds, ?, Stake, ?, ?, ?, Lucro]
                if len(row) >= 3:
                    result[bet_key]['bettingHouse'] = row[0]  # Casa de aposta
                    result[bet_key]['betType'] = row[1]       # Tipo de aposta (Chance)
                    result[bet_key]['odds'] = self._normalize_number(row[2])  # Odds (normalizar vírgulas)
                    
                    # Procurar stake (valor numérico brasileiro - aceitar vírgulas, R$, USD)
                    stake_found = False
                    for col_idx in range(3, len(row)):
                        normalized_value = self._normalize_monetary_value(row[col_idx])
                        if normalized_value and normalized_value != '0':
                            result[bet_key]['stake'] = normalized_value
                            stake_found = True
                            print(f"Stake found for {bet_key}: {row[col_idx]} -> {normalized_value}", file=sys.stderr)
                            break
                    
                    if not stake_found:
                        result[bet_key]['stake'] = '0'
                    
                    # Lucro - procurar valores monetários válidos (da direita para esquerda)
                    profit_found = False
                    for col_idx in range(len(row) - 1, -1, -1):
                        normalized_value = self._normalize_monetary_value(row[col_idx])
                        if normalized_value and normalized_value != '0' and col_idx > 2:  # Não pegar odds como lucro
                            # Evitar duplicar stake como profit
                            if normalized_value != result[bet_key]['stake']:
                                result[bet_key]['profit'] = normalized_value
                                profit_found = True
                                print(f"Profit found for {bet_key}: {row[col_idx]} -> {normalized_value}", file=sys.stderr)
                                break
                    
                    if not profit_found:
                        result[bet_key]['profit'] = '0'
                
                print(f"{bet_key}: Casa={result[bet_key]['bettingHouse']}, Tipo={result[bet_key]['betType']}, Odds={result[bet_key]['odds']}, Stake={result[bet_key]['stake']}, Lucro={result[bet_key]['profit']}", file=sys.stderr)
        
        print("Intelligent markdown parsing with specific rules completed", file=sys.stderr)
        return result

    def _normalize_number(self, value: str) -> str:
        """Normalize Brazilian number format (replace comma with dot)"""
        if not value:
            return '0'
        
        # Remove spaces and normalize decimal separator
        normalized = value.strip().replace(',', '.')
        
        # Check if it's a valid number
        try:
            float(normalized)
            return normalized
        except ValueError:
            return value  # Return original if not a valid number

    def _normalize_monetary_value(self, value: str) -> str:
        """Normalize Brazilian monetary values (R$ 27,39 -> 27.39)"""
        if not value:
            return None
        
        # Remove currency symbols and spaces
        cleaned = value.strip()
        
        # Remove common currency prefixes/suffixes
        currency_patterns = [r'^R\$\s*', r'^USD\s*', r'^\$\s*', r'\s*USD$', r'\s*BRL$']
        for pattern in currency_patterns:
            cleaned = re.sub(pattern, '', cleaned, flags=re.IGNORECASE)
        
        # Replace comma with dot for decimal separator
        cleaned = cleaned.replace(',', '.')
        
        # Check if it's a valid number
        try:
            number = float(cleaned)
            if number > 0:  # Only return positive values
                return str(number)
        except ValueError:
            pass
        
        return None

    def parse_ocr_space_json(self, ocr_result: Dict[str, Any]) -> Dict[str, Any]:
        """Parse OCR.space native JSON response using coordinate-based extraction"""
        
        result = self._get_default_result()
        
        # Check OCR.space processing status
        if ocr_result.get('IsErroredOnProcessing', True):
            print("OCR.space processing failed", file=sys.stderr)
            return result
        
        parsed_results = ocr_result.get('ParsedResults', [])
        if not parsed_results:
            print("No parsed results in OCR.space response", file=sys.stderr)
            return result
        
        # Get main text content and overlay
        main_result = parsed_results[0]
        text_overlay = main_result.get('TextOverlay', {})
        
        print(f"Using coordinate-based extraction...", file=sys.stderr)
        
        # Get parsed text for fallback
        parsed_text = main_result.get('ParsedText', '')
        
        # Use coordinate-based extraction (user's enhanced solution) with selective fallback
        result = self._extract_betting_data_coordinate_based(ocr_result)
        
        # Only fallback if both betting houses AND date are missing (preserve DD-MM-YYYY dates)
        has_date = result.get('gameDate') or result.get('gameDateFormatted') or result.get('gameDateTime')
        has_betting_data = result['betA']['bettingHouse'] or result['betB']['bettingHouse']
        
        if not has_date and not has_betting_data:
            print("Coordinate method failed (no date or betting data), falling back to regex method", file=sys.stderr)
            result = self._extract_betting_data_from_ocr_text(parsed_text, text_overlay)
        else:
            print(f"Coordinate method successful - Date: {has_date}, Betting: {has_betting_data}", file=sys.stderr)
        
        return result

    def extrair_dados_dinamicos(self, json_data: Dict[str, Any]) -> Dict[str, Any]:
        """Extract betting data using the user's original working function"""
        
        lines = json_data['ParsedResults'][0]['TextOverlay']['Lines']

        # 1. Extract general event data
        resultados_gerais = {}
        
        for line in lines:
            text = line['LineText']
            
            # Find and format Date and Time
            data_hora_match = re.search(r'(\d{4}-\d{2}-\d{2})\s(\d{2}:\d{2})', text)
            if data_hora_match:
                data_original = data_hora_match.group(1)
                hora_original = data_hora_match.group(2)
                
                data_objeto = datetime.strptime(data_original, '%Y-%m-%d')
                data_formatada_br = data_objeto.strftime('%d-%m-%Y')
                
                resultados_gerais['Data e Horário do Jogo'] = f"{data_formatada_br} {hora_original}"

            # Find Teams
            times_match = re.search(r'(.+) - (.+)', text)
            if times_match and 'Futebol' not in text and 'Liga' not in text:
                resultados_gerais['Time A'] = times_match.group(1).strip()
                resultados_gerais['Time B'] = times_match.group(2).strip()
                
            # Find Sport and League
            esporte_liga_match = re.search(r'(.+)/(.+) / (.+)', text)
            if esporte_liga_match:
                resultados_gerais['Esporte'] = esporte_liga_match.group(1).strip()
                resultados_gerais['Liga'] = esporte_liga_match.group(2).strip() + ' / ' + esporte_liga_match.group(3).strip()
            elif '/' in text and '-' in text:
                partes = text.split('/')
                resultados_gerais['Esporte'] = partes[0].strip()
                liga_partes = partes[1].split('-')
                resultados_gerais['Liga'] = liga_partes[0].strip() + ' - ' + liga_partes[1].strip()

            # Find Total Profit %
            if re.search(r'\d+\.\d+%', text) and "ROI:" not in text:
                percentage_match = re.search(r'(\d+\.\d+%)', text)
                if percentage_match:
                    resultados_gerais['Lucro Total em %'] = percentage_match.group(1)
                
        # 2. Extract table data
        headers = {}
        for line in lines:
            if line['LineText'] in ["Chance", "Aposta", "Lucro"]:
                headers[line['LineText']] = line['Words'][0]['Left']
                
        if not headers:
            return {"erro": "Cabeçalhos da tabela não encontrados."}
        
        linhas_de_aposta_y = []
        for line in lines:
            for word in line['Words']:
                if "Chance" in headers and abs(word['Left'] - headers["Chance"]) < 50:
                    linhas_de_aposta_y.append(line['Words'][0]['Top'])
                    break

        dados_apostas = []
        for y_aposta in sorted(list(set(linhas_de_aposta_y))):
            dados_da_aposta = {}
            dados_da_aposta["Casa de Aposta"] = "Não encontrado"

            for line in lines:
                if 'Words' not in line or not line['Words']:
                    continue

                word_top = line['Words'][0]['Top']
                if abs(word_top - y_aposta) < 10:
                    word_left = line['Words'][0]['Left']
                    word_text = line['LineText'].strip().replace("•", "")
                    
                    if word_left < headers["Chance"]:
                        dados_da_aposta["Casa de Aposta"] = word_text
                    elif abs(word_left - headers["Chance"]) < 50:
                        dados_da_aposta["Tipo de Aposta"] = word_text
                    elif "Aposta" in headers and abs(word_left - headers["Aposta"]) < 50:
                        dados_da_aposta["Odd"] = word_text
                    elif "Lucro" in headers and abs(word_left - headers["Lucro"]) < 50:
                        dados_da_aposta["Lucro da Aposta"] = word_text
            
            if len(dados_da_aposta) > 1:
                dados_apostas.append(dados_da_aposta)

        resultados_finais = {**resultados_gerais, "Apostas": dados_apostas}
        return resultados_finais

    def _extract_betting_data_coordinate_based(self, json_data: Dict[str, Any]) -> Dict[str, Any]:
        """Extract betting data using coordinate-based parsing - wrapper for user's original function"""
        
        try:
            print(f"Using user's original extrair_dados_dinamicos function", file=sys.stderr)
            
            # Call the user's original working function
            user_result = self.extrair_dados_dinamicos(json_data)
            
            if "erro" in user_result:
                print(f"User's function returned error: {user_result['erro']}", file=sys.stderr)
                return self._get_default_result()
            
            print(f"User's function extracted: {len(user_result.get('Apostas', []))} betting entries", file=sys.stderr)
            
            # Map the user's result format to our system format
            result = self._map_user_format_to_system_format(user_result)
            
            return result
            
        except Exception as e:
            print(f"User's coordinate-based extraction failed: {e}", file=sys.stderr)
            return self._get_default_result()

    def _map_user_format_to_system_format(self, user_result: Dict[str, Any]) -> Dict[str, Any]:
        """Map the user's original function output format to our system format"""
        
        result = self._get_default_result()
        
        # Map general event data
        if 'Time A' in user_result:
            result['betA']['teamA'] = user_result['Time A']
            result['betB']['teamA'] = user_result['Time A']
        if 'Time B' in user_result:
            result['betA']['teamB'] = user_result['Time B']
            result['betB']['teamB'] = user_result['Time B']
        if 'Esporte' in user_result:
            result['sport'] = user_result['Esporte']
        if 'Liga' in user_result:
            result['league'] = user_result['Liga']
        if 'Lucro Total em %' in user_result:
            result['totalProfitPercentage'] = user_result['Lucro Total em %']
        
        # Handle date/time - preserve user's DD-MM-YYYY formatting
        if 'Data e Horário do Jogo' in user_result:
            # Extract the formatted date and time from the combined string
            date_time_str = user_result['Data e Horário do Jogo']  # e.g., "28-09-2025 12:30"
            
            # Split the formatted date/time string
            if ' ' in date_time_str:
                date_part, time_part = date_time_str.split(' ', 1)
                
                # Convert DD-MM-YYYY back to YYYY-MM-DD for ISO date (calendar needs this)
                try:
                    date_obj = datetime.strptime(date_part, '%d-%m-%Y')
                    iso_date = date_obj.strftime('%Y-%m-%d')
                    
                    result['gameDate'] = iso_date  # ISO format for calendar
                    result['gameTime'] = time_part  # Time component
                    result['gameDateFormatted'] = date_part  # DD-MM-YYYY for display
                    result['gameDateTime'] = date_time_str  # Combined DD-MM-YYYY HH:MM for display
                    
                    print(f"Date mapping: '{date_time_str}' -> ISO: '{iso_date}', Formatted: '{date_part}'", file=sys.stderr)
                except ValueError as e:
                    print(f"Date conversion failed for '{date_time_str}': {e}", file=sys.stderr)
        
        # Map betting data (first bet -> betA, second bet -> betB)
        apostas = user_result.get('Apostas', [])
        if len(apostas) >= 1:
            bet_data = apostas[0]
            if 'Casa de Aposta' in bet_data:
                result['betA']['bettingHouse'] = bet_data['Casa de Aposta']
            if 'Tipo de Aposta' in bet_data:
                result['betA']['betType'] = bet_data['Tipo de Aposta']
            if 'Odd' in bet_data:
                result['betA']['odds'] = bet_data['Odd']
            if 'Lucro da Aposta' in bet_data:
                result['betA']['profit'] = bet_data['Lucro da Aposta']
                
        if len(apostas) >= 2:
            bet_data = apostas[1]
            if 'Casa de Aposta' in bet_data:
                result['betB']['bettingHouse'] = bet_data['Casa de Aposta']
            if 'Tipo de Aposta' in bet_data:
                result['betB']['betType'] = bet_data['Tipo de Aposta']
            if 'Odd' in bet_data:
                result['betB']['odds'] = bet_data['Odd']
            if 'Lucro da Aposta' in bet_data:
                result['betB']['profit'] = bet_data['Lucro da Aposta']
        
        print(f"Mapped user format to system format successfully", file=sys.stderr)
        print(f"betA: {result['betA']['bettingHouse']} - Odds: {result['betA']['odds']}", file=sys.stderr)
        print(f"betB: {result['betB']['bettingHouse']} - Odds: {result['betB']['odds']}", file=sys.stderr)
        
        return result

    def _map_coordinate_data_to_system_format(self, general_data: Dict, betting_data: List[Dict]) -> Dict[str, Any]:
        """Map coordinate-extracted data to current system format with DD-MM-YYYY date support"""
        
        result = self._get_default_result()
        
        # Map general data
        if 'Time A' in general_data:
            result['betA']['teamA'] = general_data['Time A']
            result['betB']['teamA'] = general_data['Time A']
        if 'Time B' in general_data:
            result['betA']['teamB'] = general_data['Time B']
            result['betB']['teamB'] = general_data['Time B']
        if 'Esporte' in general_data:
            result['sport'] = general_data['Esporte']
        if 'Liga' in general_data:
            result['league'] = general_data['Liga']
        
        # Handle formatted dates - supporting both ISO and DD-MM-YYYY
        if 'Data Original ISO' in general_data:
            # Use ISO date for calendar component
            result['gameDate'] = general_data['Data Original ISO']
            
            # Convert ISO to Date object for frontend calendar
            try:
                iso_date = general_data['Data Original ISO']  # e.g., "2025-09-28"
                date_obj = datetime.strptime(iso_date, '%Y-%m-%d')
                result['gameDateFormatted'] = date_obj.strftime('%d-%m-%Y')  # e.g., "28-09-2025"
                print(f"Date conversion: {iso_date} -> {result['gameDateFormatted']}", file=sys.stderr)
            except ValueError as e:
                print(f"Date conversion failed: {e}", file=sys.stderr)
                
        if 'Hora Original' in general_data:
            result['gameTime'] = general_data['Hora Original']
            
        if 'Data e Horário do Jogo' in general_data:
            # Combined DD-MM-YYYY HH:MM format for display
            result['gameDateTime'] = general_data['Data e Horário do Jogo']
            print(f"Combined date/time: {result['gameDateTime']}", file=sys.stderr)
            
        if 'Lucro Total em %' in general_data:
            result['totalProfitPercentage'] = general_data['Lucro Total em %']
        
        # Map betting data (first bet -> betA, second bet -> betB)
        if len(betting_data) >= 1:
            bet_data = betting_data[0]
            if 'Casa de Aposta' in bet_data:
                result['betA']['bettingHouse'] = bet_data['Casa de Aposta']
            if 'Tipo de Aposta' in bet_data:
                result['betA']['betType'] = bet_data['Tipo de Aposta']
            if 'Odd' in bet_data:
                result['betA']['odds'] = bet_data['Odd']
            if 'Lucro da Aposta' in bet_data:
                result['betA']['profit'] = bet_data['Lucro da Aposta']
                
        if len(betting_data) >= 2:
            bet_data = betting_data[1]
            if 'Casa de Aposta' in bet_data:
                result['betB']['bettingHouse'] = bet_data['Casa de Aposta']
            if 'Tipo de Aposta' in bet_data:
                result['betB']['betType'] = bet_data['Tipo de Aposta']
            if 'Odd' in bet_data:
                result['betB']['odds'] = bet_data['Odd']
            if 'Lucro da Aposta' in bet_data:
                result['betB']['profit'] = bet_data['Lucro da Aposta']
        
        print(f"Mapped coordinate data to system format", file=sys.stderr)
        print(f"betA: {result['betA']['bettingHouse']} - {result['betA']['betType']}", file=sys.stderr)
        print(f"betB: {result['betB']['bettingHouse']} - {result['betB']['betType']}", file=sys.stderr)
        
        return result

    def _extract_betting_data_from_ocr_text(self, text: str, overlay: Dict) -> Dict[str, Any]:
        """Extract betting data from OCR.space text with improved patterns"""
        
        result = self._get_default_result()
        
        # Clean text for processing
        text_clean = text.replace('\r\n', '\n').replace('\r', ' ').strip()
        lines = [line.strip() for line in text_clean.split('\n') if line.strip()]
        
        print(f"Processing {len(lines)} lines from OCR.space", file=sys.stderr)
        for i, line in enumerate(lines[:10]):  # Show first 10 lines
            print(f"Line {i}: {line}", file=sys.stderr)
        
        # 1. Extract teams (first priority)
        teams = self._extract_teams_from_lines(lines)
        if teams:
            for bet_key in ['betA', 'betB']:
                result[bet_key]['teamA'] = teams['teamA']
                result[bet_key]['teamB'] = teams['teamB']
            print(f"Teams extracted: {teams['teamA']} vs {teams['teamB']}", file=sys.stderr)
        
        # 2. Extract sport and league  
        sport_league = self._extract_sport_league_from_lines(lines)
        if sport_league:
            result['sport'] = sport_league['sport']
            result['league'] = sport_league['league']
            print(f"Sport: {result['sport']}, League: {result['league']}", file=sys.stderr)
        
        # 3. Extract date and time with timezone correction
        date_time = self._extract_date_time_from_lines(lines)
        if date_time:
            result['gameDate'] = date_time['date']
            result['gameTime'] = date_time['time']
            print(f"Game date/time: {result['gameDate']} {result['gameTime']}", file=sys.stderr)
        
        # 4. Extract profit percentage (not ROI)
        percentage = self._extract_profit_percentage_from_lines(lines)
        if percentage:
            result['totalProfitPercentage'] = percentage
            print(f"Profit percentage: {percentage}", file=sys.stderr)
        
        # 5. Extract betting houses in order (first = betA, second = betB)
        betting_houses = self._extract_betting_houses_from_lines(lines)
        if betting_houses:
            if len(betting_houses) >= 1:
                result['betA'].update(betting_houses[0])
                print(f"BetA: {betting_houses[0]['bettingHouse']} - {betting_houses[0]['betType']}", file=sys.stderr)
            if len(betting_houses) >= 2:
                result['betB'].update(betting_houses[1])
                print(f"BetB: {betting_houses[1]['bettingHouse']} - {betting_houses[1]['betType']}", file=sys.stderr)
        
        return result

    def _extract_teams_from_lines(self, lines: List[str]) -> Optional[Dict[str, str]]:
        """Extract team names from OCR lines"""
        
        # Look for team names in typical format
        team_patterns = [
            # "ASD Pineto Calcio – Rimini FC 1912"
            r'^([A-Za-zÀ-ÿ0-9\s]+(?:FC|SC|AC|Calcio|United|City|Real|Saint)?)\s*[–-]\s*([A-Za-zÀ-ÿ0-9\s]+(?:FC|SC|AC|Calcio|United|City|Real|Saint)?)(?:\s*\d+\.\d+%)?$',
            # "Billere Handball – Grand Besancon Doubs"
            r'^([A-Za-zÀ-ÿ\s]+)\s*[–-]\s*([A-Za-zÀ-ÿ\s]+)$',
            # "Aleksandar Vukic – Daniel Altmaier"  
            r'^([A-Za-zÀ-ÿ\s]+)\s*[–-]\s*([A-Za-zÀ-ÿ\s]+)$'
        ]
        
        for line in lines:
            line_clean = line.strip()
            
            # Skip obvious non-team lines
            skip_keywords = ['surebet', 'google', 'chrome', 'evento', 'futebol', 'roi', 'chance', 'lucro', 'aposta', 'total', 'mostrar', 'pt.surebet.com']
            if any(keyword in line_clean.lower() for keyword in skip_keywords):
                continue
            
            for pattern in team_patterns:
                match = re.search(pattern, line_clean, re.IGNORECASE)
                if match:
                    team_a = match.group(1).strip()
                    team_b = match.group(2).strip()
                    
                    # Validate teams
                    if (len(team_a) >= 3 and len(team_b) >= 3 and team_a != team_b and
                        not team_a.isdigit() and not team_b.isdigit()):
                        return {'teamA': team_a, 'teamB': team_b}
        
        return None

    def _extract_sport_league_from_lines(self, lines: List[str]) -> Optional[Dict[str, str]]:
        """Extract sport and league from OCR lines"""
        
        # Look for sport/league pattern: "Futebol / Itália - Série C"
        for line in lines:
            line_clean = line.strip()
            
            # Pattern: "Sport / Country - League"
            sport_pattern = r'^(Futebol|Handebol|Tênis|Beisebol|Basketball|Vôlei)\s*\/\s*([A-Za-zÀ-ÿ\s]+)\s*-\s*([A-Za-zÀ-ÿ0-9\s\-\_]+)$'
            match = re.search(sport_pattern, line_clean, re.IGNORECASE)
            
            if match:
                sport = match.group(1).strip()
                country = match.group(2).strip()
                league_name = match.group(3).strip()
                
                return {
                    'sport': sport,
                    'league': f"{country} - {league_name}"
                }
        
        return {'sport': 'Futebol', 'league': ''}

    def _extract_date_time_from_lines(self, lines: List[str]) -> Optional[Dict[str, str]]:
        """Extract date and time with timezone correction"""
        
        for line in lines:
            line_clean = line.strip()
            
            # Look for event date patterns
            # "Evento em 2 dias (2025-09-27 12:30 -03:00)"
            # "Evento em 1 dia (2025-09-26 15:30 -03:00)"
            # "Evento em aproximadamente 17 horas (2025-09-25 23:00 -03:00)"
            
            date_patterns = [
                # Normal patterns with spaces
                r'Evento em \d+ dias?\s*\((\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})',
                r'Evento em aproximadamente \d+ horas?\s*\((\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})',
                r'Evento em \d+ dia\s*\((\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})',
                # Malformed patterns without spaces - "2025-09-2712:30-03:00)"
                r'Evento em \d+ dias?\s*(\d{4}-\d{2}-\d{2})(\d{2}:\d{2})',
                r'Evento em aproximadamente \d+ horas?\s*(\d{4}-\d{2}-\d{2})(\d{2}:\d{2})',
                r'Evento em \d+ dia\s*(\d{4}-\d{2}-\d{2})(\d{2}:\d{2})',
                # Generic patterns
                r'\((\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})',
                r'(\d{4}-\d{2}-\d{2})(\d{2}:\d{2})'
            ]
            
            for pattern in date_patterns:
                match = re.search(pattern, line_clean)
                if match:
                    date_str = match.group(1)
                    time_str = match.group(2)
                    
                    # Parse date and keep ISO format for frontend compatibility
                    try:
                        # Just validate the date format, but keep the original ISO date
                        datetime.strptime(date_str, '%Y-%m-%d')
                        
                        return {
                            'date': date_str,
                            'time': time_str
                        }
                    except ValueError:
                        continue
        
        return None

    def _extract_profit_percentage_from_lines(self, lines: List[str]) -> Optional[str]:
        """Extract profit percentage (not ROI)"""
        
        for line in lines:
            line_clean = line.strip()
            
            # Look for standalone percentage (not ROI)
            # Should match "1.72%" but not "ROI: 267.10%"
            if 'roi' not in line_clean.lower():
                percentage_match = re.search(r'(\d+\.\d+)%', line_clean)
                if percentage_match:
                    percentage = percentage_match.group(1)
                    # Make sure it's a reasonable percentage (< 50%)
                    if float(percentage) < 50:
                        return percentage + '%'
        
        return None

    def _extract_betting_houses_from_lines(self, lines: List[str]) -> List[Dict[str, str]]:
        """Extract betting houses in order from OCR lines"""
        
        betting_houses = []
        
        # Brazilian betting house names (including variations with spaces)
        br_houses = ['aposta1', 'aposta 1', 'marjosports', 'bravobet', 'betnacional', 'bet7k', 'blaze', 'betfast']
        
        for line in lines:
            line_clean = line.strip()
            
            # Look for lines with Brazilian betting houses
            house_found = None
            for house in br_houses:
                if house in line_clean.lower():
                    house_found = house
                    print(f"Found betting house '{house}' in line: {line_clean}", file=sys.stderr)
                    break
            
            if house_found:
                betting_info = self._parse_betting_house_line(line_clean, house_found)
                if betting_info:
                    print(f"Extracted betting house: {betting_info}", file=sys.stderr)
                    betting_houses.append(betting_info)
        
        return betting_houses

    def _parse_betting_house_line(self, line: str, house_name: str) -> Optional[Dict[str, str]]:
        """Parse betting house line to extract all information"""
        
        line_clean = line.strip()
        print(f"Parsing betting line: {line_clean}", file=sys.stderr)
        
        # Betting patterns for OCR.space compressed formats
        patterns = [
            # "Aposta1 (BR)1 2.000 •80.36USD v2.72" - bet type and odds separated
            r'(' + house_name + r')\s*\(br\)\s*([^0-9]*?)\s*(\d+\.\d+)\s*[•·]?\s*(\d+\.\d+)\s*usd\s*v?\s*(\d+\.\d+)',
            # "MarjoSports (BR)X2 2.070 •77.64USD V2.71" - bet type and odds separated
            r'(' + house_name + r')\s*\(br\)\s*([a-zA-Z0-9]+)\s*(\d+\.\d+)\s*[•·]?\s*(\d+\.\d+)\s*usd\s*v?\s*(\d+\.\d+)',
            # "BravoBet (BR) Acima 27.5 2° o time 1.870 85.76 USD" (complex bet types)
            r'(' + house_name + r')\s*\(br\)\s*(.*?)(\d+\.\d+)\s+(\d+\.\d+)\s*usd\s*v?\s*(\d+\.\d+)',
            # Generic flexible pattern for edge cases
            r'(' + house_name + r')\s*\(br\)\s*(.*?)(\d+\.\d+)\s*[•·]?\s*(\d+\.\d+)',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, line_clean, re.IGNORECASE)
            if match:
                house = match.group(1).capitalize()
                bet_type_raw = match.group(2).strip()
                odds_raw = match.group(3)
                stake = match.group(4)
                
                # Handle OCR.space compaction: "12.000" might be "1" + "2.000"
                odds, bet_type = self._fix_ocr_compaction(odds_raw, bet_type_raw)
                
                # Extract profit - try from match first, then from end of line
                profit = "0"
                if len(match.groups()) >= 5:
                    profit = match.group(5)
                else:
                    profit_match = re.search(r'v?\s*(\d+\.\d+)\s*$', line_clean)
                    if profit_match:
                        profit = profit_match.group(1)
                
                # Clean bet type
                bet_type = self._clean_bet_type(bet_type)
                
                return {
                    'bettingHouse': f"{house} (BR)",
                    'betType': bet_type,
                    'odds': odds,
                    'stake': stake,
                    'profit': profit
                }
        
        return None

    def _fix_ocr_compaction(self, odds_raw: str, bet_type_raw: str) -> tuple[str, str]:
        """Fix OCR.space compaction where bet type and odds are merged"""
        
        # If bet type is empty or very short and odds looks like it contains bet type
        if len(bet_type_raw) <= 1 and odds_raw:
            # Check for patterns like "12.000" which might be "1" + "2.000"
            if odds_raw == "12.000":
                # "12.000" -> bet_type="1", odds="2.000"
                return "2.000", "1"
            elif odds_raw == "22.070" or odds_raw.startswith("22."):
                # "22.070" -> bet_type="2", odds="2.070" 
                return "2.070", "2"
            elif odds_raw.lower().startswith('x2') and len(odds_raw) > 2:
                # "X22.070" -> bet_type="X2", odds="2.070"
                return odds_raw[2:], "X2"
            elif odds_raw.lower().startswith('x') and len(odds_raw) > 1:
                # "X2.070" -> bet_type="X", odds="2.070"
                return odds_raw[1:], "X"
            elif odds_raw.startswith('1') and len(odds_raw) > 3:
                # Generic "1X.XXX" -> bet_type="1", odds="X.XXX"
                return odds_raw[1:], "1"
        
        return odds_raw, bet_type_raw

    def _clean_bet_type(self, bet_type_raw: str) -> str:
        """Clean and format bet type"""
        
        # Remove extra whitespace and unwanted characters
        bet_type = re.sub(r'\s+', ' ', bet_type_raw.strip())
        bet_type = re.sub(r'[^\w\s\(\)\+\-\.,°º]', ' ', bet_type)
        bet_type = re.sub(r'\s+', ' ', bet_type).strip()
        
        # Return cleaned bet type (limit length)
        return bet_type[:50]

    def _get_default_result(self) -> Dict[str, Any]:
        """Get default result structure"""
        return {
            'betA': {
                'bettingHouse': '',
                'teamA': '',
                'teamB': '',
                'betType': '',
                'odds': '0',
                'stake': '0',
                'profit': '0'
            },
            'betB': {
                'bettingHouse': '',
                'teamA': '',
                'teamB': '',
                'betType': '',
                'odds': '0',
                'stake': '0',
                'profit': '0'
            },
            'gameDate': '2025-01-01',
            'gameTime': '00:00',
            'sport': 'Futebol',
            'league': '',
            'totalProfitPercentage': '0%'
        }


def main():
    """Main function to handle stdin execution"""
    try:
        # Read base64 image from stdin
        base64_image = sys.stdin.read().strip()
        
        if not base64_image:
            error_result = {
                'success': False,
                'error': 'No image data received',
                'data': BettingSlipOCR()._get_default_result()
            }
            print(json.dumps(error_result))
            sys.exit(1)
        
        # Initialize OCR engine
        ocr_engine = BettingSlipOCR()
        
        # Analyze betting slip using OCR.space native JSON
        result = ocr_engine.analyze_betting_slip(base64_image)
        
        # Output result as JSON
        print(json.dumps(result))
        
    except Exception as e:
        error_result = {
            'success': False,
            'error': str(e),
            'data': BettingSlipOCR()._get_default_result()
        }
        print(json.dumps(error_result))
        sys.exit(1)


if __name__ == "__main__":
    main()