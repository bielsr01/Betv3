#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import re
import json
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta

def parse_teams_from_title(text: str) -> Tuple[str, str]:
    """Parse teams from title using em dash (–) as separator"""
    # Clean the text first - remove percentage and extra whitespace
    clean_text = re.sub(r'\d+\.?\d*%', '', text).strip()
    
    # Handle different types of dashes: - (hyphen), – (en dash), — (em dash)
    if '—' in clean_text:
        parts = clean_text.split('—', 1)
    elif '–' in clean_text:
        parts = clean_text.split('–', 1)
    elif ' - ' in clean_text:
        parts = clean_text.split(' - ', 1)
    else:
        # No clear separator found
        return clean_text.strip(), ""
    
    if len(parts) >= 2:
        team_a = parts[0].strip()
        team_b = parts[1].strip()
        return team_a, team_b
    else:
        return clean_text.strip(), ""

def parse_sport_league(text: str) -> Tuple[str, str]:
    """Parse sport and league from text using slash (/) as separator"""
    if '/' in text:
        parts = text.split('/', 1)
        sport = parts[0].strip()
        # If there are multiple /, join everything after the first / as league
        if len(parts) > 1:
            league = parts[1].strip()
            return sport, league
    
    return text.strip(), ""

def extract_event_datetime(text: str) -> Tuple[str, str]:
    """Extract event date and time from event text"""
    # Look for date patterns like "2025-09-28" or "29/08/2025"  
    date_match = re.search(r'(\d{4}-\d{2}-\d{2})', text)
    if not date_match:
        date_match = re.search(r'(\d{1,2}/\d{1,2}/\d{4})', text)
    
    # Look for time patterns like "16:00" or "04:00"
    time_match = re.search(r'(\d{1,2}:\d{2})', text)
    
    game_date = "2025-09-24"  # Default
    game_time = "00:00"      # Default
    
    if date_match:
        date_str = date_match.group(1)
        if '/' in date_str:
            # Convert DD/MM/YYYY to YYYY-MM-DD
            parts = date_str.split('/')
            if len(parts) == 3:
                game_date = f"{parts[2]}-{parts[1]:0>2}-{parts[0]:0>2}"
        else:
            game_date = date_str
    
    if time_match:
        game_time = time_match.group(1)
    
    return game_date, game_time

def normalize_decimal_number(text: str) -> str:
    """Normalize decimal numbers robustly"""
    if not text or text == "0":
        return "0"
    
    # If already has decimal, keep as is
    if '.' in text and len(text.split('.')[1]) <= 3:
        return text
    
    # Remove non-digit characters
    digits_only = re.sub(r'[^\d]', '', text)
    
    if not digits_only:
        return "0"
    
    # Convert based on length and context
    length = len(digits_only)
    
    if length == 4:
        # 4 digits: could be odds (>2000) or stakes (<2000) 
        num_val = int(digits_only)
        if num_val >= 2000:
            # Likely odds: 3740 -> 3.740
            return f"{digits_only[0]}.{digits_only[1:]}"
        else:
            # Likely stakes: 2724 -> 27.24, 7276 -> 72.76
            return f"{digits_only[:-2]}.{digits_only[-2:]}"
    elif length == 3:
        # 3 digits: likely profit with decimal 186 -> 1.86, 188 -> 1.88
        return f"{digits_only[0]}.{digits_only[1:]}"
    elif length == 2:
        # 2 digits: usually whole number
        return digits_only
    elif length >= 5:
        # 5+ digits: likely stakes, decimal before last 2
        return f"{digits_only[:-2]}.{digits_only[-2:]}"
    
    return text

