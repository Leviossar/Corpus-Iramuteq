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

app.use(express.json({ limit: '10mb' }));

// Shared Gemini client configured with telemetry header per guidelines
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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: Boolean(apiKey),
    timestamp: new Date().toISOString(),
  });
});

// Gemini classification endpoint for ambiguous compound expressions
app.post('/api/gemini/classify', async (req, res) => {
  try {
    const { items, model = 'gemini-3.1-flash-lite' } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: 'A lista de expressões para classificação é obrigatória.',
        fallbackTriggered: true,
      });
    }

    if (!aiClient || !apiKey) {
      return res.status(503).json({
        error: 'Chave do Gemini API não configurada no ambiente. Plano B acionado.',
        fallbackTriggered: true,
        reason: 'missing_api_key',
      });
    }

    // Format concise prompt table to minimize tokens (never send entire articles)
    const formattedList = items
      .map(
        (it: { id: string; expressao: string; contexto?: string }) =>
          `ID: ${it.id} | Expressão: "${it.expressao}" | Contexto: "${it.contexto || 'Sem contexto adicional'}"`
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

    // Target model with low-cost Flash Lite, fallback to Flash
    const targetModel = model.includes('flash') ? model : 'gemini-3.1-flash-lite';

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
    let parsedData = { resultados: [] };

    try {
      parsedData = JSON.parse(text);
    } catch {
      return res.status(502).json({
        error: 'Resposta malformada recebida do modelo. Plano B acionado.',
        fallbackTriggered: true,
        reason: 'json_parse_error',
      });
    }

    // Extract real usage metadata if provided by SDK
    const usage = response.usageMetadata || {};
    const inputTokens = usage.promptTokenCount || Math.ceil(promptText.length / 4);
    const outputTokens = usage.candidatesTokenCount || Math.ceil(text.length / 4);

    return res.json({
      success: true,
      resultados: parsedData.resultados,
      modelUsed: targetModel,
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
      },
      fallbackTriggered: false,
    });
  } catch (error: any) {
    const errorMsg = error?.message || 'Erro inesperado na chamada ao Gemini';
    const isRateLimit = errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED');
    const isAuth = errorMsg.includes('API key') || errorMsg.includes('401') || errorMsg.includes('403');

    return res.status(isRateLimit ? 429 : 500).json({
      error: errorMsg,
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
