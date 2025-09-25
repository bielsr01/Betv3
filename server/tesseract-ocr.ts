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
    console.log('Starting enhanced Tesseract OCR processing...');
    
    // Convert base64 to buffer
    const imageBuffer = Buffer.from(imageBase64.replace(/^data:image\/[a-z]+;base64,/, ''), 'base64');
    
    // Enhanced OCR settings for structured data and special characters
    await worker.setParameters({
      tessedit_pageseg_mode: 3 as any, // Fully automatic page segmentation (better for structured data)
      tessedit_ocr_engine_mode: 1 as any, // LSTM neural network engine (better accuracy)
      tessedit_char_whitelist: '', // Allow all characters including accents and symbols
      tessedit_char_blacklist: '', // No blacklist
      classify_bln_numeric_mode: 0 as any, // Allow mixed alphanumeric
      tessedit_enable_doc_dict: 1 as any, // Enable document dictionary
      tessedit_enable_bigram_correction: 1 as any, // Enable bigram correction
      tessedit_enable_dict_correction: 1 as any, // Enable dictionary correction
      load_system_dawg: 1 as any, // Load system dictionary
      load_freq_dawg: 1 as any, // Load frequent word dictionary
    });
    
    // First pass: Table/block detection mode
    await worker.setParameters({ tessedit_pageseg_mode: 6 as any }); // Uniform block of text - good for tables
    const { data: tableData } = await worker.recognize(imageBuffer);
    
    // Second pass: Automatic segmentation for better text extraction
    await worker.setParameters({ tessedit_pageseg_mode: 3 as any }); // Fully automatic - catches more text blocks  
    const { data: autoData } = await worker.recognize(imageBuffer);
    
    // Third pass: Single text line mode for precise data
    await worker.setParameters({ tessedit_pageseg_mode: 7 as any }); // Single text line
    const { data: lineData } = await worker.recognize(imageBuffer);
    
    console.log('Table-mode OCR Text:', tableData.text);
    console.log('Auto-mode OCR Text:', autoData.text);
    console.log('Line-mode OCR Text:', lineData.text);
    console.log('Table-mode Blocks:', tableData.blocks?.length || 0);
    console.log('Auto-mode Blocks:', autoData.blocks?.length || 0);
    console.log('Line-mode Blocks:', lineData.blocks?.length || 0);
    
    // Use the result with better block detection and more text
    const bestData = selectBestOCRData([tableData, autoData, lineData]);
    
    // Extract data using enhanced block-based patterns
    const extractedData = extractSureBetDataEnhanced(bestData.text, bestData.blocks || []);
    
    console.log('Enhanced Tesseract OCR result:', extractedData);
    
    return extractedData;
    
  } catch (error) {
    console.error("Tesseract OCR Error:", error);
    throw new Error(`Falha ao analisar imagem SureBet com Tesseract: ${error}`);
  } finally {
    await worker.terminate();
  }
}

// Select the best OCR result based on text quality and block detection
function selectBestOCRData(ocrResults: any[]): any {
  let bestResult = ocrResults[0];
  let bestScore = 0;
  
  for (const result of ocrResults) {
    let score = 0;
    
    // Score based on text length (more text usually better)
    score += result.text.length * 0.1;
    
    // Score based on number of blocks (more blocks = better segmentation)
    score += (result.blocks?.length || 0) * 10;
    
    // Score based on confidence (if available)
    score += (result.confidence || 0) * 0.5;
    
    // Bonus for key betting terms
    const keyTerms = ['apostas', 'odds', 'stake', 'lucro', 'profit', 'ROI', '%', 'USD'];
    const textLower = result.text.toLowerCase();
    keyTerms.forEach(term => {
      if (textLower.includes(term.toLowerCase())) score += 5;
    });
    
    if (score > bestScore) {
      bestScore = score;
      bestResult = result;
    }
  }
  
  console.log('Best OCR result selected with score:', bestScore);
  return bestResult;
}

