import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Strict payload limits
app.use(express.json({ limit: '2mb' }));

// Shared Gemini client configured with telemetry header
const apiKey = process.env.GEMINI_API_KEY || '';
let aiClient: GoogleGenAI | null = null;

if (apiKey) {
  aiClient = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Security: Whitelist of allowed economical models (prohibit expensive models)
const ALLOWED_MODELS = new Set(['gemini-3.1-flash-lite', 'gemini-3.8-flash']);

// Server-side sliding rate limiter and daily budget tracking
interface ServerUsageTracker {
  date: string;
  tokensConsumed: number;
  requestsCount: number;
  requestTimestamps: number[];
}

const usageTracker: ServerUsageTracker = {
  date: new Date().toISOString().slice(0, 10),
  tokensConsumed: 0,
  requestsCount: 0,
  requestTimestamps: [],
};

const SERVER_DAILY_TOKEN_LIMIT = 10000; // Hard server safety cap
const MAX_REQUESTS_PER_MINUTE = 15;

function checkAndResetDailyUsage() {
  const today = new Date().toISOString().slice(0, 10);
  if (usageTracker.date !== today) {
    usageTracker.date = today;
    usageTracker.tokensConsumed = 0;
    usageTracker.requestsCount = 0;
    usageTracker.requestTimestamps = [];
  }
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  checkAndResetDailyUsage();
  res.json({
    status: 'ok',
    hasApiKey: Boolean(apiKey),
    serverTokensUsedToday: usageTracker.tokensConsumed,
    serverDailyLimit: SERVER_DAILY_TOKEN_LIMIT,
    timestamp: new Date().toISOString(),
  });
});

