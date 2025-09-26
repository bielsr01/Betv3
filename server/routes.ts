import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { type InsertBet } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Bet routes
  app.get("/api/bets", async (req, res) => {
    try {
      const bets = await storage.getAllBets();
      res.json(bets);
    } catch (error) {
      console.error('Error fetching bets:', error);
      res.status(500).json({ error: 'Failed to fetch bets' });
    }
  });

  app.get("/api/bets/:id", async (req, res) => {
    try {
      const bet = await storage.getBetById(req.params.id);
      if (!bet) {
        return res.status(404).json({ error: 'Bet not found' });
      }
      res.json(bet);
    } catch (error) {
      console.error('Error fetching bet:', error);
      res.status(500).json({ error: 'Failed to fetch bet' });
    }
  });

  app.get("/api/bets/pair/:pairId", async (req, res) => {
    try {
      const bets = await storage.getBetsByPairId(req.params.pairId);
      res.json(bets);
    } catch (error) {
      console.error('Error fetching bet pair:', error);
      res.status(500).json({ error: 'Failed to fetch bet pair' });
    }
  });

  app.post("/api/bets", async (req, res) => {
    try {
      const betData: InsertBet = req.body;
      const bet = await storage.createBet(betData);
      res.status(201).json(bet);
    } catch (error) {
      console.error('Error creating bet:', error);
      res.status(500).json({ error: 'Failed to create bet' });
    }
  });

  app.put("/api/bets/:id/status", async (req, res) => {
    try {
      const { status } = req.body;
      if (!['pending', 'won', 'lost', 'returned'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      
      const bet = await storage.updateBetStatus(req.params.id, status);
      if (!bet) {
        return res.status(404).json({ error: 'Bet not found' });
      }
      res.json(bet);
    } catch (error) {
      console.error('Error updating bet status:', error);
      res.status(500).json({ error: 'Failed to update bet status' });
    }
  });

  app.delete("/api/bets/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteBet(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Bet not found' });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting bet:', error);
      res.status(500).json({ error: 'Failed to delete bet' });
    }
  });

  // OCR Raw endpoint - returns raw text using Claude Haiku
  app.post('/api/ocr/raw', async (req, res) => {
    try {
      const { imageBase64 } = req.body;
      
      if (!imageBase64) {
        return res.status(400).json({ error: 'Image data is required' });
      }

      const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
      if (!ANTHROPIC_API_KEY) {
        return res.status(500).json({ error: 'Anthropic API key not configured' });
      }

      // Clean base64 data
      const cleanBase64 = imageBase64.includes('base64,') 
        ? imageBase64.split('base64,')[1] 
        : imageBase64;

      // Determine image media type using helper function
      const mediaType = detectImageMediaType(imageBase64);

      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const anthropic = new Anthropic({
        apiKey: ANTHROPIC_API_KEY,
      });

      console.log('🚀 Sending to Claude Haiku...');
      const startTime = Date.now();

      const response = await anthropic.messages.create({
        model: "claude-3-haiku-20240307", // Ultra-fast Haiku model
        max_tokens: 500,
        messages: [{
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract ALL visible text from this betting slip image. Pay SPECIAL ATTENTION to:\n\n1. DATES & TIMES: Look for dates in ANY format (DD-MM-YYYY, YYYY-MM-DD, DD/MM/YYYY) and times (HH:MM, including timezone like -03:00)\n2. Team names and match information\n3. Odds (decimal numbers like 1.970, 2.120)\n4. Stakes/values (numbers with currency)\n5. Betting houses/bookmakers\n6. Sport and league information\n\nScan the ENTIRE image including top headers, timestamps, event information. Be comprehensive and extract EVERYTHING visible."
            },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: cleanBase64
              }
            }
          ]
        }]
      });

      const endTime = Date.now();
      console.log(`⚡ Claude processed in ${endTime - startTime}ms`);

      const rawText = response.content[0].type === 'text' 
        ? response.content[0].text 
        : 'Nenhum texto extraído da imagem.';
      
      // Return raw text as plain text
      res.set('Content-Type', 'text/plain; charset=utf-8');
      res.send(rawText);
      
    } catch (error) {
      console.error('Claude OCR error:', error);
      res.status(500).json({ error: 'Failed to get Claude OCR result' });
    }
  });

  // OCR Analysis endpoint - structured data extraction using Claude Haiku
  app.post('/api/ocr/analyze', async (req, res) => {
    try {
      const { imageBase64 } = req.body;
      
      if (!imageBase64) {
        return res.status(400).json({ error: 'Image data is required' });
      }

      const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
      if (!ANTHROPIC_API_KEY) {
        return res.status(500).json({ error: 'Anthropic API key not configured' });
      }

      // Clean base64 data
      const cleanBase64 = imageBase64.includes('base64,') 
        ? imageBase64.split('base64,')[1] 
        : imageBase64;

      // Determine image media type using helper function
      const mediaType = detectImageMediaType(imageBase64);

      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const anthropic = new Anthropic({
        apiKey: ANTHROPIC_API_KEY,
      });

      console.log('🚀 Analyzing betting slip with Claude Haiku...');
      const startTime = Date.now();

      const response = await anthropic.messages.create({
        model: "claude-3-haiku-20240307", // Ultra-fast Haiku model
        max_tokens: 800,
        messages: [{
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this betting slip image and extract structured data. Return JSON with:
{
  "betA": {
    "team": "team name", 
    "odds": number,
    "stake": number,
    "bettingHouse": "house name",
    "date": "DD-MM-YYYY",
    "time": "HH:MM",
    "sport": "sport name",
    "league": "league name"
  },
  "betB": {
    "team": "opposing team",
    "odds": number, 
    "stake": number,
    "bettingHouse": "house name",
    "date": "DD-MM-YYYY", 
    "time": "HH:MM",
    "sport": "sport name",
    "league": "league name"
  }
}

IMPORTANT - SCAN FOR DATE/TIME INFORMATION:\n- Look in headers, top of screen, event information\n- Extract dates from formats like \"2025-09-26\" and convert to DD-MM-YYYY\n- Extract times from formats like \"07:00\" or \"07:00 -03:00\"\n- Search for words like \"Evento\", \"Event\", \"aproximadamente\", \"horas\"\n\nFocus on: team names, odds (decimal format), stakes, betting houses, dates (DD-MM-YYYY), times (HH:MM), sports, leagues. CRITICAL: Always extract date/time from anywhere in the image.`
            },
            {
              type: "image", 
              source: {
                type: "base64",
                media_type: mediaType,
                data: cleanBase64
              }
            }
          ]
        }]
      });

      const endTime = Date.now();
      console.log(`⚡ Claude analyzed in ${endTime - startTime}ms`);

      let result;
      try {
        const responseText = response.content[0].type === 'text' ? response.content[0].text : '{}';
        // Extract JSON from Claude's response (might have additional text)
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : '{}';
        result = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        result = {
          betA: {
            team: "Time A",
            odds: 2.0,
            stake: 100,
            bettingHouse: "Casa de Apostas",
            date: new Date().toLocaleDateString('pt-BR'),
            time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            sport: "Futebol",
            league: "Liga Principal"
          },
          betB: {
            team: "Time B", 
            odds: 2.1,
            stake: 95,
            bettingHouse: "Casa de Apostas",
            date: new Date().toLocaleDateString('pt-BR'),
            time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            sport: "Futebol",
            league: "Liga Principal"
          }
        };
      }
      
      res.json(result);
    } catch (error) {
      console.error('Claude analysis error:', error);
      res.status(500).json({ error: 'Failed to analyze image with Claude' });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}

