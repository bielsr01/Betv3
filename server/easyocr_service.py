#!/usr/bin/env python3
"""
Tesseract OCR Service for Real Text Recognition from Images
Lightweight and reliable solution for Replit environment
"""
import sys
import json
import os
import tempfile
import time

def main():
    try:
        # Set Python path for custom libraries
        import sys
        import os
        pythonlibs_path = os.path.join(os.getcwd(), '.pythonlibs', 'lib', 'python3.12', 'site-packages')
        if pythonlibs_path not in sys.path:
            sys.path.insert(0, pythonlibs_path)

        print("TESSERACT OCR - Initializing...", file=sys.stderr)
        
        # Read input from stdin
        input_data = sys.stdin.readline().strip()
        if not input_data:
            print(json.dumps({"error": "No input data provided"}))
            sys.exit(1)
        
        # Parse input JSON
        try:
            data = json.loads(input_data)
            image_path = data.get('image_path')
            
            if not image_path or not os.path.exists(image_path):
                print(json.dumps({"error": "Invalid image path"}))
                sys.exit(1)
        except json.JSONDecodeError:
            print(json.dumps({"error": "Invalid JSON input"}))
            sys.exit(1)
        
        print(f"Processing image: {image_path}", file=sys.stderr)
        
        # Import libraries (after setting Python path)
        try:
            import pytesseract
            from PIL import Image, ImageEnhance, ImageFilter
            
            # Configure tesseract path for Replit environment
            import subprocess
            result = subprocess.run(['which', 'tesseract'], capture_output=True, text=True)
            if result.returncode == 0:
                tesseract_path = result.stdout.strip()
                pytesseract.pytesseract.tesseract_cmd = tesseract_path
                print(f"Tesseract found at: {tesseract_path}", file=sys.stderr)
            else:
                print("Tesseract binary not found in PATH", file=sys.stderr)
                
        except ImportError as e:
            print(json.dumps({"error": f"Tesseract import failed: {str(e)}"}))
            sys.exit(1)
        
        print("Starting Tesseract OCR processing...", file=sys.stderr)
        start_time = time.time()
        
        # Read and preprocess image
        print("Reading and preprocessing image...", file=sys.stderr)
        
        try:
            # Load image with PIL
            pil_image = Image.open(image_path)
            
            # Convert to grayscale for better OCR
            if pil_image.mode != 'L':
                pil_image = pil_image.convert('L')
            
            # Enhance image for better OCR results
            # Increase contrast
            enhancer = ImageEnhance.Contrast(pil_image)
            pil_image = enhancer.enhance(1.5)
            
            # Increase sharpness
            enhancer = ImageEnhance.Sharpness(pil_image)
            pil_image = enhancer.enhance(1.2)
            
            # Apply slight smoothing to reduce noise
            pil_image = pil_image.filter(ImageFilter.SMOOTH_MORE)
            
        except Exception as e:
            print(json.dumps({"error": f"Failed to read/process image: {str(e)}"}))
            sys.exit(1)
        
        print("Starting Tesseract text extraction...", file=sys.stderr)
        extraction_start = time.time()
        
        # Configure Tesseract for better SureBet detection
        # PSM 6 = Assume a single uniform block of text, preserve interword spaces
        # Extended character set for Portuguese/English betting data including accented characters AND SPACES
        tesseract_config = '--psm 6 --oem 3 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ0123456789.,:%()[]{}/-+$€£¥R$USD vs–— -c preserve_interword_spaces=1'
        
        # Extract text with detailed information
        try:
            # Get detailed OCR data - use Portuguese + English for best results
            data_dict = pytesseract.image_to_data(pil_image, config=tesseract_config, output_type=pytesseract.Output.DICT, lang='por+eng')
            
            # Get full text
            full_text = pytesseract.image_to_string(pil_image, config=tesseract_config, lang='por+eng')
            
        except Exception as e:
            print(f"Tesseract processing error: {e}", file=sys.stderr)
            # Fallback to basic extraction with Portuguese + English
            full_text = pytesseract.image_to_string(pil_image, lang='por+eng')
            data_dict = None
        
        extraction_time = time.time() - extraction_start
        print(f"OCR extraction completed in {extraction_time:.2f}s", file=sys.stderr)
        
        # Process OCR results
        lines = []
        confident_regions = 0
        
        if data_dict:
            # Process detailed results
            for i in range(len(data_dict['text'])):
                text = data_dict['text'][i].strip()
                confidence = int(data_dict['conf'][i])
                
                if text and confidence > 30:  # Only confident text
                    lines.append({
                        "text": text,
                        "confidence": round(confidence / 100.0, 3),
                        "bbox": [
                            data_dict['left'][i],
                            data_dict['top'][i],
                            data_dict['left'][i] + data_dict['width'][i],
                            data_dict['top'][i] + data_dict['height'][i]
                        ]
                    })
                    confident_regions += 1
                    print(f"Text: '{text}' (confidence: {confidence}%)", file=sys.stderr)
        
        # Clean up the full text
        full_text = full_text.strip()
        
        # Return structured result
        result = {
            "text": full_text,
            "lines": lines,
            "processing_time": round(extraction_time, 2),
            "total_time": round(time.time() - start_time, 2),
            "regions_found": len(lines),
            "confident_regions": confident_regions
        }
        
        print(json.dumps(result))
        print(f"Tesseract OCR processing completed successfully", file=sys.stderr)
        
    except Exception as e:
        print(json.dumps({"error": f"Tesseract OCR processing failed: {str(e)}"}))
        sys.exit(1)

if __name__ == "__main__":
    main()