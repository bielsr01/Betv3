import { promises as fs } from 'fs';
import path from 'path';
import sharp from 'sharp';
import { spawn } from 'child_process';

export interface SureBetOCRResult {
  betA: {
    bettingHouse: string;
    teamA: string;
    teamB: string;
    betType: string;
    odds: string;
    stake: string;
    profit: string;
  };
  betB: {
    bettingHouse: string;
    teamA: string;
    teamB: string;
    betType: string;
    odds: string;
    stake: string;
    profit: string;
  };
  gameDate: string;
  gameTime: string;
  sport: string;
  league: string;
  totalProfitPercentage: string;
}

export async function analyzeSureBetImageLocal(imageBase64: string): Promise<SureBetOCRResult> {
  try {
    // Convert base64 to buffer
    const imageBuffer = Buffer.from(imageBase64, 'base64');
    
    // Optimize image for EasyOCR - moderate processing for better accuracy
    const processedBuffer = await sharp(imageBuffer)
      .resize(1800, 2400, { fit: 'inside', withoutEnlargement: true }) // Larger size for EasyOCR
      .normalize() // Enhance contrast
      .sharpen({ sigma: 1 }) // Light sharpening
      .png({ quality: 100 }) // High quality PNG for clear text
      .toBuffer();

    // Convert to base64 for Python script
    const processedBase64 = processedBuffer.toString('base64');

    // Run EasyOCR Python script
    const result = await runEasyOCR(processedBase64);
    
    return result;
  } catch (error) {
    console.error('EasyOCR processing failed:', error);
    throw new Error('Failed to process image with EasyOCR');
  }
}

async function runEasyOCR(imageBase64: string): Promise<SureBetOCRResult> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), 'server', 'easyocr-service.py');
    const pythonProcess = spawn('python3', [scriptPath, imageBase64]);
    
    let stdout = '';
    let stderr = '';
    
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      if (stderr) {
        console.log('EasyOCR debug info:', stderr);
      }
      
      if (code !== 0) {
        console.error('EasyOCR process failed with code:', code);
        console.error('Error output:', stderr);
        reject(new Error(`EasyOCR process failed with exit code ${code}`));
        return;
      }
      
      try {
        const result = JSON.parse(stdout.trim());
        
        if (result.error) {
          reject(new Error(result.error));
          return;
        }
        
        console.log('EasyOCR result:', result);
        resolve(result);
      } catch (parseError) {
        console.error('Failed to parse EasyOCR output:', stdout);
        reject(new Error('Failed to parse EasyOCR output'));
      }
    });
    
    pythonProcess.on('error', (error) => {
      console.error('Failed to start EasyOCR process:', error);
      reject(new Error('Failed to start EasyOCR process'));
    });
  });
}

// Remove old Tesseract parsing functions - not needed with EasyOCR