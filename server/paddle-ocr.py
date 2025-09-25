#!/usr/bin/env python3
"""
PaddleOCR implementation for table detection and structured data extraction
Optimized for betting slip data extraction with table recognition
"""

import os
import sys
import json
import base64
import numpy as np
import cv2
from io import BytesIO
from PIL import Image
import pandas as pd
from paddleocr import PaddleOCR, PPStructure
import re
from typing import Dict, List, Any, Optional

# Configure PaddleOCR for CPU performance
os.environ['OMP_NUM_THREADS'] = '4'
os.environ['OPENBLAS_NUM_THREADS'] = '1'

class BettingSlipOCR:
    def __init__(self):
        """Initialize PaddleOCR with table detection capabilities"""
        print("Initializing PaddleOCR with table detection...", file=sys.stderr)
        
        # Initialize standard OCR for text recognition
        self.ocr = PaddleOCR(
            use_angle_cls=True,
            lang='en+pt',  # English + Portuguese
            use_gpu=False,
            cpu_threads=4,
            enable_mkldnn=True,  # Intel MKL optimization
            det_limit_side_len=960,
            det_limit_type='max',
            show_log=False
        )
        
        # Initialize PP-Structure for table detection and structure recognition
        self.table_engine = PPStructure(
            table=True,           # Enable table recognition
            ocr=True,            # Enable OCR within tables
            show_log=False,      # Reduce noise
            lang='en+pt',        # Multi-language support
            use_gpu=False,
            cpu_threads=4
        )
        
        print("PaddleOCR initialized successfully", file=sys.stderr)

    def decode_base64_image(self, base64_string: str) -> np.ndarray:
        """Decode base64 image string to numpy array"""
        try:
            # Remove data URL prefix if present
            if 'base64,' in base64_string:
                base64_string = base64_string.split('base64,')[1]
            
            # Decode base64
            image_data = base64.b64decode(base64_string)
            
            # Convert to PIL Image then to numpy array
            pil_image = Image.open(BytesIO(image_data))
            
            # Convert to RGB if needed (remove alpha channel)
            if pil_image.mode == 'RGBA':
                pil_image = pil_image.convert('RGB')
            
            # Convert to numpy array (OpenCV format)
            cv_image = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)
            
            return cv_image
            
        except Exception as e:
            print(f"Error decoding base64 image: {e}", file=sys.stderr)
            raise

    def extract_text_with_coordinates(self, image: np.ndarray) -> List[Dict]:
        """Extract text with bounding box coordinates using standard OCR"""
        try:
            result = self.ocr.ocr(image, cls=True)
            
            extracted_data = []
            
            if result and result[0]:
                for line in result[0]:
                    if len(line) >= 2:
                        bbox = line[0]  # Bounding box coordinates
                        text_info = line[1]  # (text, confidence)
                        
                        if len(text_info) >= 2:
                            text = text_info[0]
                            confidence = text_info[1]
                            
                            extracted_data.append({
                                'text': text,
                                'confidence': confidence,
                                'bbox': bbox,
                                'center': self._calculate_center(bbox)
                            })
            
            return extracted_data
            
        except Exception as e:
            print(f"Error in text extraction: {e}", file=sys.stderr)
            return []

    def extract_table_structure(self, image: np.ndarray) -> List[Dict]:
        """Extract table structure using PP-Structure"""
        try:
            result = self.table_engine(image)
            
            structured_data = []
            
            for region in result:
                if region.get('type') == 'table':
                    # Extract table data
                    table_info = {
                        'type': 'table',
                        'bbox': region.get('bbox', []),
                        'html': region.get('html', ''),
                        'cells': []
                    }
                    
                    # Extract table cells if available
                    if 'res' in region:
                        table_info['cells'] = region['res']
                    
                    structured_data.append(table_info)
                    
                elif region.get('type') == 'text':
                    # Regular text regions
                    structured_data.append({
                        'type': 'text',
                        'bbox': region.get('bbox', []),
                        'text': region.get('text', ''),
                        'confidence': region.get('confidence', 0.0)
                    })
            
            return structured_data
            
        except Exception as e:
            print(f"Error in table structure extraction: {e}", file=sys.stderr)
            return []

    def _calculate_center(self, bbox: List) -> Dict:
        """Calculate center point of bounding box"""
        if len(bbox) >= 4:
            x_coords = [point[0] for point in bbox]
            y_coords = [point[1] for point in bbox]
            return {
                'x': sum(x_coords) / len(x_coords),
                'y': sum(y_coords) / len(y_coords)
            }
        return {'x': 0, 'y': 0}

    def analyze_betting_slip(self, base64_image: str) -> Dict[str, Any]:
        """Main function to analyze betting slip and extract structured data"""
        try:
            print("Starting PaddleOCR betting slip analysis...", file=sys.stderr)
            
            # Decode image
            image = self.decode_base64_image(base64_image)
            print(f"Image shape: {image.shape}", file=sys.stderr)
            
            # Extract text with coordinates
            text_data = self.extract_text_with_coordinates(image)
            print(f"Extracted {len(text_data)} text regions", file=sys.stderr)
            
            # Extract table structure
            table_data = self.extract_table_structure(image)
            print(f"Found {len(table_data)} structured regions", file=sys.stderr)
            
            # Combine and parse the data
            parsed_result = self.parse_betting_data(text_data, table_data)
            
            print(f"Final parsed result: {parsed_result}", file=sys.stderr)
            
            return {
                'success': True,
                'data': parsed_result,
                'debug': {
                    'text_regions': len(text_data),
                    'table_regions': len(table_data),
                    'raw_text': [item['text'] for item in text_data]
                }
            }
            
        except Exception as e:
            print(f"Error in betting slip analysis: {e}", file=sys.stderr)
            return {
                'success': False,
                'error': str(e),
                'data': self._get_default_result()
            }

    def parse_betting_data(self, text_data: List[Dict], table_data: List[Dict]) -> Dict[str, Any]:
        """Parse extracted text and table data into betting slip structure"""
        
        result = self._get_default_result()
        all_text_lines = [item['text'] for item in text_data]
        
        print(f"Raw text lines: {all_text_lines}", file=sys.stderr)
        
        # 1. Extract teams and percentage
        team_info = self._extract_teams_and_percentage(all_text_lines)
        if team_info:
            result['betA']['teamA'] = team_info['teamA']
            result['betA']['teamB'] = team_info['teamB'] 
            result['betB']['teamA'] = team_info['teamA']
            result['betB']['teamB'] = team_info['teamB']
            result['totalProfitPercentage'] = team_info['percentage']
        
        # 2. Extract date and time
        datetime_info = self._extract_datetime(all_text_lines)
        if datetime_info:
            result['gameDate'] = datetime_info['date']
            result['gameTime'] = datetime_info['time']
        
        # 3. Extract league/sport
        league_info = self._extract_league(all_text_lines)
        if league_info:
            result['league'] = league_info['league']
            result['sport'] = league_info['sport']
        
        # 4. Extract betting data using both text and table structure
        betting_data = self._extract_betting_data(text_data, table_data)
        if betting_data:
            if 'betA' in betting_data:
                result['betA'].update(betting_data['betA'])
            if 'betB' in betting_data:
                result['betB'].update(betting_data['betB'])
        
        return result

    def _extract_teams_and_percentage(self, lines: List[str]) -> Optional[Dict[str, str]]:
        """Extract team names and profit percentage"""
        for line in lines:
            # Pattern: TeamA-TeamB Percentage%
            team_patterns = [
                r'([A-Za-zÀ-ÿ\s]+?)(?:-|–|—)([A-Za-zÀ-ÿ\s]+?)\s+(\d+\.?\d*)%',
                r'([A-Za-zÀ-ÿ]+(?:[A-Za-z\s]*[A-Za-zÀ-ÿ]+)*)(?:-|–|—)([A-Za-zÀ-ÿ]+(?:[A-Za-z\s]*[A-Za-zÀ-ÿ]+)*)\s+(\d+\.?\d*)%?'
            ]
            
            for pattern in team_patterns:
                match = re.search(pattern, line, re.IGNORECASE)
                if match:
                    team_a = self._normalize_team_name(match.group(1))
                    team_b = self._normalize_team_name(match.group(2))
                    percentage = match.group(3) + '%'
                    
                    print(f"Teams found: {team_a} vs {team_b} ({percentage})", file=sys.stderr)
                    
                    return {
                        'teamA': team_a,
                        'teamB': team_b,
                        'percentage': percentage
                    }
        
        return None

    def _extract_datetime(self, lines: List[str]) -> Optional[Dict[str, str]]:
        """Extract game date and time"""
        for line in lines:
            # Patterns for date/time extraction
            datetime_patterns = [
                r'(\d{4})-(\d{2})-(\d{2}).*?(\d{2}):(\d{2})',
                r'(\d{2})/(\d{2})/(\d{4})\s+(\d{2}):(\d{2})',
                r'Evento.*?(\d{4})-(\d{2})-(\d{2}).*?(\d{2}):(\d{2})',
                r'(\d{4})-(\d{2})-(\d{2})(\d{2}):(\d{2})'
            ]
            
            for pattern in datetime_patterns:
                match = re.search(pattern, line)
                if match:
                    groups = match.groups()
                    if len(groups) >= 5:
                        if groups[0].isdigit() and len(groups[0]) == 4:  # YYYY format
                            date = f"{groups[0]}-{groups[1]}-{groups[2]}"
                        else:  # DD/MM/YYYY format
                            date = f"{groups[2]}-{groups[1]}-{groups[0]}"
                        
                        time = f"{groups[3]}:{groups[4]}"
                        
                        print(f"Date/time found: {date} {time}", file=sys.stderr)
                        
                        return {
                            'date': date,
                            'time': time
                        }
        
        return None

    def _extract_league(self, lines: List[str]) -> Optional[Dict[str, str]]:
        """Extract league and sport information"""
        for line in lines:
            line_lower = line.lower()
            
            # Sport detection
            sport = 'Futebol'
            if 'americano' in line_lower or 'american' in line_lower:
                sport = 'Futebol Americano'
            elif 'basketball' in line_lower or 'basquete' in line_lower:
                sport = 'Basketball'
            
            # League patterns
            league_patterns = [
                r'Futebol.*?([A-Za-zÀ-ÿ\s\/\-]+)',
                r'(Liga|Championship|Cup|Campeonato|Série)[A-Za-zÀ-ÿ\s\d\/\-]*',
                r'([A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+)*)\s*\/\s*([A-Za-zÀ-ÿ\s\-]+)'
            ]
            
            for pattern in league_patterns:
                match = re.search(pattern, line, re.IGNORECASE)
                if match:
                    league = match.group(0)
                    print(f"League found: {league}, Sport: {sport}", file=sys.stderr)
                    
                    return {
                        'league': league,
                        'sport': sport
                    }
        
        return None

    def _extract_betting_data(self, text_data: List[Dict], table_data: List[Dict]) -> Optional[Dict]:
        """Extract betting house data using structured approach"""
        betting_houses = []
        
        # Group text by vertical position for table-like structure
        grouped_text = self._group_text_by_rows(text_data)
        
        print(f"Grouped text into {len(grouped_text)} rows", file=sys.stderr)
        
        for row_index, row_texts in enumerate(grouped_text):
            row_text = ' '.join([item['text'] for item in row_texts])
            print(f"Row {row_index}: {row_text}", file=sys.stderr)
            
            # Enhanced patterns for betting data
            betting_patterns = [
                # Betfast pattern: Betfast Acima19.522operiodo 2.200 6 159USDv -) o 7.66
                {
                    'house': 'Betfast',
                    'pattern': r'betfast\s+acima(\d+\.?\d*)\w*.*?(\d+\.?\d+).*?(\d+).*?usd.*?(\d+\.?\d+)',
                    'bet_type': 'Acima'
                },
                # Blaze pattern: Blaze(BR) Abaixo19.520operiodo 1910o (E) 183.14 usDv -) 7.66
                {
                    'house': 'Blaze',
                    'pattern': r'blaze.*?abaixo(\d+\.?\d*)\w*.*?(\d+).*?(\d+\.?\d+).*?usd.*?(\d+\.?\d+)',
                    'bet_type': 'Abaixo'
                },
                # Generic patterns for other houses
                {
                    'house': 'Generic',
                    'pattern': r'(betfast|blaze|aposta|betfair).*?(\d+\.?\d+).*?(\d+\.?\d+).*?(\d+\.?\d+).*?(\d+\.?\d+)',
                    'bet_type': 'Total'
                }
            ]
            
            for bet_pattern in betting_patterns:
                match = re.search(bet_pattern['pattern'], row_text, re.IGNORECASE)
                if match:
                    groups = match.groups()
                    print(f"Pattern matched for {bet_pattern['house']}: {groups}", file=sys.stderr)
                    
                    if len(groups) >= 4:
                        betting_house = {
                            'bettingHouse': bet_pattern['house'] + ' (BR)',
                            'betType': bet_pattern['bet_type'],
                            'threshold': groups[0] if bet_pattern['house'] != 'Generic' else '',
                            'odds': groups[1] if bet_pattern['house'] != 'Generic' else groups[2],
                            'stake': groups[2] if bet_pattern['house'] != 'Generic' else groups[3],
                            'profit': groups[3] if bet_pattern['house'] != 'Generic' else groups[4]
                        }
                        
                        betting_houses.append(betting_house)
                        break
        
        # Structure the betting data
        if betting_houses:
            result = {}
            if len(betting_houses) >= 1:
                result['betA'] = betting_houses[0]
            if len(betting_houses) >= 2:
                result['betB'] = betting_houses[1]
            
            return result
        
        return None

    def _group_text_by_rows(self, text_data: List[Dict], tolerance: int = 20) -> List[List[Dict]]:
        """Group text items by similar Y coordinates (table rows)"""
        if not text_data:
            return []
        
        # Sort by Y coordinate
        sorted_texts = sorted(text_data, key=lambda x: x['center']['y'])
        
        grouped_rows = []
        current_row = [sorted_texts[0]]
        current_y = sorted_texts[0]['center']['y']
        
        for text_item in sorted_texts[1:]:
            if abs(text_item['center']['y'] - current_y) <= tolerance:
                # Same row
                current_row.append(text_item)
            else:
                # New row
                # Sort current row by X coordinate
                current_row.sort(key=lambda x: x['center']['x'])
                grouped_rows.append(current_row)
                
                current_row = [text_item]
                current_y = text_item['center']['y']
        
        # Add last row
        if current_row:
            current_row.sort(key=lambda x: x['center']['x'])
            grouped_rows.append(current_row)
        
        return grouped_rows

    def _normalize_team_name(self, name: str) -> str:
        """Normalize team name"""
        return name.replace('  ', ' ').strip()

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
    """Main function to handle command line execution"""
    try:
        if len(sys.argv) != 2:
            print("Usage: python paddle-ocr.py <base64_image>", file=sys.stderr)
            sys.exit(1)
        
        base64_image = sys.argv[1]
        
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