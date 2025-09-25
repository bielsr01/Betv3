#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import re
import json
import unicodedata
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta

def normalize_unicode_text(text: str) -> str:
    """Normalize Unicode text and fix common Portuguese diacritics"""
    if not text:
        return text
    
    # Normalize Unicode to NFC form
    normalized = unicodedata.normalize('NFC', text)
    
    # Fix common Portuguese diacritics that might be missed by OCR
    diacritic_map = {
        'periodo': 'período',
        'Brasileirao': 'Brasileirão', 
        'Serie': 'Série',
        'Tenis': 'Tênis',
        'atletica': 'atlética',
        'basica': 'básica'
    }
    
    for wrong, correct in diacritic_map.items():
        normalized = re.sub(re.escape(wrong), correct, normalized, flags=re.IGNORECASE)
    
    return normalized

def normalize_decimal_number(text: str) -> str:
    """Robust decimal number normalization"""
    if not text:
        return "0"
    
    # Handle spaced decimals: "3 740" -> "3.740", "27 24" -> "27.24"
    text = re.sub(r'(\d)\s*[.,]\s*(\d{2,3})', r'\1.\2', text)
    
    # Convert comma to dot: "3,740" -> "3.740"
    text = text.replace(',', '.')
    
    # Extract only digits and dots
    clean_text = re.sub(r'[^\d.]', '', text)
    
    if not clean_text or clean_text == ".":
        return "0"
    
    # Handle cases like "3740" -> "3.740" for odds >= 2000
    if '.' not in clean_text and len(clean_text) == 4:
        num_val = int(clean_text)
        if num_val >= 2000:
            return f"{clean_text[0]}.{clean_text[1:]}"
        elif num_val >= 1000:
            return f"{clean_text[:-2]}.{clean_text[-2:]}"
    
    # Handle cases like "2724" -> "27.24" for stakes
    if '.' not in clean_text and len(clean_text) >= 3:
        return f"{clean_text[:-2]}.{clean_text[-2:]}"
    
    return clean_text

def sort_lines_by_position(lines: List[Dict]) -> List[Dict]:
    """Sort lines deterministically by Y coordinate (top to bottom), then X (left to right)"""
    def get_top_position(line):
        blocks = line.get('blocks', [])
        if not blocks:
            return 0
        # Get minimum top position from all blocks in this line
        return min(block.get('top', 0) for block in blocks)
    
    def get_left_position(line):
        blocks = line.get('blocks', [])
        if not blocks:
            return 0
        # Get minimum left position from all blocks in this line
        return min(block.get('left', 0) for block in blocks)
    
    return sorted(lines, key=lambda line: (get_top_position(line), get_left_position(line)))

def extract_header_datetime(lines: List[Dict]) -> Tuple[str, str]:
    """Extract date and time specifically from header 'Evento' line"""
    game_date = "2025-09-24"  # Default fallback
    game_time = "00:00"       # Default fallback
    
    for line in lines:
        full_text = normalize_unicode_text(line.get('full_text', ''))
        
        # Look for header line containing "Evento"
        if re.search(r'evento', full_text, re.IGNORECASE):
            # Extract date and time from parentheses: "Evento em 4 dias (2025-09-28 16:00-03:00)"
            datetime_match = re.search(r'\((\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})', full_text)
            if datetime_match:
                game_date = datetime_match.group(1)
                game_time = datetime_match.group(2)
                break
            
            # Fallback: "em X dias" - add days to today
            days_match = re.search(r'em\s+(\d+)\s+dias?', full_text, re.IGNORECASE)
            if days_match:
                days_ahead = int(days_match.group(1))
                future_date = datetime.now() + timedelta(days=days_ahead)
                game_date = future_date.strftime('%Y-%m-%d')
                
                # Try to extract time separately
                time_match = re.search(r'(\d{1,2}:\d{2})', full_text)
                if time_match:
                    game_time = time_match.group(1)
                break
    
    return game_date, game_time

