import {
  AILogEntry,
  LexicalExpression,
  TokenBudgetState,
} from '../types/corpus';

export interface DecisionCheckResult {
  canConsultAI: boolean;
  blockReason?: string;
  itemsToConsult: { id: string; expressao: string; contexto: string }[];
  cachedItems: {
    id: string;
    classificacao: 'palavra_composta' | 'termo_tecnico' | 'combinacao_livre' | 'ambiguo';
    unificar_sugerido: boolean;
    justificativa: string;
  }[];
}

const CACHE_STORAGE_KEY = 'corpuslab_gemini_decisions_cache';
const BUDGET_STORAGE_KEY = 'corpuslab_token_budget_state';
const AI_LOGS_STORAGE_KEY = 'corpuslab_ai_logs';

/**
 * Loads cached AI decisions from localStorage
 */
export function loadCachedDecisions(): Record<string, {
  classificacao: 'palavra_composta' | 'termo_tecnico' | 'combinacao_livre' | 'ambiguo';
  unificar_sugerido: boolean;
  justificativa: string;
  timestamp: string;
}> {
  try {
    const raw = localStorage.getItem(CACHE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Saves a decision into persistent cache
 */
export function saveCachedDecision(
  expression: string,
  decision: {
    classificacao: 'palavra_composta' | 'termo_tecnico' | 'combinacao_livre' | 'ambiguo';
    unificar_sugerido: boolean;
    justificativa: string;
  }
): void {
  try {
    const cache = loadCachedDecisions();
    const key = expression.toLowerCase().trim();
    cache[key] = {
      ...decision,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn('Erro ao salvar no cache local:', e);
  }
}

/**
 * Loads token budget state with conservative initial defaults
 */
export function loadTokenBudget(): TokenBudgetState {
  const defaultBudget: TokenBudgetState = {
    dailyBudget: 5000,
    tokensUsedToday: 0,
    maxTokensPerRequest: 1500,
    maxOutputTokens: 300,
    maxQueriesPerDay: 10,
    queriesExecutedToday: 0,
    queriesAvoidedByCache: 0,
    queriesBlockedByLimit: 0,
    isPaused: false,
    model: 'gemini-3.1-flash-lite',
    apiStatus: 'ready',
    lastStatusMessage: 'Pronto para desambiguações autorizadas.',
    lastBudgetResetDate: new Date().toISOString().split('T')[0],
  };

  try {
    const raw = localStorage.getItem(BUDGET_STORAGE_KEY);
    if (!raw) return defaultBudget;
    const parsed = JSON.parse(raw);
    return { ...defaultBudget, ...parsed };
  } catch {
    return defaultBudget;
  }
}

/**
 * Saves token budget state
 */
export function saveTokenBudget(budget: TokenBudgetState): void {
  try {
    localStorage.setItem(BUDGET_STORAGE_KEY, JSON.stringify(budget));
  } catch (e) {
    console.warn('Erro ao salvar orçamento:', e);
  }
}

/**
 * Loads AI audit logs
 */
export function loadAILogs(): AILogEntry[] {
  try {
    const raw = localStorage.getItem(AI_LOGS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveAILog(entry: AILogEntry): void {
  try {
    const logs = loadAILogs();
    logs.unshift(entry);
    localStorage.setItem(AI_LOGS_STORAGE_KEY, JSON.stringify(logs.slice(0, 100)));
  } catch (e) {
    console.warn('Erro ao salvar log de IA:', e);
  }
}

/**
 * AIUsageDecisionEngine: Evaluates the 9 verification checkpoints before dispatching requests
 */
export class AIUsageDecisionEngine {
  public static evaluateBatch(
    expressions: LexicalExpression[],
    budget: TokenBudgetState,
    userExplicitlyAuthorized: boolean
  ): DecisionCheckResult {
    // Check 6: User authorization check
    if (!userExplicitlyAuthorized) {
      return {
        canConsultAI: false,
        blockReason: 'O usuário ainda não autorizou a consulta deste lote ao Gemini.',
        itemsToConsult: [],
        cachedItems: [],
      };
    }

    // Check 8: API paused or marked offline
    if (budget.isPaused) {
      return {
        canConsultAI: false,
        blockReason: 'Utilização do Gemini está pausada pelo usuário. Acionando contingência local.',
        itemsToConsult: [],
        cachedItems: [],
      };
    }

    // Check 7: Daily query count and token limits
    if (budget.queriesExecutedToday >= budget.maxQueriesPerDay) {
      return {
        canConsultAI: false,
        blockReason: `Limite diário de ${budget.maxQueriesPerDay} consultas atingido. Plano B ativo.`,
        itemsToConsult: [],
        cachedItems: [],
      };
    }

    if (budget.tokensUsedToday >= budget.dailyBudget) {
      return {
        canConsultAI: false,
        blockReason: `Orçamento diário de ${budget.dailyBudget} tokens esgotado. Plano B ativo.`,
        itemsToConsult: [],
        cachedItems: [],
      };
    }

    const cache = loadCachedDecisions();
    const itemsToConsult: { id: string; expressao: string; contexto: string }[] = [];
    const cachedItems: DecisionCheckResult['cachedItems'] = [];

    for (const expr of expressions) {
      const cleanExpr = expr.original.toLowerCase().trim();

      // Check 1: Can it be resolved by standard dictionary?
      if (expr.source === 'dictionary') {
        continue;
      }

      // Check 3: Is it already cached from previous approved decisions?
      if (cache[cleanExpr]) {
        cachedItems.push({
          id: expr.id,
          ...cache[cleanExpr],
        });
        continue;
      }

      // Check 4: Is expression ambiguous enough to justify AI?
      // Only ambiguous expressions (ambiguityScore >= 0.4) are candidates
      if (expr.ambiguityScore < 0.4 && expr.status === 'approved') {
        continue;
      }

      // Prepare concise context snippet (1-2 sentences, never full document)
      const snippet = expr.contexts[0]?.snippet || '';
      itemsToConsult.push({
        id: expr.id,
        expressao: expr.original,
        contexto: snippet,
      });

      // Limit batch size to max 8 items per request for token frugality
      if (itemsToConsult.length >= 8) {
        break;
      }
    }

    if (itemsToConsult.length === 0 && cachedItems.length === 0) {
      return {
        canConsultAI: false,
        blockReason: 'Nenhuma expressão ambígua pendente de desambiguação encontrada no lote.',
        itemsToConsult: [],
        cachedItems: [],
      };
    }

    return {
      canConsultAI: itemsToConsult.length > 0,
      itemsToConsult,
      cachedItems,
    };
  }
}