// Enhanced extraction function that works with blocks and supports special characters
function extractSureBetDataEnhanced(ocrText: string, blocks: any[]): TesseractOCRData {
  const lines = ocrText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  console.log('Enhanced OCR Lines:', lines);
  console.log('OCR Blocks count:', blocks.length);
  
  // Extract structured data from blocks (table-aware parsing)
  const blockData = extractDataFromBlocks(blocks);
  
  // Combine line-based and block-based extraction
  const lineData = extractDataFromLines(lines);
  
  console.log('Block-based data:', blockData);
  console.log('Line-based data:', lineData);

  // Initialize result with enhanced character support
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

  // 1. MERGE TEAM DATA (prioritize block data, fallback to line data)
  if (lineData.teams) {
    result.betA.teamA = lineData.teams.teamA;
    result.betA.teamB = lineData.teams.teamB;
    result.betB.teamA = lineData.teams.teamA;
    result.betB.teamB = lineData.teams.teamB;
    result.totalProfitPercentage = lineData.teams.profitPercentage + '%';
  } else if (blockData.teams.length > 0) {
    // Use block-based team detection as fallback
    const teamBlock = blockData.teams[0];
    const teamMatch = teamBlock.text.match(/([A-Za-zÀ-ÿ\s]+)(?:-|–|—)([A-Za-zÀ-ÿ\s]+)/);
    if (teamMatch) {
      result.betA.teamA = normalizeTeamName(teamMatch[1]);
      result.betA.teamB = normalizeTeamName(teamMatch[2]);
      result.betB.teamA = result.betA.teamA;
      result.betB.teamB = result.betA.teamB;
      if (teamBlock.numbers.length > 0) {
        result.totalProfitPercentage = teamBlock.numbers[0] + '%';
      }
    }
  }

  // 2. MERGE DATE/TIME DATA
  if (lineData.gameInfo) {
    result.gameDate = lineData.gameInfo.date;
    result.gameTime = lineData.gameInfo.time;
  } else if (blockData.timestamps.length > 0) {
    const timestamp = blockData.timestamps[0].text;
    const dateMatch = timestamp.match(/(\d{4})-(\d{2})-(\d{2}).*?(\d{2}):(\d{2})/);
    if (dateMatch) {
      result.gameDate = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
      result.gameTime = `${dateMatch[4]}:${dateMatch[5]}`;
    }
  }

  // 3. MERGE LEAGUE DATA
  if (lineData.league) {
    result.league = lineData.league;
    result.sport = lineData.league.includes('futebol') ? 'Futebol' : 
                   lineData.league.includes('americano') ? 'Futebol Americano' : 'Esporte';
  }

  // 4. MERGE BETTING DATA (prioritize line-based extraction, enhance with block data)
  const bets = lineData.bets;
  console.log('Extracted bets from lines:', bets);
  
  if (bets.length >= 1) {
    const bet1 = bets[0];
    result.betA.bettingHouse = bet1.house + ' (BR)';
    result.betA.betType = bet1.betType + (bet1.threshold ? ` ${bet1.threshold}` : '');
    result.betA.odds = bet1.odds.toString();
    result.betA.stake = bet1.stake.toString();
    result.betA.profit = bet1.profit.toString();
  }
  
  if (bets.length >= 2) {
    const bet2 = bets[1];
    result.betB.bettingHouse = bet2.house + ' (BR)';
    result.betB.betType = bet2.betType + (bet2.threshold ? ` ${bet2.threshold}` : '');
    result.betB.odds = bet2.odds.toString();
    result.betB.stake = bet2.stake.toString();
    result.betB.profit = bet2.profit.toString();
  }

  // 5. FALLBACK: Use block-based values if line extraction failed
  if (result.betA.odds === '0' && result.betB.odds === '0' && blockData.houses.length > 0) {
    console.log('Using block-based fallback for betting data');
    
    for (let i = 0; i < Math.min(2, blockData.houses.length); i++) {
      const house = blockData.houses[i];
      const betData = {
        bettingHouse: house.text.match(/(betfast|blaze|aposta|betfair)/i)?.[1] || 'Unknown',
        betType: house.text.includes('acima') ? 'Acima' : house.text.includes('abaixo') ? 'Abaixo' : 'Total',
        odds: house.numbers.find((n: number) => n > 1 && n < 10)?.toString() || '0',
        stake: house.numbers.find((n: number) => n > 10 && n < 1000)?.toString() || '0',
        profit: house.numbers.find((n: number) => n > 1 && n < 100)?.toString() || '0'
      };
      
      if (i === 0) {
        result.betA = { ...result.betA, ...betData };
      } else {
        result.betB = { ...result.betB, ...betData };
      }
    }
  }

  console.log('Final enhanced extraction result:', result);
  return result;
}

// Helper function to normalize team names
function normalizeTeamName(teamName: string): string {
  return teamName
    .replace(/([a-z])([A-Z])/g, '$1 $2') // Add spaces between camelCase
    .replace(/\s+/g, ' ') // Normalize multiple spaces
    .trim();
}

