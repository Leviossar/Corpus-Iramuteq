import {
  AILogEntry,
  LexicalExpression,
  TokenBudgetState,
} from '../types/corpus';
import {
  AIUsageDecisionEngine,
  loadTokenBudget,
  saveCachedDecision,
  saveTokenBudget,
  saveAILog,
} from './aiDecisionEngine';

export interface BatchClassificationResponse {
  updatedExpressions: LexicalExpression[];
  budgetState: TokenBudgetState;
  fallbackTriggered: boolean;
  message: string;
  tokensConsumed: number;
}

/**
 * FallbackManager: deterministic offline contingency when Gemini is unavailable
 */
export class FallbackManager {
  public static executeLocalFallback(
    expressions: LexicalExpression[],
    reason: string
  ): LexicalExpression[] {
    console.info(`[Plano B Ativado] Motivo: ${reason}`);

    return expressions.map((expr) => {
      // Deterministic heuristic rule without AI:
      // If 3+ words or contains known academic root words, suggest unificar with human review tag
      const words = expr.original.split(' ');
      const isStrongCandidate = words.length >= 3;

      return {
        ...expr,
        aiClassification: isStrongCandidate ? 'termo_tecnico' : 'ambiguo',
        aiSuggestedUnify: isStrongCandidate,
        justification: `[Plano B Local] ${isStrongCandidate ? 'Expressão com 3+ termos. Revisão recomendada.' : 'Ambiguidade moderada. Decisão retida para o pesquisador.'}`,
        status: 'pending', // Never auto-approve without researcher confirmation
      };
    });
  }
}

/**
 * Executes a controlled, authorized classification batch with Gemini API or Fallback
 */