// Gemini classification endpoint for ambiguous compound expressions
app.post('/api/gemini/classify', async (req, res) => {
  try {
    checkAndResetDailyUsage();

    // 1. Sliding window rate limit
    const now = Date.now();
    usageTracker.requestTimestamps = usageTracker.requestTimestamps.filter((t) => now - t < 60000);
    if (usageTracker.requestTimestamps.length >= MAX_REQUESTS_PER_MINUTE) {
      return res.status(429).json({
        error: 'Limite de taxa de requisições excedido no servidor (máximo 15 requisições por minuto). Aguarde um instante.',
        fallbackTriggered: true,
        reason: 'rate_limit_exceeded',
      });
    }

    // 2. Server-side token budget check
    if (usageTracker.tokensConsumed >= SERVER_DAILY_TOKEN_LIMIT) {
      return res.status(429).json({
        error: `Orçamento de segurança do servidor (${SERVER_DAILY_TOKEN_LIMIT} tokens diários) atingido. Plano B acionado.`,
        fallbackTriggered: true,
        reason: 'server_daily_budget_exceeded',
      });
    }

    const { items, model = 'gemini-3.1-flash-lite' } = req.body;

    // 3. Strict Payload Validation
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: 'A lista de expressões para classificação é obrigatória.',
        fallbackTriggered: true,
      });
    }

    // Maximum 10 items per batch to prevent token explosion
    if (items.length > 10) {
      return res.status(400).json({
        error: 'Tamanho de lote excede o limite máximo permitido de 10 expressões por requisição.',
        fallbackTriggered: true,
      });
    }

    // Validate that expressions and snippets are concise
    for (const it of items) {
      if (!it.expressao || typeof it.expressao !== 'string') {
        return res.status(400).json({
          error: 'Cada item deve possuir uma expressão textual válida.',
          fallbackTriggered: true,
        });
      }
      if (it.expressao.length > 100) {
        return res.status(400).json({
          error: 'Expressão individual excede o limite máximo de 100 caracteres.',
          fallbackTriggered: true,
        });
      }
      if (it.contexto && it.contexto.length > 350) {
        return res.status(400).json({
          error: 'Contexto excede o limite de 350 caracteres. O Gemini deve receber apenas frases curtas, nunca artigos inteiros.',
          fallbackTriggered: true,
        });
      }
    }

    // 4. Model whitelist
    const targetModel = ALLOWED_MODELS.has(model) ? model : 'gemini-3.1-flash-lite';

    // 5. API Client check
    if (!aiClient || !apiKey) {
      return res.status(503).json({
        error: 'Chave do Gemini API não configurada no ambiente. Plano B acionado.',
        fallbackTriggered: true,
        reason: 'missing_api_key',
      });
    }

    // Format concise prompt table
    const formattedList = items
      .map(
        (it: { id: string; expressao: string; contexto?: string }) =>
          `ID: ${it.id} | Expressão: "${it.expressao.trim()}" | Contexto: "${(it.contexto || 'Sem contexto adicional').trim()}"`
      )
      .join('\n');

    const promptText = `Você é um classificador linguístico auxiliar para a preparação de corpus do IRaMuTeQ.
Analise apenas as expressões fornecidas e seus contextos.
Identifique se cada expressão representa uma unidade lexical convencional (palavra_composta), um termo técnico acadêmico (termo_tecnico), uma combinação livre de palavras que não deve ser unificada (combinacao_livre), ou se permanece ambígua (ambiguo).
Não reescreva o texto, não invente contexto e não tome decisões metodológicas pelo pesquisador.
Quando houver ambiguidade, recomende revisão humana.
Use justificativas de no máximo 12 palavras por expressão.

Expressões para análise:
${formattedList}`;

    usageTracker.requestTimestamps.push(now);

    const response = await aiClient.models.generateContent({
      model: targetModel,
      contents: promptText,
      config: {
        systemInstruction:
          'Você é um classificador linguístico estrito e econômico para preparação de corpus para o software IRaMuTeQ. Responda exclusivamente em JSON estruturado com justificativas sucintas de até 12 palavras.',
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            resultados: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  classificacao: {
                    type: Type.STRING,
                    description: 'palavra_composta, termo_tecnico, combinacao_livre ou ambiguo',
                  },
                  unificar_sugerido: { type: Type.BOOLEAN },
                  justificativa: { type: Type.STRING },
                },
                required: ['id', 'classificacao', 'unificar_sugerido', 'justificativa'],
              },
            },
          },
          required: ['resultados'],
        },
      },
    });

    const text = response.text || '{}';
    let parsedData: { resultados: any[] } = { resultados: [] };

    try {
      parsedData = JSON.parse(text);
    } catch {
      return res.status(502).json({
        error: 'Resposta malformada recebida do modelo. Plano B acionado.',
        fallbackTriggered: true,
        reason: 'json_parse_error',
      });
    }

    // Strict schema check on each returned item
    const validClassifications = new Set(['palavra_composta', 'termo_tecnico', 'combinacao_livre', 'ambiguo']);
    const sanitizedResults = (parsedData.resultados || [])
      .filter((r) => r && typeof r.id === 'string')
      .map((r) => ({
        id: String(r.id),
        classificacao: validClassifications.has(r.classificacao) ? r.classificacao : 'ambiguo',
        unificar_sugerido: Boolean(r.unificar_sugerido),
        justificativa: String(r.justificativa || '').slice(0, 150),
      }));

    // Extract real usage metadata if provided by SDK
    const usage = response.usageMetadata || {};
    const inputTokens = usage.promptTokenCount || Math.ceil(promptText.length / 4);
    const outputTokens = usage.candidatesTokenCount || Math.ceil(text.length / 4);
    const totalTokens = inputTokens + outputTokens;

    // Track on server
    usageTracker.tokensConsumed += totalTokens;
    usageTracker.requestsCount += 1;

    return res.json({
      success: true,
      resultados: sanitizedResults,
      modelUsed: targetModel,
      usage: {
        inputTokens,
        outputTokens,
        totalTokens,
      },
      fallbackTriggered: false,
    });
  } catch (error: any) {
    const errorMsg = error?.message || 'Erro na chamada ao Gemini';
    const isRateLimit = errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED');
    const isAuth = errorMsg.includes('API key') || errorMsg.includes('401') || errorMsg.includes('403');

    return res.status(isRateLimit ? 429 : 500).json({
      error: errorMsg.slice(0, 200), // sanitize message
      fallbackTriggered: true,
      reason: isRateLimit ? 'rate_limit_429' : isAuth ? 'auth_error' : 'server_error',
    });
  }
});

// Setup Vite middleware in dev or static files in production
async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CorpusLab Server rodando em http://localhost:${PORT}`);
  });
}

startServer();
