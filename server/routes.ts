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

  // OCR Raw endpoint - returns unprocessed Mistral OCR text
  app.post('/api/ocr/raw', async (req, res) => {
    try {
      const { imageBase64 } = req.body;
      
      if (!imageBase64) {
        return res.status(400).json({ error: 'Image data is required' });
      }

      const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
      if (!MISTRAL_API_KEY) {
        return res.status(500).json({ error: 'Mistral API key not configured' });
      }

      // Clean base64 string
      const cleanBase64 = imageBase64.includes('base64,') 
        ? imageBase64.split('base64,')[1] 
        : imageBase64;

      // Call Mistral OCR API directly for raw text
      const payload = {
        model: "mistral-ocr-latest",
        document: {
          type: "image_url",
          image_url: `data:image/png;base64,${cleanBase64}`
        },
        include_image_base64: false
      };

      const response = await fetch('https://api.mistral.ai/v1/ocr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MISTRAL_API_KEY}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Mistral OCR API error: ${response.status}`);
      }

      const ocrResult = await response.json();
      
      // Extract raw text without formatting
      let rawText = '';
      if (ocrResult.pages && ocrResult.pages.length > 0) {
        // Get markdown content and convert to plain text
        const markdown = ocrResult.pages[0].markdown || '';
        
        // Remove markdown formatting to get clean text
        rawText = markdown
          .replace(/#{1,6}\s+/g, '') // Remove headers
          .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
          .replace(/\*([^*]+)\*/g, '$1') // Remove italic
          .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Remove links
          .replace(/\|/g, ' ') // Remove table separators
          .replace(/---+/g, '') // Remove horizontal rules
          .replace(/^\s*[\-\*\+]\s+/gm, '') // Remove list bullets
          .replace(/^\s*\d+\.\s+/gm, '') // Remove numbered lists
          .replace(/\n{3,}/g, '\n\n') // Normalize line breaks
          .trim();
      }
      
      // If no text extracted, show raw response
      if (!rawText) {
        rawText = `Nenhum texto extraído.\n\nResposta completa da API:\n${JSON.stringify(ocrResult, null, 2)}`;
      }
      
      // Return clean text as plain text
      res.set('Content-Type', 'text/plain; charset=utf-8');
      res.send(rawText);
      
    } catch (error) {
      console.error('Mistral OCR raw analysis error:', error);
      res.status(500).json({ error: 'Failed to get raw Mistral OCR result' });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
