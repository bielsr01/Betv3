import { GoogleGenAI } from "@google/genai";

// GEMINI AI OCR SYSTEM: Advanced multimodal AI-powered OCR
// Replaces DocTR/Tesseract with Google's state-of-the-art AI
// Superior accuracy and no disk space limitations
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

interface BetData {
  bettingHouse?: string;
  teamA?: string;
  teamB?: string;
  odds?: number;
  stake?: number;
  payout?: number;
  betType?: string;
  market?: string;
}

interface OCRResult {
  success: boolean;
  method: string;
  betA: BetData;
  betB: BetData;
  totalProfitPercentage?: number;
  processing_info: {
    model: string;
    timestamp: string;
    processing_time_ms: number;
  };
  error?: string;
}

export class GeminiAIOCR {
  /**
   * Extract betting data from Portuguese SureBet calculator screenshots
   * using Gemini's advanced multimodal AI capabilities
   */
  async extractBettingData(imageBase64: string): Promise<OCRResult> {
    const startTime = Date.now();
    
    try {
      console.log('🤖 Gemini AI OCR: Processing betting slip with multimodal AI...');
      
      const systemPrompt = `You are an expert at analyzing Portuguese sports betting screenshots from SureBet calculators. 

CRITICAL: Extract ALL betting information with maximum accuracy from this Portuguese betting calculator screenshot.

BETTING HOUSES TO RECOGNIZE (15+ major houses):
- KTO, Pinnacle, BravoBet, Blaze, Bet365, Betfair, Betano, Sportingbet
- Casa de Apostas, Bodog, 1xBet, Betway, Rivalo, Dafabet, 22Bet
- And any other betting house names visible

EXTRACT THESE FIELDS FOR EACH BET (A and B):
- bettingHouse: Name of the betting platform
- teamA: First team name  
- teamB: Second team name
- odds: Decimal odds (e.g., 2.50, 1.85)
- stake: Stake amount in currency
- payout: Expected payout amount
- betType: Type of bet (e.g., "1X2", "Over/Under", "Both Teams Score")
- market: Specific market (e.g., "Match Result", "Total Goals")

PROFIT CALCULATION:
- Calculate totalProfitPercentage from the visible profit information
- Look for "Lucro" or "Profit" percentages in the calculator

PORTUGUESE TEXT RECOGNITION:
- Handle Portuguese characters correctly (ã, ç, ê, etc.)
- Common Portuguese betting terms: "Casa de Apostas", "Odds", "Stake", "Lucro"
- Team names may be in Portuguese or original language

OUTPUT FORMAT: Return valid JSON only:
{
  "success": true,
  "method": "gemini_ai_multimodal_ocr",
  "betA": {
    "bettingHouse": "string",
    "teamA": "string", 
    "teamB": "string",
    "odds": number,
    "stake": number,
    "payout": number,
    "betType": "string",
    "market": "string"
  },
  "betB": {
    "bettingHouse": "string",
    "teamA": "string",
    "teamB": "string", 
    "odds": number,
    "stake": number,
    "payout": number,
    "betType": "string",
    "market": "string"
  },
  "totalProfitPercentage": number
}

If extraction fails, return: {"success": false, "error": "description"}`;

      const contents = [
        {
          inlineData: {
            data: imageBase64,
            mimeType: "image/png"
          }
        },
        systemPrompt
      ];

      const response = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents: contents,
        config: {
          responseMimeType: "application/json"
        }
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("Empty response from Gemini AI");
      }

      console.log('🎯 Gemini AI OCR: Raw response received');
      
      // Parse Gemini AI response
      let extractedData;
      try {
        extractedData = JSON.parse(responseText);
      } catch (parseError) {
        console.error('❌ JSON parse error:', parseError);
        throw new Error(`Failed to parse Gemini AI response: ${parseError}`);
      }

      const processingTime = Date.now() - startTime;

      // Build comprehensive result
      const result: OCRResult = {
        success: true,
        method: "gemini_ai_multimodal_ocr",
        betA: extractedData.betA || {},
        betB: extractedData.betB || {},
        totalProfitPercentage: extractedData.totalProfitPercentage,
        processing_info: {
          model: "gemini-2.5-pro",
          timestamp: new Date().toISOString(),
          processing_time_ms: processingTime
        }
      };

      console.log(`✅ Gemini AI OCR completed in ${processingTime}ms`);
      console.log(`🎯 Extracted data: BetA=${result.betA?.bettingHouse || 'N/A'}, BetB=${result.betB?.bettingHouse || 'N/A'}`);

      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error('❌ Gemini AI OCR error:', error);

      return {
        success: false,
        method: "gemini_ai_multimodal_ocr_error",
        betA: {},
        betB: {},
        processing_info: {
          model: "gemini-2.5-pro", 
          timestamp: new Date().toISOString(),
          processing_time_ms: processingTime
        },
        error: error instanceof Error ? error.message : 'Unknown Gemini AI error'
      };
    }
  }
}