def parse_teams_from_title(lines: List[Dict]) -> Tuple[str, str]:
    """Parse teams from title line using em dash separator, looking near the top"""
    for line in lines[:10]:  # Check first 10 lines for teams
        full_text = normalize_unicode_text(line.get('full_text', ''))
        
        # Skip header and betting house lines
        if any(keyword in full_text.lower() for keyword in ['evento', 'surebet', 'kto', 'pinnacle', 'bet365', 'betfair']):
            continue
        
        # Look for team separator: em dash, en dash, or hyphen with spaces
        if '—' in full_text or '–' in full_text or ' - ' in full_text:
            # Clean percentage from text
            clean_text = re.sub(r'\d+\.?\d*%', '', full_text).strip()
            
            # Split on different dash types
            if '—' in clean_text:
                parts = clean_text.split('—', 1)
            elif '–' in clean_text:
                parts = clean_text.split('–', 1)
            else:
                parts = clean_text.split(' - ', 1)
            
            if len(parts) >= 2:
                team_a = parts[0].strip()
                team_b = parts[1].strip()
                
                # Validate team names (should be meaningful length)
                if len(team_a) > 2 and len(team_b) > 2:
                    return team_a, team_b
    
    return "", ""

def parse_sport_league_near_teams(lines: List[Dict], teams_line_index: int) -> Tuple[str, str]:
    """Parse sport and league from lines near the teams line"""
    # Check a wider range around the teams line
    start_idx = max(0, teams_line_index - 3)
    end_idx = min(len(lines), teams_line_index + 6)
    
    for i in range(start_idx, end_idx):
        full_text = normalize_unicode_text(lines[i].get('full_text', ''))
        
        # Look for sport/league pattern with slashes
        if '/' in full_text and any(sport in full_text.lower() for sport in ['futebol', 'football', 'tênis', 'tennis', 'basquete', 'basketball', 'volei', 'handebol']):
            parts = full_text.split('/', 1)
            sport = parts[0].strip()
            league = parts[1].strip() if len(parts) > 1 else ""
            return sport, league
    
    return "", ""

def group_bet_lines(lines: List[Dict]) -> List[Dict]:
    """Group betting house lines with adjacent lines for complete bet information"""
    betting_groups = []
    house_names = ['KTO', 'Pinnacle', 'Bet365', 'Betfair', 'Betano', 'Sportingbet', 'BravoBet', 'Blaze', 'Aposta1', 'Betnacional', 'SuperBet', 'VBet', 'MarjoSports', 'Betfast']
    
    i = 0
    while i < len(lines):
        line = lines[i]
        full_text = line.get('full_text', '')
        
        # Check if this line contains a betting house
        house_found = None
        for house in house_names:
            if house in full_text:
                house_found = house
                break
        
        if house_found:
            # Create a group starting with the house line
            group = {
                'house': house_found,
                'main_line': line,
                'all_lines': [line],
                'combined_text': full_text,
                'top_position': min(block.get('top', 0) for block in line.get('blocks', [{'top': 0}]))
            }
            
            # Look for adjacent lines within Y threshold (±25 pixels) but exclude other betting houses
            main_top = group['top_position']
            
            # Check previous line (only if it doesn't contain a betting house)
            if i > 0:
                prev_line = lines[i-1]
                prev_text = prev_line.get('full_text', '')
                prev_top = min(block.get('top', 0) for block in prev_line.get('blocks', [{'top': 0}]))
                
                # Don't combine if previous line contains another betting house
                has_house = any(house in prev_text for house in house_names)
                if not has_house and abs(prev_top - main_top) <= 25:
                    group['all_lines'].insert(0, prev_line)
                    group['combined_text'] = prev_text + ' ' + group['combined_text']
            
            # Check next line (only if it doesn't contain a betting house)
            if i + 1 < len(lines):
                next_line = lines[i+1]
                next_text = next_line.get('full_text', '')
                next_top = min(block.get('top', 0) for block in next_line.get('blocks', [{'top': 0}]))
                
                # Don't combine if next line contains another betting house
                has_house = any(house in next_text for house in house_names)
                if not has_house and abs(next_top - main_top) <= 25:
                    group['all_lines'].append(next_line)
                    group['combined_text'] += ' ' + next_text
            
            betting_groups.append(group)
        
        i += 1
    
    # Sort groups by Y position to ensure consistent betA/betB assignment
    betting_groups.sort(key=lambda g: g['top_position'])
    
    return betting_groups

