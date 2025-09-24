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

  // OCR Analysis endpoint using Coordinate Parser (PRIMARY METHOD)
  app.post('/api/ocr/analyze', async (req, res) => {
    try {
      const { imageBase64 } = req.body;
      
      if (!imageBase64) {
        return res.status(400).json({ error: 'Image data is required' });
      }
      
      // Validate image size (prevent oversized uploads)
      if (imageBase64.length > 4 * 1024 * 1024) { // ~3MB base64 limit
        return res.status(413).json({ error: 'Image too large. Please use a smaller image.' });
      }

      const startTime = Date.now();
      
      try {
        // PRIMARY: Use coordinate-based parser for accurate field mapping
        const { analyzeImageWithCoordinateParser } = await import('./local-ocr');
        const result = await analyzeImageWithCoordinateParser(imageBase64);
        
        const processingTime = Date.now() - startTime;
        console.log(`Coordinate parser processing completed in ${processingTime}ms`);
        
        res.json({
          ...result,
          processingTime: `${processingTime}ms`
        });
      } catch (coordinateError) {
        console.error('Coordinate parser failed, falling back to legacy parser:', coordinateError);
        
        // FALLBACK: Use legacy OCR parser if coordinate parser fails
        const { analyzeSureBetImageLocal } = await import('./local-ocr');
        const fallbackResult = await analyzeSureBetImageLocal(imageBase64);
        
        const processingTime = Date.now() - startTime;
        console.log(`Fallback OCR processing completed in ${processingTime}ms`);
        
        res.json({
          ...fallbackResult,
          processingTime: `${processingTime}ms`,
          note: 'Used fallback parser due to coordinate parser failure'
        });
      }
    } catch (error) {
      console.error('OCR analysis error:', error);
      res.status(500).json({ error: 'Failed to analyze image with OCR' });
    }
  });

  // OCR Blocks Analysis endpoint - extracts text in organized blocks with positions
  app.post('/api/ocr/blocks', async (req, res) => {
    try {
      const { imageBase64 } = req.body;
      
      if (!imageBase64) {
        return res.status(400).json({ error: 'Image data is required' });
      }
      
      // Validate image size (prevent oversized uploads)
      if (imageBase64.length > 4 * 1024 * 1024) { // ~3MB base64 limit
        return res.status(413).json({ error: 'Image too large. Please use a smaller image.' });
      }

      const startTime = Date.now();
      
      // Import and use blocks OCR function
      const { analyzeImageBlocks } = await import('./local-ocr');
      const result = await analyzeImageBlocks(imageBase64);
      
      const processingTime = Date.now() - startTime;
      console.log(`Tesseract OCR blocks processing completed in ${processingTime}ms`);
      
      res.json({
        ...result,
        processingTime: `${processingTime}ms`
      });
    } catch (error) {
      console.error('Tesseract OCR blocks analysis error:', error);
      res.status(500).json({ error: 'Failed to analyze image blocks with Tesseract OCR' });
    }
  });

  // OCR Analysis with Coordinate Parser - uses coordinate-based mapping for accurate field extraction
  app.post('/api/ocr/coordinate', async (req, res) => {
    try {
      const { imageBase64 } = req.body;
      
      if (!imageBase64) {
        return res.status(400).json({ error: 'Image data is required' });
      }
      
      // Validate image size (prevent oversized uploads)
      if (imageBase64.length > 4 * 1024 * 1024) { // ~3MB base64 limit
        return res.status(413).json({ error: 'Image too large. Please use a smaller image.' });
      }

      const startTime = Date.now();
      
      // Import and use coordinate parser function
      const { analyzeImageWithCoordinateParser } = await import('./local-ocr');
      const result = await analyzeImageWithCoordinateParser(imageBase64);
      
      const processingTime = Date.now() - startTime;
      console.log(`Coordinate parser processing completed in ${processingTime}ms`);
      
      res.json({
        ...result,
        processingTime: `${processingTime}ms`
      });
    } catch (error) {
      console.error('Coordinate parser analysis error:', error);
      res.status(500).json({ error: 'Failed to analyze image with coordinate parser' });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
