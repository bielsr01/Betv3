import { promises as fs } from 'fs';
import path from 'path';
import sharp from 'sharp';
import { createWorker } from 'tesseract.js';

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
    console.log('Starting real OCR processing with Tesseract.js...');
    
    // Convert base64 to buffer
    const imageBuffer = Buffer.from(imageBase64, 'base64');
    
    // Optimize image for better OCR accuracy
    const processedBuffer = await sharp(imageBuffer)
      .resize(1600, 2000, { fit: 'inside', withoutEnlargement: true })
      .grayscale() // Convert to grayscale for better text recognition
      .normalize() // Enhance contrast
      .sharpen({ sigma: 1.2 }) // Sharpen text
      .png({ quality: 100 })
      .toBuffer();

    // Perform OCR with Tesseract.js
    const extractedText = await performOCR(processedBuffer);
    console.log('OCR extracted text:', extractedText);

    // Parse the real extracted text to structured data
    const result = parseSureBetText(extractedText);
    
    return result;
  } catch (error) {
    console.error('OCR processing failed:', error);
    throw new Error('Failed to process image with OCR');
  }
}

async function performOCR(imageBuffer: Buffer): Promise<string> {
  const worker = await createWorker('eng+por', 1, {
    logger: m => {
      if (m.status === 'recognizing text') {
        console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
      }
    }
  });

  try {
    // Configure Tesseract for better text recognition
    await worker.setParameters({
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,%-+()[]ÀÁÂÃÇÉÊÍÓÔÕÚÜàáâãçéêíóôõúü ',
      tessedit_pageseg_mode: 6, // Uniform block of text
    });

    const { data: { text } } = await worker.recognize(imageBuffer);
    return text;
  } finally {
    await worker.terminate();
  }
}

function parseSureBetText(text: string): SureBetOCRResult {
  console.log('Parsing OCR text:', text.substring(0, 200) + '...');
  
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
    // Extract teams (looking for pattern: "Team1 – Team2" or "Team1 - Team2" or "Team1 vs Team2")
    for (const line of lines.slice(0, 10)) {
      const teamMatch = line.match(/([A-Za-zÀ-ÿ\s0-9.&()]+?)\s*[-–—vs]\s*([A-Za-zÀ-ÿ\s0-9.&()]+)/i);
      if (teamMatch && !line.includes('%') && teamMatch[1].length > 2 && teamMatch[2].length > 2) {
        result.betA.teamA = teamMatch[1].trim();
        result.betA.teamB = teamMatch[2].trim();
        result.betB.teamA = teamMatch[1].trim();
        result.betB.teamB = teamMatch[2].trim();
        console.log(`Found teams: ${teamMatch[1]} vs ${teamMatch[2]}`);
        break;
      }
    }

    // Extract sport and league
    const sportMatch = text.match(/(Futebol|Football|Basketball|Basquete|Tennis|Tênis|Volleyball|Volei)[\s\/\-]*([^\n\r]+)/i);
    if (sportMatch) {
      result.sport = sportMatch[1];
      result.league = sportMatch[2].trim().substring(0, 50); // Limit length
      console.log(`Found sport/league: ${result.sport} / ${result.league}`);
    }

    // Extract total profit percentage - Extract just the number
    const profitMatch = text.match(/(\d+[.,]\d+)%/);
    if (profitMatch) {
      result.totalProfitPercentage = profitMatch[1].replace(',', '.');
      console.log(`Found profit percentage: ${result.totalProfitPercentage}%`);
    }

    // Extract date and time
    const dateMatch = text.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
    if (dateMatch) {
      result.gameDate = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
      console.log(`Found date: ${result.gameDate}`);
    }

    const timeMatch = text.match(/(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      result.gameTime = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
      console.log(`Found time: ${result.gameTime}`);
    }

    // Extract betting houses and financial data
    const bettingHouses = ['Pinnacle', 'BravoBet', 'Betfast', 'Blaze', 'KTO', 'Betano', 'VBet', 'MarjoSports', 'Betnacional', 'Aposta1', 'SuperBet', 'bet365', 'Sportingbet'];
    const betLines: string[] = [];

    // Find lines containing betting houses and numerical values
    for (const line of lines) {
      for (const house of bettingHouses) {
        if (line.toLowerCase().includes(house.toLowerCase()) && 
            (line.includes('USD') || line.includes('$') || line.includes('R$') || /\d+[.,]\d+/.test(line))) {
          betLines.push(line);
          console.log(`Found bet line: ${line}`);
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

    console.log('Final parsed result:', JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('Error parsing SureBet text:', error);
    return result; // Return partial results even if parsing fails
  }
}

function parseBetLine(line: string, bet: any, bettingHouses: string[]) {
  try {
    console.log(`Parsing bet line: ${line}`);
    
    // Extract betting house
    for (const house of bettingHouses) {
      if (line.toLowerCase().includes(house.toLowerCase())) {
        bet.bettingHouse = house;
        console.log(`Found house: ${house}`);
        break;
      }
    }

    // Extract numerical values (odds, stake, profit) - handle both comma and dot
    const numbers = line.match(/\d+[.,]\d+/g);
    if (numbers && numbers.length >= 2) {
      // Convert commas to dots for consistency
      const cleanNumbers = numbers.map(n => n.replace(',', '.'));
      
      bet.odds = cleanNumbers[0];
      if (cleanNumbers.length >= 2) bet.stake = cleanNumbers[1];
      if (cleanNumbers.length >= 3) bet.profit = cleanNumbers[2];
      
      console.log(`Found numbers: odds=${bet.odds}, stake=${bet.stake}, profit=${bet.profit}`);
    }

    // Extract bet type (text between house and first number or common bet types)
    const betTypePatterns = [
      /(?:1x2|1X2)\s*(Casa|Home|Visitante|Away)/i,
      /(Over|Under)\s*\d+[.,]?\d*/i,
      /(Dupla\s*Chance|Double\s*Chance)/i,
      /(Ambas\s*Marcam|Both\s*Teams\s*Score)/i,
      /(Handicap)/i
    ];
    
    for (const pattern of betTypePatterns) {
      const betTypeMatch = line.match(pattern);
      if (betTypeMatch) {
        bet.betType = betTypeMatch[0].trim();
        console.log(`Found bet type: ${bet.betType}`);
        break;
      }
    }
    
    // Fallback: extract text between house and first number
    if (!bet.betType && bet.bettingHouse) {
      const betTypeMatch = line.match(new RegExp(`${bet.bettingHouse}\\s*(?:\\([^)]+\\))?\\s+(.+?)\\s+\\d+`, 'i'));
      if (betTypeMatch) {
        bet.betType = betTypeMatch[1].trim().replace(/(USD|usd|\$|R\$)/g, '').trim();
        console.log(`Extracted bet type: ${bet.betType}`);
      }
    }
  } catch (error) {
    console.error('Error parsing bet line:', error);
  }
}