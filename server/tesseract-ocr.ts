import { createWorker } from 'tesseract.js';

interface TesseractOCRData {
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

export async function analyzeSureBetImageTesseract(imageBase64: string): Promise<TesseractOCRData> {
  const worker = await createWorker('por+eng');
  
  try {
    console.log('Starting Tesseract OCR processing...');
    
    // Convert base64 to buffer
    const imageBuffer = Buffer.from(imageBase64.replace(/^data:image\/[a-z]+;base64,/, ''), 'base64');
    
    // OCR with optimized settings for betting slips
    const ocrOptions = {
      'tessedit_pageseg_mode': '6', // Assume single uniform block of text
      'tessedit_char_whitelist': 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,:;()-%/@' 
    };
    const { data } = await worker.recognize(imageBuffer, ocrOptions as any);
    
    console.log('Raw OCR Text:', data.text);
    
    // Extract data using robust patterns
    const extractedData = extractSureBetData(data.text);
    
    console.log('Tesseract OCR result:', extractedData);
    
    return extractedData;
    
  } catch (error) {
    console.error("Tesseract OCR Error:", error);
    throw new Error(`Falha ao analisar imagem SureBet com Tesseract: ${error}`);
  } finally {
    await worker.terminate();
  }
}

function extractSureBetData(ocrText: string): TesseractOCRData {
  const lines = ocrText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  console.log('OCR Lines:', lines);
  
  // Initialize default structure matching Gemini format
  const result: TesseractOCRData = {
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
    sport: 'Futebol',
    league: '',
    totalProfitPercentage: '0'
  };
  
  // Common betting house patterns
  const bettingHouses = ['KTO', 'Betfair', 'Bet365', 'Pinnacle', 'Aposta1', 'SuperBet', 'Blaze', 'Pixbet'];
  
  // Extract teams (usually appear early in text)
  const teamPatterns = [
    /([A-Za-z\s]+)\s*(?:vs?|x)\s*([A-Za-z\s]+)/i,
    /([A-Za-z\s]{3,})\s*-\s*([A-Za-z\s]{3,})/i
  ];
  
  let teamsFound = false;
  for (const line of lines.slice(0, 10)) { // Check first 10 lines for teams
    for (const pattern of teamPatterns) {
      const teamMatch = line.match(pattern);
      if (teamMatch && !teamsFound) {
        const [, team1, team2] = teamMatch;
        if (team1.length > 2 && team2.length > 2) {
          result.betA.teamA = team1.trim();
          result.betA.teamB = team2.trim();
          result.betB.teamA = team1.trim();
          result.betB.teamB = team2.trim();
          teamsFound = true;
          console.log('Teams found:', team1, 'vs', team2);
          break;
        }
      }
    }
    if (teamsFound) break;
  }
  
  // Extract betting houses, odds, and stakes
  let betAFound = false;
  let betBFound = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for betting houses
    for (const house of bettingHouses) {
      if (line.toUpperCase().includes(house.toUpperCase())) {
        console.log(`Found betting house: ${house} in line: ${line}`);
        
        // Look for odds and stakes in nearby lines
        const searchRange = lines.slice(Math.max(0, i-2), Math.min(lines.length, i+5));
        
        // Extract odds (decimal format like 1.75, 21.000)
        const oddsPattern = /\b(\d+\.?\d*)\b/g;
        const stakes: string[] = [];
        const odds: string[] = [];
        
        for (const searchLine of searchRange) {
          const numbers = searchLine.match(/\b\d+\.?\d*\b/g);
          if (numbers) {
            for (const num of numbers) {
              const value = parseFloat(num);
              // Odds are typically between 1.01 and 50
              if (value >= 1.01 && value <= 50 && !odds.find(o => Math.abs(parseFloat(o) - value) < 0.001)) {
                odds.push(num);
              }
              // Stakes are typically larger numbers
              if (value >= 10 && value <= 10000) {
                stakes.push(num);
              }
            }
          }
        }
        
        // Assign to first available bet
        if (!betAFound && odds.length > 0 && stakes.length > 0) {
          result.betA.bettingHouse = house;
          result.betA.odds = odds[0];
          result.betA.stake = stakes[0];
          // Calculate profit (simplified)
          const profit = (parseFloat(stakes[0]) * parseFloat(odds[0]) - parseFloat(stakes[0])).toFixed(2);
          result.betA.profit = profit;
          betAFound = true;
          console.log(`Bet A: ${house}, Odds: ${odds[0]}, Stake: ${stakes[0]}, Profit: ${profit}`);
        } else if (!betBFound && odds.length > 0 && stakes.length > 0) {
          result.betB.bettingHouse = house;
          result.betB.odds = odds[odds.length > 1 ? 1 : 0];
          result.betB.stake = stakes[stakes.length > 1 ? 1 : 0];
          // Calculate profit (simplified)
          const stakeValue = stakes[stakes.length > 1 ? 1 : 0];
          const oddsValue = odds[odds.length > 1 ? 1 : 0];
          const profit = (parseFloat(stakeValue) * parseFloat(oddsValue) - parseFloat(stakeValue)).toFixed(2);
          result.betB.profit = profit;
          betBFound = true;
          console.log(`Bet B: ${house}, Odds: ${oddsValue}, Stake: ${stakeValue}, Profit: ${profit}`);
        }
      }
    }
  }
  
  // Extract percentage from text (look for patterns like "2.25%" or "1.59%")
  const percentagePattern = /(\d+\.?\d*)\s*%/;
  for (const line of lines) {
    const percentageMatch = line.match(percentagePattern);
    if (percentageMatch) {
      result.totalProfitPercentage = percentageMatch[1] + '%';
      console.log('Total profit percentage found:', result.totalProfitPercentage);
      break;
    }
  }
  
  // Extract date patterns (DD/MM/YYYY or YYYY-MM-DD)
  const datePattern = /(\d{2})\/(\d{2})\/(\d{4})|(\d{4})-(\d{2})-(\d{2})/;
  for (const line of lines) {
    const dateMatch = line.match(datePattern);
    if (dateMatch) {
      if (dateMatch[1]) { // DD/MM/YYYY format
        const [, day, month, year] = dateMatch;
        result.gameDate = `${year}-${month}-${day}`;
      } else if (dateMatch[4]) { // YYYY-MM-DD format
        result.gameDate = `${dateMatch[4]}-${dateMatch[5]}-${dateMatch[6]}`;
      }
      break;
    }
  }
  
  // Extract time patterns (HH:MM)
  const timePattern = /(\d{1,2}):(\d{2})/;
  for (const line of lines) {
    const timeMatch = line.match(timePattern);
    if (timeMatch) {
      result.gameTime = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
      break;
    }
  }
  
  // Extract league/competition info
  const leagueKeywords = ['Liga', 'Championship', 'Premier', 'Brasileirão', 'Copa', 'Serie', 'Division'];
  for (const line of lines) {
    for (const keyword of leagueKeywords) {
      if (line.includes(keyword)) {
        result.league = line.substring(0, 50); // Limit length
        break;
      }
    }
    if (result.league) break;
  }
  
  // Extract bet types from common patterns
  const betTypes = ['Total', 'Over', 'Under', 'Resultado', 'DNB', 'Handicap', 'Corners'];
  for (const line of lines) {
    for (const betType of betTypes) {
      if (line.includes(betType)) {
        if (!result.betA.betType) {
          result.betA.betType = betType;
        } else if (!result.betB.betType) {
          result.betB.betType = betType;
          break;
        }
      }
    }
    if (result.betA.betType && result.betB.betType) break;
  }
  
  console.log('Final extracted data:', result);
  return result;
}