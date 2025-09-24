#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import os
import subprocess
import json
from PIL import Image, ImageEnhance, ImageFilter
import pytesseract

def find_tesseract():
    """Find tesseract binary in the system"""
    try:
        result = subprocess.run(['which', 'tesseract'], capture_output=True, text=True)
        if result.returncode == 0:
            tesseract_path = result.stdout.strip()
            print(f"Tesseract found at: {tesseract_path}", file=sys.stderr)
            return tesseract_path
        else:
            print("Tesseract not found via 'which'", file=sys.stderr)
            return None
    except Exception as e:
        print(f"Error finding tesseract: {e}", file=sys.stderr)
        return None

def preprocess_image(image_path):
    """Enhanced image preprocessing for better OCR accuracy"""
    try:
        print("Reading and preprocessing image...", file=sys.stderr)
        
        # Open and convert to RGB
        image = Image.open(image_path)
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Resize if too small (maintain aspect ratio)
        width, height = image.size
        if width < 1000:
            scale_factor = 1000 / width
            new_width = int(width * scale_factor)
            new_height = int(height * scale_factor)
            image = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
            print(f"Resized image to {new_width}x{new_height}", file=sys.stderr)
        
        # Enhance contrast and sharpness
        enhancer = ImageEnhance.Contrast(image)
        image = enhancer.enhance(1.2)
        
        enhancer = ImageEnhance.Sharpness(image)
        image = enhancer.enhance(1.1)
        
        # Slight gaussian blur to reduce noise
        image = image.filter(ImageFilter.GaussianBlur(radius=0.5))
        
        return image
        
    except Exception as e:
        print(f"Error preprocessing image: {e}", file=sys.stderr)
        return None

def extract_text_blocks(image_path):
    """Extract text with detailed position information"""
    try:
        print("Starting Tesseract text extraction with blocks...", file=sys.stderr)
        
        # Configure pytesseract
        tesseract_path = find_tesseract()
        if tesseract_path:
            pytesseract.pytesseract.tesseract_cmd = tesseract_path
        
        # Preprocess image
        image = preprocess_image(image_path)
        if image is None:
            return None
        
        # Tesseract configuration for Portuguese + English
        config = "--psm 6 --oem 3 -c preserve_interword_spaces=1"
        
        # Extract detailed data including coordinates
        data = pytesseract.image_to_data(
            image, 
            lang='por+eng',
            config=config,
            output_type=pytesseract.Output.DICT
        )
        
        # Process the data into organized blocks
        blocks = []
        
        for i in range(len(data['text'])):
            text = data['text'][i].strip()
            if len(text) > 0:  # Only non-empty text
                confidence = data['conf'][i]
                
                block = {
                    'text': text,
                    'confidence': confidence,
                    'left': data['left'][i],
                    'top': data['top'][i],
                    'width': data['width'][i],
                    'height': data['height'][i],
                    'level': data['level'][i],  # 1=page, 2=block, 3=para, 4=line, 5=word
                    'block_num': data['block_num'][i],
                    'par_num': data['par_num'][i],
                    'line_num': data['line_num'][i],
                    'word_num': data['word_num'][i]
                }
                blocks.append(block)
        
        # Sort by position (top to bottom, left to right)
        blocks.sort(key=lambda x: (x['top'], x['left']))
        
        # Group by lines (same line_num and block_num)
        lines = {}
        for block in blocks:
            line_key = f"{block['block_num']}-{block['line_num']}"
            if line_key not in lines:
                lines[line_key] = []
            lines[line_key].append(block)
        
        # Organize into readable structure
        organized_data = {
            'total_blocks': len(blocks),
            'lines': [],
            'raw_blocks': blocks
        }
        
        for line_key in sorted(lines.keys()):
            line_blocks = sorted(lines[line_key], key=lambda x: x['left'])
            line_text = ' '.join([b['text'] for b in line_blocks])
            
            organized_data['lines'].append({
                'line_key': line_key,
                'full_text': line_text,
                'blocks': line_blocks,
                'avg_confidence': sum([b['confidence'] for b in line_blocks]) / len(line_blocks),
                'top': min([b['top'] for b in line_blocks]),
                'left': min([b['left'] for b in line_blocks]),
                'right': max([b['left'] + b['width'] for b in line_blocks]),
                'bottom': max([b['top'] + b['height'] for b in line_blocks])
            })
        
        print(f"Extracted {len(blocks)} text blocks in {len(organized_data['lines'])} lines", file=sys.stderr)
        
        return organized_data
        
    except Exception as e:
        print(f"Error in text extraction: {e}", file=sys.stderr)
        return None

def main():
    if len(sys.argv) != 2:
        print("Usage: python3 ocr_blocks_service.py <image_path>", file=sys.stderr)
        sys.exit(1)
    
    image_path = sys.argv[1]
    
    if not os.path.exists(image_path):
        print(f"Image file not found: {image_path}", file=sys.stderr)
        sys.exit(1)
    
    print(f"Processing image: {image_path}", file=sys.stderr)
    
    try:
        result = extract_text_blocks(image_path)
        
        if result is None:
            print("Failed to extract text blocks", file=sys.stderr)
            sys.exit(1)
        
        # Output JSON result
        print(json.dumps(result, ensure_ascii=False, indent=2))
        
    except Exception as e:
        print(f"Error in main: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()