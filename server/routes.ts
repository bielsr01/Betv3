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

  // DOCTR AI OCR ENDPOINT: AI-powered OCR with PyTorch backend
  // User explicitly requested DocTR over Tesseract alternatives
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
        // DOCTR AI SYSTEM - User's explicit preference
        console.log('🤖 Starting DocTR AI OCR system (PyTorch + AI models)...');
        
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
            
            // PRIORITIZE STDOUT PARSING OVER EXIT CODE
            // Python script outputs valid JSON to stdout even when dependencies have warnings
            try {
              if (stdout.trim()) {
                const result = JSON.parse(stdout.trim());
                // If we got valid JSON, that's success regardless of exit code
                console.log(`📊 Got valid JSON from DocTR (exit code ${code})`);
                resolve(result);
                return;
              }
            } catch (parseError) {
              console.log(`❌ JSON parse failed: ${parseError}. Stdout: ${stdout.substring(0, 100)}`);
            }
            
            // Only reject if no valid JSON was found AND exit code indicates failure
            reject(new Error(`DocTR AI failed - no valid output. Code: ${code}, Stderr: ${stderr.substring(0, 300)}`));
          });
          
          child.on('error', (err: any) => {
            clearTimeout(timeout);
            reject(err);
          });
          
          // Send JSON data to Python script
          child.stdin.write(JSON.stringify({ imageBase64 }));
          child.stdin.end();
        });

        const processingTime = Date.now() - startTime;
        console.log(`✅ DocTR AI OCR completed in ${processingTime}ms`);

        if ((doctrResult as any).success) {
          console.log('🎉 SUCCESS: DocTR AI extraction succeeded');
          console.log('DEBUG: DOCTR_AI_SUCCESS', JSON.stringify({
            method: (doctrResult as any).method,
            betA_house: (doctrResult as any).betA?.bettingHouse,
            betB_house: (doctrResult as any).betB?.bettingHouse,
            profit: (doctrResult as any).totalProfitPercentage,
            processing_time_ms: processingTime,
            timestamp: new Date().toISOString()
          }));
        } else {
          console.log('⚠️ DocTR AI could not extract data (this is normal for unclear images)');
          console.log('DEBUG: DOCTR_AI_NO_DATA', JSON.stringify({
            method: (doctrResult as any).method,
            error: (doctrResult as any).error,
            processing_time_ms: processingTime,
            timestamp: new Date().toISOString()
          }));
        }
        
        // Always return the DocTR result, whether success or failure
        res.json(doctrResult as any);
        return;
        
      } catch (error: any) {
        console.error('DocTR AI OCR error:', error);
        res.status(500).json({ 
          error: 'DocTR AI OCR failed', 
          details: error.message 
        });
      }
    } catch (outerError: any) {
      console.error('OCR endpoint error:', outerError);
      res.status(500).json({ error: 'Failed to process OCR request' });
    }
  });
  
  // Server startup
  const server = createServer(app);
  return server;
}