def extract_bet_type_from_group(combined_text: str) -> str:
    """Extract bet type from combined text using comprehensive patterns"""
    text = normalize_unicode_text(combined_text)
    
    # Comprehensive bet type patterns
    bet_patterns = [
        # DNB patterns: "1 / DNB 1° o período", "1/ DNB 1° periodo"
        r'(\d+\s*/?\s*DNB\s+\d+[°º]?\s*(?:o\s*)?per[íi]odo)',
        # Handicap patterns: "H2(0) 1º o período", "H1(-1) 2° período" 
        r'(H[12]\([^)]*\)\s+\d+[°º]?\s*(?:o\s*)?per[íi]odo)',
        # Over/Under with período: "Acima 2.5 1º período"
        r'((?:Acima|Abaixo|Over|Under)\s+\d+[.,]?\d*\s+\d+[°º]?\s*per[íi]odo)',
        # 1X2 patterns: "1X2", "1*2", "2*1"
        r'(\d+[X\*]\d+)',
        # General Over/Under: "Over 2.5", "Acima 1.5"
        r'((?:Acima|Abaixo|Over|Under)\s+\d+[.,]?\d*)',
        # Match result: "Resultado Final"
        r'(Resultado\s+Final)',
        # Double chance: "Dupla Chance"
        r'(Dupla\s+Chance)',
    ]
    
    for pattern in bet_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(1).strip()
    
    # Fallback: extract text between house name and first large number
    house_match = re.search(r'(?:KTO|Pinnacle|Bet365|Betfair|Betano|BravoBet|Blaze|Aposta1|Betnacional|SuperBet|VBet|MarjoSports|Betfast)\s*\([^)]*\)\s*([^0-9]+?)(?:\d+\.\d+|\d{3,})', text, re.IGNORECASE)
    if house_match:
        bet_type = house_match.group(1).strip()
        # Clean common symbols
        bet_type = re.sub(r'[&@#\[\]/]', '', bet_type)
        bet_type = ' '.join(bet_type.split())
        if len(bet_type) > 2:
            return bet_type[:50]
    
    return ""

def extract_numbers_with_context(combined_text: str) -> Dict[str, str]:
    """Extract odds, stake, and profit using context-aware classification"""
    text = combined_text
    
    # Find all potential numbers, including decimals
    number_matches = list(re.finditer(r'\d+[.,]\d+|\d+', text))
    normalized_numbers = []
    
    for match in number_matches:
        raw_num = match.group()
        normalized = normalize_decimal_number(raw_num)
        start_pos = match.start()
        end_pos = match.end()
        
        try:
            value = float(normalized)
            # Skip single digits that are likely OCR artifacts (except valid small numbers)
            if len(raw_num) == 1 and value > 9:
                continue
                
            normalized_numbers.append({
                'raw': raw_num,
                'normalized': normalized,
                'value': value,
                'start': start_pos,
                'end': end_pos,
                'context_before': text[max(0, start_pos-20):start_pos],
                'context_after': text[end_pos:end_pos+20]
            })
        except ValueError:
            continue
    
    result = {'odds': '0', 'stake': '0', 'profit': '0'}
    
    if not normalized_numbers:
        return result
    
    # Classify numbers by context and value ranges
    
    # 1. Find odds: typically 1.01-100, appears after bet type or house name
    odds_candidates = [n for n in normalized_numbers if 1.01 <= n['value'] <= 100.0]
    
    # Filter out numbers inside parentheses like "(8R)" and bet type numbers like "10.5" in "Abaixo 10.5"
    filtered_odds = []
    for candidate in odds_candidates:
        start = candidate['start']
        # Check if this number is inside parentheses
        before_text = text[max(0, start-15):start]
        after_text = text[start:start+15]
        
        # Skip if number is inside parentheses like "(8R)"
        if '(' in before_text and ')' in after_text:
            continue
        
        # Skip if number is part of bet type (preceded by Acima/Abaixo/Over/Under)
        if re.search(r'(?:acima|abaixo|over|under)\s*$', before_text, re.IGNORECASE):
            continue
            
        # Skip if number is followed by "- escanteios" or similar bet type indicators
        if re.search(r'^\s*[-–—]\s*(?:escanteios|corners|gols|goals)', after_text, re.IGNORECASE):
            continue
        
        filtered_odds.append(candidate)
    
    if filtered_odds:
        # Prefer odds with decimal points (more likely to be real odds)
        decimal_odds = [n for n in filtered_odds if '.' in n['normalized']]
        if decimal_odds:
            result['odds'] = decimal_odds[0]['normalized']
        else:
            result['odds'] = filtered_odds[0]['normalized']
    
    # 2. Find stake: near currency symbols or reasonable stake range (5-5000)
    stake_candidates = [n for n in normalized_numbers if 5.0 <= n['value'] <= 5000.0]
    currency_indicators = ['USD', 'USDT', 'R$', 'BRL', 'EUR']
    
    best_stake = None
    min_distance = float('inf')
    
    for candidate in stake_candidates:
        for currency in currency_indicators:
            currency_pos = text.find(currency, candidate['end'])
            if currency_pos >= 0:
                distance = currency_pos - candidate['end']
                if distance < min_distance:
                    min_distance = distance
                    best_stake = candidate
    
    if best_stake:
        result['stake'] = best_stake['normalized']
    elif stake_candidates:
        # Fallback: rightmost stake candidate (usually the stake column)
        result['stake'] = stake_candidates[-1]['normalized']
    
    # 3. Find profit: small numbers 0.1-15, typically at the end
    profit_candidates = [n for n in normalized_numbers if 0.1 <= n['value'] <= 15.0]
    if profit_candidates:
        # Take the rightmost (last) profit candidate
        result['profit'] = profit_candidates[-1]['normalized']
    
    return result

