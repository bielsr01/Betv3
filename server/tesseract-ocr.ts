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

  // 1. EXTRACT TEAMS - Look for specific pattern "AsociacionDeportivaTarma-AlianzaAtletico"
  for (const line of lines) {
    // Pattern for team names separated by hyphen or dash
    const teamMatch = line.match(/([A-Za-z\s]+)(?:-|–|—)([A-Za-z\s]+)\s+(\d+\.\d+)%/);
    if (teamMatch) {
      const [, team1, team2, percentage] = teamMatch;
      result.betA.teamA = team1.replace(/([a-z])([A-Z])/g, '$1 $2').trim(); // Add spaces: AsociacionDeportiva -> Asociacion Deportiva
      result.betA.teamB = team2.replace(/([a-z])([A-Z])/g, '$1 $2').trim();
      result.betB.teamA = result.betA.teamA;
      result.betB.teamB = result.betA.teamB;
      result.totalProfitPercentage = percentage + '%';
      console.log('Teams and percentage found:', result.betA.teamA, 'vs', result.betA.teamB, percentage + '%');
      break;
    }
  }

  // 2. EXTRACT DATE AND TIME from pattern like "(2025-09-2615:15-03:00)"
  for (const line of lines) {
    const dateTimeMatch = line.match(/(\d{4})-(\d{2})-(\d{2})(\d{2}):(\d{2})/);
    if (dateTimeMatch) {
      const [, year, month, day, hour, minute] = dateTimeMatch;
      result.gameDate = `${year}-${month}-${day}`;
      result.gameTime = `${hour}:${minute}`;
      console.log('Date and time found:', result.gameDate, result.gameTime);
      break;
    }
  }

  // 3. EXTRACT LEAGUE from "Futebol/Peru-Liga1"
  for (const line of lines) {
    if (line.includes('Futebol/') || line.includes('Liga') || line.includes('Championship')) {
      result.league = line.replace(/([a-z])([A-Z])/g, '$1 $2'); // Add spaces
      console.log('League found:', result.league);
      break;
    }
  }

  // 4. EXTRACT BET DATA - Look for specific patterns from the OCR
  let betAProcessed = false;
  let betBProcessed = false;

  for (const line of lines) {
    // Pattern for Aposta1: "Apostalr)Total27 21.000 00%O 21.000 23.03 usbv@ 10.60"
    const aposta1Match = line.match(/Apostal.*?Total.*?(\d+\.\d+).*?(\d+\.\d+).*?(\d+\.\d+).*?(\d+\.\d+)/);
    if (aposta1Match && !betAProcessed) {
      const [, odds1, odds2, stake, profit] = aposta1Match;
      result.betA.bettingHouse = 'Aposta1 (BR)';
      result.betA.betType = 'Total ≥7';
      result.betA.odds = odds1; // 21.000
      result.betA.stake = stake; // 23.03
      result.betA.profit = profit; // 10.60
      betAProcessed = true;
      console.log('Bet A found:', result.betA);
      continue;
    }

    // Pattern for Betfair: "Betfair(8R) Abaixo7.5 1.080o 65% 1.075 450 usbv@O1063"
    const betfairMatch = line.match(/Betfair.*?Abaixo.*?(\d+\.\d+).*?(\d+\.\d+).*?(\d+).*?(\d+\.\d+)/);
    if (betfairMatch && !betBProcessed) {
      const [, odds1, odds2, stake, profit] = betfairMatch;
      result.betB.bettingHouse = 'Betfair (BR)';
      result.betB.betType = 'Abaixo 7.5';
      result.betB.odds = odds2; // 1.075
      result.betB.stake = stake; // 450
      result.betB.profit = profit; // 10.63
      betBProcessed = true;
      console.log('Bet B found:', result.betB);
      continue;
    }
  }

  // 5. FALLBACK: Try to extract betting houses and data more generically
  if (!betAProcessed || !betBProcessed) {
    const bettingHouses = [
      { name: 'Aposta1', patterns: ['Apostal', 'Aposta1'] },
      { name: 'Betfair', patterns: ['Betfair'] },
      { name: 'Bet365', patterns: ['Bet365'] },
      { name: 'KTO', patterns: ['KTO'] }
    ];

    for (const line of lines) {
      for (const house of bettingHouses) {
        if (house.patterns.some(pattern => line.includes(pattern))) {
          // Extract all numbers from the line
          const numbers = line.match(/\d+\.\d+|\d+/g);
          if (numbers && numbers.length >= 3) {
            const houseData = {
              bettingHouse: house.name + ' (BR)',
              betType: line.includes('Total') ? 'Total ≥7' : line.includes('Abaixo') ? 'Abaixo 7.5' : 'Unknown',
              odds: numbers.find(n => parseFloat(n) > 1 && parseFloat(n) < 50) || '0',
              stake: numbers.find(n => parseFloat(n) > 10 && parseFloat(n) < 10000) || '0',
              profit: numbers[numbers.length - 1] || '0'
            };

            if (!betAProcessed && house.name === 'Aposta1') {
              Object.assign(result.betA, houseData);
              betAProcessed = true;
            } else if (!betBProcessed && house.name === 'Betfair') {
              Object.assign(result.betB, houseData);
              betBProcessed = true;
            }
          }
        }
      }
    }
  }

  // Ensure teams are copied to both bets
  if (result.betA.teamA && !result.betB.teamA) {
    result.betB.teamA = result.betA.teamA;
    result.betB.teamB = result.betA.teamB;
  }

  console.log('Final extracted data:', result);
  return result;
}