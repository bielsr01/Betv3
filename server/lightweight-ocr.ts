import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Ultra-lightweight OCR solution - replaces heavy dependencies
 * Uses only basic Python libraries for maximum efficiency
 */

export interface LightweightOCRResult {
  success: boolean;
  method: string;
  raw_text: string;
  text_blocks: Array<{
    line_key: string;
    full_text: string;
    confidence_avg: number;
    words?: Array<{ text: string; confidence: number }>;
  }>;
  word_count?: number;
  processing_info?: {
    image_size: [number, number];
    method_used: string;
  };
  betA?: {
    bettingHouse: string;
    teamA: string;
    teamB: string;
    odds: string;
    stake: string;
    payout: string;
  };
  betB?: {
    bettingHouse: string;
    teamA: string;
    teamB: string;
    odds: string;
    stake: string;
    payout: string;
  };
  totalProfitPercentage?: string;
  error?: string;
}

/**
 * Analyze image using ultra-lightweight OCR system
 * Replacement for heavy Tesseract/DocTR dependencies
 */
export async function analyzeImageLightweight(imageBase64: string): Promise<LightweightOCRResult> {
  return new Promise((resolve, reject) => {
    console.log('Starting ultra-lightweight OCR analysis...');
    
    const child = spawn('python3', ['server/lightweight_ocr.py', imageBase64], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data;
    });
    
    child.stderr.on('data', (data) => {
      stderr += data;
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          console.log(`Lightweight OCR completed: ${result.success ? 'SUCCESS' : 'FAILED'}`);
          
          if (result.success) {
            // Log extraction results for debugging
            console.log(`Extracted text preview: ${result.raw_text?.substring(0, 200)}...`);
            if (result.betA?.bettingHouse && result.betB?.bettingHouse) {
              console.log(`Betting houses detected: ${result.betA.bettingHouse}, ${result.betB.bettingHouse}`);
              console.log(`Odds extracted: ${result.betA.odds}, ${result.betB.odds}`);
              console.log(`Stakes extracted: ${result.betA.stake}, ${result.betB.stake}`);
            }
          } else {
            console.log(`Lightweight OCR error: ${result.error}`);
          }
          
          resolve(result);
        } catch (e) {
          reject(new Error(`Failed to parse lightweight OCR output: ${e instanceof Error ? e.message : String(e)}`));
        }
      } else {
        console.error('Lightweight OCR Python process failed:', stderr);
        reject(new Error(`Lightweight OCR process failed with code ${code}: ${stderr}`));
      }
    });
    
    child.on('error', (err) => {
      console.error('Failed to start lightweight OCR process:', err);
      reject(new Error(`Failed to start lightweight OCR: ${err.message}`));
    });
  });
}

/**
 * Analyze image blocks using lightweight OCR - compatible interface
 * Maintains compatibility with existing code while using new lightweight system
 */
export async function analyzeImageBlocks(imageBase64: string): Promise<{
  success: boolean;
  lines: Array<{ full_text: string; confidence?: number }>;
  total_blocks: number;
  processing_time?: string;
  method: string;
}> {
  try {
    console.log('Analyzing image with lightweight OCR blocks system...');
    
    const result = await analyzeImageLightweight(imageBase64);
    
    if (!result.success) {
      return {
        success: false,
        lines: [],
        total_blocks: 0,
        method: 'lightweight_ocr_blocks_failed',
        processing_time: '0ms'
      };
    }
    
    // Convert lightweight OCR format to blocks format for compatibility
    const lines = result.text_blocks.map(block => ({
      full_text: block.full_text,
      confidence: block.confidence_avg || 0.85
    }));
    
    console.log(`Lightweight OCR blocks extracted: ${lines.length} lines`);
    
    return {
      success: true,
      lines: lines,
      total_blocks: result.text_blocks.length,
      method: 'lightweight_ocr_blocks',
      processing_time: '0ms'
    };
    
  } catch (error) {
    console.error('Lightweight OCR blocks analysis error:', error);
    return {
      success: false,
      lines: [],
      total_blocks: 0,
      method: 'lightweight_ocr_blocks_error',
      processing_time: '0ms'
    };
  }
}

/**
 * Enhanced betting data extraction using lightweight OCR
 * Direct replacement for heavy OCR systems
 */
export async function extractBettingDataLightweight(imageBase64: string): Promise<LightweightOCRResult> {
  try {
    console.log('Starting lightweight betting data extraction...');
    
    const result = await analyzeImageLightweight(imageBase64);
    
    if (result.success) {
      console.log('✅ Lightweight betting extraction completed successfully');
      console.log(`Method: ${result.method}`);
      
      if (result.betA && result.betB) {
        console.log(`🏠 Houses: ${result.betA.bettingHouse} vs ${result.betB.bettingHouse}`);
        console.log(`💰 Odds: ${result.betA.odds} vs ${result.betB.odds}`);
        console.log(`💸 Stakes: ${result.betA.stake} vs ${result.betB.stake}`);
        console.log(`📊 Profit: ${result.totalProfitPercentage}%`);
      }
    } else {
      console.log('❌ Lightweight betting extraction failed:', result.error);
    }
    
    return result;
    
  } catch (error) {
    console.error('Lightweight betting extraction error:', error);
    return {
      success: false,
      method: 'lightweight_betting_extraction_error',
      raw_text: '',
      text_blocks: [],
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Compatibility export for coordinate parser (uses lightweight system)
export async function analyzeImageWithCoordinateParser(imageBase64: string): Promise<LightweightOCRResult> {
  console.log('Using lightweight OCR for coordinate parsing...');
  return extractBettingDataLightweight(imageBase64);
}