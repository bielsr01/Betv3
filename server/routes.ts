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
      const originalMediaType = detectImageMediaType(imageBase64);
      
      // Apply ultra-fast compression to reduce tokens dramatically
      const { compressedBase64, newMediaType } = await compressImageForClaude(cleanBase64, originalMediaType);

      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const anthropic = new Anthropic({
        apiKey: ANTHROPIC_API_KEY,
      });

      console.log('🚀 Sending to Claude Haiku...');
      const startTime = Date.now();

      const response = await anthropic.messages.create({
        model: "claude-3-haiku-20240307", // Mantendo Haiku para velocidade
        max_tokens: 1000,  // Aumentado conforme seu JSON
        messages: [{
          role: "user",
          content: [
            {
              type: "text",
              text: `Analise esta imagem de surebet e extraia EXATAMENTE os dados mostrados. Retorne APENAS no formato especificado abaixo, sem texto adicional.

Formato de resposta OBRIGATÓRIO (copie exatamente esta estrutura):

Data do evento: 26/09/2025
Hora: 15:45

Time A: OH Leuven
Time B: Anderlecht

Aposta 1
Casa: Cassino (BR)
Tipo: Acima 2.25
Odd: 1.84
Valor da Aposta: 2650.00
Lucro: 106.00

Aposta 2
Casa: Betano (BR)
Tipo: Abaixo 2.25
Odd: 2.30
Valor da Aposta: 2120.00
Lucro: 106.00

Lucro%: 2.22

REGRAS IMPORTANTES:
- Substitua APENAS os valores pelos dados da imagem atual
- Para o campo 'Tipo': use EXATAMENTE o texto completo da coluna 'Chance' (ex: se aparecer 'Acima 44.5 1º o set', use isso completo no campo Tipo)
- Mantenha EXATAMENTE a mesma estrutura e ordem mostrada acima
- Use ponto decimal para números (não vírgula)
- Não adicione explicações ou texto extra
- Retorne APENAS os dados no formato especificado`
            },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: newMediaType,
                data: compressedBase64
              }
            }
          ]
        }]
      });

      const endTime = Date.now();
      console.log(`⚡ Claude processed in ${endTime - startTime}ms`);

      // Com o prompt perfeito do usuário, Claude retorna diretamente no formato correto
      const responseText = response.content[0].type === 'text' ? response.content[0].text : '';
      
      // Return formatted text as plain text - sem parsing JSON, formato direto
      res.set('Content-Type', 'text/plain; charset=utf-8');
      res.send(responseText.trim());
      
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
      const originalMediaType = detectImageMediaType(imageBase64);
      
      // Apply ultra-fast compression to reduce tokens dramatically
      const { compressedBase64, newMediaType } = await compressImageForClaude(cleanBase64, originalMediaType);

      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const anthropic = new Anthropic({
        apiKey: ANTHROPIC_API_KEY,
      });

      console.log('🚀 Analyzing betting slip with Claude Haiku...');
      const startTime = Date.now();

      const response = await anthropic.messages.create({
        model: "claude-3-haiku-20240307", // Ultra-fast Haiku model
        max_tokens: 400,  // Reduzido para economia
        messages: [{
          role: "user",
          content: [
            {
              type: "text",
              text: `Extrair dados EXATOS da imagem e retornar JSON:
{
  "betA": {
    "bettingHouse": "[nome da casa]",
    "teamA": "[time 1]", 
    "teamB": "[time 2]",
    "betType": "[COPIAR EXATO texto coluna tipo/chance: exemplo 'Acima 7.5 1º período 2º time' com símbolos/acentos]",
    "odds": "[valor]",
    "stake": "[valor]", 
    "profit": "[lucro]",
    "date": "[DD-MM-YYYY]",
    "time": "[HH:MM]",
    "sport": "[esporte]",
    "league": "[liga]"
  },
  "betB": {
    "bettingHouse": "[nome da casa]",
    "teamA": "[time 1]",
    "teamB": "[time 2]", 
    "betType": "[COPIAR EXATO texto coluna tipo/chance: exemplo 'Acima 7.5 1º período 2º time' com símbolos/acentos]",
    "odds": "[valor]",
    "stake": "[valor]",
    "profit": "[lucro]",
    "date": "[DD-MM-YYYY]", 
    "time": "[HH:MM]",
    "sport": "[esporte]",
    "league": "[liga]"
  },
  "totalProfitPercentage": "[percentual]"
}`
            },
            {
              type: "image", 
              source: {
                type: "base64",
                media_type: newMediaType,
                data: compressedBase64
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

// Ultra-fast image compression with Sharp for token reduction
async function compressImageForClaude(base64: string, originalMediaType: string): Promise<{compressedBase64: string, newMediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif"}> {
  try {
    const startTime = Date.now();
    
    // Convert base64 to buffer for Sharp processing
    const inputBuffer = Buffer.from(base64, 'base64');
    
    // Ultra-fast compression settings optimized for SPEED
    const compressedBuffer = await (await import('sharp')).default(inputBuffer)
      .resize({
        width: 800,        // Max width for OCR (sufficient for text recognition)
        withoutEnlargement: true  // Don't upscale small images
      })
      .webp({
        quality: 75,       // Good balance: speed vs file size
        effort: 1          // Lowest effort = fastest compression (0-6 scale)
      })
      .toBuffer();
    
    const compressionTime = Date.now() - startTime;
    const originalSize = inputBuffer.length;
    const compressedSize = compressedBuffer.length;
    const reductionPercentage = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);
    
    console.log(`⚡ COMPRESSÃO ULTRA-RÁPIDA:`);
    console.log(`  📊 ${originalSize} → ${compressedSize} bytes (-${reductionPercentage}%)`);
    console.log(`  ⏱️  Tempo: ${compressionTime}ms`);
    
    return {
      compressedBase64: compressedBuffer.toString('base64'),
      newMediaType: 'image/webp' as const
    };
    
  } catch (error) {
    console.error('🔥 Erro na compressão ultra-rápida:', error);
    // Fallback: return original if compression fails
    return {
      compressedBase64: base64,
      newMediaType: originalMediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif"
    };
  }
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