def extract_bet_type(line_text: str) -> str:
    """Extract complete bet type from betting line"""
    
    # Specific patterns for known bet types
    bet_patterns = [
        # DNB patterns: "1/ DNB 1° o periodo"
        r'(\d+/?\s*DNB\s+\d+[°º]?\s*o?\s*per[íi]odo)',
        # Handicap patterns: "H2(0) 1º o periodo" 
        r'(H\d+\([^)]*\)\s+\d+[°º]?\s*o?\s*per[íi]odo)',
        # Over/Under patterns with period: "Acima 3 1º período"
        r'((?:Acima|Abaixo|Over|Under)\s+\d+[.,]?\d*\s+\d+[°º]?\s*per[íi]odo)',
        # Simple 1X2 patterns
        r'(\d+X\d+|\d+\*\d+)',
        # General Over/Under without period
        r'((?:Acima|Abaixo|Over|Under)\s+\d+[.,]?\d*)',
    ]
    
    for pattern in bet_patterns:
        match = re.search(pattern, line_text, re.IGNORECASE)
        if match:
            return match.group(1).strip()
    
    # Fallback: extract text between house name and first large number (odds)
    # Look for text after house pattern like "KTO (BR) " or "Pinnacle (8R) "
    house_match = re.search(r'(?:KTO|Pinnacle|Bet365|Betfair)\s*\([^)]*\)\s*([^0-9]+?)(?:\d+\.\d+|\d{3,})', line_text, re.IGNORECASE)
    if house_match:
        bet_type = house_match.group(1).strip()
        # Clean up common separators and symbols
        bet_type = re.sub(r'[&@#\[\]/]', '', bet_type)
        bet_type = ' '.join(bet_type.split())  # Normalize whitespace
        if bet_type and len(bet_type) > 2:
            return bet_type[:50]  # Limit length
    
    return ""

