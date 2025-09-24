import { promises as fs } from 'fs';
import path from 'path';
import sharp from 'sharp';
import tesseract from 'node-tesseract-ocr';

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
    
    // Optimize image for better OCR results - increase contrast and clarity
    const processedBuffer = await sharp(imageBuffer)
      .resize(1600, 2000, { fit: 'inside', withoutEnlargement: true }) // Optimal size for text recognition
      .grayscale() // Convert to grayscale for better text recognition
      .normalize() // Enhance contrast
      .sharpen() // Sharpen edges for better character recognition
      .png({ quality: 100 }) // High quality PNG for clear text
      .toBuffer();

    // Save processed image temporarily
    const tempPath = path.join('/tmp', `surebet_${Date.now()}.png`);
    await fs.writeFile(tempPath, processedBuffer);

    // Configure Tesseract for optimal performance with SureBet images
    const config = {
      lang: 'eng+por', // English + Portuguese support
      oem: 1, // LSTM neural net mode (fastest + accurate)
      psm: 6, // Assume uniform text block
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,%-+()[]ÀÁÂÃÇÉÊÍÓÔÕÚÜàáâãçéêíóôõúü ',
    };

    // Extract text using optimized Tesseract
    const extractedText = await tesseract.recognize(tempPath, config);
    console.log('Extracted OCR text:', extractedText);

    // Clean up temp file
    try {
      await fs.unlink(tempPath);
    } catch (error) {
      console.warn('Failed to clean up temp file:', error);
    }

    // Parse the extracted text to structured data
    const result = parseSureBetText(extractedText);
    
    return result;
  } catch (error) {
    console.error('Local OCR processing failed:', error);
    throw new Error('Failed to process image with local OCR');
  }
}

function parseSureBetText(text: string): SureBetOCRResult {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  // Initialize result with defaults
  const result: SureBetOCRResult = {
    betA: {
      bettingHouse: '',
      teamA: '',
      teamB: '',
      betType: '',
      odds: '0',
      stake: '0',
      profit: '0'
    },
    betB: {
      bettingHouse: '',
      teamA: '',
      teamB: '',
      betType: '',
      odds: '0',
      stake: '0',
      profit: '0'
    },
    gameDate: new Date().toISOString().split('T')[0],
    gameTime: '00:00',
    sport: '',
    league: '',
    totalProfitPercentage: '0'
  };

  try {
    // Extract teams (looking for pattern: "Team1 – Team2" or "Team1 - Team2")
    for (const line of lines.slice(0, 5)) {
      const teamMatch = line.match(/([A-Za-zÀ-ÿ\s0-9.&()]+?)\s*[-–—]\s*([A-Za-zÀ-ÿ\s0-9.&()]+)/);
      if (teamMatch && !line.includes('%')) {
        result.betA.teamA = teamMatch[1].trim();
        result.betA.teamB = teamMatch[2].trim();
        result.betB.teamA = teamMatch[1].trim();
        result.betB.teamB = teamMatch[2].trim();
        break;
      }
    }

    // Extract sport and league
    const sportMatch = text.match(/(Futebol|Basketball|Basquete|Tennis|Tênis|Volleyball|Volei)[\/\s]*([^\n\r]+)/i);
    if (sportMatch) {
      result.sport = sportMatch[1];
      result.league = sportMatch[2].trim();
    }

    // Extract total profit percentage - FIXED: Extract just the number
    const profitMatch = text.match(/(\d+\.\d+)%/);
    if (profitMatch) {
      result.totalProfitPercentage = profitMatch[1]; // Extract only the number, not the %
    }

    // Extract date and time
    const dateMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (dateMatch) {
      result.gameDate = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
    }

    const timeMatch = text.match(/(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      result.gameTime = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
    }

    // Extract betting houses and financial data
    const bettingHouses = ['Pinnacle', 'BravoBet', 'Betfast', 'Blaze', 'KTO', 'Betano', 'VBet', 'MarjoSports', 'Betnacional', 'Aposta1', 'SuperBet'];
    const betLines: string[] = [];

    // Find lines containing betting houses and USD amounts
    for (const line of lines) {
      for (const house of bettingHouses) {
        if (line.toLowerCase().includes(house.toLowerCase()) && (line.includes('USD') || line.includes('$'))) {
          betLines.push(line);
          break;
        }
      }
    }

    // Parse betting data from identified lines
    if (betLines.length >= 1) {
      parseBetLine(betLines[0], result.betA, bettingHouses);
    }
    if (betLines.length >= 2) {
      parseBetLine(betLines[1], result.betB, bettingHouses);
    }

    return result;
  } catch (error) {
    console.error('Error parsing SureBet text:', error);
    return result; // Return partial results even if parsing fails
  }
}

function parseBetLine(line: string, bet: any, bettingHouses: string[]) {
  try {
    // Extract betting house
    for (const house of bettingHouses) {
      if (line.toLowerCase().includes(house.toLowerCase())) {
        bet.bettingHouse = house;
        break;
      }
    }

    // Extract numerical values (odds, stake, profit)
    const numbers = line.match(/\d+\.\d+/g);
    if (numbers && numbers.length >= 3) {
      bet.odds = numbers[0];
      bet.stake = numbers[1];
      bet.profit = numbers[2];
    }

    // Extract bet type (text between house and first number)
    const betTypeMatch = line.match(new RegExp(`(?:${bettingHouses.join('|')})\\s*(?:\\([^)]+\\))?\\s+(.+?)\\s+\\d+\\.\\d+`, 'i'));
    if (betTypeMatch) {
      bet.betType = betTypeMatch[1].trim();
    }
  } catch (error) {
    console.error('Error parsing bet line:', error);
  }
}