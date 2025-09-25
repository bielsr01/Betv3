#!/usr/bin/env python3
"""
Simple Pure OCR - Just reads text from image without complex parsing
Uses file input instead of command line arguments to avoid size limits
"""

import sys
import json
import base64
import tempfile
import os
from PIL import Image
import pytesseract
from typing import Dict, Any, List

def extract_pure_text_from_file(image_path: str) -> Dict[str, Any]:
    """
    Pure OCR extraction from image file - just reads all text
    Returns raw text without interpretation
    """
    try:
        # Open and process image
        image = Image.open(image_path)
        
        # Convert to RGB if necessary
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Simple OCR with Portuguese support
        custom_config = r'--oem 3 --psm 6 -l por+eng'
        
        # Extract all text
        raw_text = pytesseract.image_to_string(image, config=custom_config)
        
        # Extract text with bounding boxes for verification
        data = pytesseract.image_to_data(image, config=custom_config, output_type=pytesseract.Output.DICT)
        
        # Build text blocks with positions for user verification
        text_blocks = []
        for i in range(len(data['text'])):
            text = data['text'][i].strip()
            if text and int(data['conf'][i]) > 30:  # Only confident text
                text_blocks.append({
                    'text': text,
                    'confidence': int(data['conf'][i]),
                    'x': data['left'][i],
                    'y': data['top'][i],
                    'width': data['width'][i],
                    'height': data['height'][i]
                })
        
        # Sort blocks by position (top to bottom, left to right)
        text_blocks.sort(key=lambda block: (block['y'], block['x']))
        
        return {
            'success': True,
            'raw_text': raw_text.strip(),
            'text_blocks': text_blocks,
            'total_blocks': len(text_blocks),
            'method': 'simple_pure_ocr'
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'method': 'simple_pure_ocr'
        }

def main():
    """Command line interface - reads image path from stdin"""
    try:
        # Read image path from stdin
        image_path = input().strip()
        
        if not os.path.exists(image_path):
            print(json.dumps({'success': False, 'error': f'Image file not found: {image_path}'}))
            sys.exit(1)
        
        result = extract_pure_text_from_file(image_path)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        
    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}))
        sys.exit(1)

if __name__ == '__main__':
    main()