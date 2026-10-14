import {
  DocumentItem,
  LexicalExpression,
  TransformationRecord,
} from '../types/corpus';
import { DEFAULT_ACADEMIC_COMPOUND_WORDS } from '../data/sampleDatasets';

// Portuguese stopwords to filter meaningless n-grams (e.g. "de um", "para o")
export const PORTUGUESE_STOPWORDS = new Set([
  'a', 'o', 'as', 'os', 'um', 'uma', 'uns', 'umas',
  'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas',
  'por', 'pelo', 'pela', 'pelos', 'pelas', 'para', 'pra', 'com', 'sem',
  'sob', 'sobre', 'e', 'ou', 'mas', 'que', 'se', 'como', 'quando',
  'muito', 'mais', 'menos', 'já', 'ainda', 'também', 'só', 'apenas',
  'ele', 'ela', 'eles', 'elas', 'este', 'esta', 'estes', 'estas',
  'esse', 'essa', 'esses', 'essas', 'aquele', 'aquela', 'aqueles', 'aquelas',
  'isto', 'isso', 'aquilo', 'seu', 'sua', 'seus', 'suas', 'meu', 'minha',
  'foi', 'eram', 'ser', 'são', 'era', 'está', 'estão', 'estava', 'tem', 'têm',
]);

/**
 * Tokenizes text into lowercase words while preserving diacritics
 */
export function tokenizeWords(text: string): string[] {
  if (!text) return [];
  const matches = text.match(/[\p{L}\p{N}]+(?:[-_][\p{L}\p{N}]+)*/gu);
  return matches ? matches.map((m) => m.toLowerCase()) : [];
}

/**
 * Normalizes an expression key for robust comparison and duplicate detection:
 * - Canonical Unicode normalization (NFC)
 * - Lowercase transformation
 * - Collapsing multiple spaces and whitespace
 * - Treats spaces, hyphens, and underscores as equivalent word separators
 * - Strictly preserves diacritics / accents (e.g., "avaliação" and "avaliacao" remain distinct)
 */
export function normalizeExpressionKey(term: string): string {
  if (!term) return '';
  return term
    .normalize('NFC')
    .toLowerCase()
    .trim()
    .replace(/[\s\-_]+/g, ' ');
}

export interface BulkAddResult {
  updatedExpressions: LexicalExpression[];
  addedCount: number;
  ignoredCount: number;
  addedItems: LexicalExpression[];
}

/**
 * Bulk adds candidate terms to the review dictionary:
 * 1. Considers the complete set of candidates (not just visible page)
 * 2. Compares against all registered expressions using normalized comparison keys
 * 3. Prevents duplicates
 * 4. Preserves human decisions already registered (approved, rejected, pending)
 * 5. Adds only new terms with status 'pending'
 * 6. Returns updated list with accurate added and ignored counts
 */
export function addAllCandidateTerms(
  candidates: LexicalExpression[],
  existingExpressions: LexicalExpression[]
): BulkAddResult {
  const existingKeySet = new Set<string>();

  for (const expr of existingExpressions) {
    if (expr.original) existingKeySet.add(normalizeExpressionKey(expr.original));
    if (expr.normalized) existingKeySet.add(normalizeExpressionKey(expr.normalized));
  }

  const addedItems: LexicalExpression[] = [];
  let ignoredCount = 0;

  for (const cand of candidates) {
    const key = normalizeExpressionKey(cand.original);
    const normKey = normalizeExpressionKey(cand.normalized);

    // If candidate or its normalized equivalent already exists, preserve existing decision & ignore
    if (existingKeySet.has(key) || existingKeySet.has(normKey)) {
      ignoredCount++;
      continue;
    }

    // Register so later candidates in the same batch don't duplicate
    existingKeySet.add(key);
    existingKeySet.add(normKey);

    const newExpr: LexicalExpression = {
      ...cand,
      id: cand.id && cand.id.startsWith('stat_')
        ? cand.id
        : `cand_${Date.now()}_${Math.random().toString(36).substr(2, 7)}`,
      status: 'pending', // Rule 3.4: Methodological requirement: added in batch receive 'pending'
      appliedCount: 0,
      justification:
        cand.justification ||
        `Expressão candidata estatística (N-grama com ${cand.frequency} ocorrência(s)) adicionada para revisão.`,
    };

    addedItems.push(newExpr);
  }

  return {
    updatedExpressions: [...existingExpressions, ...addedItems],
    addedCount: addedItems.length,
    ignoredCount,
    addedItems,
  };
}

/**
 * Method B: Extract statistical n-grams (2 to 5 words) across all documents with NPMI association calculation
 */
