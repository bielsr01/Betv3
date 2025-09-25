import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);

interface SimpleOCRResult {
  success: boolean;
  raw_text?: string;
  text_blocks?: Array<{
    text: string;
    confidence: number;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  total_blocks?: number;
  error?: string;
  method: string;
}

/**
 * Simple Pure OCR - Just reads text from image without complex interpretation
 * Uses temporary file to avoid command line argument length limits
 */
export async function analyzeImageWithSimpleOCR(imageBase64: string): Promise<SimpleOCRResult> {
  let tempImagePath: string | null = null;
  
  try {
    console.log('Starting simple pure OCR processing...');
    
    // Create temporary image file
    const imageBuffer = Buffer.from(imageBase64, 'base64');
    tempImagePath = path.join(process.cwd(), 'temp', `ocr_image_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.png`);
    
    // Ensure temp directory exists
    const tempDir = path.dirname(tempImagePath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Write image to temporary file
    await writeFile(tempImagePath, imageBuffer);
    console.log('Image saved to temporary file:', tempImagePath);
    
    // Run Python OCR script
    const pythonPath = 'python3';
    const scriptPath = path.join(process.cwd(), 'server', 'simple_ocr.py');
    
    console.log('Running Python OCR script:', scriptPath);
    
    return new Promise((resolve, reject) => {
      const pythonProcess = spawn(pythonPath, [scriptPath], {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      
      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      pythonProcess.on('close', async (code) => {
        // Clean up temporary file
        if (tempImagePath && fs.existsSync(tempImagePath)) {
          try {
            await unlink(tempImagePath);
            console.log('Temporary file cleaned up');
          } catch (cleanupError) {
            console.warn('Failed to clean up temporary file:', cleanupError);
          }
        }
        
        if (code !== 0) {
          console.error('Simple OCR process failed with code:', code);
          console.error('Simple OCR stderr:', stderr);
          reject(new Error(`Simple OCR failed with code ${code}: ${stderr}`));
          return;
        }
        
        try {
          const result = JSON.parse(stdout);
          
          if (!result.success) {
            console.error('Simple OCR extraction failed:', result.error);
            reject(new Error(result.error));
            return;
          }
          
          console.log(`Simple OCR extraction completed successfully`);
          console.log(`Extracted ${result.total_blocks || 0} text blocks`);
          
          resolve(result);
          
        } catch (parseError) {
          console.error('Failed to parse Simple OCR result:', parseError);
          console.error('Raw stdout:', stdout);
          reject(parseError);
        }
      });
      
      pythonProcess.on('error', async (error) => {
        // Clean up temporary file on error
        if (tempImagePath && fs.existsSync(tempImagePath)) {
          try {
            await unlink(tempImagePath);
          } catch (cleanupError) {
            console.warn('Failed to clean up temporary file on error:', cleanupError);
          }
        }
        console.error('Simple OCR process error:', error);
        reject(error);
      });
      
      // Send image path to Python script via stdin
      pythonProcess.stdin.write(tempImagePath + '\n');
      pythonProcess.stdin.end();
    });
    
  } catch (error) {
    // Clean up temporary file on error
    if (tempImagePath && fs.existsSync(tempImagePath)) {
      try {
        await unlink(tempImagePath);
      } catch (cleanupError) {
        console.warn('Failed to clean up temporary file on error:', cleanupError);
      }
    }
    throw error;
  }
}