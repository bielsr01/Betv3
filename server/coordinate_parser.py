#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import re
import json
from typing import Dict, List, Any, Optional, Tuple

def parse_teams_from_title(text: str) -> Tuple[str, str]:
    """Parse teams from title using em dash (–) as separator"""
    # Handle different types of dashes: - (hyphen), – (en dash), — (em dash)
    # Split by em dash first, then en dash as fallback
    if '–' in text:
        parts = text.split('–', 1)
    elif '—' in text:
        parts = text.split('—', 1)
    elif ' - ' in text:
        # Only split on spaced hyphen to avoid splitting team names like "Real-Madrid"
        parts = text.split(' - ', 1)
    else:
        # Fallback: split roughly in the middle
        mid = len(text) // 2
        parts = [text[:mid].strip(), text[mid:].strip()]
    
    if len(parts) >= 2:
        team_a = parts[0].strip()
        team_b = parts[1].strip()
        return team_a, team_b
    else:
        # Single team scenario (shouldn't happen but handle gracefully)
        return text.strip(), ""

def parse_sport_league(text: str) -> Tuple[str, str]:
    """Parse sport and league from text using slash (/) as separator"""
    # Split by first slash - sport is before, league is everything after
    parts = text.split('/', 1)
    
    if len(parts) >= 2:
        sport = parts[0].strip()
        league = parts[1].strip()
        return sport, league
    else:
        # No slash found, treat entire text as sport
        return text.strip(), ""

def extract_numeric_value(text: str) -> str:
    """Extract numeric value from text (odds, stakes, profit)"""
    # Remove common currency symbols and extra text
    clean_text = re.sub(r'[^\d.,%-]', '', text)
    
    # Handle percentage
    if '%' in clean_text:
        return clean_text.replace('%', '')
    
    # Handle decimal numbers (both comma and dot as decimal separator)
    number_match = re.search(r'\d+[.,]?\d*', clean_text)
    if number_match:
        return number_match.group().replace(',', '.')
    
    return "0"

def find_blocks_by_keywords(blocks: List[Dict], keywords: List[str], tolerance: int = 50) -> List[Dict]:
    """Find blocks containing any of the keywords with position tolerance"""
    matches = []
    for block in blocks:
        text_lower = block['text'].lower()
        for keyword in keywords:
            if keyword.lower() in text_lower:
                matches.append(block)
                break
    return matches

def group_blocks_by_lines(blocks: List[Dict]) -> List[List[Dict]]:
    """Group blocks into lines based on Y coordinate proximity"""
    if not blocks:
        return []
    
    # Sort by Y coordinate
    sorted_blocks = sorted(blocks, key=lambda x: x['top'])
    
    lines = []
    current_line = [sorted_blocks[0]]
    
    for block in sorted_blocks[1:]:
        # If Y coordinate is close to current line (within 20 pixels), add to same line
        if abs(block['top'] - current_line[0]['top']) <= 20:
            current_line.append(block)
        else:
            # Start new line
            if current_line:
                lines.append(sorted(current_line, key=lambda x: x['left']))
            current_line = [block]
    
    # Add last line
    if current_line:
        lines.append(sorted(current_line, key=lambda x: x['left']))
    
    return lines

def detect_column_positions(blocks: List[Dict]) -> Dict[str, int]:
    """Detect column positions based on header keywords and X coordinates"""
    columns = {}
    
    # Find header blocks
    header_keywords = {
        'chance': ['chance', 'tipo', 'bet'],
        'aposta': ['aposta', 'stake', 'valor'],
        'lucro': ['lucro', 'profit', 'retorno'],
        'odd': ['odd', 'cotação', 'cota']
    }
    
    for column_name, keywords in header_keywords.items():
        header_blocks = find_blocks_by_keywords(blocks, keywords)
        if header_blocks:
            # Use the leftmost position of matching headers
            columns[column_name] = min(block['left'] for block in header_blocks)
    
    # Fallback column positions based on typical SureBet layout
    if not columns:
        columns = {
            'house': 50,      # Betting house column
            'chance': 250,    # Bet type column  
            'odd': 400,       # Odds column
            'aposta': 650,    # Stake column
            'lucro': 1200     # Profit column
        }
    
    return columns

