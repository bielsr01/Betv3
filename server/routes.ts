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
        // DOCTR AI SYSTEM: Advanced AI-powered OCR with PyTorch backend
        console.log('Starting DocTR AI OCR system (PyTorch + AI models)...');
        const doctrResult = await new Promise((resolve, reject) => {
          const child = spawn('python3', ['server/doctr_ai_ocr.py', imageBase64], {
            stdio: ['pipe', 'pipe', 'pipe']
          });
          
          let stdout = '';
          let stderr = '';
          
          child.stdout.on('data', (data) => stdout += data);
          child.stderr.on('data', (data) => stderr += data);
          
          child.on('close', (code) => {
            if (code === 0) {
              try {
                const result = JSON.parse(stdout);
                resolve(result);
              } catch (e) {
                reject(new Error(`Failed to parse DocTR AI output: ${e.message}`));
              }
            } else {
              reject(new Error(`DocTR AI failed: ${stderr}`));
            }
          });
          
          child.on('error', (err) => reject(err));
        });
        
        const processingTime = Date.now() - startTime;
        console.log(`DocTR AI OCR completed in ${processingTime}ms`);
        
        if (!doctrResult.success) {
          return res.status(500).json({
            success: false,
            error: doctrResult.error || 'DocTR AI OCR processing failed',
            method: 'doctr_ai_ocr'
          });
        }
        
        // Create result using DocTR AI OCR (already has betting data extracted)
        const simpleResult = {
          success: true,
          method: 'doctr_ai_pytorch',
          raw_text: doctrResult.raw_text,
          text_blocks: doctrResult.text_blocks,
          total_blocks: doctrResult.text_blocks?.length || 0,
          
          // Already extracted fields from DocTR AI OCR
          betA: doctrResult.betA || {
            bettingHouse: '',
            teamA: '',
            teamB: '',
            betType: '',
            odds: '',
            stake: '',
            payout: '',
            selectedSide: 'A'
          },
          betB: doctrResult.betB || {
            bettingHouse: '',
            teamA: '',
            teamB: '',
            betType: '',
            odds: '',
            stake: '',
            payout: '',
            selectedSide: 'B'
          },
          gameDate: '',
          gameTime: '',
          sport: 'Futebol',
          league: '',
          totalProfitPercentage: doctrResult.totalProfitPercentage || '',
          processing_info: doctrResult.processing_info
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
                
                // DIRECT PATTERN SEARCH - Find specific SureBet patterns in the original text
                const numerosMatch = [];
                
                // Search for specific SureBet odds patterns (3-digit decimals like 1.830, 2.280)
                const sureBetOddsRegex = /\b(\d\.\d{3})\b/g; // Matches X.XXX format with word boundaries
                let sureBetMatch;
                while ((sureBetMatch = sureBetOddsRegex.exec(texto)) !== null) {
                  numerosMatch.push({
                    value: parseFloat(sureBetMatch[1]),
                    position: sureBetMatch.index,
                    text: sureBetMatch[1],
                    type: 'surebet_odds'
                  });
                  console.log(`Found SureBet odds pattern: ${sureBetMatch[1]} at position ${sureBetMatch.index}`);
                }
                
                // Search for stake amounts (typically 2-digit decimals like 55.47, 44.53)
                const stakeRegex = /\b(\d{2,3}\.\d{2})\b/g; // Matches XX.XX or XXX.XX format with word boundaries  
                let stakeMatch;
                while ((stakeMatch = stakeRegex.exec(texto)) !== null) {
                  const value = parseFloat(stakeMatch[1]);
                  // Only stakes in reasonable range (10-1000)
                  if (value >= 10 && value <= 1000) {
                    numerosMatch.push({
                      value: value,
                      position: stakeMatch.index,
                      text: stakeMatch[1],
                      type: 'stake'
                    });
                    console.log(`Found stake pattern: ${stakeMatch[1]} at position ${stakeMatch.index}`);
                  }
                }
                
                // Search for two-part stakes (like "44 53" that should be "44.53")  
                const twoPartStakeRegex = /\b(\d{2})\s+(\d{2})\b/g;
                let twoPartMatch;
                while ((twoPartMatch = twoPartStakeRegex.exec(texto)) !== null) {
                  const combined = `${twoPartMatch[1]}.${twoPartMatch[2]}`;
                  const value = parseFloat(combined);
                  if (value >= 10 && value <= 1000) {
                    numerosMatch.push({
                      value: value,
                      position: twoPartMatch.index,
                      text: combined,
                      type: 'combined_stake'
                    });
                    console.log(`Found combined stake: ${combined} from "${twoPartMatch[1]} ${twoPartMatch[2]}"`);
                  }
                }
                
                // NO GENERIC FALLBACK - only use typed pattern matches to prevent overwriting
                
                console.log(`Numbers found with positions:`, numerosMatch);
                
                // Find numbers that appear AFTER the betting house name
                const numerosAposCasa = numerosMatch
                  .filter(num => num.position > casaPos && !isNaN(num.value))
                  .filter(num => num.value > 0); // Remove zeros
                
                console.log(`Numbers after ${casa}:`, numerosAposCasa);
                
                if (!betA.bettingHouse) {
                  betA.bettingHouse = casa;
                  
                  // Priority 1: Look for SureBet-specific odds patterns (X.XXX format)
                  const sureBetOdds = numerosAposCasa.filter(num => 
                    num.type === 'surebet_odds' && num.value >= 1.0 && num.value <= 10.0
                  ).sort((a, b) => a.position - b.position);
                  
                  if (sureBetOdds.length > 0) {
                    betA.odds = sureBetOdds[0].text;
                    console.log(`BetA odds (SureBet pattern): ${betA.odds}`);
                  }
                  
                  // Priority 2: Look for stake patterns (XX.XX format or combined)
                  const stakeNumbers = numerosAposCasa.filter(num => 
                    (num.type === 'stake' || num.type === 'combined_stake') && 
                    num.value >= 10 && num.value <= 1000
                  ).sort((a, b) => a.position - b.position);
                  
                  if (stakeNumbers.length > 0) {
                    betA.stake = stakeNumbers[0].text;
                    console.log(`BetA stake (pattern match): ${betA.stake}`);
                  }
                  
                } else if (!betB.bettingHouse) {
                  betB.bettingHouse = casa;
                  
                  // Priority 1: Look for SureBet odds patterns, different from BetA
                  const sureBetOdds = numerosAposCasa.filter(num => 
                    num.type === 'surebet_odds' && 
                    num.value >= 1.0 && num.value <= 10.0 &&
                    num.text !== betA.odds // Different from BetA
                  ).sort((a, b) => a.position - b.position);
                  
                  if (sureBetOdds.length > 0) {
                    betB.odds = sureBetOdds[0].text;
                    console.log(`BetB odds (SureBet pattern): ${betB.odds}`);
                  }
                  
                  // Priority 2: Look for stakes, different from BetA
                  const stakeNumbers = numerosAposCasa.filter(num => 
                    (num.type === 'stake' || num.type === 'combined_stake') && 
                    num.value >= 10 && num.value <= 1000 &&
                    num.text !== betA.stake // Different from BetA
                  ).sort((a, b) => a.position - b.position);
                  
                  if (stakeNumbers.length > 0) {
                    betB.stake = stakeNumbers[0].text;
                    console.log(`BetB stake (pattern match): ${betB.stake}`);
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