export function extractStatisticalCandidates(
  documents: DocumentItem[],
  existingExpressions: LexicalExpression[] = [],
  maxCandidates: number = 250
): LexicalExpression[] {
  const existingMap = new Map<string, LexicalExpression>();
  for (const expr of existingExpressions) {
    existingMap.set(normalizeExpressionKey(expr.original), expr);
  }

  const unigramCounts = new Map<string, number>();
  let totalTokenCount = 0;

  const ngramCounts = new Map<
    string,
    {
      count: number;
      docs: Set<string>;
      words: string[];
      sampleContexts: { docId: string; docName: string; snippet: string }[];
    }
  >();

  // Tokenize per document
  for (const doc of documents) {
    const text = doc.sectionCleanedText || doc.normalizedText || doc.cleanedText || doc.rawText;
    if (!text) continue;

    const sentences = text.split(/(?<=[.?!;])\s+/);

    for (const sentence of sentences) {
      const words = tokenizeWords(sentence);
      if (words.length === 0) continue;

      totalTokenCount += words.length;

      // Count unigrams for PMI calculation
      for (const w of words) {
        unigramCounts.set(w, (unigramCounts.get(w) || 0) + 1);
      }

      if (words.length < 2) continue;

      // Extract 2-gram, 3-gram, 4-gram, 5-gram
      for (let n = 2; n <= Math.min(5, words.length); n++) {
        for (let i = 0; i <= words.length - n; i++) {
          const slice = words.slice(i, i + n);

          // Filtering heuristic: N-gram should not start or end with a pure preposition/conjunction
          const firstWord = slice[0];
          const lastWord = slice[slice.length - 1];

          if (PORTUGUESE_STOPWORDS.has(firstWord) || PORTUGUESE_STOPWORDS.has(lastWord)) {
            continue;
          }

          // Count content words (at least 2 non-stopwords or meaningful pattern)
          const contentWords = slice.filter((w) => !PORTUGUESE_STOPWORDS.has(w));
          if (contentWords.length < 2) {
            continue;
          }

          const phrase = slice.join(' ');

          // Skip numbers only or single letters
          if (/^\d+(\s+\d+)*$/.test(phrase) || phrase.length < 4) {
            continue;
          }

          let entry = ngramCounts.get(phrase);
          if (!entry) {
            entry = { count: 0, docs: new Set(), words: slice, sampleContexts: [] };
            ngramCounts.set(phrase, entry);
          }

          entry.count++;
          entry.docs.add(doc.id);

          if (entry.sampleContexts.length < 3) {
            const snippet = sentence.trim().length > 150 ? sentence.trim().substring(0, 150) + '...' : sentence.trim();
            if (!entry.sampleContexts.some((c) => c.snippet === snippet)) {
              entry.sampleContexts.push({
                docId: doc.id,
                docName: doc.name,
                snippet,
              });
            }
          }
        }
      }
    }
  }

  const results: LexicalExpression[] = [];
  const safeTotalTokens = Math.max(totalTokenCount, 100);

  // Filter and compute NPMI scores
  for (const [phrase, data] of ngramCounts.entries()) {
    // Only consider expressions appearing at least twice or across multiple documents
    if (data.count < 2 && data.docs.size < 2) {
      continue;
    }

    const words = data.words;
    const normalized = words.join('_');

    // Compute Normalized Pointwise Mutual Information (NPMI)
    // P(ngram) = data.count / safeTotalTokens
    // P(w_i) = unigramCount(w_i) / safeTotalTokens
    const pNgram = data.count / safeTotalTokens;
    let sumLogPWords = 0;

    for (const w of words) {
      const pW = (unigramCounts.get(w) || 1) / safeTotalTokens;
      sumLogPWords += Math.log2(pW);
    }

    const log2PNgram = Math.log2(pNgram);
    const pmi = log2PNgram - sumLogPWords;
    // NPMI = PMI / -log2(P(ngram))
    const npmi = log2PNgram !== 0 ? Math.max(-1, Math.min(1, pmi / -log2PNgram)) : 0;

    // Check if already in dictionary or previous list
    const existing = existingMap.get(phrase);
    if (existing) {
      results.push({
        ...existing,
        frequency: data.count,
        docCount: data.docs.size,
        npmiScore: parseFloat(npmi.toFixed(3)),
        contexts: data.sampleContexts,
      });
      continue;
    }

    // Ambiguity scoring heuristic
    // High NPMI (> 0.45) indicates strong fixed phrase (low ambiguity ~0.2)
    // Low NPMI with 2 words indicates probable free combination (high ambiguity ~0.7)
    let ambiguityScore = 0.5;
    if (npmi > 0.45) {
      ambiguityScore = 0.2;
    } else if (words.length >= 3 && npmi > 0.25) {
      ambiguityScore = 0.3;
    } else if (words.length === 2 && npmi < 0.2) {
      ambiguityScore = 0.75;
    }

    results.push({
      id: `stat_${Math.random().toString(36).substr(2, 9)}`,
      original: phrase,
      normalized: normalized,
      source: 'statistical',
      frequency: data.count,
      docCount: data.docs.size,
      npmiScore: parseFloat(npmi.toFixed(3)),
      contexts: data.sampleContexts,
      status: 'pending',
      ambiguityScore,
      appliedCount: 0,
    });
  }

  // Sort by frequency descending
  results.sort((a, b) => b.frequency - a.frequency);

  return results.slice(0, maxCandidates);
}

