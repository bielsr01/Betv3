/**
 * Real OCR Solution using Tesseract.js (WASM)
 * Genuine OCR processing without system dependencies
 * Maintains accuracy while eliminating heavy external deps
 */

import { createWorker } from 'tesseract.js';

export interface RealOCRResult {
  success: boolean;
  method: string;
  raw_text: string;
  text_blocks: Array<{
    line_key: string;
    full_text: string;
    confidence_avg: number;
    words?: Array<{ text: string; confidence: number; bbox?: any }>;
  }>;
  betA: {
    bettingHouse: string;
    teamA: string;
    teamB: string;
    odds: string;
    stake: string;
    payout: string;
  };
  betB: {
    bettingHouse: string;
    teamA: string;
    teamB: string;
    odds: string;
    stake: string;
    payout: string;
  };
  totalProfitPercentage: string;
  processing_info: {
    confidence: number;
    processing_time: number;
    ocr_method: string;
  };
  error?: string;
}

/**
 * Real OCR processing using Tesseract.js WASM
 * No system dependencies, runs entirely in Node.js
 */
export class RealOCRProcessor {
  
  private bettingHouses = [
    'Pinnacle', 'KTO', 'BravoBet', 'Betfast', 'Blaze', 'Betano', 
    'VBet', 'MarjoSports', 'Betnacional', 'Aposta1', 'SuperBet', 
    'bet365', 'Sportingbet', '1xBet', 'Betway', 'Sportsbet'
  ];