export async function classifyExpressionsBatch(
  expressions: LexicalExpression[],
  userAuthorized: boolean,
  forceFallbackSimulation: boolean = false
): Promise<BatchClassificationResponse> {
  let budget = loadTokenBudget();

  // 1. Evaluate with Decision Engine
  const evaluation = AIUsageDecisionEngine.evaluateBatch(expressions, budget, userAuthorized);

  // If simulation is forced or cannot consult AI, run local fallback or apply cache
  if (forceFallbackSimulation || !evaluation.canConsultAI) {
    if (evaluation.cachedItems.length > 0 && !forceFallbackSimulation) {
      // Apply cached decisions
      const updated = expressions.map((expr) => {
        const cached = evaluation.cachedItems.find((c) => c.id === expr.id);
        if (cached) {
          return {
            ...expr,
            source: 'gemini' as const,
            aiClassification: cached.classificacao,
            aiSuggestedUnify: cached.unificar_sugerido,
            justification: `${cached.justificativa} (recuperado do cache)`,
          };
        }
        return expr;
      });

      budget.queriesAvoidedByCache += evaluation.cachedItems.length;
      saveTokenBudget(budget);

      return {
        updatedExpressions: updated,
        budgetState: budget,
        fallbackTriggered: false,
        message: `${evaluation.cachedItems.length} expressão(ões) recuperada(s) do cache local sem consumo de tokens.`,
        tokensConsumed: 0,
      };
    }

    // Trigger local Fallback (Plano B)
    const fallbackResults = FallbackManager.executeLocalFallback(
      expressions,
      forceFallbackSimulation ? 'Simulação de contingência pelo pesquisador' : evaluation.blockReason || 'Bloqueio preventivo pelo motor de decisão'
    );

    budget.queriesBlockedByLimit++;
    budget.lastStatusMessage = evaluation.blockReason || 'Plano B ativo.';
    saveTokenBudget(budget);

    // Save AI log entry
    saveAILog({
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      model: budget.model,
      expressionsCount: expressions.length,
      inputTokens: 0,
      outputTokens: 0,
      fromCache: false,
      fallbackTriggered: true,
      status: forceFallbackSimulation ? 'Simulação Plano B' : evaluation.blockReason || 'Contingência local acionada',
      costEstimatedBrl: 0,
    });

    return {
      updatedExpressions: fallbackResults,
      budgetState: budget,
      fallbackTriggered: true,
      message: forceFallbackSimulation
        ? 'Simulação de Plano B executada com sucesso. Nenhuma chamada foi enviada à API.'
        : `A assistência do Gemini está indisponível (${evaluation.blockReason}). O processamento continuará normalmente com o mecanismo local.`,
      tokensConsumed: 0,
    };
  }

  // 2. Dispatch server-side request to Node.js proxy
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

    const response = await fetch('/api/gemini/classify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: evaluation.itemsToConsult,
        model: budget.model,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      const reason = errorJson.reason || `HTTP ${response.status}`;

      // Update API status
      if (response.status === 429) {
        budget.apiStatus = 'rate_limited';
      } else if (response.status === 503) {
        budget.apiStatus = 'offline';
      } else {
        budget.apiStatus = 'error';
      }

      budget.lastStatusMessage = `Falha na requisição (${reason}). Plano B acionado automaticamente.`;
      saveTokenBudget(budget);

      const fallbackResults = FallbackManager.executeLocalFallback(expressions, reason);

      saveAILog({
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        model: budget.model,
        expressionsCount: evaluation.itemsToConsult.length,
        inputTokens: 0,
        outputTokens: 0,
        fromCache: false,
        fallbackTriggered: true,
        status: `Erro ${reason} - Plano B ativado`,
        costEstimatedBrl: 0,
      });

      return {
        updatedExpressions: fallbackResults,
        budgetState: budget,
        fallbackTriggered: true,
        message: 'A assistência do Gemini está temporariamente indisponível. O processamento continuará normalmente com o mecanismo local.',
        tokensConsumed: 0,
      };
    }

    const data = await response.json();
    const resultados = data.resultados || [];
    const totalTokens = data.usage?.totalTokens || 150;

    // Update token budget
    budget.tokensUsedToday += totalTokens;
    budget.queriesExecutedToday += 1;
    budget.apiStatus = 'ready';
    budget.lastStatusMessage = `Última consulta bem-sucedida (${totalTokens} tokens consumidos).`;
    saveTokenBudget(budget);

    // Save to persistent cache and merge into expressions
    const updated = expressions.map((expr) => {
      const match = resultados.find((r: any) => r.id === expr.id);
      if (match) {
        const decision = {
          classificacao: match.classificacao,
          unificar_sugerido: Boolean(match.unificar_sugerido),
          justificativa: match.justificativa || 'Classificação linguística assistida',
        };

        saveCachedDecision(expr.original, decision);

        return {
          ...expr,
          source: 'gemini' as const,
          aiClassification: decision.classificacao,
          aiSuggestedUnify: decision.unificar_sugerido,
          justification: decision.justificativa,
        };
      }
      return expr;
    });

    saveAILog({
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      model: data.modelUsed || budget.model,
      expressionsCount: evaluation.itemsToConsult.length,
      inputTokens: data.usage?.inputTokens || 0,
      outputTokens: data.usage?.outputTokens || 0,
      fromCache: false,
      fallbackTriggered: false,
      status: 'Sucesso',
      costEstimatedBrl: (totalTokens / 1_000_000) * 0.75, // approximate BRL conversion for Flash Lite
    });

    return {
      updatedExpressions: updated,
      budgetState: budget,
      fallbackTriggered: false,
      message: `${evaluation.itemsToConsult.length} expressão(ões) analisada(s) pelo Gemini (${totalTokens} tokens).`,
      tokensConsumed: totalTokens,
    };
  } catch (err: any) {
    const errorMsg = err?.name === 'AbortError' ? 'Timeout na conexão' : err?.message || 'Falha de rede';

    budget.apiStatus = 'offline';
    budget.lastStatusMessage = `Conexão falhou: ${errorMsg}. Plano B acionado.`;
    saveTokenBudget(budget);

    const fallbackResults = FallbackManager.executeLocalFallback(expressions, errorMsg);

    saveAILog({
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      model: budget.model,
      expressionsCount: evaluation.itemsToConsult.length,
      inputTokens: 0,
      outputTokens: 0,
      fromCache: false,
      fallbackTriggered: true,
      status: `Falha: ${errorMsg} - Plano B ativado`,
      costEstimatedBrl: 0,
    });

    return {
      updatedExpressions: fallbackResults,
      budgetState: budget,
      fallbackTriggered: true,
      message: 'A assistência do Gemini está indisponível. O processamento continuará normalmente com o mecanismo local. Algumas expressões poderão exigir sua revisão.',
      tokensConsumed: 0,
    };
  }
}