// Enhanced bet data extraction with support for special characters
function extractBetsFromLines(lines: string[]) {
  const bets: { betA?: any; betB?: any } = {};
  let betAProcessed = false;
  let betBProcessed = false;

  // Enhanced patterns with support for special characters (≥, ≤, etc.)
  const betPatterns = [
    // Pattern for various betting houses with accents and special chars
    {
      houses: ['Betfast', 'BetFast', 'betfast'],
      pattern: /(?:Betfast|BetFast|betfast).*?(?:Acima|Above|≥|>=)\s*(\d+[\.,]?\d*)\s*.*?(\d+[\.,]?\d+).*?(\d+[\.,]?\d+).*?(\d+[\.,]?\d+)/i,
      betType: (match: string) => match.includes('Acima') || match.includes('Above') || match.includes('≥') || match.includes('>=') ? 'Acima' : 'Total ≥'
    },
    {
      houses: ['Blaze', 'blaze'],
      pattern: /(?:Blaze|blaze).*?(?:Abaixo|Below|≤|<=)\s*(\d+[\.,]?\d*)\s*.*?(\d+[\.,]?\d+).*?(\d+[\.,]?\d+).*?(\d+[\.,]?\d+)/i,
      betType: (match: string) => match.includes('Abaixo') || match.includes('Below') || match.includes('≤') || match.includes('<=') ? 'Abaixo' : 'Total ≤'
    },
    {
      houses: ['Aposta1', 'aposta1', 'Apostal'],
      pattern: /(?:Aposta1|aposta1|Apostal).*?(?:Total|total)\s*(\d+[\.,]?\d*)\s*.*?(\d+[\.,]?\d+).*?(\d+[\.,]?\d+).*?(\d+[\.,]?\d+)/i,
      betType: () => 'Total'
    },
    {
      houses: ['Betfair', 'betfair'],
      pattern: /(?:Betfair|betfair).*?(?:Abaixo|Below|Under|≤|<=)\s*(\d+[\.,]?\d*)\s*.*?(\d+[\.,]?\d+).*?(\d+[\.,]?\d+).*?(\d+[\.,]?\d+)/i,
      betType: () => 'Abaixo'
    }
  ];

  for (const line of lines) {
    for (const betPattern of betPatterns) {
      const match = line.match(betPattern.pattern);
      if (match && (!betAProcessed || !betBProcessed)) {
        const [, threshold, odds, stake, profit] = match;
        
        const betData = {
          bettingHouse: betPattern.houses[0] + ' (BR)',
          betType: betPattern.betType(line) + (threshold ? ` ${threshold.replace(',', '.')}` : ''),
          odds: odds.replace(',', '.'),
          stake: stake.replace(',', '.'),
          profit: profit.replace(',', '.')
        };

        if (!betAProcessed && (betPattern.houses.includes('Betfast') || betPattern.houses.includes('Aposta1'))) {
          bets.betA = betData;
          betAProcessed = true;
          console.log('Enhanced Bet A found:', betData);
        } else if (!betBProcessed && (betPattern.houses.includes('Blaze') || betPattern.houses.includes('Betfair'))) {
          bets.betB = betData;
          betBProcessed = true;
          console.log('Enhanced Bet B found:', betData);
        }
      }
    }
  }

  return bets;
}

// Extract structured data using OCR block geometry
function extractDataFromBlocks(blocks: any[]): any {
  const blockBasedData: any = {
    teams: [],
    houses: [],
    values: [],
    timestamps: [],
    metadata: []
  };
  
  blocks.forEach((block, blockIndex) => {
    if (!block.paragraphs) return;
    
    block.paragraphs.forEach((paragraph: any, pIndex: number) => {
      if (!paragraph.lines) return;
      
      paragraph.lines.forEach((line: any, lIndex: number) => {
        if (!line.words) return;
        
        const lineText = line.words.map((w: any) => w.text).join(' ');
        const lineNumbers = extractAllNumbers(lineText);
        
        // Categorize based on content and position
        if (lineText.match(/vs|-|–|—/i) && lineNumbers.some((n: number) => n > 0.5 && n < 50)) {
          // Likely team names with percentage
          blockBasedData.teams.push({
            text: lineText,
            numbers: lineNumbers,
            position: { block: blockIndex, paragraph: pIndex, line: lIndex }
          });
        } else if (lineText.match(/(betfast|blaze|aposta|betfair)/i)) {
          // Betting house data
          blockBasedData.houses.push({
            text: lineText,
            numbers: lineNumbers,
            position: { block: blockIndex, paragraph: pIndex, line: lIndex }
          });
        } else if (lineNumbers.length >= 3) {
          // Numeric data (likely odds, stakes, profits)
          blockBasedData.values.push({
            text: lineText,
            numbers: lineNumbers,
            position: { block: blockIndex, paragraph: pIndex, line: lIndex }
          });
        } else if (lineText.match(/\d{4}-\d{2}-\d{2}|\d{2}:\d{2}/)) {
          // Date/time information
          blockBasedData.timestamps.push({
            text: lineText,
            position: { block: blockIndex, paragraph: pIndex, line: lIndex }
          });
        } else {
          // Other metadata
          blockBasedData.metadata.push({
            text: lineText,
            position: { block: blockIndex, paragraph: pIndex, line: lIndex }
          });
        }
      });
    });
  });
  
  return blockBasedData;
}

