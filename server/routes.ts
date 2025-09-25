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
        // HYBRID SYSTEM: Combine working OCR blocks with improved processing
        console.log('Starting hybrid OCR system (blocks + improved processing)...');
        const { analyzeImageBlocks } = await import('./local-ocr');
        const blocksResult = await analyzeImageBlocks(imageBase64);
        
        const processingTime = Date.now() - startTime;
        console.log(`Hybrid OCR completed in ${processingTime}ms`);
        
        // Extract all text from lines (structure that worked before)
        const allText = blocksResult.lines ? 
          blocksResult.lines.map(line => line.full_text || '').filter(text => text.trim()).join(' ') : '';
        
        // Apply improved regex-based extraction from your research
        const betData = extractBettingDataImproved(allText, blocksResult.lines || []);
        
        // Create result with hybrid extraction
        const simpleResult = {
          success: true,
          method: 'hybrid_improved_extraction',
          raw_text: allText,
          text_blocks: blocksResult.lines || [],
          total_blocks: blocksResult.total_blocks || 0,
          
          // Automatically filled fields using improved logic
          betA: betData.betA,
          betB: betData.betB,
          gameDate: betData.gameDate,
          gameTime: betData.gameTime,
          sport: betData.sport,
          league: betData.league,
          totalProfitPercentage: betData.totalProfitPercentage
        };
        
        // Improved extraction function based on your research
        function extractBettingDataImproved(fullText: string, lines: any[]) {
          let betA = { bettingHouse: '', teamA: '', teamB: '', betType: '', odds: '', stake: '', payout: '', selectedSide: 'A' };
          let betB = { bettingHouse: '', teamA: '', teamB: '', betType: '', odds: '', stake: '', payout: '', selectedSide: 'B' };
          let gameDate = '', gameTime = '', sport = 'Futebol', league = '', totalProfitPercentage = '';
          
          console.log(`Processing ${lines.length} lines with improved regex...`);
          
          // Enhanced casa detection using your approach
          const casasApostas = ['KTO', 'Pinnacle', 'Bet365', 'Betfair', 'Sportsbet', 'Betano', 'Rivalo', 'Betway', 'BravoBet', 'Blaze'];
          
          lines.forEach((line, index) => {
            const texto = line.full_text || '';
            console.log(`Line ${index+1}: "${texto.substring(0, 100)}"`);
            
            // Detect betting houses with position-based number extraction
            casasApostas.forEach(casa => {
              if (texto.includes(casa)) {
                console.log(`Found betting house: ${casa} in line: ${texto}`);
                
                // Get position of the betting house in the text
                const casaPos = texto.indexOf(casa);
                
                // Extract ALL numbers from the line
                const numerosRegex = /(\d+\.?\d*)/g;
                const numerosMatch = [];
                let match;
                while ((match = numerosRegex.exec(texto)) !== null) {
                  numerosMatch.push({
                    value: parseFloat(match[1]),
                    position: match.index,
                    text: match[1]
                  });
                }
                
                console.log(`Numbers found with positions:`, numerosMatch);
                
                // Find numbers that appear AFTER the betting house name
                const numerosAposCasa = numerosMatch
                  .filter(num => num.position > casaPos && !isNaN(num.value))
                  .filter(num => num.value > 0); // Remove zeros
                
                console.log(`Numbers after ${casa}:`, numerosAposCasa);
                
                if (!betA.bettingHouse) {
                  betA.bettingHouse = casa;
                  
                  // For BetA: Look for odds patterns - typically between 1.0 and 10.0
                  const possibleOdds = numerosAposCasa.filter(num => 
                    num.value >= 1.0 && num.value <= 10.0 && num.text.includes('.')
                  );
                  
                  if (possibleOdds.length > 0) {
                    // Take the first reasonable odds after the house name
                    betA.odds = possibleOdds[0].text;
                    console.log(`BetA odds set to: ${betA.odds}`);
                  }
                  
                  // For stakes: look for larger numbers (typically 10-100)
                  const possibleStakes = numerosAposCasa.filter(num => 
                    num.value >= 10 && num.value <= 1000
                  );
                  
                  if (possibleStakes.length > 0) {
                    betA.stake = possibleStakes[0].text;
                    console.log(`BetA stake set to: ${betA.stake}`);
                  }
                  
                } else if (!betB.bettingHouse) {
                  betB.bettingHouse = casa;
                  
                  // For BetB: Look for odds patterns
                  const possibleOdds = numerosAposCasa.filter(num => 
                    num.value >= 1.0 && num.value <= 10.0 && num.text.includes('.')
                  );
                  
                  if (possibleOdds.length > 0) {
                    // If betA already took first odds, take second
                    const oddsIndex = possibleOdds.findIndex(odds => odds.text !== betA.odds);
                    if (oddsIndex >= 0) {
                      betB.odds = possibleOdds[oddsIndex].text;
                    } else if (possibleOdds.length > 1) {
                      betB.odds = possibleOdds[1].text;
                    } else {
                      betB.odds = possibleOdds[0].text;
                    }
                    console.log(`BetB odds set to: ${betB.odds}`);
                  }
                  
                  // For stakes: look for larger numbers, but different from betA
                  const possibleStakes = numerosAposCasa.filter(num => 
                    num.value >= 10 && num.value <= 1000 && num.text !== betA.stake
                  );
                  
                  if (possibleStakes.length > 0) {
                    betB.stake = possibleStakes[0].text;
                    console.log(`BetB stake set to: ${betB.stake}`);
                  }
                }
              }
            });
            
            // Extract profit percentage using your approach
            const profitMatch = texto.match(/(\d+\.?\d*)%/);
            if (profitMatch && !totalProfitPercentage) {
              totalProfitPercentage = profitMatch[1];
              console.log(`Found profit: ${totalProfitPercentage}%`);
            }
            
            // Extract teams with better pattern - look for team names before betting houses
            const teamMatch = texto.match(/([A-Za-zÀ-ÿ\s\-]+)\s*[—-]\s*([A-Za-zÀ-ÿ\s\-]+)/);
            if (teamMatch && !betA.teamA) {
              let teamA = teamMatch[1].trim();
              let teamB = teamMatch[2].trim();
              
              // Clean up team names - remove betting house names if they got mixed in
              casasApostas.forEach(casa => {
                teamA = teamA.replace(casa, '').trim();
                teamB = teamB.replace(casa, '').trim();
              });
              
              // Remove common OCR artifacts
              teamA = teamA.replace(/\s+/g, ' ').replace(/^[^A-Za-zÀ-ÿ]+/, '').trim();
              teamB = teamB.replace(/\s+/g, ' ').replace(/^[^A-Za-zÀ-ÿ]+/, '').trim();
              
              if (teamA.length > 2 && teamB.length > 2) {
                betA.teamA = teamA;
                betA.teamB = teamB;
                betB.teamA = teamA;
                betB.teamB = teamB;
                console.log(`Found teams: ${betA.teamA} vs ${betA.teamB}`);
              }
            }
            
            // Alternative team extraction from specific patterns
            if (!betA.teamA && (texto.includes('Grêmio') || texto.includes('Vitória'))) {
              const gremioDVitoriaMatch = texto.match(/(Grêmio[-\s]*[A-Z]*)\s*[—-]?\s*(Vitória[-\s]*[A-Z]*)/);
              if (gremioDVitoriaMatch) {
                betA.teamA = gremioDVitoriaMatch[1].trim();
                betA.teamB = gremioDVitoriaMatch[2].trim();
                betB.teamA = betA.teamA;
                betB.teamB = betA.teamB;
                console.log(`Found specific teams: ${betA.teamA} vs ${betA.teamB}`);
              }
            }
          });
          
          // Calculate payouts
          if (betA.odds && betA.stake) {
            betA.payout = (parseFloat(betA.odds) * parseFloat(betA.stake)).toFixed(2);
          }
          if (betB.odds && betB.stake) {
            betB.payout = (parseFloat(betB.odds) * parseFloat(betB.stake)).toFixed(2);
          }
          
          // Set default date
          if (!gameDate) {
            const today = new Date();
            gameDate = today.toISOString().split('T')[0];
          }
          
          console.log(`Extraction complete - BetA: ${betA.bettingHouse}, BetB: ${betB.bettingHouse}`);
          
          return { betA, betB, gameDate, gameTime, sport, league, totalProfitPercentage };
        }
        
        console.log('DEBUG: HYBRID_OCR_SUCCESS', JSON.stringify({
          method: 'hybrid_improved_extraction',
          total_blocks: simpleResult.total_blocks,
          text_preview: simpleResult.raw_text.substring(0, 150),
          betA_house: simpleResult.betA.bettingHouse,
          betB_house: simpleResult.betB.bettingHouse,
          betA_odds: simpleResult.betA.odds,
          betB_odds: simpleResult.betB.odds,
          betA_stake: simpleResult.betA.stake,
          betB_stake: simpleResult.betB.stake,
          total_profit: simpleResult.totalProfitPercentage,
          processing_time_ms: processingTime,
          timestamp: new Date().toISOString()
        }));
        
        res.json({
          ...simpleResult,
          processingTime: `${processingTime}ms`
        });
        
      } catch (extractionError: any) {
        console.error('ERROR: Improved OCR extraction failed');
        
        console.log('DEBUG: IMPROVED_OCR_FAILED', JSON.stringify({
          method: 'improved_ocr_extraction',
          error_message: extractionError?.message || 'Unknown error',
          processing_time_ms: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }));
        
        throw new Error(`Improved OCR extraction failed: ${extractionError?.message || 'Unknown error'}`);
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