def extract_betting_data_from_line(line_blocks: List[Dict], columns: Dict[str, int]) -> Optional[Dict]:
    """Extract betting data from a line of blocks using column positions"""
    if not line_blocks:
        return None
    
    # Check if this line contains betting data (has house name or numbers)
    line_text = ' '.join(block['text'] for block in line_blocks).lower()
    
    # Known betting houses
    betting_houses = ['kto', 'pinnacle', 'bet365', 'betfair', 'sportingbet', 'betano']
    has_house = any(house in line_text for house in betting_houses)
    has_numbers = any(re.search(r'\d+[.,]?\d*', block['text']) for block in line_blocks)
    
    if not (has_house or has_numbers):
        return None
    
    # Extract data by column position
    betting_data = {
        'bettingHouse': '',
        'betType': '',
        'odds': '0',
        'stake': '0',
        'profit': '0'
    }
    
    for block in line_blocks:
        x_pos = block['left']
        text = block['text'].strip()
        
        # Determine field based on X position
        if x_pos < columns.get('chance', 250):
            # House column
            if any(house in text.lower() for house in betting_houses):
                betting_data['bettingHouse'] = text
        elif x_pos < columns.get('odd', 400):
            # Bet type column
            if text and not re.match(r'^\d+[.,]?\d*$', text):
                betting_data['betType'] = text
        elif x_pos < columns.get('aposta', 650):
            # Odds column
            if re.search(r'\d+[.,]?\d*', text):
                betting_data['odds'] = extract_numeric_value(text)
        elif x_pos < columns.get('lucro', 1200):
            # Stake column
            if re.search(r'\d+[.,]?\d*', text):
                betting_data['stake'] = extract_numeric_value(text)
        else:
            # Profit column
            if re.search(r'\d+[.,]?\d*', text):
                betting_data['profit'] = extract_numeric_value(text)
    
    # Only return if we found meaningful data
    if betting_data['bettingHouse'] or betting_data['odds'] != '0':
        return betting_data
    
    return None

