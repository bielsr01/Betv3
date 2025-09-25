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
        // PURE EXTRACTION: Use working OCR blocks for simple text reading  
        console.log('Starting pure text extraction...');
        const { analyzeImageBlocks } = await import('./local-ocr');
        const blocksResult = await analyzeImageBlocks(imageBase64);
        
        const processingTime = Date.now() - startTime;
        console.log(`Pure text extraction completed in ${processingTime}ms`);
        
        // Extract all text from lines (correct structure)
        const allText = blocksResult.lines ? 
          blocksResult.lines.map(line => line.full_text || '').filter(text => text.trim()).join(' ') : '';
        
        // Extract betting data automatically from text
        const betData = extractBettingData(allText, blocksResult.lines || []);
        
        // Create result with automatically filled fields
        const simpleResult = {
          success: true,
          method: 'automatic_extraction',
          raw_text: allText,
          text_blocks: blocksResult.lines || [],
          total_blocks: blocksResult.total_blocks || 0,
          
          // Automatically filled fields from extracted data
          betA: betData.betA,
          betB: betData.betB,
          gameDate: betData.gameDate,
          gameTime: betData.gameTime,
          sport: betData.sport,
          league: betData.league,
          totalProfitPercentage: betData.totalProfitPercentage
        };
        
        // Add automatic extraction function before the route handler
        function extractBettingData(fullText: string, lines: any[]) {
          let betA = { bettingHouse: '', teamA: '', teamB: '', betType: '', odds: '', stake: '', payout: '', selectedSide: 'A' };
          let betB = { bettingHouse: '', teamA: '', teamB: '', betType: '', odds: '', stake: '', payout: '', selectedSide: 'B' };
          let gameDate = '', gameTime = '', sport = 'Futebol', league = '', totalProfitPercentage = '';
          
          // Look for betting houses and data in lines
          lines.forEach(line => {
            const text = line.full_text || '';
            
            // Extract Pinnacle data
            if (text.includes('Pinnacle')) {
              const pinnacleMatch = text.match(/Pinnacle.*?([\d.]+).*?([\d.]+)/);
              if (pinnacleMatch) {
                betB.bettingHouse = 'Pinnacle';
                betB.odds = pinnacleMatch[1];
                betB.stake = pinnacleMatch[2];
                
                // Extract bet type
                if (text.includes('H2(0)')) betB.betType = 'H2(0) 1º período';
                else if (text.includes('H1')) betB.betType = 'H1';
                else if (text.includes('DNB')) betB.betType = 'DNB';
              }
            }
            
            // Extract KTO data
            if (text.includes('KTO') || text.includes('kto')) {
              const ktoMatch = text.match(/([\d.]+).*?([\d.]+)/);
              if (ktoMatch) {
                betA.bettingHouse = 'KTO';
                betA.odds = ktoMatch[1];
                betA.stake = ktoMatch[2];
                
                // Extract bet type
                if (text.includes('1/')) betA.betType = '1/ DNB 1º período';
                else if (text.includes('DNB')) betA.betType = 'DNB';
              }
            }
            
            // Extract teams
            if (text.includes('—') || text.includes('-')) {
              const teamMatch = text.match(/([\w\s-]+)\s*[—-]\s*([\w\s-]+)/);
              if (teamMatch) {
                betA.teamA = teamMatch[1].trim();
                betA.teamB = teamMatch[2].trim();
                betB.teamA = teamMatch[1].trim();
                betB.teamB = teamMatch[2].trim();
              }
            }
            
            // Extract total profit
            if (text.includes('%') || text.includes('total')) {
              const profitMatch = text.match(/([\d.]+)%/);
              if (profitMatch) {
                totalProfitPercentage = profitMatch[1];
              }
            }
            
            // Extract date
            if (text.match(/\d{4}-\d{2}-\d{2}/) || text.match(/\d{2}\/\d{2}/)) {
              const dateMatch = text.match(/(\d{4}-\d{2}-\d{2})|(\d{2}\/\d{2}\/\d{4})/);
              if (dateMatch) {
                gameDate = dateMatch[0];
              }
            }
          });
          
          // Calculate payouts if missing
          if (betA.odds && betA.stake && !betA.payout) {
            betA.payout = (parseFloat(betA.odds) * parseFloat(betA.stake)).toFixed(2);
          }
          if (betB.odds && betB.stake && !betB.payout) {
            betB.payout = (parseFloat(betB.odds) * parseFloat(betB.stake)).toFixed(2);
          }
          
          // Set default date if none found
          if (!gameDate) {
            const today = new Date();
            gameDate = today.toISOString().split('T')[0];
          }
          
          return { betA, betB, gameDate, gameTime, sport, league, totalProfitPercentage };
        }
        
        console.log('DEBUG: AUTOMATIC_EXTRACTION_SUCCESS', JSON.stringify({
          method: 'automatic_extraction',
          total_blocks: simpleResult.total_blocks,
          text_preview: allText.substring(0, 150),
          betA_house: simpleResult.betA.bettingHouse,
          betB_house: simpleResult.betB.bettingHouse,
          betA_odds: simpleResult.betA.odds,
          betB_odds: simpleResult.betB.odds,
          processing_time_ms: processingTime,
          timestamp: new Date().toISOString()
        }));
        
        res.json({
          ...simpleResult,
          processingTime: `${processingTime}ms`
        });
        
      } catch (extractionError: any) {
        console.error('ERROR: Pure text extraction failed');
        
        console.log('DEBUG: EXTRACTION_FAILED', JSON.stringify({
          method: 'pure_text_extraction',
          error_message: extractionError?.message || 'Unknown error',
          processing_time_ms: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }));
        
        throw new Error(`Pure text extraction failed: ${extractionError?.message || 'Unknown error'}`);
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
