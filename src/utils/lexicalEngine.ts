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
 * Method B: Extract statistical n-grams (2 to 5 words) across all documents
 */
export function extractStatisticalCandidates(
  documents: DocumentItem[],
  existingExpressions: LexicalExpression[] = []
): LexicalExpression[] {
  const existingMap = new Map<string, LexicalExpression>();
  for (const expr of existingExpressions) {
    existingMap.set(expr.original.toLowerCase(), expr);
  }

  const ngramCounts = new Map<string, { count: number; docs: Set<string>; sampleContexts: { docId: string; docName: string; snippet: string }[] }>();

  // Tokenize per document
  for (const doc of documents) {
    const text = doc.cleanedText || doc.rawText;
    if (!text) continue;

    // Split into sentences for context extraction
    const sentences = text.split(/(?<=[.?!;])\s+/);

    for (const sentence of sentences) {
      const words = tokenizeWords(sentence);
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

          // Skip numbers only
          if (/^\d+(\s+\d+)*$/.test(phrase)) {
            continue;
          }

          let entry = ngramCounts.get(phrase);
          if (!entry) {
            entry = { count: 0, docs: new Set(), sampleContexts: [] };
            ngramCounts.set(phrase, entry);
          }

          entry.count++;
          entry.docs.add(doc.id);

          if (entry.sampleContexts.length < 3) {
            // Find snippet in sentence
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

  // Filter and compute association scores
  for (const [phrase, data] of ngramCounts.entries()) {
    // Only consider expressions appearing at least twice across the corpus, or in multiple documents
    if (data.count < 2 && data.docs.size < 2) {
      continue;
    }

    const words = phrase.split(' ');
    const normalized = words.join('_');

    // Check if already in dictionary or previous list
    const existing = existingMap.get(phrase);
    if (existing) {
      results.push({
        ...existing,
        frequency: data.count,
        docCount: data.docs.size,
        contexts: data.sampleContexts,
      });
      continue;
    }

    // Ambiguity scoring heuristic (0 = unequivocal, 1 = highly ambiguous)
    // Phrases with high frequency and 3+ words tend to be strong conceptual units.
    // 2-word combinations that contain generic action verbs tend to be ambiguous.
    let ambiguityScore = 0.3;
    if (words.length === 2) {
      ambiguityScore = 0.65;
    } else if (words.length >= 3) {
      ambiguityScore = 0.35;
    }

    results.push({
      id: `stat_${Math.random().toString(36).substr(2, 9)}`,
      original: phrase,
      normalized: normalized,
      source: 'statistical',
      frequency: data.count,
      docCount: data.docs.size,
      contexts: data.sampleContexts,
      status: 'pending',
      ambiguityScore,
      appliedCount: 0,
    });
  }

  // Sort by frequency descending
  results.sort((a, b) => b.frequency - a.frequency);

  return results.slice(0, 100); // Top 100 candidate expressions
}

/**
 * Initializes the default academic dictionary expressions (Method A)
 */
export function initializeDefaultDictionary(documents: DocumentItem[]): LexicalExpression[] {
  return DEFAULT_ACADEMIC_COMPOUND_WORDS.map((item, idx) => {
    // Count occurrences in current corpus
    let totalFreq = 0;
    const docSet = new Set<string>();
    const contexts: { docId: string; docName: string; snippet: string }[] = [];

    const regex = new RegExp(`(?<![\\p{L}\\p{N}_])${item.original}(?![\\p{L}\\p{N}_])`, 'gui');

    for (const doc of documents) {
      const text = doc.cleanedText || doc.rawText;
      const matches = text.match(regex);
      if (matches) {
        totalFreq += matches.length;
        docSet.add(doc.id);

        if (contexts.length < 2) {
          const sentences = text.split(/(?<=[.?!])\s+/);
          const found = sentences.find((s) => regex.test(s));
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
      status: 'approved', // Pre-approved by academic dictionary
      ambiguityScore: 0.1, // High confidence
      appliedCount: 0,
      justification: `Unidade conceitual padrão do vocabulário acadêmico (${item.category}).`,
    };
  });
}

/**
 * Applies approved compound expressions into text safely:
 * - Substitutes ONLY approved expressions
 * - Sorts by length descending to prevent substring collisions (e.g. "gestão_estratégica_de_processos" before "gestão_de_processos")
 * - Enforces Unicode word boundary lookarounds `(?<![\p{L}\p{N}_])...(?![[\p{L}\p{N}_])`
 * - Preserves accents and diacritics
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
    // Word boundary that supports Unicode letters and underscores
    const escaped = expr.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, 'gui');

    let occurrencesCount = 0;
    const newText = updatedText.replace(pattern, (match) => {
      occurrencesCount++;
      // Match case sensitivity pattern or use defined normalized form
      return expr.normalized;
    });

    if (occurrencesCount > 0) {
      transformations.push({
        id: `trans_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        docId,
        docName,
        type: 'compound_replacement',
        description: `Unificação da expressão "${expr.original}" para "${expr.normalized}" (${occurrencesCount} ocorrência${occurrencesCount > 1 ? 's' : ''})`,
        beforeSnippet: expr.original,
        afterSnippet: expr.normalized,
      });
      updatedText = newText;
    }
  }

  return { updatedText, transformations };
}

/**
 * Reverts a specific compound expression back to its original separated form
 */
export function revertCompoundWord(text: string, normalized: string, original: string): string {
  if (!text || !normalized || !original) return text;
  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'gu');
  return text.replace(pattern, original);
}