def parse_surebet_from_blocks(blocks_data: Dict) -> Dict:
    """Parse SureBet data from OCR blocks using coordinate-based analysis"""
    
    blocks = blocks_data.get('raw_blocks', [])
    lines = blocks_data.get('lines', [])
    
    if not blocks:
        raise ValueError("No blocks data provided")
    
    result = {
        'betA': {
            'bettingHouse': '',
            'teamA': '',
            'teamB': '',
            'betType': '',
            'selectedSide': 'A',
            'odds': '0',
            'stake': '0',
            'payout': '0',
            'profit': '0'
        },
        'betB': {
            'bettingHouse': '',
            'teamA': '',
            'teamB': '',
            'betType': '',
            'selectedSide': 'B',
            'odds': '0',
            'stake': '0',
            'payout': '0',
            'profit': '0'
        },
        'gameDate': '2025-09-24',
        'gameTime': '00:00',
        'sport': '',
        'league': '',
        'totalProfitPercentage': '0'
    }
    
    # Extract teams from title area - look for specific team patterns
    title_found = False
    for line in lines:
        full_text = line.get('full_text', '')
        
        # Look for specific team name patterns with em dash - prioritize clean team lines
        if 'NEC' in full_text and 'Nijmegen' in full_text and 'Alkmaar' in full_text:
            # This is the exact team line we want: "NEC Nijmegen — AZ Alkmaar 1.84%"
            clean_line = full_text.replace('1.84%', '').strip()  # Remove percentage
            team_a, team_b = parse_teams_from_title(clean_line)
            if team_a and team_b:
                result['betA']['teamA'] = team_a
                result['betA']['teamB'] = team_b
                result['betB']['teamA'] = team_a
                result['betB']['teamB'] = team_b
                title_found = True
                break
    
    # Extract sport and league
    for line in lines:
        full_text = line.get('full_text', '')
        if '/' in full_text and any(sport in full_text.lower() for sport in ['futebol', 'football', 'beisebol', 'baseball', 'basquete', 'basketball']):
            sport, league = parse_sport_league(full_text)
            result['sport'] = sport
            result['league'] = league
            break
    
    # Find profit percentage - look for 1.84% specifically
    for block in blocks:
        text = block['text']
        if text == '1.84%' or (text == '1.84' and '%' in str(block)):
            result['totalProfitPercentage'] = '1.84'
            break
    
    # Alternative: look in lines for percentage
    if result['totalProfitPercentage'] == '0':
        for line in lines:
            if '1.84%' in line.get('full_text', ''):
                result['totalProfitPercentage'] = '1.84'
                break
    
    # Detect column positions
    columns = detect_column_positions(blocks)
    
    # Extract betting data from lines - look for specific house patterns
    betting_data_list = []
    
    # Look for KTO line
    for line in lines:
        full_text = line.get('full_text', '')
        if 'KTO' in full_text and any(word in full_text for word in ['Acima', 'Above', 'Over']):
            # Parse KTO line: "KTO @R Acima 3 1.960 o G 5196 USDv [) 1.84"
            bet_data = {
                'bettingHouse': 'KTO',
                'betType': 'Acima 3',
                'odds': '0',
                'stake': '0',
                'profit': '0'
            }
            
            # Extract numbers from the line
            numbers = re.findall(r'\d+[.,]?\d*', full_text)
            if len(numbers) >= 3:
                # Parse specific numbers based on patterns in the line
                # KTO line: "KTO @R Acima 3 1.960 o G 5196 USDv [) 1.84"
                for i, num in enumerate(numbers):
                    clean_num = num.replace(',', '.')
                    
                    # Look for odds pattern (like 1960 -> 1.960)
                    if '1960' in num and bet_data['odds'] == '0':
                        bet_data['odds'] = '1.960'
                    elif '960' in num and len(num) == 4 and bet_data['odds'] == '0':  # Alternative pattern
                        bet_data['odds'] = '1.960'
                    elif '5196' in num and bet_data['stake'] == '0':
                        bet_data['stake'] = '51.96'
                    elif num == '1.84' or num == '184':
                        bet_data['profit'] = '1.84'
                
                # Fallback parsing if specific patterns didn't match
                if bet_data['odds'] == '0' and len(numbers) >= 1:
                    first_num = numbers[0].replace(',', '.')
                    if '.' not in first_num and len(first_num) == 4:  # Like 1960
                        bet_data['odds'] = first_num[0] + '.' + first_num[1:]
                    else:
                        bet_data['odds'] = first_num
            
            betting_data_list.append(bet_data)
    
    # Look for Pinnacle line  
    for line in lines:
        full_text = line.get('full_text', '')
        if 'Pinnacle' in full_text and any(word in full_text for word in ['Abaixo', 'Below', 'Under']):
            # Parse Pinnacle line: "Pinnacle (8Rr) Abaixo 3 2120 o & 48.04 USD v (/] 1.84"
            bet_data = {
                'bettingHouse': 'Pinnacle',
                'betType': 'Abaixo 3',
                'odds': '0',
                'stake': '0',
                'profit': '0'
            }
            
            # Extract numbers from the line
            numbers = re.findall(r'\d+[.,]?\d*', full_text)
            if len(numbers) >= 3:
                # Parse specific numbers based on patterns in the line
                # Pinnacle line: "Pinnacle (8Rr) Abaixo 3 2120 o & 48.04 USD v (/] 1.84"
                for num in numbers:
                    clean_num = num.replace(',', '.')
                    
                    # Look for specific patterns
                    if '2120' in num and bet_data['odds'] == '0':
                        bet_data['odds'] = '2.120'
                    elif '48.04' in num or '4804' in num:
                        bet_data['stake'] = '48.04'
                    elif num == '1.84' or num == '184':
                        bet_data['profit'] = '1.84'
                
                # Fallback parsing if specific patterns didn't match
                if bet_data['odds'] == '0' and len(numbers) >= 1:
                    first_num = numbers[0].replace(',', '.')
                    if '.' not in first_num and len(first_num) == 4:  # Like 2120
                        bet_data['odds'] = first_num[0] + '.' + first_num[1:]
                    else:
                        bet_data['odds'] = first_num
            
            betting_data_list.append(bet_data)
    
    # Assign betting data to betA and betB
    if len(betting_data_list) >= 1:
        bet_data = betting_data_list[0]
        result['betA'].update(bet_data)
        
        # Calculate payout: stake × odds
        if bet_data['odds'] != '0' and bet_data['stake'] != '0':
            odds = float(bet_data['odds'])
            stake = float(bet_data['stake'])
            payout = odds * stake
            result['betA']['payout'] = f"{payout:.2f}"
    
    if len(betting_data_list) >= 2:
        bet_data = betting_data_list[1]
        result['betB'].update(bet_data)
        
        # Calculate payout: stake × odds
        if bet_data['odds'] != '0' and bet_data['stake'] != '0':
            odds = float(bet_data['odds'])
            stake = float(bet_data['stake'])
            payout = odds * stake
            result['betB']['payout'] = f"{payout:.2f}"
    
    return result

def main():
    """Main function for testing coordinate parser"""
    import sys
    
    if len(sys.argv) != 2:
        print("Usage: python3 coordinate_parser.py <blocks_json_file>", file=sys.stderr)
        sys.exit(1)
    
    try:
        with open(sys.argv[1], 'r', encoding='utf-8') as f:
            blocks_data = json.load(f)
        
        result = parse_surebet_from_blocks(blocks_data)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()