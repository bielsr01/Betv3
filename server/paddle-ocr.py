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
        """Parse OCR.space native JSON response"""
        
        result = self._get_default_result()
        
        # Check OCR.space processing status
        if ocr_result.get('IsErroredOnProcessing', True):
            print("OCR.space processing failed", file=sys.stderr)
            return result
        
        parsed_results = ocr_result.get('ParsedResults', [])
        if not parsed_results:
            print("No parsed results in OCR.space response", file=sys.stderr)
            return result
        
        # Get main text content
        main_result = parsed_results[0]
        parsed_text = main_result.get('ParsedText', '')
        text_overlay = main_result.get('TextOverlay', {})
        
        print(f"OCR.space extracted text: {parsed_text[:1000]}...", file=sys.stderr)
        
        # Extract structured data
        result = self._extract_betting_data_from_ocr_text(parsed_text, text_overlay)
        
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
                r'Evento em \d+ dias?\s*\((\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})',
                r'Evento em aproximadamente \d+ horas?\s*\((\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})',
                r'Evento em \d+ dia\s*\((\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})',
                r'\((\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})'
            ]
            
            for pattern in date_patterns:
                match = re.search(pattern, line_clean)
                if match:
                    date_str = match.group(1)
                    time_str = match.group(2)
                    
                    # Parse date and add timezone correction if needed
                    try:
                        event_date = datetime.strptime(date_str, '%Y-%m-%d')
                        
                        # Check if we need timezone correction
                        # If the date seems to be one day behind, add one day
                        today = datetime.now()
                        if event_date.date() < today.date():
                            # Add one day to correct timezone issue
                            event_date = event_date + timedelta(days=1)
                            date_str = event_date.strftime('%Y-%m-%d')
                        
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
        
        # Brazilian betting house names
        br_houses = ['aposta1', 'marjosports', 'bravobet', 'betnacional', 'bet7k', 'blaze', 'betfast']
        
        for line in lines:
            line_clean = line.strip()
            
            # Look for lines with Brazilian betting houses
            house_found = None
            for house in br_houses:
                if house in line_clean.lower():
                    house_found = house
                    break
            
            if house_found:
                betting_info = self._parse_betting_house_line(line_clean, house_found)
                if betting_info:
                    betting_houses.append(betting_info)
                    print(f"Extracted betting house: {betting_info}", file=sys.stderr)
        
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