def parse_surebet_from_blocks(blocks_data: Dict) -> Dict:
    """Parse SureBet data from OCR blocks with robust, deterministic extraction"""
    
    blocks = blocks_data.get('raw_blocks', [])
    lines = blocks_data.get('lines', [])
    
    if not lines:
        raise ValueError("No lines data provided")
    
    # Sort lines deterministically by Y position (top to bottom)
    sorted_lines = sort_lines_by_position(lines)
    
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
    
    # Extract header date and time
    game_date, game_time = extract_header_datetime(sorted_lines)
    result['gameDate'] = game_date
    result['gameTime'] = game_time
    
    # Extract teams
    team_a, team_b = parse_teams_from_title(sorted_lines)
    result['betA']['teamA'] = team_a
    result['betA']['teamB'] = team_b
    result['betB']['teamA'] = team_a
    result['betB']['teamB'] = team_b
    
    # Extract profit percentage from teams line
    for line in sorted_lines:
        full_text = line.get('full_text', '')
        if team_a in full_text and team_b in full_text and '%' in full_text:
            percent_match = re.search(r'(\d+\.?\d*)%', full_text)
            if percent_match:
                result['totalProfitPercentage'] = percent_match.group(1)
                break
    
    # Find teams line index for sport/league parsing
    teams_line_index = -1
    for i, line in enumerate(sorted_lines):
        full_text = line.get('full_text', '')
        if team_a in full_text and team_b in full_text:
            teams_line_index = i
            break
    
    # Extract sport and league near teams line
    if teams_line_index >= 0:
        sport, league = parse_sport_league_near_teams(sorted_lines, teams_line_index)
        result['sport'] = sport
        result['league'] = league
    else:
        # Fallback: search entire document for sport/league
        for line in sorted_lines:
            full_text = normalize_unicode_text(line.get('full_text', ''))
            if '/' in full_text and any(sport in full_text.lower() for sport in ['futebol', 'football', 'tênis', 'tennis', 'basquete', 'basketball']):
                parts = full_text.split('/', 1)
                result['sport'] = parts[0].strip()
                result['league'] = parts[1].strip() if len(parts) > 1 else ""
                break
    
    # Group betting lines and extract data
    betting_groups = group_bet_lines(sorted_lines)
    
    # Assign betA and betB deterministically by Y position (top = A, bottom = B)
    if len(betting_groups) >= 1:
        group_a = betting_groups[0]  # Upper bet = A
        numbers = extract_numbers_with_context(group_a['combined_text'])
        bet_type = extract_bet_type_from_group(group_a['combined_text'])
        
        result['betA']['bettingHouse'] = group_a['house']
        result['betA']['betType'] = bet_type
        result['betA']['odds'] = numbers['odds']
        result['betA']['stake'] = numbers['stake']
        result['betA']['profit'] = numbers['profit']
        
        # Calculate payout
        try:
            odds = float(numbers['odds'])
            stake = float(numbers['stake'])
            payout = odds * stake
            result['betA']['payout'] = f"{payout:.2f}"
        except (ValueError, ZeroDivisionError):
            result['betA']['payout'] = '0'
    
    if len(betting_groups) >= 2:
        group_b = betting_groups[1]  # Lower bet = B
        numbers = extract_numbers_with_context(group_b['combined_text'])
        bet_type = extract_bet_type_from_group(group_b['combined_text'])
        
        result['betB']['bettingHouse'] = group_b['house']
        result['betB']['betType'] = bet_type
        result['betB']['odds'] = numbers['odds']
        result['betB']['stake'] = numbers['stake']
        result['betB']['profit'] = numbers['profit']
        
        # Calculate payout
        try:
            odds = float(numbers['odds'])
            stake = float(numbers['stake'])
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