// Enhanced line-based data extraction with improved numeric parsing
function extractDataFromLines(lines: string[]): any {
  const extracted: any = {
    teams: null,
    bets: [],
    gameInfo: null,
    league: null
  };
  
  for (const line of lines) {
    const cleanLine = normalizeText(line);
    
    // Enhanced team extraction with better normalization
    const teamMatch = cleanLine.match(/([A-Za-zÀ-ÿ\s]+)(?:-|–|—|\s+vs\s+)([A-Za-zÀ-ÿ\s]+)\s+(\d+[\.,]?\d*)%/);
    if (teamMatch && !extracted.teams) {
      const [, team1, team2, percentage] = teamMatch;
      extracted.teams = {
        teamA: normalizeTeamName(team1),
        teamB: normalizeTeamName(team2),
        profitPercentage: parseFloat(percentage.replace(',', '.'))
      };
    }
    
    // Enhanced betting data extraction with better number parsing
    const betHousePatterns = [
      { name: 'Betfast', pattern: /betfast.*?acima\s*(\d+[\.,]?\d*)\s*.*?(\d+[\.,]?\d+).*?(\d+[\.,]?\d+).*?(\d+[\.,]?\d+)/i },
      { name: 'Blaze', pattern: /blaze.*?abaixo\s*(\d+[\.,]?\d*)\s*.*?(\d+[\.,]?\d+).*?(\d+[\.,]?\d+).*?(\d+[\.,]?\d+)/i },
      { name: 'Aposta1', pattern: /aposta.*?total\s*(\d+[\.,]?\d*)\s*.*?(\d+[\.,]?\d+).*?(\d+[\.,]?\d+).*?(\d+[\.,]?\d+)/i },
      { name: 'Betfair', pattern: /betfair.*?(?:abaixo|under)\s*(\d+[\.,]?\d*)\s*.*?(\d+[\.,]?\d+).*?(\d+[\.,]?\d+).*?(\d+[\.,]?\d+)/i }
    ];
    
    for (const house of betHousePatterns) {
      const match = cleanLine.match(house.pattern);
      if (match) {
        const [, threshold, odds, stake, profit] = match;
        extracted.bets.push({
          house: house.name,
          betType: house.name === 'Betfast' ? 'Acima' : house.name === 'Blaze' ? 'Abaixo' : 'Total',
          threshold: parseFloat(threshold.replace(',', '.')),
          odds: parseFloat(odds.replace(',', '.')),
          stake: parseFloat(stake.replace(',', '.')),
          profit: parseFloat(profit.replace(',', '.'))
        });
      }
    }
    
    // Date/time extraction
    const dateMatch = cleanLine.match(/(\d{4})-(\d{2})-(\d{2}).*?(\d{2}):(\d{2})/);
    if (dateMatch && !extracted.gameInfo) {
      extracted.gameInfo = {
        date: `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`,
        time: `${dateMatch[4]}:${dateMatch[5]}`
      };
    }
    
    // League extraction
    if (cleanLine.includes('futebol') && !extracted.league) {
      extracted.league = cleanLine;
    }
  }
  
  return extracted;
}

// Helper function to extract all numbers from text with better parsing
function extractAllNumbers(text: string): number[] {
  const numbers: number[] = [];
  
  // Enhanced number patterns including currency and percentages
  const numberPatterns = [
    /(\d+[\.,]\d+)%/g, // Percentages
    /(\d+[\.,]\d+)\s*USD/gi, // Currency
    /(\d+[\.,]\d+)/g, // Regular decimals
    /(\d+)/g // Integers
  ];
  
  for (const pattern of numberPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const numStr = match[1].replace(',', '.');
      const num = parseFloat(numStr);
      if (!isNaN(num) && !numbers.includes(num)) {
        numbers.push(num);
      }
    }
  }
  
  return numbers.sort((a, b) => b - a); // Sort descending
}

// Enhanced text normalization for better parsing
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/[^\w\s\d\.,%-]/g, ' ') // Keep essential chars
    .trim();
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