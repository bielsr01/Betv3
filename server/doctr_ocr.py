#!/usr/bin/env python3
"""
DocTR OCR Service - AI-powered text recognition
More efficient and accurate replacement for Tesseract
"""

import sys
import json
import os
import tempfile
from io import BytesIO
import base64
from typing import Dict, Any, List, Tuple
import re

try:
    from doctr.io import DocumentFile
    from doctr.models import ocr_predictor
    from PIL import Image
    import numpy as np
except ImportError as e:
    print(f"Error importing required packages: {e}")
    print("Please install: pip install python-doctr[torch,viz] pillow")
    sys.exit(1)

class DocTROCR:
    def __init__(self):
        """Initialize DocTR OCR with optimized models"""
        try:
            # Use best performing architectures for betting documents
            self.model = ocr_predictor(
                det_arch='db_resnet50',        # Text detection model  
                reco_arch='crnn_vgg16_bn',     # Text recognition model
                pretrained=True
            )
            print("DocTR OCR initialized successfully")
        except Exception as e:
            print(f"Error initializing DocTR: {e}")
            raise

    def preprocess_image(self, image_data: bytes) -> Image.Image:
        """Preprocess image for better OCR accuracy"""
        try:
            # Load image from bytes
            image = Image.open(BytesIO(image_data))
            
            # Convert to RGB if necessary
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Resize if too large (DocTR works better with reasonable sizes)
            max_size = 2000
            if max(image.size) > max_size:
                ratio = max_size / max(image.size)
                new_size = tuple(int(dim * ratio) for dim in image.size)
                image = image.resize(new_size, Image.Resampling.LANCZOS)
                print(f"Resized image to {new_size}")
            
            return image
        except Exception as e:
            print(f"Error preprocessing image: {e}")
            raise

    def extract_text_with_coordinates(self, image_data: bytes) -> Dict[str, Any]:
        """
        Extract text using DocTR with coordinate information
        Returns structured data with text, confidence, and positions
        """
        try:
            # Preprocess image
            image = self.preprocess_image(image_data)
            
            # Save to temporary file for DocTR
            with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp_file:
                image.save(tmp_file.name, 'JPEG', quality=95)
                tmp_path = tmp_file.name
            
            try:
                # Create document from image
                doc = DocumentFile.from_images(tmp_path)
                
                # Perform OCR
                result = model(doc)
                
                # Extract structured data
                structured_data = self._process_doctr_result(result)
                
                return {
                    'success': True,
                    'method': 'doctr_ai_ocr',
                    'raw_text': structured_data['full_text'],
                    'text_blocks': structured_data['blocks'],
                    'word_count': structured_data['word_count'],
                    'confidence_avg': structured_data['confidence_avg'],
                    'processing_info': {
                        'image_size': image.size,
                        'total_words': len(structured_data['words']),
                        'high_confidence_words': len([w for w in structured_data['words'] if w['confidence'] > 0.8])
                    }
                }
                
            finally:
                # Clean up temporary file
                if os.path.exists(tmp_path):
                    os.unlink(tmp_path)
                    
        except Exception as e:
            print(f"DocTR OCR error: {e}")
            return {
                'success': False,
                'error': str(e),
                'method': 'doctr_ai_ocr'
            }

    def _process_doctr_result(self, result) -> Dict[str, Any]:
        """Process DocTR result into structured format compatible with existing system"""
        try:
            # Export to dictionary format
            result_dict = result.export()
            
            full_text = ""
            all_blocks = []
            all_words = []
            total_confidence = 0
            word_count = 0
            
            # Process each page (usually just one for betting images)
            for page_idx, page in enumerate(result_dict['pages']):
                page_text_lines = []
                
                # Process blocks (paragraphs)
                for block_idx, block in enumerate(page['blocks']):
                    block_text_lines = []
                    
                    # Process lines within each block
                    for line_idx, line in enumerate(block['lines']):
                        line_text = ""
                        line_words = []
                        
                        # Process words within each line
                        for word_idx, word in enumerate(line['words']):
                            word_text = word['value']
                            confidence = word['confidence']
                            geometry = word['geometry']
                            
                            # Add to line text
                            line_text += word_text + " "
                            
                            # Store word details
                            word_data = {
                                'text': word_text,
                                'confidence': confidence,
                                'bbox': geometry,  # Already normalized coordinates [x1,y1,x2,y2]
                                'line': line_idx,
                                'block': block_idx
                            }
                            line_words.append(word_data)
                            all_words.append(word_data)
                            
                            total_confidence += confidence
                            word_count += 1
                        
                        # Clean up line text
                        line_text = line_text.strip()
                        if line_text:
                            block_text_lines.append(line_text)
                            page_text_lines.append(line_text)
                            
                            # Create block entry compatible with existing system
                            all_blocks.append({
                                'line_key': f"{page_idx}-{line_idx}",
                                'full_text': line_text,
                                'words': line_words,
                                'confidence_avg': sum(w['confidence'] for w in line_words) / len(line_words) if line_words else 0
                            })
                
                # Add page text to full text
                full_text += "\n".join(page_text_lines) + "\n"
            
            # Calculate average confidence
            confidence_avg = total_confidence / word_count if word_count > 0 else 0
            
            return {
                'full_text': full_text.strip(),
                'blocks': all_blocks,
                'words': all_words,
                'word_count': word_count,
                'confidence_avg': confidence_avg
            }
            
        except Exception as e:
            print(f"Error processing DocTR result: {e}")
            raise

    def extract_betting_data(self, image_data: bytes) -> Dict[str, Any]:
        """
        Extract betting data specifically optimized for SureBet images
        """
        try:
            # Get OCR results
            ocr_result = self.extract_text_with_coordinates(image_data)
            
            if not ocr_result['success']:
                return ocr_result
            
            # Use existing extraction logic but with DocTR data
            betting_data = self._extract_betting_info_from_doctr(ocr_result)
            
            # Add DocTR specific metadata
            betting_data.update({
                'ocr_method': 'doctr_ai',
                'confidence_avg': ocr_result['confidence_avg'],
                'word_count': ocr_result['word_count'],
                'processing_info': ocr_result['processing_info']
            })
            
            return betting_data
            
        except Exception as e:
            print(f"Error extracting betting data: {e}")
            return {
                'success': False,
                'error': str(e),
                'method': 'doctr_betting_extraction'
            }

    def _extract_betting_info_from_doctr(self, ocr_result: Dict[str, Any]) -> Dict[str, Any]:
        """Extract betting information from DocTR OCR results"""
        
        # Initialize result structure
        result = {
            'success': True,
            'method': 'doctr_betting_extraction',
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
        
        # Known betting houses
        betting_houses = [
            'Pinnacle', 'BravoBet', 'Betfast', 'Blaze', 'KTO', 'Betano', 
            'VBet', 'MarjoSports', 'Betnacional', 'Aposta1', 'SuperBet', 
            'bet365', 'Sportingbet', '1xBet', 'Betway'
        ]
        
        full_text = ocr_result['raw_text']
        
        # Extract profit percentage
        profit_match = re.search(r'(\d+\.?\d*)%', full_text)
        if profit_match:
            result['totalProfitPercentage'] = profit_match.group(1)
            print(f"Found profit: {result['totalProfitPercentage']}%")
        
        # Extract teams
        team_match = re.search(r'([A-Za-zÀ-ÿ\s\-]+)\s*[—-]\s*([A-Za-zÀ-ÿ\s\-]+)', full_text)
        if team_match:
            team_a = team_match.group(1).strip()
            team_b = team_match.group(2).strip()
            
            # Clean team names
            for house in betting_houses:
                team_a = team_a.replace(house, '').strip()
                team_b = team_b.replace(house, '').strip()
            
            if len(team_a) > 2 and len(team_b) > 2:
                result['betA']['teamA'] = team_a
                result['betA']['teamB'] = team_b
                result['betB']['teamA'] = team_a
                result['betB']['teamB'] = team_b
                print(f"Found teams: {team_a} vs {team_b}")
        
        # Extract betting house data using advanced pattern matching
        for block in ocr_result['text_blocks']:
            text_line = block['full_text']
            
            # Look for betting houses in this line
            for house in betting_houses:
                if house.lower() in text_line.lower():
                    print(f"Found betting house: {house} in line: {text_line}")
                    
                    # Extract odds and stakes using SureBet specific patterns
                    odds_stakes = self._extract_odds_stakes_from_line(text_line)
                    
                    if not result['betA']['bettingHouse']:
                        result['betA']['bettingHouse'] = house
                        if odds_stakes['odds']:
                            result['betA']['odds'] = odds_stakes['odds']
                        if odds_stakes['stake']:
                            result['betA']['stake'] = odds_stakes['stake']
                    elif not result['betB']['bettingHouse'] and house != result['betA']['bettingHouse']:
                        result['betB']['bettingHouse'] = house
                        if odds_stakes['odds']:
                            result['betB']['odds'] = odds_stakes['odds']
                        if odds_stakes['stake']:
                            result['betB']['stake'] = odds_stakes['stake']
                    
                    break  # Move to next line after finding a house
        
        # Calculate payouts if we have odds and stakes
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

    def _extract_odds_stakes_from_line(self, text_line: str) -> Dict[str, str]:
        """Extract odds and stakes from a betting house line using optimized patterns"""
        
        odds = ""
        stake = ""
        
        # SureBet specific odds pattern (X.XXX format like 1.830, 2.280)
        odds_match = re.search(r'\b(\d\.\d{3})\b', text_line)
        if odds_match:
            odds = odds_match.group(1)
        
        # SureBet specific stake patterns  
        # Pattern 1: XX.XX format (like 55.47)
        stake_match = re.search(r'\b(\d{2,3}\.\d{2})\b', text_line)
        if stake_match:
            stake = stake_match.group(1)
        else:
            # Pattern 2: Two separate numbers that should be combined (like "44 53" -> "44.53")
            two_part_match = re.search(r'\b(\d{2})\s+(\d{2})\b', text_line)
            if two_part_match:
                stake = f"{two_part_match.group(1)}.{two_part_match.group(2)}"
        
        return {'odds': odds, 'stake': stake}


def main():
    """Main function for command line usage"""
    if len(sys.argv) != 2:
        print("Usage: python doctr_ocr.py <base64_image_data>")
        sys.exit(1)
    
    try:
        # Initialize DocTR OCR
        doctr_ocr = DocTROCR()
        
        # Decode base64 image data
        base64_data = sys.argv[1]
        image_data = base64.b64decode(base64_data)
        
        # Perform OCR and betting data extraction
        result = doctr_ocr.extract_betting_data(image_data)
        
        # Output JSON result
        print(json.dumps(result, ensure_ascii=False))
        
    except Exception as e:
        error_result = {
            'success': False,
            'error': str(e),
            'method': 'doctr_main'
        }
        print(json.dumps(error_result))

if __name__ == "__main__":
    main()