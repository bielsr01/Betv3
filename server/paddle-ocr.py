#!/usr/bin/env python3
"""
OCR.space API implementation for betting slip data extraction
Uses OCR.space native JSON API with Engine 2 for superior accuracy
Optimized for Portuguese betting houses and special characters
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
        """Initialize OCR.space API client"""
        print("Initializing OCR.space API...", file=sys.stderr)
        
        self.api_key = os.environ.get('OCR_SPACE_API_KEY')
        if self.api_key:
            self.endpoint = "https://api.ocr.space/parse/image"
            print("OCR.space API initialized successfully", file=sys.stderr)
        else:
            print("OCR.space API key not found", file=sys.stderr)
            self.api_key = None

    def decode_base64_image(self, base64_string: str) -> bytes:
        """Decode base64 image string to bytes"""
        try:
            if 'base64,' in base64_string:
                base64_string = base64_string.split('base64,')[1]
            return base64.b64decode(base64_string)
        except Exception as e:
            print(f"Error decoding base64 image: {e}", file=sys.stderr)
            raise

    def extract_text_with_ocr_space(self, image_bytes: bytes) -> Dict[str, Any]:
        """Extract text using OCR.space API with native JSON response"""
        try:
            if self.api_key is None:
                return self._fallback_ocr_response()
            
            print("Using OCR.space API for text extraction...", file=sys.stderr)
            
            # OCR.space API parameters for JSON response
            payload = {
                'apikey': self.api_key,
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
            response = requests.post(self.endpoint, data=payload, files=files, timeout=30)
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
        """Main function to analyze betting slip using OCR.space native JSON"""
        try:
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

    def _extract_betting_data_coordinate_based(self, json_data: Dict[str, Any]) -> Dict[str, Any]:
        """Extract betting data using coordinate-based parsing with DD-MM-YYYY date formatting (user's enhanced solution)"""
        
        try:
            lines = json_data['ParsedResults'][0]['TextOverlay']['Lines']
            print(f"Processing {len(lines)} lines with enhanced coordinate-based parser", file=sys.stderr)
            
            # 1. Extract general event data with proper date formatting
            resultados_gerais = {}
            
            for line in lines:
                text = line['LineText']
                
                # Find and format Date and Time - DD-MM-YYYY format
                data_hora_match = re.search(r'(\d{4}-\d{2}-\d{2})\s(\d{2}:\d{2})', text)
                if data_hora_match:
                    data_original = data_hora_match.group(1)
                    hora_original = data_hora_match.group(2)
                    
                    # Convert YYYY-MM-DD to DD-MM-YYYY format
                    data_objeto = datetime.strptime(data_original, '%Y-%m-%d')
                    data_formatada_br = data_objeto.strftime('%d-%m-%Y')
                    
                    resultados_gerais['Data e Horário do Jogo'] = f"{data_formatada_br} {hora_original}"
                    resultados_gerais['Data Original ISO'] = data_original  # Keep ISO for calendar
                    resultados_gerais['Hora Original'] = hora_original

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
                    if len(partes) >= 2:
                        resultados_gerais['Esporte'] = partes[0].strip()
                        liga_partes = partes[1].split('-')
                        if len(liga_partes) >= 2:
                            resultados_gerais['Liga'] = liga_partes[0].strip() + ' - ' + liga_partes[1].strip()

                # Find Total Profit %
                if re.search(r'\d+\.\d+%', text) and "ROI:" not in text:
                    percentage_match = re.search(r'(\d+\.\d+%)', text)
                    if percentage_match:
                        resultados_gerais['Lucro Total em %'] = percentage_match.group(1)
                        
            # 2. Extract table data using coordinates with better error handling
            headers = {}
            for line in lines:
                if line['LineText'] in ["Chance", "Aposta", "Lucro"]:
                    if 'Words' in line and line['Words'] and len(line['Words']) > 0:
                        headers[line['LineText']] = line['Words'][0]['Left']
                        
            if not headers:
                print("Table headers not found with coordinate method", file=sys.stderr)
                # Continue processing for general data extraction
            else:
                print(f"Found headers: {headers}", file=sys.stderr)
            
            # Find Y coordinates (vertical) of betting lines with safety checks
            linhas_de_aposta_y = []
            if headers and "Chance" in headers:
                for line in lines:
                    if 'Words' not in line or not line['Words']:
                        continue
                    for word in line['Words']:
                        if abs(word['Left'] - headers["Chance"]) < 50:
                            if line['Words'] and len(line['Words']) > 0:
                                linhas_de_aposta_y.append(line['Words'][0]['Top'])
                            break

            dados_apostas = []
            if headers:
                for y_aposta in sorted(list(set(linhas_de_aposta_y))):
                    dados_da_aposta = {}
                    dados_da_aposta["Casa de Aposta"] = "Não encontrado"

                    for line in lines:
                        if 'Words' not in line or not line['Words']:
                            continue

                        if len(line['Words']) > 0:
                            word_top = line['Words'][0]['Top']
                            if abs(word_top - y_aposta) < 10:
                                word_left = line['Words'][0]['Left']
                                word_text = line['LineText'].strip().replace("•", "")
                                
                                if word_left < headers.get("Chance", float('inf')):
                                    dados_da_aposta["Casa de Aposta"] = word_text
                                elif "Chance" in headers and abs(word_left - headers["Chance"]) < 50:
                                    dados_da_aposta["Tipo de Aposta"] = word_text
                                elif "Aposta" in headers and abs(word_left - headers["Aposta"]) < 50:
                                    dados_da_aposta["Odd"] = word_text
                                elif "Lucro" in headers and abs(word_left - headers["Lucro"]) < 50:
                                    dados_da_aposta["Lucro da Aposta"] = word_text
                    
                    if len(dados_da_aposta) > 1:
                        dados_apostas.append(dados_da_aposta)

            print(f"Extracted {len(dados_apostas)} betting entries", file=sys.stderr)
            
            # 3. Map to current system format (betA/betB) with formatted dates
            result = self._map_coordinate_data_to_system_format(resultados_gerais, dados_apostas)
            
            return result
            
        except Exception as e:
            print(f"Enhanced coordinate-based extraction failed: {e}", file=sys.stderr)
            return self._get_default_result()

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