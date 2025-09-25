#!/usr/bin/env python3
"""
OCR.space API implementation for OCR and structured data extraction
Optimized for betting slip data extraction with JSON response and special character support
Using Engine 2 for enhanced accuracy and special characters (≥, ≤, acentos, etc.)
"""

import os
import sys
import json
import base64
import re
import requests
from typing import Dict, List, Any, Optional
from io import BytesIO
import time

class BettingSlipOCR:
    def __init__(self):
        """Initialize OCR.space API client"""
        print("Initializing OCR.space API...", file=sys.stderr)
        
        try:
            # Get API key from environment variables
            self.api_key = os.environ.get('OCR_SPACE_API_KEY')
            
            if self.api_key:
                # OCR.space API endpoint
                self.endpoint = "https://api.ocr.space/parse/image"
                print("OCR.space API initialized successfully", file=sys.stderr)
            else:
                print("OCR.space API key not found, using fallback mode", file=sys.stderr)
                self.api_key = None
                
        except Exception as e:
            print(f"Failed to initialize OCR.space API: {e}", file=sys.stderr)
            print("Using fallback mode", file=sys.stderr)
            self.api_key = None

    def decode_base64_image(self, base64_string: str) -> bytes:
        """Decode base64 image string to bytes for OCR API"""
        try:
            # Remove data URL prefix if present
            if 'base64,' in base64_string:
                base64_string = base64_string.split('base64,')[1]
            
            # Decode base64 to bytes
            image_data = base64.b64decode(base64_string)
            
            return image_data
            
        except Exception as e:
            print(f"Error decoding base64 image: {e}", file=sys.stderr)
            raise

    def extract_text_with_ocr_space(self, image_bytes: bytes) -> Dict[str, Any]:
        """Extract text using OCR.space API with Engine 2 for special characters"""
        try:
            if self.api_key is None:
                print("OCR.space API not available, using fallback", file=sys.stderr)
                return self._fallback_ocr_response()
            
            print("Using OCR.space API for text extraction", file=sys.stderr)
            
            # Prepare the request payload
            payload = {
                'apikey': self.api_key,
                'language': 'por',  # Portuguese for better results with BR betting houses
                'isOverlayRequired': True,  # Get coordinates
                'OCREngine': 2,  # Engine 2 for special characters support
                'detectOrientation': True,
                'scale': True,
                'isTable': True  # Better for table-like betting data
            }
            
            # Prepare the file upload
            files = {
                'file': ('betting_slip.jpg', image_bytes, 'image/jpeg')
            }
            
            # Make the API request
            response = requests.post(self.endpoint, data=payload, files=files, timeout=30)
            response.raise_for_status()
            
            ocr_result = response.json()
            print(f"OCR.space response: {json.dumps(ocr_result, indent=2)}", file=sys.stderr)
            
            return ocr_result
            
        except requests.exceptions.RequestException as e:
            print(f"HTTP error in OCR.space API: {e}", file=sys.stderr)
            return self._fallback_ocr_response()
        except Exception as e:
            print(f"Error in OCR.space text extraction: {e}", file=sys.stderr)
            return self._fallback_ocr_response()

    def _fallback_ocr_response(self) -> Dict[str, Any]:
        """Fallback OCR response structure"""
        return {
            "ParsedResults": [{
                "TextOverlay": {
                    "Lines": [],
                    "HasOverlay": False,
                    "Message": "Text overlay is not provided as it was not requested"
                },
                "TextOrientation": "0",
                "FileParseExitCode": 1,
                "ParsedText": "",
                "ErrorMessage": "OCR API not available",
                "ErrorDetails": ""
            }],
            "OCRExitCode": 4,
            "IsErroredOnProcessing": True,
            "ErrorMessage": ["OCR API not available"],
            "ErrorDetails": "",
            "ProcessingTimeInMilliseconds": "0"
        }

    def analyze_betting_slip(self, base64_image: str) -> Dict[str, Any]:
        """Main function to analyze betting slip and extract structured data"""
        try:
            print("Starting OCR.space betting slip analysis...", file=sys.stderr)
            
            # Decode image to bytes
            image_bytes = self.decode_base64_image(base64_image)
            print(f"Image size: {len(image_bytes)} bytes", file=sys.stderr)
            
            # Extract text using OCR.space API
            ocr_result = self.extract_text_with_ocr_space(image_bytes)
            
            # Parse the OCR result into betting slip structure
            parsed_result = self.parse_ocr_space_result(ocr_result)
            
            print(f"Final parsed result: {parsed_result}", file=sys.stderr)
            
            return {
                'success': True,
                'data': parsed_result,
                'debug': {
                    'ocr_exit_code': ocr_result.get('OCRExitCode'),
                    'processing_time': ocr_result.get('ProcessingTimeInMilliseconds'),
                    'parsed_text_preview': ocr_result.get('ParsedResults', [{}])[0].get('ParsedText', '')[:200] if ocr_result.get('ParsedResults') else ''
                }
            }
            
        except Exception as e:
            print(f"Error in betting slip analysis: {e}", file=sys.stderr)
            return {
                'success': False,
                'error': str(e),
                'data': self._get_default_result()
            }

    def parse_ocr_space_result(self, ocr_result: Dict[str, Any]) -> Dict[str, Any]:
        """Parse OCR.space JSON result into betting slip structure"""
        
        result = self._get_default_result()
        
        # Check if OCR was successful
        if ocr_result.get('IsErroredOnProcessing', True):
            print("OCR processing failed", file=sys.stderr)
            return result
        
        parsed_results = ocr_result.get('ParsedResults', [])
        if not parsed_results:
            print("No parsed results found", file=sys.stderr)
            return result
        
        # Get the main parsed text
        parsed_text = parsed_results[0].get('ParsedText', '')
        print(f"Extracted text: {parsed_text}", file=sys.stderr)
        
        # Get text overlay for coordinates if available
        text_overlay = parsed_results[0].get('TextOverlay', {})
        lines = text_overlay.get('Lines', []) if text_overlay.get('HasOverlay') else []
        
        # Extract structured data from parsed text
        result = self._extract_betting_data_from_text(parsed_text, lines)
        
        return result

    def _extract_betting_data_from_text(self, text: str, lines: List[Dict]) -> Dict[str, Any]:
        """Extract betting data from OCR.space parsed text using enhanced patterns"""
        
        result = self._get_default_result()
        
        # Clean and normalize text
        text = text.replace('\r\n', '\n').replace('\r', '\n')
        print(f"Processing text: {text[:500]}...", file=sys.stderr)
        
        # 1. Extract teams using enhanced patterns for real-world names
        teams = self._extract_teams_from_text(text)
        if teams:
            result['betA']['teamA'] = teams['teamA']
            result['betA']['teamB'] = teams['teamB']
            result['betB']['teamA'] = teams['teamA']
            result['betB']['teamB'] = teams['teamB']
            print(f"Teams extracted: {teams['teamA']} vs {teams['teamB']}", file=sys.stderr)
        
        # 2. Extract percentage (avoid ROI percentage)
        percentage_patterns = [
            r'([A-Za-zÀ-ÿ]+)\s*[-–]\s*([A-Za-zÀ-ÿ]+)(\d+\.\d+)\s*%',  # "Lille - Lyon2.50%"
            r'([A-Za-zÀ-ÿ]+)\s*[-–]\s*([A-Za-zÀ-ÿ]+)\s+(\d+\.\d+)\s*%'  # "Lille - Lyon 2.50%"
        ]
        
        for pattern in percentage_patterns:
            match = re.search(pattern, text)
            if match and 'roi' not in match.group(0).lower():
                result['totalProfitPercentage'] = match.group(3) + '%'
                print(f"Profit percentage: {match.group(3)}%", file=sys.stderr)
                break
        
        # 3. Extract date and time
        date_match = re.search(r'(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})', text)
        if date_match:
            result['gameDate'] = date_match.group(1)
            result['gameTime'] = date_match.group(2)
            print(f"Date/time: {date_match.group(1)} {date_match.group(2)}", file=sys.stderr)
        
        # 4. Extract sport and league
        sport_league = self._extract_sport_league_from_text(text)
        if sport_league:
            result['sport'] = sport_league.get('sport', 'Futebol')
            league_clean = sport_league.get('league', '')
            # Clean league from table headers and extra content
            league_clean = re.sub(r'\t.*$', '', league_clean)  # Remove tab and everything after
            league_clean = re.sub(r'\nChance.*$', '', league_clean, flags=re.DOTALL)  # Remove table headers
            result['league'] = league_clean.strip()
            print(f"Sport: {result['sport']}, League: {result['league']}", file=sys.stderr)
        
        # 5. Extract betting houses data with enhanced patterns
        betting_data = self._extract_betting_houses_from_text(text, lines)
        if betting_data:
            if 'betA' in betting_data:
                result['betA'].update(betting_data['betA'])
            if 'betB' in betting_data:
                result['betB'].update(betting_data['betB'])
        
        return result

    def _extract_teams_from_text(self, text: str) -> Optional[Dict[str, str]]:
        """Extract team names optimized for OCR.space format"""
        
        # Clean text from OCR.space format issues
        text_clean = re.sub(r'[\t\r\n]+', ' ', text)
        text_clean = re.sub(r'\s+', ' ', text_clean)
        
        # Enhanced patterns for OCR.space output format
        team_patterns = [
            # Direct pattern for "Lille - Lyon2.50%" (OCR.space often concatenates)
            r'([A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ&]+)*)\s*[-–]\s*([A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ&]+)*?)(\d+\.\d+)\s*%',
            # Pattern with spacing "Lille - Lyon 2.50%"
            r'([A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ&]+)*)\s*[-–]\s*([A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ&]+)*)\s+(\d+\.\d+)\s*%',
            # General team pattern without percentage
            r'([A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ&]+)*)\s*[-–]\s*([A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ&]+)*)'
        ]
        
        for pattern in team_patterns:
            match = re.search(pattern, text_clean, re.IGNORECASE)
            if match:
                teamA = match.group(1).strip()
                teamB = match.group(2).strip()
                
                # Clean any remaining unwanted characters and prefixes
                teamA = re.sub(r'^[^\w]+|[^\w]+$', '', teamA)
                teamB = re.sub(r'^[^\w]+|[^\w]+$', '', teamB)
                
                # Remove common OCR artifacts/prefixes
                teamA = re.sub(r'^[O]\s+', '', teamA)  # Remove "O " prefix
                teamB = re.sub(r'^[O]\s+', '', teamB) 
                
                # Filter out non-teams
                non_teams = ['surebet', 'google', 'chrome', 'evento', 'futebol', 'apostas', 'roi', 'chance', 'lucro', 'total', 'mostrar', 'use', 'arredondar', 'levar', 'pt', 'dias', 'br', 'usd', 'aposta', 'calculadora', 'co', 'do']
                
                if (len(teamA) >= 2 and len(teamB) >= 2 and teamA != teamB and
                    not any(word.lower() in teamA.lower() for word in non_teams) and
                    not any(word.lower() in teamB.lower() for word in non_teams) and
                    not teamA.isdigit() and not teamB.isdigit()):
                    
                    return {
                        'teamA': teamA,
                        'teamB': teamB
                    }
        
        return None

    def _extract_sport_league_from_text(self, text: str) -> Optional[Dict[str, str]]:
        """Extract sport and league information"""
        
        # Default sport detection
        sport = 'Futebol'
        if 'americano' in text.lower():
            sport = 'Futebol Americano'
        elif 'basketball' in text.lower() or 'basquete' in text.lower():
            sport = 'Basketball'
        
        # League patterns
        league_patterns = [
            r'Futebol\s*/\s*([A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+)*)\s*[-–]\s*([A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ0-9]+)*)',
            r'([A-Za-zÀ-ÿ]+)\s*[-–]\s*(Premier\s+League|Ligue\s+\d+|Championship|Serie\s+A|Bundesliga|La\s+Liga|College|UEFA|Champions)',
            r'([A-Za-zÀ-ÿ]+)\s*[-–]\s*([A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ0-9]+)*)'
        ]
        
        for pattern in league_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match and not any(skip in match.group(0).lower() for skip in ['surebet', 'google', 'chrome', 'roi', 'evento', 'apostas']):
                country = match.group(1).strip()
                league = match.group(2).strip()
                
                if len(country) >= 3 and len(league) >= 3 and country != league:
                    return {
                        'sport': sport,
                        'league': f"{country} - {league}"
                    }
        
        return {'sport': sport, 'league': ''}

    def _extract_betting_houses_from_text(self, text: str, lines: List[Dict]) -> Optional[Dict[str, Any]]:
        """Extract betting house data with comprehensive patterns for all bet types"""
        
        betting_houses = []
        
        # Split text into lines for processing
        text_lines = text.split('\n')
        
        print(f"Processing {len(text_lines)} lines for betting data", file=sys.stderr)
        
        for i, line in enumerate(text_lines):
            line_clean = line.strip()
            if not line_clean:
                continue
            
            print(f"Line {i}: {line_clean}", file=sys.stderr)
            
            # Skip non-betting lines
            if not any(house in line_clean.lower() for house in ['betnacional', 'kto', 'blaze', 'betfast', 'marjosports', '(br)']):
                continue
            
            # Enhanced betting patterns with special character support
            betting_info = self._parse_betting_line_enhanced(line_clean)
            if betting_info:
                betting_houses.append(betting_info)
                print(f"Extracted betting house: {betting_info}", file=sys.stderr)
        
        # Structure the results
        if betting_houses:
            result = {}
            if len(betting_houses) >= 1:
                result['betA'] = betting_houses[0]
            if len(betting_houses) >= 2:
                result['betB'] = betting_houses[1]
            return result
        
        return None

    def _parse_betting_line_enhanced(self, line: str) -> Optional[Dict[str, str]]:
        """Parse betting line with enhanced support for all bet types and special characters"""
        
        # Normalize special characters
        line = line.replace('≥', '>=').replace('≤', '<=').replace('&amp;', '&').replace('·', '.').replace('º', '°')
        
        # OCR.space optimized patterns for compressed format
        patterns = [
            # Betnacional H1: "Betnacional (BR)H1(+0.5) - escanteios1.83056.01USD V2.50"
            {
                'pattern': r'(betnacional)\s*\(br\)(.*?escanteios)(\d+\.\d+)(\d+\.\d+)usd\s*v?\s*(\d+\.\d+)',
                'groups': ['house', 'bet_type', 'odds', 'stake', 'profit']
            },
            # KTO flexible: "KTO (BR)2 - escanteios2.330 •43.99USD V2.50"
            {
                'pattern': r'(kto)\s*\(br\)\s*(.*?)(?=\d+\.\d+)(\d+\.\d+)\s*[•·\u2022\u00b7]?\s*(\d+\.\d+)\s*usd\s*v?\s*(\d+\.\d+)',
                'groups': ['house', 'bet_type', 'odds', 'stake', 'profit']
            },
            # Blaze: "Blaze (BR) Abaixo 3.5 - cartões 2º o time R 1.340 · 75.81 USD v 1.59"
            {
                'pattern': r'(blaze)\s*\(br\)\s*(.*?)r?\s*(\d+\.\d+)\s*[·•]?\s*(\d+\.\d+)\s*usd\s*v?\s*(\d+\.\d+)',
                'groups': ['house', 'bet_type', 'odds', 'stake', 'profit']
            },
            # MarjoSports: "MarjoSports (BR) Total 24 - cartões 2º o time 4.200 R 24.19 USD v 1.60"
            {
                'pattern': r'(marjosports)\s*\(br\)\s*(.*?)(\d+\.\d+)\s*r?\s*(\d+\.\d+)\s*usd\s*v?\s*(\d+\.\d+)',
                'groups': ['house', 'bet_type', 'odds', 'stake', 'profit']
            },
            # Generic pattern for any (BR) house with compressed format
            {
                'pattern': r'(\w+)\s*\(br\)\s*(.*?)(\d+\.\d+)(\d+\.\d+)usd\s*v?\s*(\d+\.\d+)',
                'groups': ['house', 'bet_type', 'odds', 'stake', 'profit']
            },
            # Generic with spaces
            {
                'pattern': r'(\w+)\s*\(br\)\s*(.*?)(\d+\.\d+)\s+(\d+\.\d+)\s*usd\s*v?\s*(\d+\.\d+)',
                'groups': ['house', 'bet_type', 'odds', 'stake', 'profit']
            }
        ]
        
        for pattern_info in patterns:
            match = re.search(pattern_info['pattern'], line, re.IGNORECASE)
            if match:
                groups = match.groups()
                print(f"Betting pattern matched: {groups}", file=sys.stderr)
                
                if len(groups) >= 5:
                    house = groups[0].capitalize()
                    bet_type = groups[1].strip()
                    odds = groups[2]
                    stake = groups[3]
                    profit = groups[4]
                    
                    # Clean bet type
                    bet_type = re.sub(r'\s+', ' ', bet_type)
                    bet_type = bet_type.replace('º', '°').replace('2°', '2º')
                    
                    return {
                        'bettingHouse': f"{house} (BR)",
                        'betType': bet_type,
                        'odds': odds,
                        'stake': stake,
                        'profit': profit
                    }
        
        return None

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
        
        # Initialize OCR
        ocr_engine = BettingSlipOCR()
        
        # Analyze betting slip
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