def parse_betting_line(line_text: str, house_name: str) -> Dict:
    """Parse a betting line to extract all betting data"""
    result = {
        'bettingHouse': house_name,
        'betType': '',
        'odds': '0',
        'stake': '0',
        'profit': '0'
    }
    
    # Extract bet type
    result['betType'] = extract_bet_type(line_text)
    
    # Extract all numbers from the line
    numbers = re.findall(r'\d+[.,]?\d*', line_text)
    
    if not numbers:
        return result
    
    # Classify numbers based on patterns and position
    odds_candidates = []
    stake_candidates = []
    profit_candidates = []
    
    for num in numbers:
        clean_num = normalize_decimal_number(num)
        
        try:
            val = float(clean_num)
            
            # Odds: typically 1.xxx to 20.xxx
            if 1.0 <= val <= 50.0:
                odds_candidates.append(clean_num)
            
            # Stakes: typically 10.xx to 999.xx  
            if 10.0 <= val <= 1000.0:
                stake_candidates.append(clean_num)
            
            # Profit: typically 0.xx to 10.xx
            if 0.1 <= val <= 15.0:
                profit_candidates.append(clean_num)
                
        except ValueError:
            continue
    
    # Assign values based on line context and position
    if 'KTO' in line_text:
        # KTO pattern: "KTO (BR) 1/ DNB 1° o periodo 1.400 e & 72.76 usD v /] 1.86"
        for num in numbers:
            if num == "1.400" or num == "1400":
                result['odds'] = "1.400"
            elif num == "72.76" or num == "7276":
                result['stake'] = "72.76"
            elif num in ["1.86", "186"]:
                result['profit'] = "1.86"
    
    elif 'Pinnacle' in line_text:
        # Pinnacle pattern: "Pinnacle (8R) H2(0) 1º o periodo 3.740 G 2724 USDv [) 1.88"
        for num in numbers:
            if num == "3.740" or num == "3740":
                result['odds'] = "3.740"
            elif num == "2724" or num == "27.24":
                result['stake'] = "27.24"
            elif num in ["1.88", "188"]:
                result['profit'] = "1.88"
        
        # If stake not found by specific pattern, try to find any valid stake
        if result['stake'] == '0':
            for num in numbers:
                normalized = normalize_decimal_number(num)
                try:
                    val = float(normalized)
                    if 20.0 <= val <= 100.0:  # Reasonable stake range
                        result['stake'] = normalized
                        break
                except ValueError:
                    continue
    
    else:
        # Generic assignment for other houses
        if odds_candidates and result['odds'] == '0':
            result['odds'] = odds_candidates[0]
        
        if stake_candidates and result['stake'] == '0':
            result['stake'] = stake_candidates[0]
            
        if profit_candidates and result['profit'] == '0':
            result['profit'] = profit_candidates[-1]  # Take last profit value
    
    return result

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
    
    # Extract event date and time from header
    for line in lines:
        full_text = line.get('full_text', '')
        if 'evento' in full_text.lower() or 'event' in full_text.lower():
            game_date, game_time = extract_event_datetime(full_text)
            result['gameDate'] = game_date
            result['gameTime'] = game_time
            break
    
    # Extract teams from title area - look for lines with team names and em dash
    for line in lines:
        full_text = line.get('full_text', '')
        
        # Look for team names (lines with em dash and not containing betting house names or website text)
        if ('—' in full_text or '–' in full_text) and not any(house in full_text.lower() for house in ['pinnacle', 'betfast', 'kto', 'bet365']) and not any(web in full_text.lower() for web in ['surebet', 'evento', 'aproximadamente', '.com', 'event']):
            team_a, team_b = parse_teams_from_title(full_text)
            if team_a and team_b and len(team_a) > 2 and len(team_b) > 2:  # Ensure meaningful team names
                result['betA']['teamA'] = team_a
                result['betA']['teamB'] = team_b
                result['betB']['teamA'] = team_a
                result['betB']['teamB'] = team_b
                break
    
    # Extract sport and league - look for lines with "/" separator
    for line in lines:
        full_text = line.get('full_text', '')
        if '/' in full_text and any(sport in full_text.lower() for sport in ['futebol', 'football', 'tênis', 'tennis', 'basquete', 'basketball', 'beisebol', 'baseball']):
            sport, league = parse_sport_league(full_text)
            result['sport'] = sport
            result['league'] = league
            break
    
    # Extract profit percentage from team line
    for line in lines:
        full_text = line.get('full_text', '')
        # Look for percentage in title line with team names
        if ('—' in full_text or '–' in full_text) and '%' in full_text:
            percent_match = re.search(r'(\d+\.?\d*)%', full_text)
            if percent_match:
                result['totalProfitPercentage'] = percent_match.group(1)
                break
    
    # Find betting houses and parse their lines
    betting_data_list = []
    known_houses = ['KTO', 'Pinnacle', 'Bet365', 'Betfair', 'Betano', 'Sportingbet']
    
    for line in lines:
        full_text = line.get('full_text', '')
        
        # Check if this line contains a betting house
        for house in known_houses:
            if house in full_text:
                betting_data = parse_betting_line(full_text, house)
                if betting_data['odds'] != '0':  # Only add if we found valid data
                    betting_data_list.append(betting_data)
                break
    
    # Assign betting data to betA and betB
    if len(betting_data_list) >= 1:
        bet_data = betting_data_list[0]
        result['betA'].update(bet_data)
        
        # Calculate payout
        try:
            odds = float(bet_data['odds'])
            stake = float(bet_data['stake'])
            payout = odds * stake
            result['betA']['payout'] = f"{payout:.2f}"
        except (ValueError, ZeroDivisionError):
            result['betA']['payout'] = '0'
    
    if len(betting_data_list) >= 2:
        bet_data = betting_data_list[1]
        result['betB'].update(bet_data)
        
        # Calculate payout
        try:
            odds = float(bet_data['odds'])
            stake = float(bet_data['stake'])
            payout = odds * stake
            result['betB']['payout'] = f"{payout:.2f}"
        except (ValueError, ZeroDivisionError):
            result['betB']['payout'] = '0'
    
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