/**
 * Initializes the default academic dictionary expressions (Method A)
 */
export function initializeDefaultDictionary(documents: DocumentItem[]): LexicalExpression[] {
  return DEFAULT_ACADEMIC_COMPOUND_WORDS.map((item, idx) => {
    let totalFreq = 0;
    const docSet = new Set<string>();
    const contexts: { docId: string; docName: string; snippet: string }[] = [];

    // Always create a fresh RegExp instance to avoid shared lastIndex state issues
    const escaped = item.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, 'gui');

    for (const doc of documents) {
      const text = doc.sectionCleanedText || doc.normalizedText || doc.cleanedText || doc.rawText;
      regex.lastIndex = 0;
      const matches = text.match(regex);
      if (matches) {
        totalFreq += matches.length;
        docSet.add(doc.id);

        if (contexts.length < 2) {
          const sentences = text.split(/(?<=[.?!])\s+/);
          const found = sentences.find((s) => {
            const singleRegex = new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, 'ui');
            return singleRegex.test(s);
          });
          if (found) {
            contexts.push({
              docId: doc.id,
              docName: doc.name,
              snippet: found.trim().substring(0, 140),
            });
          }
        }
      }
    }

    return {
      id: `dict_${idx + 1}`,
      original: item.original,
      normalized: item.normalized,
      source: 'dictionary',
      frequency: totalFreq,
      docCount: docSet.size,
      contexts,
      status: 'approved',
      ambiguityScore: 0.1,
      appliedCount: 0,
      category: item.category,
      justification: `Unidade conceitual padrão do vocabulário acadêmico (${item.category}).`,
    };
  });
}

/**
 * Applies approved compound expressions into text safely:
 * - Substitutes ONLY approved expressions.
 * - Sorts by length descending to prevent substring collisions (e.g. "gestão_estratégica_de_processos" before "gestão_de_processos").
 * - Enforces Unicode word boundary lookarounds `(?<![\p{L}\p{N}_])...(?![[\p{L}\p{N}_])` to prevent partial substitutions inside words or already unified tokens.
 * - Preserves accents and diacritics.
 * - Records complete audit trail in TransformationRecord.
 */
export function applyApprovedCompoundWords(
  text: string,
  approvedExpressions: LexicalExpression[],
  docId: string,
  docName: string
): { updatedText: string; transformations: TransformationRecord[] } {
  if (!text || approvedExpressions.length === 0) {
    return { updatedText: text, transformations: [] };
  }

  // Sort approved expressions by character length descending
  const sorted = [...approvedExpressions]
    .filter((e) => e.status === 'approved')
    .sort((a, b) => b.original.length - a.original.length);

  let updatedText = text;
  const transformations: TransformationRecord[] = [];

  for (const expr of sorted) {
    // Avoid double substitution if already normalized
    if (updatedText.includes(expr.normalized) && !updatedText.includes(expr.original)) {
      continue;
    }

    const escaped = expr.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, 'gui');
    pattern.lastIndex = 0;

    let occurrencesCount = 0;
    const newText = updatedText.replace(pattern, () => {
      occurrencesCount++;
      return expr.normalized;
    });

    if (occurrencesCount > 0) {
      transformations.push({
        id: `trans_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        timestamp: new Date().toISOString(),
        docId,
        docName,
        stage: 'lexical_unification',
        type: 'compound_replacement',
        ruleName: 'unificacao_lexical_iramuteq',
        description: `Unificação da expressão "${expr.original}" para "${expr.normalized}" (${occurrencesCount} ocorrência${occurrencesCount > 1 ? 's' : ''})`,
        beforeSnippet: expr.original,
        afterSnippet: expr.normalized,
        occurrencesCount,
        reversible: true,
      });
      updatedText = newText;
    }
  }

  return { updatedText, transformations };
}

/**
 * Reverts a specific compound expression back to its original separated form with boundary safety
 */
export function revertCompoundWord(text: string, normalized: string, original: string): string {
  if (!text || !normalized || !original) return text;
  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, 'gu');
  pattern.lastIndex = 0;
  return text.replace(pattern, original);
}
