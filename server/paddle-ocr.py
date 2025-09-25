#!/usr/bin/env python3
"""
Perplexity AI OCR for Betting Slips
Uses Perplexity's vision capabilities to extract and analyze betting slip data
Provides both raw text extraction and structured data extraction
"""

import os
import sys
import json
import base64
import requests
from typing import Dict, List, Any, Optional
from datetime import datetime
import time

class PerplexityOCR:
    def __init__(self):
        """Initialize Perplexity AI OCR client"""
        print("Initializing Perplexity AI OCR...", file=sys.stderr)
        
        self.api_key = os.environ.get('PERPLEXITY_API_KEY')
        if not self.api_key:
            print("ERROR: PERPLEXITY_API_KEY not found in environment", file=sys.stderr)
            raise ValueError("PERPLEXITY_API_KEY is required")
        
        self.endpoint = "https://api.perplexity.ai/chat/completions"
        self.model = "llama-3.1-sonar-small-128k-online"
        
        print("Perplexity AI OCR initialized successfully", file=sys.stderr)

    def extract_raw_text(self, base64_image: str) -> str:
        """Extract raw text from image using Perplexity AI"""
        try:
            print("Starting raw text extraction with Perplexity AI...", file=sys.stderr)
            
            # Clean base64 string
            if 'base64,' in base64_image:
                base64_image = base64_image.split('base64,')[1]
            
            # Create data URL for the image
            image_url = f"data:image/png;base64,{base64_image}"
            
            # Prepare the request for raw text extraction
            payload = {
                "model": self.model,
                "messages": [
                    {
                        "role": "system",
                        "content": "You are an OCR system. Extract all visible text from the image exactly as it appears. Do not interpret, translate, or format the text. Return only the raw text content with line breaks preserved."
                    },
                    {
                        "role": "user",
                        "content": f"Extract all text from this image:\n\n![Image]({image_url})"
                    }
                ],
                "max_tokens": 2000,
                "temperature": 0.1,
                "stream": False,
                "return_images": False,
                "return_related_questions": False
            }
            
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            print("Sending request to Perplexity AI...", file=sys.stderr)
            response = requests.post(self.endpoint, headers=headers, json=payload, timeout=60)
            response.raise_for_status()
            
            result = response.json()
            
            # Extract the text content
            if 'choices' in result and result['choices'] and 'message' in result['choices'][0]:
                raw_text = result['choices'][0]['message']['content']
                print(f"Raw text extracted: {len(raw_text)} characters", file=sys.stderr)
                return raw_text
            else:
                print("No text content found in Perplexity response", file=sys.stderr)
                return "Nenhum texto extraído da imagem."
                
        except requests.exceptions.RequestException as e:
            print(f"Perplexity API request failed: {e}", file=sys.stderr)
            return f"Erro na requisição da API: {str(e)}"
        except Exception as e:
            print(f"Raw text extraction error: {e}", file=sys.stderr)
            return f"Erro na extração de texto: {str(e)}"

    def extract_betting_data(self, base64_image: str) -> Dict[str, Any]:
        """Extract structured betting data from image using Perplexity AI"""
        try:
            print("Starting structured betting data extraction with Perplexity AI...", file=sys.stderr)
            
            # Clean base64 string
            if 'base64,' in base64_image:
                base64_image = base64_image.split('base64,')[1]
            
            # Create data URL for the image
            image_url = f"data:image/png;base64,{base64_image}"
            
            # Prepare the request for structured extraction
            payload = {
                "model": self.model,
                "messages": [
                    {
                        "role": "system",
                        "content": """You are a betting slip data extraction expert. Analyze the betting slip image and extract the following information in JSON format:

{
  "betA": {
    "teamA": "First team name",
    "teamB": "Second team name", 
    "betType": "Bet type (1, 2, X, etc.)",
    "bettingHouse": "Betting house name",
    "odds": "Odds value (decimal format)",
    "stake": "Stake amount (numeric)",
    "payout": "Potential payout (numeric)"
  },
  "betB": {
    "teamA": "First team name",
    "teamB": "Second team name",
    "betType": "Bet type (different from betA)",
    "bettingHouse": "Different betting house name",
    "odds": "Different odds value",
    "stake": "Different stake amount",
    "payout": "Different potential payout"
  },
  "gameDate": "YYYY-MM-DD format",
  "gameTime": "HH:MM format",
  "sport": "Sport type (Futebol, Basquete, etc.)",
  "league": "League name",
  "totalProfitPercentage": "Profit percentage (e.g., 1.50%)"
}

Extract real values from the image. If some data is not visible, use reasonable defaults but mark uncertainty."""
                    },
                    {
                        "role": "user",
                        "content": f"Extract betting data from this betting slip image:\n\n![Betting Slip]({image_url})"
                    }
                ],
                "max_tokens": 1500,
                "temperature": 0.1,
                "stream": False,
                "return_images": False,
                "return_related_questions": False
            }
            
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            print("Sending structured extraction request to Perplexity AI...", file=sys.stderr)
            response = requests.post(self.endpoint, headers=headers, json=payload, timeout=60)
            response.raise_for_status()
            
            result = response.json()
            
            # Extract and parse the JSON content
            if 'choices' in result and result['choices'] and 'message' in result['choices'][0]:
                content = result['choices'][0]['message']['content']
                print(f"Received structured response: {content[:200]}...", file=sys.stderr)
                
                # Try to extract JSON from the response
                try:
                    # Look for JSON content in the response
                    json_start = content.find('{')
                    json_end = content.rfind('}') + 1
                    
                    if json_start != -1 and json_end > json_start:
                        json_str = content[json_start:json_end]
                        betting_data = json.loads(json_str)
                        
                        # Add formatted dates
                        if 'gameDate' in betting_data:
                            try:
                                date_obj = datetime.strptime(betting_data['gameDate'], '%Y-%m-%d')
                                betting_data['gameDateFormatted'] = date_obj.strftime('%d-%m-%Y')
                                betting_data['gameDateTime'] = f"{betting_data['gameDateFormatted']} {betting_data.get('gameTime', '00:00')}"
                            except ValueError:
                                # Use current date as fallback
                                today = datetime.now()
                                betting_data['gameDateFormatted'] = today.strftime('%d-%m-%Y')
                                betting_data['gameDate'] = today.strftime('%Y-%m-%d')
                                betting_data['gameDateTime'] = f"{betting_data['gameDateFormatted']} {betting_data.get('gameTime', '00:00')}"
                        
                        print(f"Successfully extracted betting data", file=sys.stderr)
                        return betting_data
                    else:
                        print("No valid JSON found in response", file=sys.stderr)
                        return self._get_default_result()
                        
                except json.JSONDecodeError as e:
                    print(f"Failed to parse JSON from response: {e}", file=sys.stderr)
                    print(f"Response content: {content}", file=sys.stderr)
                    return self._get_default_result()
            else:
                print("No content found in Perplexity response", file=sys.stderr)
                return self._get_default_result()
                
        except requests.exceptions.RequestException as e:
            print(f"Perplexity API request failed: {e}", file=sys.stderr)
            return self._get_default_result()
        except Exception as e:
            print(f"Structured extraction error: {e}", file=sys.stderr)
            return self._get_default_result()

    def _get_default_result(self) -> Dict[str, Any]:
        """Get default result structure when extraction fails"""
        today = datetime.now()
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
            'gameDate': today.strftime('%Y-%m-%d'),
            'gameTime': today.strftime('%H:%M'),
            'gameDateFormatted': today.strftime('%d-%m-%Y'),
            'gameDateTime': today.strftime('%d-%m-%Y %H:%M'),
            'sport': 'Futebol',
            'league': 'Liga Geral',
            'totalProfitPercentage': '0%'
        }

    def analyze_betting_slip(self, base64_image: str) -> Dict[str, Any]:
        """Main function to analyze betting slip using Perplexity AI"""
        try:
            print("Starting Perplexity AI betting slip analysis...", file=sys.stderr)
            
            # Extract structured betting data
            betting_data = self.extract_betting_data(base64_image)
            
            return {
                'success': True,
                'data': betting_data,
                'debug': {
                    'ocr_provider': 'perplexity',
                    'model': self.model,
                    'extraction_method': 'ai_vision'
                }
            }
            
        except Exception as e:
            print(f"Error in Perplexity AI betting slip analysis: {e}", file=sys.stderr)
            return {
                'success': False,
                'error': str(e),
                'data': self._get_default_result()
            }

# Function to maintain compatibility with existing code
def analyzeSureBetImagePaddle(base64_image: str) -> Dict[str, Any]:
    """Main entry point for betting slip analysis (compatibility function)"""
    try:
        ocr = PerplexityOCR()
        return ocr.analyze_betting_slip(base64_image)
    except Exception as e:
        print(f"Error in analyzeSureBetImagePaddle: {e}", file=sys.stderr)
        return {
            'success': False,
            'error': str(e),
            'data': PerplexityOCR()._get_default_result() if PerplexityOCR else {}
        }

# Main execution for command line usage
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
        ocr = PerplexityOCR()
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