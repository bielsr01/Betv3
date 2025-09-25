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

  // OCR Analysis endpoint using PaddleOCR with table detection
  app.post('/api/ocr/analyze', async (req, res) => {
    try {
      const { imageBase64 } = req.body;
      
      if (!imageBase64) {
        return res.status(400).json({ error: 'Image data is required' });
      }

      // Import and use PaddleOCR function with table detection
      const { analyzeSureBetImagePaddle } = await import('./paddle-ocr');
      const result = await analyzeSureBetImagePaddle(imageBase64);
      
      res.json(result);
    } catch (error) {
      console.error('PaddleOCR analysis error:', error);
      res.status(500).json({ error: 'Failed to analyze image with PaddleOCR' });
    }
  });

  // OCR Raw endpoint - returns raw text using Perplexity AI
  app.post('/api/ocr/raw', async (req, res) => {
    try {
      const { imageBase64 } = req.body;
      
      if (!imageBase64) {
        return res.status(400).json({ error: 'Image data is required' });
      }

      const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
      if (!PERPLEXITY_API_KEY) {
        return res.status(500).json({ error: 'Perplexity API key not configured' });
      }

      // Call Perplexity API with proper image format
      const cleanBase64 = imageBase64.includes('base64,') 
        ? imageBase64.split('base64,')[1] 
        : imageBase64;

      const payload = {
        model: "sonar-pro",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract text from image. Be fast."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/png;base64,${cleanBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 300,
        temperature: 0.5
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Perplexity API error details:', errorText);
        throw new Error(`Perplexity API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      
      // Extract the raw text content
      let rawText = 'Nenhum texto extraído da imagem.';
      if (result.choices && result.choices[0] && result.choices[0].message) {
        rawText = result.choices[0].message.content;
      }
      
      // Return raw text as plain text
      res.set('Content-Type', 'text/plain; charset=utf-8');
      res.send(rawText);
      
    } catch (error) {
      console.error('Perplexity raw analysis error:', error);
      res.status(500).json({ error: 'Failed to get raw Perplexity result' });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
