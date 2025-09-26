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

  // OCR Raw endpoint - usa função compartilhada + formatação para texto
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

      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const anthropic = new Anthropic({
        apiKey: ANTHROPIC_API_KEY,
      });

      // USA A MESMA FUNÇÃO CONFIÁVEL DO /api/ocr/analyze
      const jsonData = await extractSurebetData(imageBase64, anthropic);
      
      // Formatar JSON em texto no formato solicitado pelo usuário
      const formatToText = (data: any) => {
        const lines = [
          `Data do evento: ${data.gameDate || ''}`,
          `Hora: ${data.gameTime || ''}`,
          '',
          `Esporte: ${data.sport || ''}`,
          `Liga: ${data.league || ''}`,
          '',
          `Time A: ${data.teamA || ''}`,
          `Time B: ${data.teamB || ''}`,
          '',
          `Aposta 1`,
          `Casa: ${data.betA?.bettingHouse || ''}`,
          `Tipo: ${data.betA?.betType || ''}`,
          `Odd: ${data.betA?.odds || ''}`,
          `Valor da Aposta: ${data.betA?.stake || ''}`,
          `Lucro: ${data.betA?.profit || ''}`,
          '',
          `Aposta 2`,
          `Casa: ${data.betB?.bettingHouse || ''}`,
          `Tipo: ${data.betB?.betType || ''}`,
          `Odd: ${data.betB?.odds || ''}`,
          `Valor da Aposta: ${data.betB?.stake || ''}`,
          `Lucro: ${data.betB?.profit || ''}`,
          '',
          `Lucro%: ${data.totalProfitPercentage || ''}`
        ];
        return lines.join('\n');
      };

      const formattedText = formatToText(jsonData);
      
      console.log('✅ /api/ocr/raw: Successfully formatted shared extraction data');
      res.set('Content-Type', 'text/plain; charset=utf-8');
      res.send(formattedText);
      
    } catch (error) {
      console.error('Raw OCR error:', error);
      if (error instanceof Error && error.message.includes('No JSON found')) {
        return res.status(502).json({ 
          error: 'Claude did not return valid JSON', 
          details: error.message 
        });
      }
      res.status(500).json({ error: 'Failed to extract surebet data' });
    }
  });


  // OCR Analysis endpoint - usa função compartilhada para JSON
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

      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const anthropic = new Anthropic({
        apiKey: ANTHROPIC_API_KEY,
      });

      // USA A MESMA FUNÇÃO COMPARTILHADA
      const result = await extractSurebetData(imageBase64, anthropic);
      
      console.log('✅ /api/ocr/analyze: Successfully extracted data via shared function');
      res.json(result);
      
    } catch (error) {
      console.error('Analysis OCR error:', error);
      if (error instanceof Error && error.message.includes('No JSON found')) {
        return res.status(502).json({ 
          error: 'Claude did not return valid JSON', 
          details: error.message 
        });
      }
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

// Função compartilhada para extração confiável de dados de surebet
async function extractSurebetData(imageBase64: string, anthropic: any) {
  // Clean base64 data
  const cleanBase64 = imageBase64.includes('base64,') 
    ? imageBase64.split('base64,')[1] 
    : imageBase64;

  // Determine image media type
  const originalMediaType = detectImageMediaType(imageBase64);
  
  // Apply ultra-fast compression
  const { compressedBase64, newMediaType } = await compressImageForClaude(cleanBase64, originalMediaType);

  console.log('🚀 Extracting surebet data with Claude Haiku...');
  const startTime = Date.now();

  const response = await anthropic.messages.create({
    model: "claude-3-haiku-20240307",
    max_tokens: 800,
    messages: [{
      role: "user",
      content: [
        {
          type: "text",
          text: `Analise esta captura de tela do SureBet Calculator e extraia EXATAMENTE os dados mostrados na interface.

INSTRUÇÕES ESPECÍFICAS:
1. DATA E HORA: Encontre a data/hora do jogo (formato DD/MM/YYYY) - NÃO use datas antigas, extraia a data REAL mostrada
2. TIMES: Extraia os nomes dos times exatamente como mostrado (geralmente com "–" ou "vs" entre eles)
3. ESPORTE/LIGA: Identifique o esporte e liga mostrados na interface
4. CASAS DE APOSTAS: Extraia os nomes das casas (colunas da tabela)
5. TIPOS DE APOSTA: Extraia EXATAMENTE o texto da coluna "Chance" ou tipo de aposta - não invente texto
6. ODDS: Números das odds exatos da tabela
7. STAKES: Valores investidos em cada aposta (coluna valor)
8. LUCRO: Valores de lucro mostrados
9. PORCENTAGEM: Porcentagem de lucro total (geralmente no topo)

Retorne APENAS JSON válido no formato:

{
  "gameDate": "DD/MM/YYYY",
  "gameTime": "HH:MM",
  "sport": "nome_do_esporte",
  "league": "nome_da_liga", 
  "teamA": "time_1",
  "teamB": "time_2",
  "betA": {
    "bettingHouse": "casa_1",
    "betType": "tipo_aposta_exato",
    "odds": "1.XX",
    "stake": "XXXX.XX",
    "profit": "XXX.XX"
  },
  "betB": {
    "bettingHouse": "casa_2", 
    "betType": "tipo_aposta_exato",
    "odds": "1.XX",
    "stake": "XXXX.XX", 
    "profit": "XXX.XX"
  },
  "totalProfitPercentage": "X.XX%"
}

IMPORTANTE: 
- Use dados REAIS da imagem, não exemplos
- Mantenha formatação original dos tipos de aposta
- Use data atual da interface, não datas antigas
- Preserve acentos e caracteres especiais
- Use apenas números com pontos decimais (formato americano)`
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

  // Extract and parse JSON
  const responseText = response.content[0].type === 'text' ? response.content[0].text : '';
  console.log('📥 Claude raw response:', responseText.substring(0, 200) + '...');
  
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`No JSON found in Claude response: ${responseText}`);
  }
  
  const jsonStr = jsonMatch[0];
  const jsonData = JSON.parse(jsonStr);
  
  console.log('✅ Successfully parsed surebet data:', JSON.stringify(jsonData, null, 2));
  return jsonData;
}
