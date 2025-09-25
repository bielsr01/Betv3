#!/usr/bin/env python3
"""
DocTR AI OCR Service - Advanced Document Text Recognition
High-performance AI-powered OCR using DocTR and PyTorch
Specifically optimized for Portuguese betting documents
"""

import sys
import json
import os
import base64
from io import BytesIO
from typing import Dict, Any, List, Tuple
import re
import numpy as np

try:
    from doctr.io import DocumentFile
    from doctr.models import ocr_predictor
    import cv2
    from PIL import Image, ImageEnhance
    print("DocTR AI OCR initialized successfully!")
except ImportError as e:
    print(f"Error importing DocTR: {e}")
    sys.exit(1)

class DocTRAIOCR:
    def __init__(self):
        """Initialize DocTR AI OCR system"""
        try:
            # Initialize DocTR OCR predictor with PyTorch backend
            print("Loading DocTR AI model...")
            self.ocr_predictor = ocr_predictor(pretrained=True)
            print("✅ DocTR AI OCR model loaded successfully!")
        except Exception as e:
            print(f"Error initializing DocTR: {e}")
            raise

    def preprocess_betting_image(self, image_data: bytes) -> np.ndarray:
        """
        Advanced image preprocessing for betting documents using AI techniques
        """
        try:
            # Load image
            image = Image.open(BytesIO(image_data))
            
            # Convert to RGB
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Convert to numpy array
            img_array = np.array(image)
            
            # Advanced AI-inspired preprocessing
            
            # 1. Smart resizing for optimal AI processing
            height, width = img_array.shape[:2]
            target_size = 1024  # Optimal for DocTR
            
            if max(height, width) > target_size:
                if width > height:
                    new_width = target_size
                    new_height = int(height * (target_size / width))
                else:
                    new_height = target_size
                    new_width = int(width * (target_size / height))
                
                img_array = cv2.resize(img_array, (new_width, new_height), interpolation=cv2.INTER_LANCZOS4)
                print(f"AI preprocessing: Resized to {new_width}x{new_height}")
            
            # 2. Contrast enhancement for better text recognition
            pil_img = Image.fromarray(img_array)
            enhancer = ImageEnhance.Contrast(pil_img)
            pil_img = enhancer.enhance(1.2)
            
            # 3. Sharpening for crisp text edges
            enhancer = ImageEnhance.Sharpness(pil_img)
            pil_img = enhancer.enhance(1.1)
            
            return np.array(pil_img)
            
        except Exception as e:
            print(f"Error in AI preprocessing: {e}")
            raise

    def extract_text_with_doctr(self, image_data: bytes) -> Dict[str, Any]:
        """
        Extract text using DocTR AI OCR
        """
        try:
            print("🤖 Starting DocTR AI text extraction...")
            
            # Preprocess image
            processed_image = self.preprocess_betting_image(image_data)
            
            # Convert to PIL for DocTR
            pil_image = Image.fromarray(processed_image)
            
            # Create DocumentFile for DocTR
            doc = DocumentFile.from_images([pil_image])
            
            # Perform AI OCR with DocTR
            result = self.ocr_predictor(doc)
            
            # Process DocTR results
            structured_data = self._process_doctr_results(result)
            
            return {
                'success': True,
                'method': 'doctr_ai_ocr',
                'raw_text': structured_data['full_text'],
                'text_blocks': structured_data['blocks'],
                'word_count': structured_data['word_count'],
                'confidence_avg': structured_data['confidence_avg'],
                'processing_info': {
                    'ai_model': 'DocTR with PyTorch',
                    'image_size': processed_image.shape[:2][::-1],
                    'total_words': structured_data['word_count']
                }
            }
            
        except Exception as e:
            print(f"DocTR AI OCR error: {e}")
            return {
                'success': False,
                'error': str(e),
                'method': 'doctr_ai_ocr'
            }

    def _process_doctr_results(self, doctr_result) -> Dict[str, Any]:
        """
        Process DocTR AI results into structured format
        """
        try:
            full_text = ""
            all_blocks = []
            word_count = 0
            total_confidence = 0
            
            # Navigate DocTR result structure
            for page_idx, page in enumerate(doctr_result.pages):
                for block_idx, block in enumerate(page.blocks):
                    for line_idx, line in enumerate(block.lines):
                        line_text = ""
                        line_confidence = 0
                        line_word_data = []
                        
                        for word_idx, word in enumerate(line.words):
                            word_text = word.value
                            word_conf = word.confidence
                            
                            if word_text.strip():
                                line_text += word_text + " "
                                line_confidence += word_conf
                                word_count += 1
                                total_confidence += word_conf
                                
                                line_word_data.append({
                                    'text': word_text,
                                    'confidence': word_conf,
                                    'bbox': word.geometry,
                                    'line': line_idx
                                })
                        
                        # Create line block
                        line_text = line_text.strip()
                        if line_text:
                            avg_confidence = line_confidence / len(line.words) if line.words else 0
                            
                            all_blocks.append({
                                'line_key': f"doctr-p{page_idx}-b{block_idx}-l{line_idx}",
                                'full_text': line_text,
                                'words': line_word_data,
                                'confidence_avg': avg_confidence
                            })
                            
                            full_text += line_text + "\n"
            
            confidence_avg = total_confidence / word_count if word_count > 0 else 0
            
            return {
                'full_text': full_text.strip(),
                'blocks': all_blocks,
                'word_count': word_count,
                'confidence_avg': confidence_avg
            }
            
        except Exception as e:
            print(f"Error processing DocTR results: {e}")
            raise

    def extract_betting_data_ai(self, image_data: bytes) -> Dict[str, Any]:
        """
        Extract betting data using DocTR AI with advanced pattern recognition
        """
        try:
            # Get AI OCR results
            ocr_result = self.extract_text_with_doctr(image_data)
            
            if not ocr_result['success']:
                return ocr_result
            
            # Use AI-enhanced betting information extraction
            betting_data = self._extract_betting_info_ai(ocr_result)
            
            # Add AI OCR metadata
            betting_data.update({
                'ocr_method': 'doctr_ai_pytorch',
                'confidence_avg': ocr_result['confidence_avg'],
                'word_count': ocr_result['word_count'],
                'processing_info': ocr_result['processing_info']
            })
            
            return betting_data
            
        except Exception as e:
            print(f"Error extracting betting data with DocTR AI: {e}")
            return {
                'success': False,
                'error': str(e),
                'method': 'doctr_ai_betting_extraction'
            }

    def _extract_betting_info_ai(self, ocr_result: Dict[str, Any]) -> Dict[str, Any]:
        """
        AI-enhanced betting information extraction using DocTR results
        """
        result = {
            'success': True,
            'method': 'doctr_ai_betting_extraction',
            'raw_text': ocr_result['raw_text'],
            'text_blocks': ocr_result['text_blocks'],
            'betA': {
                'bettingHouse': '',
                'teamA': '',
                'teamB': '',
                'odds': '',
                'stake': '',
                'payout': ''
            },
            'betB': {
                'bettingHouse': '',
                'teamA': '',
                'teamB': '',
                'odds': '',
                'stake': '',
                'payout': ''
            },
            'totalProfitPercentage': '',
            'gameDate': '',
            'sport': '',
            'league': ''
        }
        
        # AI-enhanced betting house detection
        betting_houses = [
            'Pinnacle', 'KTO', 'BravoBet', 'Betfast', 'Blaze', 'Betano', 
            'VBet', 'MarjoSports', 'Betnacional', 'Aposta1', 'SuperBet', 
            'bet365', 'Sportingbet', '1xBet', 'Betway'
        ]
        
        full_text = ocr_result['raw_text']
        print(f"🤖 AI analyzing text: {full_text[:200]}...")
        
        # AI profit extraction with multiple patterns
        profit_patterns = [
            r'(\d+\.?\d*)%',
            r'ROI[:\s]*(\d+\.?\d*)%',
            r'Lucro[:\s]*(\d+\.?\d*)%',
            r'Profit[:\s]*(\d+\.?\d*)%'
        ]
        
        for pattern in profit_patterns:
            profit_match = re.search(pattern, full_text, re.IGNORECASE)
            if profit_match:
                result['totalProfitPercentage'] = profit_match.group(1)
                print(f"🤖 AI found profit: {result['totalProfitPercentage']}%")
                break
        
        # AI team extraction with enhanced patterns
        team_patterns = [
            r'([A-Za-zÀ-ÿ\s\-\.]+)\s*[—–-]\s*([A-Za-zÀ-ÿ\s\-\.]+)',
            r'([A-Za-zÀ-ÿ\s\-\.]+)\s+vs\s+([A-Za-zÀ-ÿ\s\-\.]+)',
            r'([A-Za-zÀ-ÿ\s\-\.]+)\s+x\s+([A-Za-zÀ-ÿ\s\-\.]+)'
        ]
        
        for pattern in team_patterns:
            team_match = re.search(pattern, full_text)
            if team_match:
                team_a = self._clean_team_name_ai(team_match.group(1), betting_houses)
                team_b = self._clean_team_name_ai(team_match.group(2), betting_houses)
                
                if len(team_a) > 2 and len(team_b) > 2:
                    result['betA']['teamA'] = team_a
                    result['betA']['teamB'] = team_b
                    result['betB']['teamA'] = team_a
                    result['betB']['teamB'] = team_b
                    print(f"🤖 AI found teams: {team_a} vs {team_b}")
                    break
        
        # AI-enhanced betting house and data extraction
        for block in ocr_result['text_blocks']:
            text_line = block['full_text']
            confidence = block['confidence_avg']
            
            # Only process high-confidence blocks
            if confidence < 0.4:
                continue
            
            # AI betting house detection with confidence weighting
            for house in betting_houses:
                if house.lower() in text_line.lower():
                    print(f"🤖 AI found betting house: {house} (confidence: {confidence:.2f}) in: {text_line}")
                    
                    # Extract odds and stakes using AI coordinate analysis
                    odds_stakes = self._extract_odds_stakes_ai(text_line, block.get('words', []), confidence)
                    
                    if not result['betA']['bettingHouse']:
                        result['betA']['bettingHouse'] = house
                        if odds_stakes['odds']:
                            result['betA']['odds'] = odds_stakes['odds']
                            print(f"🤖 AI set betA odds: {odds_stakes['odds']}")
                        if odds_stakes['stake']:
                            result['betA']['stake'] = odds_stakes['stake']
                            print(f"🤖 AI set betA stake: {odds_stakes['stake']}")
                    elif not result['betB']['bettingHouse'] and house != result['betA']['bettingHouse']:
                        result['betB']['bettingHouse'] = house
                        if odds_stakes['odds']:
                            result['betB']['odds'] = odds_stakes['odds']
                            print(f"🤖 AI set betB odds: {odds_stakes['odds']}")
                        if odds_stakes['stake']:
                            result['betB']['stake'] = odds_stakes['stake']
                            print(f"🤖 AI set betB stake: {odds_stakes['stake']}")
                    break
        
        # AI payout calculation
        for bet_key in ['betA', 'betB']:
            bet = result[bet_key]
            if bet['odds'] and bet['stake']:
                try:
                    odds_val = float(bet['odds'])
                    stake_val = float(bet['stake'])
                    bet['payout'] = f"{odds_val * stake_val:.2f}"
                except ValueError:
                    pass
        
        return result

    def _clean_team_name_ai(self, team_name: str, betting_houses: List[str]) -> str:
        """AI-enhanced team name cleaning"""
        cleaned = team_name.strip()
        
        # Remove betting house names
        for house in betting_houses:
            cleaned = cleaned.replace(house, '').strip()
        
        # Advanced cleaning with Portuguese support
        cleaned = re.sub(r'^[^A-Za-zÀ-ÿ]+', '', cleaned)
        cleaned = re.sub(r'[^A-Za-zÀ-ÿ\s\-\.]+$', '', cleaned)
        cleaned = re.sub(r'\s+', ' ', cleaned)
        
        return cleaned.strip()

    def _extract_odds_stakes_ai(self, text_line: str, words: List[Dict], confidence: float) -> Dict[str, str]:
        """
        AI-enhanced odds and stakes extraction using DocTR word-level data
        """
        odds = ""
        stake = ""
        
        # Use AI confidence to weight pattern matching
        confidence_boost = min(confidence * 1.5, 1.0)
        
        # Enhanced SureBet patterns with AI confidence weighting
        
        # Pattern 1: SureBet odds (X.XXX format)
        odds_patterns = [
            r'\b(\d\.\d{3})\b',  # 1.830, 2.280
            r'\b(\d\.\d{2})\b',  # 1.83, 2.28
        ]
        
        for pattern in odds_patterns:
            odds_match = re.search(pattern, text_line)
            if odds_match:
                odds_candidate = odds_match.group(1)
                odds_val = float(odds_candidate)
                
                # AI-weighted odds validation
                min_odds = 1.0 if confidence > 0.7 else 1.1
                max_odds = 20.0 if confidence > 0.7 else 10.0
                
                if min_odds <= odds_val <= max_odds:
                    odds = odds_candidate
                    print(f"🤖 AI found odds: {odds} (confidence: {confidence:.2f})")
                    break
        
        # Pattern 2: AI-enhanced stake extraction
        stake_patterns = [
            r'\b(\d{2,3}\.\d{2})\b',  # 55.47, 44.53
            r'\b(\d{1,3}\.\d{2})\b',  # 5.47, 144.53
        ]
        
        for pattern in stake_patterns:
            stake_match = re.search(pattern, text_line)
            if stake_match and stake_match.group(1) != odds:
                stake_candidate = stake_match.group(1)
                stake_val = float(stake_candidate)
                
                # AI-weighted stake validation
                min_stake = 5.0 if confidence > 0.7 else 10.0
                max_stake = 5000.0
                
                if min_stake <= stake_val <= max_stake:
                    stake = stake_candidate
                    print(f"🤖 AI found stake: {stake} (confidence: {confidence:.2f})")
                    break
        
        # AI two-part stake combination
        if not stake:
            two_part_match = re.search(r'\b(\d{2})\s+(\d{2})\b', text_line)
            if two_part_match:
                combined = f"{two_part_match.group(1)}.{two_part_match.group(2)}"
                combined_val = float(combined)
                
                if 10.0 <= combined_val <= 1000.0:
                    stake = combined
                    print(f"🤖 AI combined stake: {stake} from '{two_part_match.group(1)} {two_part_match.group(2)}'")
        
        return {'odds': odds, 'stake': stake}


def main():
    """Main function for DocTR AI OCR"""
    try:
        # Initialize DocTR AI OCR
        doctr_ocr = DocTRAIOCR()
        
        # Read base64 data from stdin to avoid E2BIG error
        base64_data = sys.stdin.read().strip()
        if not base64_data:
            raise ValueError("No image data received from stdin")
        
        image_data = base64.b64decode(base64_data)
        
        # Perform AI OCR and betting data extraction
        result = doctr_ocr.extract_betting_data_ai(image_data)
        
        # Output JSON result
        print(json.dumps(result, ensure_ascii=False))
        
    except Exception as e:
        error_result = {
            'success': False,
            'error': str(e),
            'method': 'doctr_ai_ocr_main'
        }
        print(json.dumps(error_result))

if __name__ == "__main__":
    main()