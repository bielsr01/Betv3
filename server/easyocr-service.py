#!/usr/bin/env python3
import sys
import json
import base64
import io
import re
from PIL import Image
import easyocr

def extract_surebet_data(text):
    """Extract SureBet data from OCR text using optimized patterns"""
    
    # Initialize result
    result = {
        "betA": {
            "bettingHouse": "",
            "teamA": "",
            "teamB": "",
            "betType": "",
            "odds": "0",
            "stake": "0",
            "profit": "0"
        },
        "betB": {
            "bettingHouse": "",
            "teamA": "",
            "teamB": "",
            "betType": "",
            "odds": "0",
            "stake": "0",
            "profit": "0"
        },
        "gameDate": "",
        "gameTime": "",
        "sport": "",
        "league": "",
        "totalProfitPercentage": "0"
    }
    
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    
    # Extract teams (format: "Team1 — Team2" or "Team1 - Team2")
    for line in lines[:5]:  # Check first few lines
        team_match = re.search(r'([A-Za-z\u00C0-\u017F\s0-9.&]+)\s*[-—–]\s*([A-Za-z\u00C0-\u017F\s0-9.&]+)', line)
        if team_match and not re.search(r'\d+\.\d+%', line):  # Not a percentage line
            result["betA"]["teamA"] = team_match.group(1).strip()
            result["betA"]["teamB"] = team_match.group(2).strip()
            result["betB"]["teamA"] = team_match.group(1).strip()
            result["betB"]["teamB"] = team_match.group(2).strip()
            break
    
    # Extract sport and league
    sport_match = re.search(r'(Futebol|Football|Basquete|Basketball|Tennis|Tênis|Volei)\s*/\s*([^\n]+)', text, re.IGNORECASE)
    if sport_match:
        result["sport"] = sport_match.group(1)
        result["league"] = sport_match.group(2).strip()
    
    # Extract profit percentage
    profit_match = re.search(r'(\d+\.\d+)%', text)
    if profit_match:
        result["totalProfitPercentage"] = profit_match.group(1)
    
    # Extract betting data from lines with USD
    betting_houses = ['Pinnacle', 'BravoBet', 'Betfast', 'Blaze', 'KTO', 'Betano', 'VBet', 'MarjoSports', 'Betnacional']
    bet_lines = []
    
    for line in lines:
        for house in betting_houses:
            if house.lower() in line.lower() and 'USD' in line:
                bet_lines.append(line)
                break
    
    # Parse first betting line
    if len(bet_lines) >= 1:
        line = bet_lines[0]
        
        # Extract house
        for house in betting_houses:
            if house.lower() in line.lower():
                result["betA"]["bettingHouse"] = house
                break
        
        # Extract odds, stake, profit using regex
        # Pattern: odds ... USD stake ... profit
        numbers = re.findall(r'(\d+\.\d+)', line)
        if len(numbers) >= 3:
            result["betA"]["odds"] = numbers[0]
            result["betA"]["stake"] = numbers[1]
            result["betA"]["profit"] = numbers[2]
        
        # Extract bet type (between house and first number)
        bet_type_match = re.search(r'(?:' + '|'.join(betting_houses) + r')\s*(?:\([^)]+\))?\s+(.+?)\s+\d+\.\d+', line, re.IGNORECASE)
        if bet_type_match:
            result["betA"]["betType"] = bet_type_match.group(1).strip()
    
    # Parse second betting line
    if len(bet_lines) >= 2:
        line = bet_lines[1]
        
        # Extract house
        for house in betting_houses:
            if house.lower() in line.lower():
                result["betB"]["bettingHouse"] = house
                break
        
        # Extract odds, stake, profit using regex
        numbers = re.findall(r'(\d+\.\d+)', line)
        if len(numbers) >= 3:
            result["betB"]["odds"] = numbers[0]
            result["betB"]["stake"] = numbers[1]
            result["betB"]["profit"] = numbers[2]
        
        # Extract bet type
        bet_type_match = re.search(r'(?:' + '|'.join(betting_houses) + r')\s*(?:\([^)]+\))?\s+(.+?)\s+\d+\.\d+', line, re.IGNORECASE)
        if bet_type_match:
            result["betB"]["betType"] = bet_type_match.group(1).strip()
    
    # Extract date and time
    date_match = re.search(r'(\d{4}-\d{2}-\d{2})', text)
    if date_match:
        result["gameDate"] = date_match.group(1)
    
    time_match = re.search(r'(\d{1,2}:\d{2})', text)
    if time_match:
        result["gameTime"] = time_match.group(1)
    
    return result

def main():
    if len(sys.argv) != 2:
        print(json.dumps({"error": "Usage: python3 easyocr-service.py <base64_image>"}))
        sys.exit(1)
    
    try:
        # Initialize EasyOCR reader (cache it for faster subsequent calls)
        reader = easyocr.Reader(['en', 'pt'], gpu=False, verbose=False)
        
        # Decode base64 image
        image_base64 = sys.argv[1]
        image_data = base64.b64decode(image_base64)
        image = Image.open(io.BytesIO(image_data))
        
        # Convert PIL Image to format EasyOCR can use
        image_array = list(image_data)
        
        # Perform OCR
        results = reader.readtext(image_array, detail=0)  # detail=0 returns only text
        
        # Join all text results
        extracted_text = '\n'.join(results)
        
        # Extract SureBet data
        surebet_data = extract_surebet_data(extracted_text)
        
        # Output JSON
        print(json.dumps(surebet_data))
        
    except Exception as e:
        print(json.dumps({"error": f"OCR processing failed: {str(e)}"}))
        sys.exit(1)

if __name__ == "__main__":
    main()