  /**
   * Perform real OCR on image using Tesseract.js
   */
  async extractBettingDataReal(imageBase64: string): Promise<RealOCRResult> {
    const startTime = Date.now();
    
    try {
      console.log('🔍 Starting REAL OCR with Tesseract.js (WASM)...');
      
      // Create Tesseract worker
      const worker = await createWorker('eng+por', 1, {
        logger: m => {
          if (m.status === 'recognizing text') {
            console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        }
      });

      // Perform real OCR
      const { data } = await worker.recognize(Buffer.from(imageBase64, 'base64'));
      
      await worker.terminate();
      
      const processingTime = Date.now() - startTime;
      console.log(`✅ Real OCR completed in ${processingTime}ms`);
      console.log(`📝 Extracted text (${data.text.length} chars): ${data.text.substring(0, 200)}...`);
      
      // Process OCR results with proven extraction logic
      const extractedData = this.extractBettingInfo(data);
      
      // Structure OCR results
      const textBlocks = this.structureOCRResults(data);
      
      return {
        success: true,
        method: 'tesseract_js_wasm',
        raw_text: data.text,
        text_blocks: textBlocks,
        betA: extractedData.betA,
        betB: extractedData.betB,
        totalProfitPercentage: extractedData.totalProfitPercentage,
        processing_info: {
          confidence: data.confidence,
          processing_time: processingTime,
          ocr_method: 'tesseract_wasm'
        }
      };
      
    } catch (error) {
      console.error('❌ Real OCR error:', error);
      return {
        success: false,
        method: 'tesseract_js_wasm_error',
        raw_text: '',
        text_blocks: [],
        betA: { bettingHouse: '', teamA: '', teamB: '', odds: '', stake: '', payout: '' },
        betB: { bettingHouse: '', teamA: '', teamB: '', odds: '', stake: '', payout: '' },
        totalProfitPercentage: '',
        processing_info: {
          confidence: 0,
          processing_time: Date.now() - startTime,
          ocr_method: 'error'
        },
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Extract betting information using proven regex patterns on REAL OCR text
   */
  private extractBettingInfo(ocrData: any) {
    const result = {
      betA: { bettingHouse: '', teamA: '', teamB: '', odds: '', stake: '', payout: '' },
      betB: { bettingHouse: '', teamA: '', teamB: '', odds: '', stake: '', payout: '' },
      totalProfitPercentage: ''
    };

    const fullText = ocrData.text || '';
    const words = ocrData.words || [];
    
    console.log(`🔍 Analyzing ${words.length} words from real OCR...`);
    
    // Extract profit percentage
    const profitMatch = fullText.match(/(\d+\.?\d*)%/);
    if (profitMatch) {
      result.totalProfitPercentage = profitMatch[1];
      console.log(`📊 Found profit: ${result.totalProfitPercentage}%`);
    }
    
    // Extract team names using proven patterns
    const teamPatterns = [
      /([A-Za-zÀ-ÿ\s\-]+)\s*[—–-]\s*([A-Za-zÀ-ÿ\s\-]+)/,
      /([A-Za-zÀ-ÿ\s\-]+)\s+vs\s+([A-Za-zÀ-ÿ\s\-]+)/,
      /([A-Za-zÀ-ÿ\s\-]+)\s+x\s+([A-Za-zÀ-ÿ\s\-]+)/
    ];
    
    for (const pattern of teamPatterns) {
      const teamMatch = fullText.match(pattern);
      if (teamMatch) {
        const teamA = this.cleanTeamName(teamMatch[1]);
        const teamB = this.cleanTeamName(teamMatch[2]);
        
        if (teamA.length > 2 && teamB.length > 2) {
          result.betA.teamA = teamA;
          result.betA.teamB = teamB;
          result.betB.teamA = teamA;
          result.betB.teamB = teamB;
          console.log(`⚽ Found teams: ${teamA} vs ${teamB}`);
          break;
        }
      }
    }
    
    // Extract betting houses and associated data using coordinate-based approach
    words.forEach((word, index) => {
      const wordText = word.text?.toLowerCase() || '';
      
      // Check if word matches a betting house
      for (const house of this.bettingHouses) {
        if (wordText.includes(house.toLowerCase())) {
          console.log(`🏠 Found betting house: ${house} at position ${index}`);
          
          // Extract numbers that appear after this betting house
          const numbersAfter = this.extractNumbersAfterPosition(words, index);
          
          if (!result.betA.bettingHouse) {
            result.betA.bettingHouse = house;
            this.assignOddsAndStake(result.betA, numbersAfter);
            console.log(`🅰️ BetA: ${house} - ${result.betA.odds}/${result.betA.stake}`);
          } else if (!result.betB.bettingHouse && house !== result.betA.bettingHouse) {
            result.betB.bettingHouse = house;
            this.assignOddsAndStake(result.betB, numbersAfter);
            console.log(`🅱️ BetB: ${house} - ${result.betB.odds}/${result.betB.stake}`);
          }
          break;
        }
      }
    });
    
    // Calculate payouts
    this.calculatePayouts(result.betA);
    this.calculatePayouts(result.betB);
    
    return result;
  }

  private cleanTeamName(teamName: string): string {
    let cleaned = teamName.trim();
    
    // Remove betting house names
    for (const house of this.bettingHouses) {
      cleaned = cleaned.replace(new RegExp(house, 'gi'), '').trim();
    }
    
    // Clean OCR artifacts
    cleaned = cleaned.replace(/[^A-Za-zÀ-ÿ\s\-]/g, '').trim();
    cleaned = cleaned.replace(/\s+/g, ' ');
    
    return cleaned;
  }

  private extractNumbersAfterPosition(words: any[], houseIndex: number): Array<{value: number, text: string, type: string}> {
    const numbers = [];
    
    // Look at the next 10 words after betting house
    for (let i = houseIndex + 1; i < Math.min(words.length, houseIndex + 11); i++) {
      const wordText = words[i].text || '';
      
      // SureBet odds pattern (X.XXX)
      const oddsMatch = wordText.match(/^\d\.\d{3}$/);
      if (oddsMatch) {
        const value = parseFloat(oddsMatch[0]);
        if (value >= 1.0 && value <= 10.0) {
          numbers.push({ value, text: oddsMatch[0], type: 'surebet_odds' });
        }
      }
      
      // Stake pattern (XX.XX)
      const stakeMatch = wordText.match(/^\d{2,3}\.\d{2}$/);
      if (stakeMatch) {
        const value = parseFloat(stakeMatch[0]);
        if (value >= 10 && value <= 1000) {
          numbers.push({ value, text: stakeMatch[0], type: 'stake' });
        }
      }
    }
    
    return numbers;
  }

  private assignOddsAndStake(bet: any, numbers: Array<{value: number, text: string, type: string}>) {
    // Assign odds (priority: surebet_odds)
    const odds = numbers.find(n => n.type === 'surebet_odds');
    if (odds) {
      bet.odds = odds.text;
    }
    
    // Assign stake
    const stake = numbers.find(n => n.type === 'stake');
    if (stake) {
      bet.stake = stake.text;
    }
  }

  private calculatePayouts(bet: any) {
    if (bet.odds && bet.stake) {
      try {
        const odds = parseFloat(bet.odds);
        const stake = parseFloat(bet.stake);
        bet.payout = (odds * stake).toFixed(2);
      } catch (e) {
        console.error('Error calculating payout:', e);
      }
    }
  }

  private structureOCRResults(ocrData: any): Array<{line_key: string, full_text: string, confidence_avg: number}> {
    const lines = ocrData.lines || [];
    
    return lines.map((line: any, index: number) => ({
      line_key: `tesseract-${index}`,
      full_text: line.text || '',
      confidence_avg: line.confidence || 0
    }));
  }
}

/**
 * Main extraction function - performs REAL OCR
 */
export async function extractBettingDataReal(imageBase64: string): Promise<RealOCRResult> {
  const processor = new RealOCRProcessor();
  return processor.extractBettingDataReal(imageBase64);
}

/**
 * Blocks-compatible interface using real OCR
 */
export async function analyzeImageBlocksReal(imageBase64: string): Promise<{
  success: boolean;
  lines: Array<{ full_text: string; confidence?: number }>;
  total_blocks: number;
  method: string;
}> {
  try {
    const result = await extractBettingDataReal(imageBase64);
    
    if (!result.success) {
      return {
        success: false,
        lines: [],
        total_blocks: 0,
        method: 'real_ocr_blocks_failed'
      };
    }
    
    const lines = result.text_blocks.map(block => ({
      full_text: block.full_text,
      confidence: block.confidence_avg
    }));
    
    return {
      success: true,
      lines: lines,
      total_blocks: result.text_blocks.length,
      method: 'tesseract_js_real_blocks'
    };
    
  } catch (error) {
    console.error('Real OCR blocks analysis error:', error);
    return {
      success: false,
      lines: [],
      total_blocks: 0,
      method: 'real_ocr_blocks_error'
    };
  }
}