import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface PaddleOCRData {
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

export async function analyzeSureBetImagePaddle(imageBase64: string): Promise<PaddleOCRData> {
  return new Promise((resolve, reject) => {
    try {
      console.log('Starting PaddleOCR analysis...');
      
      // Path to Python script
      const pythonScript = path.join(__dirname, 'paddle-ocr.py');
      
      // Spawn Python process (pass image through stdin instead of args)
      const pythonProcess = spawn('python3', [pythonScript], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env },
      });

      let stdout = '';
      let stderr = '';

      // Send base64 image through stdin
      pythonProcess.stdin.write(imageBase64);
      pythonProcess.stdin.end();

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', (code) => {
        try {
          // Log debug information
          if (stderr) {
            console.log('PaddleOCR Debug Output:', stderr);
          }

          if (code !== 0) {
            console.error(`PaddleOCR process exited with code ${code}`);
            console.error('Error output:', stderr);
            throw new Error(`PaddleOCR failed with exit code ${code}: ${stderr}`);
          }

          // Parse JSON output
          const result = JSON.parse(stdout.trim());
          
          if (!result.success) {
            throw new Error(result.error || 'PaddleOCR analysis failed');
          }

          console.log('PaddleOCR analysis completed successfully');
          console.log('Extracted data:', JSON.stringify(result.data, null, 2));
          
          resolve(result.data as PaddleOCRData);
          
        } catch (error) {
          console.error('Error parsing PaddleOCR output:', error);
          reject(new Error(`Failed to parse PaddleOCR output: ${error}`));
        }
      });

      pythonProcess.on('error', (error) => {
        console.error('Failed to start PaddleOCR process:', error);
        reject(new Error(`Failed to start PaddleOCR process: ${error}`));
      });

      // Handle timeout (30 seconds)
      const timeout = setTimeout(() => {
        pythonProcess.kill();
        reject(new Error('PaddleOCR analysis timed out after 30 seconds'));
      }, 30000);

      pythonProcess.on('close', () => {
        clearTimeout(timeout);
      });

    } catch (error) {
      console.error('PaddleOCR Error:', error);
      reject(new Error(`PaddleOCR failed: ${error}`));
    }
  });
}