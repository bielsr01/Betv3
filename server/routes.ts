import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { type InsertBet } from "@shared/schema";
import { GeminiAIOCR } from "./gemini_ai_ocr";

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

  app.patch("/api/bets/:id/status", async (req, res) => {
    try {
      const { status } = req.body;
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

  // GEMINI AI OCR ENDPOINT: Advanced multimodal AI-powered OCR
  // Superior to DocTR/Tesseract with Google's state-of-the-art AI  
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
        // PRIMARY: DOCTR AI SYSTEM as requested by user
        // DocTR with PyTorch backend (user explicitly requested this over Tesseract)
        console.log('🤖 Starting DocTR AI OCR system (PyTorch + AI models) as requested...');
        
        try {
          // Try DocTR first (user preference) with timeout
          const { spawn } = await import('child_process');
          const doctrResult = await new Promise((resolve, reject) => {
            const child = spawn('python3', ['server/doctr_ai_ocr.py'], {
              stdio: ['pipe', 'pipe', 'pipe']
            });
            
            // Timeout after 60 seconds
            const timeout = setTimeout(() => {
              child.kill('SIGTERM');
              reject(new Error('DocTR AI timeout after 60 seconds'));
            }, 60000);
            
            let stdout = '';
            let stderr = '';
            
            child.stdout.on('data', (data) => stdout += data);
            child.stderr.on('data', (data) => stderr += data);
            
            child.on('close', (code) => {
              clearTimeout(timeout);
              if (code === 0) {
                try {
                  const result = JSON.parse(stdout.trim());
                  resolve(result);
                } catch (e: any) {
                  reject(new Error(`Failed to parse DocTR AI output: ${e.message}. Output: ${stdout.substring(0, 200)}`));
                }
              } else {
                reject(new Error(`DocTR AI failed with code ${code}: ${stderr}`));
              }
            });
            
            child.on('error', (err: any) => {
              clearTimeout(timeout);
              reject(err);
            });
            
            // Send base64 data via stdin
            child.stdin.write(imageBase64);
            child.stdin.end();
          });

          const processingTime = Date.now() - startTime;
          console.log(`✅ DocTR AI OCR completed in ${processingTime}ms`);

          if ((doctrResult as any).success) {
            console.log('🎉 SUCCESS: DocTR AI extraction succeeded (user preferred method)');
            console.log('DEBUG: DOCTR_AI_SUCCESS', JSON.stringify({
              method: (doctrResult as any).method,
              betA_house: (doctrResult as any).betA?.bettingHouse,
              betB_house: (doctrResult as any).betB?.bettingHouse,
              profit: (doctrResult as any).totalProfitPercentage,
              processing_time_ms: processingTime,
              timestamp: new Date().toISOString()
            }));
            
            res.json(doctrResult as any);
            return;
          }
        } catch (doctrError: any) {
          console.log('⚠️ DocTR AI unavailable, falling back to Gemini AI...');
          console.log('DocTR error:', doctrError.message);
        }
        
        // FALLBACK: GEMINI AI SYSTEM (when DocTR is not available)
        // This respects user preference for DocTR while providing working alternative
        console.log('🔄 Falling back to Gemini AI OCR system...');
        
        const geminiOCR = new GeminiAIOCR();
        const geminiResult = await geminiOCR.extractBettingData(imageBase64);
        
        const processingTime = Date.now() - startTime;
        console.log(`✅ Gemini AI fallback completed in ${processingTime}ms`);
        
        if (geminiResult.success) {
          console.log('🎉 SUCCESS: Gemini AI fallback extraction succeeded');
          console.log('DEBUG: GEMINI_FALLBACK_SUCCESS', JSON.stringify({
            method: `${geminiResult.method}_fallback`,
            betA_house: geminiResult.betA?.bettingHouse,
            betB_house: geminiResult.betB?.bettingHouse,
            profit: geminiResult.totalProfitPercentage,
            processing_time_ms: processingTime,
            timestamp: new Date().toISOString()
          }));
          
          res.json({...geminiResult, method: `${geminiResult.method}_fallback`});
          return;
        } else {
          console.log('❌ ERROR: Both DocTR AI and Gemini AI failed');
          throw new Error(`All OCR systems failed. DocTR: unavailable, Gemini: ${geminiResult.error}`);
        }
        
      } catch (error) {
        console.error('OCR analysis error:', error);
        res.status(500).json({ error: 'Failed to analyze image with OCR' });
      }
    } catch (outerError) {
      console.error('OCR endpoint error:', outerError);
      res.status(500).json({ error: 'Failed to process OCR request' });
    }
  });
  
  // Server startup
  const server = createServer(app);
  return server;
}