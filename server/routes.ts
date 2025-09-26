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

      // Determine image media type
      let mediaType = 'image/jpeg';
      if (imageBase64.includes('data:image/png')) mediaType = 'image/png';
      else if (imageBase64.includes('data:image/webp')) mediaType = 'image/webp';

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
              text: "Extract ALL visible text from this image. Focus on numbers, names, odds, dates, and any betting information. Be comprehensive and fast."
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

      // Determine image media type
      let mediaType = 'image/jpeg';
      if (imageBase64.includes('data:image/png')) mediaType = 'image/png';
      else if (imageBase64.includes('data:image/webp')) mediaType = 'image/webp';

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

Focus on: team names, odds (decimal format), stakes, betting houses, dates (DD-MM-YYYY), times (HH:MM), sports, leagues. If info is missing, use reasonable defaults.`
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
