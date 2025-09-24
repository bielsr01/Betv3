import { GoogleGenAI } from "@google/genai";

// Using the Gemini integration for OCR/Vision analysis
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface BetData {
  bettingHouse: string;
  teamA: string;
  teamB: string;
  betType: string;
  odds: string;
  stake: string;
  profit: string;
}

export interface SureBetOCRResult {
  betA: BetData;
  betB: BetData;
  gameDate: string;
  gameTime: string;
  sport: string;
  league: string;
  totalProfitPercentage: string;
}

export async function analyzeSureBetImage(imageBase64: string): Promise<SureBetOCRResult> {
  try {
    const prompt = `Analyze this SureBet calculator screenshot and extract the betting information in JSON format.

Extract ONLY the essential betting data from this SureBet screenshot:
- Teams playing
- Each betting line: house, bet type, odds, stake (USD amount), profit (rightmost number)
- Sport/league, profit percentage

Return CONCISE JSON:
{
  "betA": {
    "bettingHouse": "house name",
    "teamA": "team 1 name", 
    "teamB": "team 2 name",
    "betType": "bet description",
    "odds": "decimal odds",
    "stake": "stake amount",
    "profit": "profit amount"
  },
  "betB": {
    "bettingHouse": "house name",
    "teamA": "team 1 name",
    "teamB": "team 2 name", 
    "betType": "bet description",
    "odds": "decimal odds",
    "stake": "stake amount",
    "profit": "profit amount"
  },
  "gameDate": "YYYY-MM-DD",
  "gameTime": "HH:MM",
  "sport": "sport name",
  "league": "league name",
  "totalProfitPercentage": "percentage"
}

Important:
- Extract exact values from the image
- For Portuguese text, keep as is (don't translate)
- Use decimal format for numbers (e.g., "1.85" not "1,85")
- If any field cannot be determined, use empty string ""
- Stakes should be the values after [E in the USD column
- Profit should be the rightmost values (Lucro column)`;

    const contents = [
      {
        inlineData: {
          data: imageBase64,
          mimeType: "image/jpeg",
        },
      },
      prompt,
    ];

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", // Much faster than pro
      config: {
        responseMimeType: "application/json",
        temperature: 0, // More deterministic/faster
      },
      contents: contents,
    });

    const rawJson = response.text;
    console.log("Gemini OCR Response:", rawJson);

    if (rawJson) {
      const parsedData: SureBetOCRResult = JSON.parse(rawJson);
      return parsedData;
    } else {
      throw new Error("Empty response from Gemini");
    }
  } catch (error) {
    console.error("Gemini OCR Error:", error);
    
    // More specific error handling
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        throw new Error('Chave API do Gemini inválida. Verifique a configuração.');
      } else if (error.message.includes('quota')) {
        throw new Error('Limite de uso da API Gemini excedido. Tente novamente mais tarde.');
      } else if (error.message.includes('JSON')) {
        throw new Error('Erro ao processar resposta da IA. A imagem pode estar corrompida.');
      }
    }
    
    throw new Error(`Falha ao analisar imagem SureBet: ${error}`);
  }
}