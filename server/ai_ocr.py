#!/usr/bin/env python3
"""
AI OCR Service - Lightweight but powerful OCR solution
Combines EasyOCR with custom algorithms for betting documents
More efficient alternative to heavy DocTR while maintaining AI benefits
"""

import sys
import json
import os
import tempfile
from io import BytesIO
import base64
from typing import Dict, Any, List, Tuple
import re
import numpy as np

try:
    import easyocr
    import cv2
    from PIL import Image, ImageEnhance, ImageFilter
except ImportError as e:
    print(f"Error importing required packages: {e}")
    print("Please install: pip install easyocr opencv-python-headless pillow")
    sys.exit(1)

class AIOptimizedOCR:
    def __init__(self):
        """Initialize AI OCR with optimized settings for betting documents"""
        try:
            # Initialize EasyOCR with Portuguese and English support
            # GPU=False to avoid memory issues, still very fast on CPU
            self.reader = easyocr.Reader(['en', 'pt'], gpu=False, verbose=False)
            print("AI OCR initialized successfully with EasyOCR")
        except Exception as e:
            print(f"Error initializing EasyOCR: {e}")
            raise

    def preprocess_image_ai(self, image_data: bytes) -> np.ndarray:
        """
        Advanced image preprocessing using AI techniques
        Optimized specifically for betting document screenshots
        """
        try:
            # Load image
            image = Image.open(BytesIO(image_data))
            
            # Convert to RGB if necessary
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Convert to numpy array for OpenCV processing
            img_array = np.array(image)
            img_cv = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
            
            # AI-inspired preprocessing pipeline
            
            # 1. Adaptive histogram equalization for better contrast
            lab = cv2.cvtColor(img_cv, cv2.COLOR_BGR2LAB)
            lab_planes = cv2.split(lab)
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
            lab_planes[0] = clahe.apply(lab_planes[0])
            enhanced = cv2.merge(lab_planes)
            enhanced = cv2.cvtColor(enhanced, cv2.COLOR_LAB2BGR)
            
            # 2. Noise reduction with bilateral filter
            denoised = cv2.bilateralFilter(enhanced, 9, 75, 75)
            
            # 3. Smart resizing for optimal OCR
            height, width = denoised.shape[:2]
            
            # Optimal size for text recognition (not too small, not too large)
            target_height = 1200
            if height > target_height:
                ratio = target_height / height
                new_width = int(width * ratio)
                denoised = cv2.resize(denoised, (new_width, target_height), 
                                   interpolation=cv2.INTER_LANCZOS4)
                print(f"Resized image for optimal OCR: {new_width}x{target_height}")
            
            return denoised
            
        except Exception as e:
            print(f"Error in image preprocessing: {e}")
            raise

    def extract_text_with_ai(self, image_data: bytes) -> Dict[str, Any]:
        """
        Extract text using AI OCR with advanced confidence analysis
        """
        try:
            # Preprocess image with AI techniques
            processed_image = self.preprocess_image_ai(image_data)
            
            # Perform OCR with EasyOCR
            results = self.reader.readtext(processed_image)
            
            # Process results with AI-inspired analysis
            structured_data = self._process_ai_ocr_results(results, processed_image.shape)
            
            return {
                'success': True,
                'method': 'ai_optimized_ocr',
                'raw_text': structured_data['full_text'],
                'text_blocks': structured_data['blocks'],
                'word_count': structured_data['word_count'],
                'confidence_avg': structured_data['confidence_avg'],
                'processing_info': {
                    'image_size': processed_image.shape[:2][::-1],  # W, H format
                    'total_detections': len(results),
                    'high_confidence_words': len([r for r in results if r[2] > 0.8])
                }
            }
            
        except Exception as e:
            print(f"AI OCR error: {e}")
            return {
                'success': False,
                'error': str(e),
                'method': 'ai_optimized_ocr'
            }

    def _process_ai_ocr_results(self, results: List[Tuple], image_shape: Tuple) -> Dict[str, Any]:
        """
        Process EasyOCR results with AI-inspired text analysis
        Groups text intelligently and calculates advanced metrics
        """
        try:
            full_text = ""
            all_blocks = []
            word_count = 0
            total_confidence = 0
            
            # Sort results by position (top to bottom, left to right)
            sorted_results = sorted(results, key=lambda x: (x[0][0][1], x[0][0][0]))  # Sort by Y then X
            
            # Group nearby text into logical lines using AI clustering
            lines = self._cluster_text_into_lines(sorted_results, image_shape)
            
            for line_idx, line_words in enumerate(lines):
                line_text = ""
                line_confidence = 0
                line_word_data = []
                
                for bbox, text, confidence in line_words:
                    # Clean text
                    cleaned_text = text.strip()
                    if cleaned_text:
                        line_text += cleaned_text + " "
                        line_confidence += confidence
                        word_count += 1
                        total_confidence += confidence
                        
                        # Store word details
                        line_word_data.append({
                            'text': cleaned_text,
                            'confidence': confidence,
                            'bbox': self._normalize_bbox(bbox, image_shape),
                            'line': line_idx
                        })
                
                # Create line block
                line_text = line_text.strip()
                if line_text:
                    avg_confidence = line_confidence / len(line_words) if line_words else 0
                    
                    all_blocks.append({
                        'line_key': f"ai-{line_idx}",
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
            print(f"Error processing AI OCR results: {e}")
            raise

    def _cluster_text_into_lines(self, results: List[Tuple], image_shape: Tuple) -> List[List[Tuple]]:
        """
        Use AI-inspired clustering to group text into logical lines
        """
        if not results:
            return []
        
        lines = []
        current_line = [results[0]]
        
        # Calculate dynamic threshold based on image size
        height_threshold = image_shape[0] * 0.02  # 2% of image height
        
        for i in range(1, len(results)):
            prev_bbox = results[i-1][0]
            curr_bbox = results[i][0]
            
            # Calculate vertical distance between text centers
            prev_center_y = (prev_bbox[0][1] + prev_bbox[2][1]) / 2
            curr_center_y = (curr_bbox[0][1] + curr_bbox[2][1]) / 2
            
            vertical_distance = abs(curr_center_y - prev_center_y)
            
            # If close enough vertically, add to current line
            if vertical_distance < height_threshold:
                current_line.append(results[i])
            else:
                # Start new line
                lines.append(current_line)
                current_line = [results[i]]
        
        # Add the last line
        if current_line:
            lines.append(current_line)
        
        # Sort words within each line by X position
        for line in lines:
            line.sort(key=lambda x: x[0][0][0])  # Sort by left X coordinate
        
        return lines

    def _normalize_bbox(self, bbox: List[List[float]], image_shape: Tuple) -> List[float]:
        """Normalize bounding box coordinates to [0,1] range"""
        height, width = image_shape[:2]
        
        # EasyOCR returns [[x1,y1], [x2,y1], [x2,y2], [x1,y2]]
        x_coords = [point[0] for point in bbox]
        y_coords = [point[1] for point in bbox]
        
        x1, x2 = min(x_coords), max(x_coords)
        y1, y2 = min(y_coords), max(y_coords)
        
        # Normalize to [0,1]
        return [x1/width, y1/height, x2/width, y2/height]

    def extract_betting_data_ai(self, image_data: bytes) -> Dict[str, Any]:
        """
        Extract betting data using AI OCR with specialized algorithms
        """
        try:
            # Get AI OCR results
            ocr_result = self.extract_text_with_ai(image_data)
            
            if not ocr_result['success']:
                return ocr_result
            
            # Use AI-enhanced extraction logic
            betting_data = self._extract_betting_info_ai(ocr_result)
            
            # Add AI OCR metadata
            betting_data.update({
                'ocr_method': 'ai_optimized',
                'confidence_avg': ocr_result['confidence_avg'],
                'word_count': ocr_result['word_count'],
                'processing_info': ocr_result['processing_info']
            })
            
            return betting_data
            
        except Exception as e:
            print(f"Error extracting betting data with AI: {e}")
            return {
                'success': False,
                'error': str(e),
                'method': 'ai_betting_extraction'
            }

    def _extract_betting_info_ai(self, ocr_result: Dict[str, Any]) -> Dict[str, Any]:
        """
        AI-enhanced betting information extraction with smart pattern recognition
        """
        result = {
            'success': True,
            'method': 'ai_betting_extraction',
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
        
        # Enhanced betting house detection with AI confidence weighting
        betting_houses = [
            'Pinnacle', 'BravoBet', 'Betfast', 'Blaze', 'KTO', 'Betano', 
            'VBet', 'MarjoSports', 'Betnacional', 'Aposta1', 'SuperBet', 
            'bet365', 'Sportingbet', '1xBet', 'Betway'
        ]
        
        full_text = ocr_result['raw_text']
        
        # AI-enhanced profit extraction with multiple pattern recognition
        profit_patterns = [
            r'(\d+\.?\d*)%',  # Standard percentage
            r'ROI[:\s]*(\d+\.?\d*)%',  # ROI percentage
            r'Lucro[:\s]*(\d+\.?\d*)%'  # Portuguese profit
        ]
        
        for pattern in profit_patterns:
            profit_match = re.search(pattern, full_text, re.IGNORECASE)
            if profit_match:
                result['totalProfitPercentage'] = profit_match.group(1)
                print(f"AI found profit: {result['totalProfitPercentage']}%")
                break
        
        # AI-enhanced team extraction with better cleaning
        team_patterns = [
            r'([A-Za-zÀ-ÿ\s\-\.]+)\s*[—–-]\s*([A-Za-zÀ-ÿ\s\-\.]+)',
            r'([A-Za-zÀ-ÿ\s\-\.]+)\s+vs\s+([A-Za-zÀ-ÿ\s\-\.]+)',
            r'([A-Za-zÀ-ÿ\s\-\.]+)\s+x\s+([A-Za-zÀ-ÿ\s\-\.]+)'
        ]
        
        for pattern in team_patterns:
            team_match = re.search(pattern, full_text)
            if team_match:
                team_a = self._clean_team_name(team_match.group(1), betting_houses)
                team_b = self._clean_team_name(team_match.group(2), betting_houses)
                
                if len(team_a) > 2 and len(team_b) > 2:
                    result['betA']['teamA'] = team_a
                    result['betA']['teamB'] = team_b
                    result['betB']['teamA'] = team_a
                    result['betB']['teamB'] = team_b
                    print(f"AI found teams: {team_a} vs {team_b}")
                    break
        
        # AI-enhanced betting house and data extraction
        for block in ocr_result['text_blocks']:
            text_line = block['full_text']
            confidence = block['confidence_avg']
            
            # Only process high-confidence blocks
            if confidence < 0.5:
                continue
            
            # AI-powered house detection with confidence weighting
            for house in betting_houses:
                if house.lower() in text_line.lower():
                    print(f"AI found betting house: {house} (confidence: {confidence:.2f}) in: {text_line}")
                    
                    # Extract odds and stakes using AI pattern matching
                    odds_stakes = self._extract_odds_stakes_ai(text_line, confidence)
                    
                    if not result['betA']['bettingHouse']:
                        result['betA']['bettingHouse'] = house
                        if odds_stakes['odds']:
                            result['betA']['odds'] = odds_stakes['odds']
                            print(f"AI set betA odds: {odds_stakes['odds']}")
                        if odds_stakes['stake']:
                            result['betA']['stake'] = odds_stakes['stake']
                            print(f"AI set betA stake: {odds_stakes['stake']}")
                    elif not result['betB']['bettingHouse'] and house != result['betA']['bettingHouse']:
                        result['betB']['bettingHouse'] = house
                        if odds_stakes['odds']:
                            result['betB']['odds'] = odds_stakes['odds']
                            print(f"AI set betB odds: {odds_stakes['odds']}")
                        if odds_stakes['stake']:
                            result['betB']['stake'] = odds_stakes['stake']
                            print(f"AI set betB stake: {odds_stakes['stake']}")
                    
                    break
        
        # AI-powered payout calculation
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

    def _clean_team_name(self, team_name: str, betting_houses: List[str]) -> str:
        """AI-enhanced team name cleaning"""
        cleaned = team_name.strip()
        
        # Remove betting house names
        for house in betting_houses:
            cleaned = cleaned.replace(house, '').strip()
        
        # Remove common OCR artifacts and extra characters
        cleaned = re.sub(r'^[^A-Za-zÀ-ÿ]+', '', cleaned)  # Remove leading non-letters
        cleaned = re.sub(r'[^A-Za-zÀ-ÿ\s\-\.]+$', '', cleaned)  # Remove trailing artifacts
        cleaned = re.sub(r'\s+', ' ', cleaned)  # Normalize spaces
        
        return cleaned.strip()

    def _extract_odds_stakes_ai(self, text_line: str, confidence: float) -> Dict[str, str]:
        """
        AI-enhanced odds and stakes extraction with confidence-weighted pattern matching
        """
        odds = ""
        stake = ""
        
        # High-confidence patterns for SureBet format
        confidence_multiplier = min(confidence * 2, 1.0)  # Boost confidence effect
        
        # Pattern 1: High-precision SureBet odds (X.XXX format)
        odds_patterns = [
            r'\b(\d\.\d{3})\b',  # 1.830, 2.280
            r'\b(\d\.\d{2})\b',  # 1.83, 2.28
            r'\b(\d\.\d{1})\b'   # 1.8, 2.3
        ]
        
        for pattern in odds_patterns:
            odds_match = re.search(pattern, text_line)
            if odds_match:
                odds_candidate = odds_match.group(1)
                odds_val = float(odds_candidate)
                
                # Validate odds range with confidence weighting
                min_odds = 1.0 if confidence > 0.8 else 1.1
                max_odds = 15.0 if confidence > 0.8 else 10.0
                
                if min_odds <= odds_val <= max_odds:
                    odds = odds_candidate
                    print(f"AI found odds: {odds} (confidence: {confidence:.2f})")
                    break
        
        # Pattern 2: Enhanced stake extraction
        stake_patterns = [
            r'\b(\d{2,3}\.\d{2})\b',  # 55.47, 44.53
            r'\b(\d{1,3}\.\d{2})\b',  # 5.47, 144.53
        ]
        
        for pattern in stake_patterns:
            stake_match = re.search(pattern, text_line)
            if stake_match and stake_match.group(1) != odds:  # Don't use same number as odds
                stake_candidate = stake_match.group(1)
                stake_val = float(stake_candidate)
                
                # Validate stake range
                min_stake = 5.0 if confidence > 0.8 else 10.0
                max_stake = 2000.0
                
                if min_stake <= stake_val <= max_stake:
                    stake = stake_candidate
                    print(f"AI found stake: {stake} (confidence: {confidence:.2f})")
                    break
        
        # Pattern 3: Two-part stake combination (AI-enhanced)
        if not stake:
            two_part_match = re.search(r'\b(\d{2})\s+(\d{2})\b', text_line)
            if two_part_match:
                combined = f"{two_part_match.group(1)}.{two_part_match.group(2)}"
                combined_val = float(combined)
                
                if 10.0 <= combined_val <= 1000.0:
                    stake = combined
                    print(f"AI combined stake: {stake} from '{two_part_match.group(1)} {two_part_match.group(2)}'")
        
        return {'odds': odds, 'stake': stake}


def main():
    """Main function for command line usage"""
    if len(sys.argv) != 2:
        print("Usage: python ai_ocr.py <base64_image_data>")
        sys.exit(1)
    
    try:
        # Initialize AI OCR
        ai_ocr = AIOptimizedOCR()
        
        # Decode base64 image data
        base64_data = sys.argv[1]
        image_data = base64.b64decode(base64_data)
        
        # Perform AI OCR and betting data extraction
        result = ai_ocr.extract_betting_data_ai(image_data)
        
        # Output JSON result
        print(json.dumps(result, ensure_ascii=False))
        
    except Exception as e:
        error_result = {
            'success': False,
            'error': str(e),
            'method': 'ai_ocr_main'
        }
        print(json.dumps(error_result))

if __name__ == "__main__":
    main()