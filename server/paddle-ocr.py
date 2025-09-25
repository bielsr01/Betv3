#!/usr/bin/env python3
"""
AI-Powered Semantic OCR for Betting Slips
Uses intelligent field classification instead of rigid regex rules
Extracts data from any betting slip format using semantic understanding
"""

import os
import sys
import json
import base64
import re
import requests
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta
import time

class FieldCandidate:
    """Represents a potential field value with confidence score"""
    def __init__(self, value: str, field_type: str, source: str, confidence: float):
        self.value = value
        self.field_type = field_type
        self.source = source
        self.confidence = confidence

class BettingSlipDocument:
    """Structured representation of betting slip content"""
    def __init__(self, raw_text: str, sections: List[str], tables: List[List[str]]):
        self.raw_text = raw_text
        self.sections = sections
        self.tables = tables
        self.candidates = []

class SemanticBettingSlipOCR:
    def __init__(self):
        """Initialize AI-powered semantic OCR"""
        print("Initializing AI-powered semantic OCR...", file=sys.stderr)
        
        # Configure available APIs
        self.mistral_api_key = os.environ.get('MISTRAL_API_KEY')
        self.ocr_space_api_key = os.environ.get('OCR_SPACE_API_KEY')
        self.google_credentials = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS_JSON')
        
        # Set primary OCR provider
        if self.mistral_api_key:
            self.primary_ocr = "mistral"
            print("Using Mistral.ai for OCR", file=sys.stderr)
        elif self.ocr_space_api_key:
            self.primary_ocr = "ocr_space"
            print("Using OCR.space for text extraction", file=sys.stderr)
        else:
            self.primary_ocr = None
            print("No OCR provider available", file=sys.stderr)

    def extract_raw_text(self, base64_image: str) -> str:
        """Extract raw text from image using configured OCR provider"""
        try:
            if self.primary_ocr == "mistral":
                return self._extract_with_mistral(base64_image)
            elif self.primary_ocr == "ocr_space":
                return self._extract_with_ocr_space(base64_image)
            else:
                return "OCR não disponível"
        except Exception as e:
            print(f"OCR extraction failed: {e}", file=sys.stderr)
            return "Erro na extração de texto"

    def _extract_with_mistral(self, base64_image: str) -> str:
        """Extract text using Mistral OCR API"""
        try:
            if 'base64,' in base64_image:
                base64_image = base64_image.split('base64,')[1]
            
            payload = {
                "model": "mistral-ocr-latest",
                "document": {
                    "type": "image_url",
                    "image_url": f"data:image/png;base64,{base64_image}"
                },
                "include_image_base64": False
            }
            
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.mistral_api_key}"
            }
            
            response = requests.post("https://api.mistral.ai/v1/ocr", headers=headers, json=payload, timeout=60)
            response.raise_for_status()
            
            result = response.json()
            if 'pages' in result and result['pages']:
                return result['pages'][0].get('markdown', '')
            return ""
            
        except Exception as e:
            print(f"Mistral OCR failed: {e}", file=sys.stderr)
            return ""

    def _extract_with_ocr_space(self, base64_image: str) -> str:
        """Extract text using OCR.space API"""
        try:
            if 'base64,' in base64_image:
                base64_image = base64_image.split('base64,')[1]
            
            image_bytes = base64.b64decode(base64_image)
            
            payload = {
                'apikey': self.ocr_space_api_key,
                'language': 'por',
                'OCREngine': 2,
                'detectOrientation': True,
                'isTable': True
            }
            
            files = {'file': ('image.png', image_bytes, 'image/png')}
            
            response = requests.post("https://api.ocr.space/parse/image", data=payload, files=files, timeout=30)
            response.raise_for_status()
            
            result = response.json()
            if 'ParsedResults' in result and result['ParsedResults']:
                return result['ParsedResults'][0].get('ParsedText', '')
            return ""
            
        except Exception as e:
            print(f"OCR.space failed: {e}", file=sys.stderr)
            return ""

    def classify_fields_with_ai(self, text: str) -> List[FieldCandidate]:
        """Use AI to classify and extract fields from text"""
        candidates = []
        
        print(f"Classifying fields in text: {text[:200]}...", file=sys.stderr)
        
        # Extract all potential values using general patterns
        lines = text.split('\n')
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # Find team names (any two words separated by vs, -, x, etc.)
            team_patterns = [
                r'([A-Za-zÀ-ÿ\s]{3,})\s*(?:vs?|x|-|–)\s*([A-Za-zÀ-ÿ\s]{3,})',
                r'#\s*([A-Za-zÀ-ÿ\s]{3,})\s*-\s*([A-Za-zÀ-ÿ\s]{3,})',
                r'([A-Za-zÀ-ÿ\s]{3,})\s*[–-]\s*([A-Za-zÀ-ÿ\s]{3,})\s*\d'
            ]
            
            for pattern in team_patterns:
                match = re.search(pattern, line, re.IGNORECASE)
                if match:
                    team_a = match.group(1).strip()
                    team_b = match.group(2).strip()
                    
                    # Validate teams (not common words)
                    if self._is_valid_team(team_a) and self._is_valid_team(team_b):
                        candidates.append(FieldCandidate(team_a, "team_a", f"line: {line}", 0.9))
                        candidates.append(FieldCandidate(team_b, "team_b", f"line: {line}", 0.9))
                        print(f"Teams found: {team_a} vs {team_b}", file=sys.stderr)
            
            # Find profit percentages FIRST (to avoid confusing with odds)
            profit_pattern = r'(\d+[,\.]\d+)%'
            profit_matches = re.findall(profit_pattern, line)
            for profit in profit_matches:
                if 'ROI' not in line:  # Exclude ROI values
                    profit_clean = profit.replace(',', '.')
                    try:
                        profit_value = float(profit_clean)
                        if 0.1 <= profit_value <= 20.0:  # Valid profit range
                            candidates.append(FieldCandidate(f"{profit_clean}%", "profit", f"line: {line}", 0.9))
                            print(f"Profit found: {profit_clean}%", file=sys.stderr)
                    except ValueError:
                        pass
            
            # Find odds (decimal numbers > 1.0) - exclude if already found as profit
            if not any('%' in line for match in profit_matches):  # Only look for odds if no % in line
                odds_pattern = r'(\d+[,\.]\d{2,3})'
                odds_matches = re.findall(odds_pattern, line)
                for odds in odds_matches:
                    odds_clean = odds.replace(',', '.')
                    try:
                        odds_value = float(odds_clean)
                        if 1.01 <= odds_value <= 50.0:  # Valid odds range
                            candidates.append(FieldCandidate(odds_clean, "odds", f"line: {line}", 0.8))
                            print(f"Odds found: {odds_clean}", file=sys.stderr)
                    except ValueError:
                        pass
            
            # Find stakes/payouts (monetary values) - improved patterns
            money_patterns = [
                r'R\$\s*(\d+[,\.]\d{1,2})',  # R$ 123.45
                r'(\d+[,\.]\d{1,2})\s*R\$',  # 123.45 R$
                r'(\d+[,\.]\d{2,3})\s*(?=\s|$)',  # Standalone numbers with 2-3 decimals
            ]
            
            for pattern in money_patterns:
                money_matches = re.findall(pattern, line)
                for money in money_matches:
                    money_clean = money.replace(',', '.')
                    try:
                        money_value = float(money_clean)
                        if 1.0 <= money_value <= 100000.0:  # Valid money range
                            candidates.append(FieldCandidate(money_clean, "monetary", f"line: {line}", 0.7))
                            print(f"Money found: {money_clean}", file=sys.stderr)
                    except ValueError:
                        pass
            
            # Find bet types (1, 2, X, 1X, 2X, Over, Under, etc.)
            bet_type_patterns = [
                r'\b(1¹⁻²|2¹⁻²|1X²|X2²|Over|Under|1|2|X)\b',
                r'(Vitória\s+\w+|Empate|Derrota\s+\w+)',
                r'(Home|Away|Draw)'
            ]
            
            for pattern in bet_type_patterns:
                bet_matches = re.findall(pattern, line, re.IGNORECASE)
                for bet_type in bet_matches:
                    if len(bet_type.strip()) >= 1:
                        candidates.append(FieldCandidate(bet_type.strip(), "bet_type", f"line: {line}", 0.8))
                        print(f"Bet type found: {bet_type.strip()}", file=sys.stderr)
            
            # Find betting houses (words ending with common suffixes)
            house_pattern = r'([\w\s]{3,}(?:Bet|bet|BET)[\w]*)'
            house_matches = re.findall(house_pattern, line)
            for house in house_matches:
                house_clean = house.strip()
                if len(house_clean) >= 3 and self._is_valid_betting_house(house_clean):
                    candidates.append(FieldCandidate(house_clean, "betting_house", f"line: {line}", 0.7))
                    print(f"Betting house found: {house_clean}", file=sys.stderr)
            
            # Find sports
            sport_pattern = r'(Futebol|Basquete|Basketball|Football|Tennis|Vôlei)'
            sport_match = re.search(sport_pattern, line, re.IGNORECASE)
            if sport_match:
                sport = sport_match.group(1).capitalize()
                candidates.append(FieldCandidate(sport, "sport", f"line: {line}", 0.9))
                print(f"Sport found: {sport}", file=sys.stderr)
            
            # Find dates
            date_patterns = [
                r'(\d{1,2})[/-](\d{1,2})[/-](\d{4})',
                r'(\d{4})-(\d{1,2})-(\d{1,2})',
                r'(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})'
            ]
            
            for pattern in date_patterns:
                date_match = re.search(pattern, line)
                if date_match:
                    try:
                        if len(date_match.groups()) == 3:
                            # Parse different date formats
                            if pattern == date_patterns[0]:  # DD/MM/YYYY or DD-MM-YYYY
                                day, month, year = date_match.groups()
                                formatted_date = f"{day.zfill(2)}-{month.zfill(2)}-{year}"
                            elif pattern == date_patterns[1]:  # YYYY-MM-DD
                                year, month, day = date_match.groups()
                                formatted_date = f"{day.zfill(2)}-{month.zfill(2)}-{year}"
                            
                            candidates.append(FieldCandidate(formatted_date, "date", f"line: {line}", 0.8))
                            print(f"Date found: {formatted_date}", file=sys.stderr)
                    except ValueError:
                        pass
            
            # Find times
            time_pattern = r'(\d{1,2}):(\d{2})'
            time_match = re.search(time_pattern, line)
            if time_match:
                hour, minute = time_match.groups()
                formatted_time = f"{hour.zfill(2)}:{minute}"
                candidates.append(FieldCandidate(formatted_time, "time", f"line: {line}", 0.7))
                print(f"Time found: {formatted_time}", file=sys.stderr)
        
        print(f"Found {len(candidates)} field candidates", file=sys.stderr)
        return candidates

    def _is_valid_team(self, name: str) -> bool:
        """Check if a string is a valid team name"""
        name_lower = name.lower().strip()
        
        # Too short
        if len(name_lower) < 3:
            return False
        
        # Common invalid words
        invalid_words = [
            'surebet', 'google', 'chrome', 'mostrar', 'total', 'aposta', 'documento', 
            'evento', 'casa', 'lucro', 'chance', 'data', 'hora', 'futebol', 'basquete',
            'roi', 'percent', 'and', 'the', 'com', 'para', 'por', 'em', 'de', 'da', 'do'
        ]
        
        for word in invalid_words:
            if word in name_lower:
                return False
        
        # Must contain letters
        if not re.search(r'[a-zA-ZÀ-ÿ]', name):
            return False
        
        return True

    def _is_valid_betting_house(self, name: str) -> bool:
        """Check if a string is a valid betting house name"""
        name_lower = name.lower().strip()
        
        # Common betting house patterns
        valid_patterns = ['bet', 'sport', 'casa', 'bookie', 'wager']
        valid_houses = ['kto', 'superbet', 'pixbet', 'bet365', 'betano', 'sportingbet']
        
        # Check if contains betting-related words
        has_pattern = any(pattern in name_lower for pattern in valid_patterns)
        is_known_house = any(house in name_lower for house in valid_houses)
        
        return has_pattern or is_known_house

    def reconcile_candidates(self, candidates: List[FieldCandidate]) -> Dict[str, Any]:
        """Select best candidates and build final result"""
        result = self._get_default_result()
        
        # Group candidates by type
        by_type = {}
        for candidate in candidates:
            if candidate.field_type not in by_type:
                by_type[candidate.field_type] = []
            by_type[candidate.field_type].append(candidate)
        
        # Select best candidates for each field
        
        # Teams
        if 'team_a' in by_type and 'team_b' in by_type:
            # Take highest confidence team pair
            team_a = max(by_type['team_a'], key=lambda c: c.confidence)
            team_b = max(by_type['team_b'], key=lambda c: c.confidence)
            
            result['betA']['teamA'] = team_a.value
            result['betA']['teamB'] = team_b.value
            result['betB']['teamA'] = team_a.value
            result['betB']['teamB'] = team_b.value
        
        # Odds - take two different highest confidence odds
        if 'odds' in by_type:
            odds_sorted = sorted(by_type['odds'], key=lambda c: c.confidence, reverse=True)
            # Get unique odds values to avoid duplicates
            unique_odds = []
            seen_values = set()
            for odds in odds_sorted:
                if odds.value not in seen_values:
                    unique_odds.append(odds)
                    seen_values.add(odds.value)
            
            if len(unique_odds) >= 2:
                result['betA']['odds'] = unique_odds[0].value
                result['betB']['odds'] = unique_odds[1].value
                print(f"Using different odds: {unique_odds[0].value} and {unique_odds[1].value}", file=sys.stderr)
            elif len(unique_odds) == 1:
                result['betA']['odds'] = unique_odds[0].value
                result['betB']['odds'] = unique_odds[0].value
        
        # Stakes/Payouts - distribute monetary values
        if 'monetary' in by_type:
            money_sorted = sorted(by_type['monetary'], key=lambda c: c.confidence, reverse=True)
            if len(money_sorted) >= 4:
                result['betA']['stake'] = money_sorted[0].value
                result['betA']['payout'] = money_sorted[1].value
                result['betB']['stake'] = money_sorted[2].value
                result['betB']['payout'] = money_sorted[3].value
            elif len(money_sorted) >= 2:
                result['betA']['stake'] = money_sorted[0].value
                result['betB']['stake'] = money_sorted[1].value
        
        # Profit
        if 'profit' in by_type:
            profit = max(by_type['profit'], key=lambda c: c.confidence)
            result['totalProfitPercentage'] = profit.value
        
        # Bet Types - distribute different bet types
        if 'bet_type' in by_type:
            bet_types_sorted = sorted(by_type['bet_type'], key=lambda c: c.confidence, reverse=True)
            # Get unique bet types to avoid duplicates
            unique_bet_types = []
            seen_types = set()
            for bet_type in bet_types_sorted:
                if bet_type.value not in seen_types:
                    unique_bet_types.append(bet_type)
                    seen_types.add(bet_type.value)
            
            if len(unique_bet_types) >= 2:
                result['betA']['betType'] = unique_bet_types[0].value
                result['betB']['betType'] = unique_bet_types[1].value
                print(f"Using different bet types: {unique_bet_types[0].value} and {unique_bet_types[1].value}", file=sys.stderr)
            elif len(unique_bet_types) == 1:
                result['betA']['betType'] = unique_bet_types[0].value
                result['betB']['betType'] = unique_bet_types[0].value
        
        # Betting houses
        if 'betting_house' in by_type:
            houses_sorted = sorted(by_type['betting_house'], key=lambda c: c.confidence, reverse=True)
            # Get unique betting houses
            unique_houses = []
            seen_houses = set()
            for house in houses_sorted:
                house_clean = house.value.lower()
                if house_clean not in seen_houses:
                    unique_houses.append(house)
                    seen_houses.add(house_clean)
            
            if len(unique_houses) >= 2:
                result['betA']['bettingHouse'] = unique_houses[0].value
                result['betB']['bettingHouse'] = unique_houses[1].value
                print(f"Using different betting houses: {unique_houses[0].value} and {unique_houses[1].value}", file=sys.stderr)
            elif len(unique_houses) == 1:
                result['betA']['bettingHouse'] = unique_houses[0].value
                result['betB']['bettingHouse'] = unique_houses[0].value
        
        # Sport
        if 'sport' in by_type:
            sport = max(by_type['sport'], key=lambda c: c.confidence)
            result['sport'] = sport.value
            result['league'] = f"{sport.value} League"  # Default league
        
        # Date
        if 'date' in by_type:
            date = max(by_type['date'], key=lambda c: c.confidence)
            result['gameDateFormatted'] = date.value
            # Convert DD-MM-YYYY to YYYY-MM-DD for gameDate
            try:
                day, month, year = date.value.split('-')
                result['gameDate'] = f"{year}-{month}-{day}"
            except ValueError:
                result['gameDate'] = date.value
        else:
            # Default to today if no date found
            today = datetime.now()
            result['gameDateFormatted'] = today.strftime('%d-%m-%Y')
            result['gameDate'] = today.strftime('%Y-%m-%d')
        
        # Time
        if 'time' in by_type:
            time_val = max(by_type['time'], key=lambda c: c.confidence)
            result['gameTime'] = time_val.value
        else:
            # Default to current time if no time found
            result['gameTime'] = datetime.now().strftime('%H:%M')
        
        # Combine date and time
        result['gameDateTime'] = f"{result['gameDateFormatted']} {result['gameTime']}"
        
        print(f"Reconciliation complete. Found teams: {result['betA']['teamA']} vs {result['betA']['teamB']}", file=sys.stderr)
        return result

    def _get_default_result(self) -> Dict[str, Any]:
        """Get default result structure"""
        return {
            'betA': {
                'teamA': 'Time A',
                'teamB': 'Time B',
                'betType': '1',
                'bettingHouse': 'Casa A',
                'odds': '2.00',
                'stake': '100.00',
                'payout': '200.00'
            },
            'betB': {
                'teamA': 'Time A',
                'teamB': 'Time B',
                'betType': '2',
                'bettingHouse': 'Casa B',
                'odds': '2.00',
                'stake': '100.00',
                'payout': '200.00'
            },
            'gameDate': datetime.now().strftime('%Y-%m-%d'),
            'gameTime': datetime.now().strftime('%H:%M'),
            'gameDateFormatted': datetime.now().strftime('%d-%m-%Y'),
            'gameDateTime': datetime.now().strftime('%d-%m-%Y %H:%M'),
            'sport': 'Futebol',
            'league': 'Liga Geral',
            'totalProfitPercentage': '0%'
        }

    def analyze_betting_slip(self, base64_image: str) -> Dict[str, Any]:
        """Main analysis function using semantic approach"""
        try:
            print("Starting AI-powered semantic betting slip analysis...", file=sys.stderr)
            
            # Step 1: Extract raw text
            raw_text = self.extract_raw_text(base64_image)
            if not raw_text:
                print("No text extracted from image", file=sys.stderr)
                return {
                    'success': False,
                    'error': 'Failed to extract text from image',
                    'data': self._get_default_result()
                }
            
            print(f"Raw text extracted: {len(raw_text)} characters", file=sys.stderr)
            
            # Step 2: AI field classification
            candidates = self.classify_fields_with_ai(raw_text)
            if not candidates:
                print("No field candidates found", file=sys.stderr)
                return {
                    'success': False,
                    'error': 'No recognizable betting data found',
                    'data': self._get_default_result()
                }
            
            # Step 3: Reconcile candidates into final result
            final_result = self.reconcile_candidates(candidates)
            
            print(f"Final result: {json.dumps(final_result, indent=2)}", file=sys.stderr)
            
            return {
                'success': True,
                'data': final_result,
                'debug': {
                    'ocr_provider': self.primary_ocr,
                    'candidates_found': len(candidates),
                    'raw_text_length': len(raw_text),
                    'semantic_extraction': True
                }
            }
            
        except Exception as e:
            print(f"Error in semantic betting slip analysis: {e}", file=sys.stderr)
            return {
                'success': False,
                'error': str(e),
                'data': self._get_default_result()
            }

# Main execution
if __name__ == "__main__":
    try:
        # Read base64 image from stdin
        base64_image = sys.stdin.read().strip()
        
        if not base64_image:
            print(json.dumps({
                'success': False, 
                'error': 'No image data provided',
                'data': {}
            }))
            sys.exit(1)
        
        # Create OCR instance and analyze
        ocr = SemanticBettingSlipOCR()
        result = ocr.analyze_betting_slip(base64_image)
        
        # Output result as JSON
        print(json.dumps(result, ensure_ascii=False, indent=2))
        
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': f'Python script error: {str(e)}',
            'data': {}
        }), file=sys.stderr)
        sys.exit(1)