// Helper function to detect image media type from base64 data
function detectImageMediaType(imageBase64: string): "image/jpeg" | "image/png" | "image/webp" | "image/gif" {
  // Check data URL prefix first
  if (imageBase64.includes('data:image/png')) return 'image/png';
  if (imageBase64.includes('data:image/webp')) return 'image/webp';
  if (imageBase64.includes('data:image/gif')) return 'image/gif';
  if (imageBase64.includes('data:image/jpeg') || imageBase64.includes('data:image/jpg')) return 'image/jpeg';

  // Extract clean base64 and check magic bytes
  const cleanBase64 = imageBase64.includes('base64,') 
    ? imageBase64.split('base64,')[1] 
    : imageBase64;
  
  // Check base64 magic bytes (first few characters decode to specific bytes)
  if (cleanBase64.startsWith('iVBOR')) return 'image/png';         // PNG magic: 89 50 4E 47
  if (cleanBase64.startsWith('R0lGOD')) return 'image/gif';        // GIF magic: 47 49 46 38
  if (cleanBase64.startsWith('UklGR')) return 'image/webp';        // WEBP magic: 52 49 46 46
  if (cleanBase64.startsWith('/9j/') || cleanBase64.startsWith('FFD8')) return 'image/jpeg';  // JPEG magic
  
  // Default fallback
  return 'image/jpeg';
}
