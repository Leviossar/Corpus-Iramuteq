import { AmbiguousCorrectionItem, DocumentSections, ExclusionSettings } from '../types/corpus';

// Known Portuguese prefixes that require hyphen under the orthographic agreement
const HYPHEN_PREFIXES = new Set([
  'pós', 'pré', 'pró', 'recém', 'além', 'aquém', 'sem', 'ex',
  'vice', 'sob', 'sub', 'inter', 'super', 'hiper', 'anti', 'auto',
  'co', 'contra', 'infra', 'ultra', 'micro', 'macro', 'multi',
]);

// Common compound roots & adjectives that preserve hyphenation across line breaks
const COMPOUND_ROOTS = new Set([
  'político', 'politico', 'sócio', 'socio', 'econômico', 'economico',
  'físico', 'fisico', 'químico', 'quimico', 'técnico', 'tecnico',
  'científico', 'cientifico', 'histórico', 'historico', 'social',
  'luso', 'afro', 'ítalo', 'franco', 'anglo', 'euro', 'latino',
  'médico', 'medico', 'hospitalar', 'psico', 'pedagógico', 'pedagogico',
  'norte', 'sul', 'centro', 'leste', 'oeste', 'segunda', 'terça', 'quarta',
  'quinta', 'sexta', 'feira',
]);

// Common Portuguese verbal enclitics (pronomes oblíquos átonos)
const ENCLITICS = new Set([
  'se', 'lhe', 'lhes', 'nos', 'me', 'te', 'vos', 'o', 'a', 'os', 'as',
  'lo', 'la', 'los', 'las', 'no', 'na', 'nos', 'nas',
]);

/**
 * Normalizes unicode text to NFC (Tier A: Safe deterministic transformation)
 */
export function normalizeUnicodeNFC(text: string): string {
  if (!text) return '';
  return text.normalize('NFC');
}

/**
 * Removes non-printable, zero-width, and control characters while preserving standard Portuguese punctuation (Tier A)
 */
export function cleanInvisibleCharacters(text: string): string {
  if (!text) return '';

  return (
    text
      // Remove zero-width spaces, joiners, directional marks, soft hyphens
      .replace(/[\u200B-\u200D\uFEFF\u00A0\u200E\u200F]/g, ' ')
      // Normalize curly quotes to standard forms
      .replace(/[“”«»]/g, '"')
      .replace(/[‘’‚‛]/g, "'")
      // Normalize em-dash / en-dash surrounded by spaces to hyphen
      .replace(/\s*[—–]\s*/g, ' - ')
      // Remove control characters except newline and tab
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      // Normalize multiple horizontal spaces to single space
      .replace(/[ \t]+/g, ' ')
  );
}

// Common standard Portuguese derivational suffixes that indicate broken single-word syllables
const COMMON_DERIVATIONAL_SUFFIXES = new Set([
  'mento', 'mentos', 'ção', 'ções', 'cao', 'coes', 'dade', 'dades',
  'tude', 'tudes', 'ismo', 'ismos', 'ista', 'istas', 'mente',
  'ência', 'ências', 'encia', 'encias', 'ância', 'âncias', 'ancia', 'ancias',
  'ável', 'áveis', 'avel', 'aveis', 'ível', 'íveis', 'ivel', 'iveis',
  'ional', 'ionais', 'ador', 'adores', 'adora', 'adoras', 'ante', 'antes',
  'ente', 'entes', 'eza', 'ezas', 'oso', 'osa', 'osos', 'osas',
  'logia', 'logias', 'tório', 'tórios', 'torio', 'torios',
]);

/**
 * Repairs de-hyphenation across line breaks with strict 3-tier safety classification:
 * - Tier A (Safe Automatic):
 *   * Preserves genuine lexical hyphens ("político-\neconômico" -> "político-econômico", "segunda-\nfeira" -> "segunda-feira")
 *   * Preserves enclitic pronouns ("recomenda-\nse" -> "recomenda-se")
 *   * Preserves orthographic prefixes ("pós-\ngraduação" -> "pós-graduação")
 *   * Joins verified single words with suffixes or broken syllables ("desenvolvi-\nmento" -> "desenvolvimento")
 * - Tier C (Ambiguous / Uncertain):
 *   * Preserves content without modification until researcher approves ("avaliação-\ninstitucional" -> "avaliação-institucional")
 *   * Flags for researcher review with accurate line number and context snippet
 */
export function fixLineBreakHyphenation(text: string): {
  cleanedText: string;
  ambiguousItems: AmbiguousCorrectionItem[];
} {
  if (!text) return { cleanedText: '', ambiguousItems: [] };

  const ambiguousItems: AmbiguousCorrectionItem[] = [];

  const cleanedText = text.replace(
    /([\p{L}]+)[-\u00AD\u2011]\s*[\r\n]+\s*([\p{L}]+)/gu,
    (match, p1: string, p2: string, offset: number) => {
      const lower1 = p1.toLowerCase();
      const lower2 = p2.toLowerCase();
      // Calculate accurate 1-indexed line number in the original text
      const lineNumber = (text.slice(0, offset).match(/\n/g) || []).length + 1;
      const context = text
        .slice(Math.max(0, offset - 25), Math.min(text.length, offset + match.length + 25))
        .replace(/\s+/g, ' ');

      // Tier A - Case 1: Enclitic pronoun (e.g. "recomenda-se", "observa-se", "tornou-se")
      if (ENCLITICS.has(lower2)) {
        return `${p1}-${p2}`;
      }

      // Tier A - Case 2: Prefixes that require hyphen (e.g. "pós-graduação", "pré-requisito", "ex-diretor")
      if (HYPHEN_PREFIXES.has(lower1)) {
        return `${p1}-${p2}`;
      }

      // Tier A - Case 3: Recognized compound adjectives & roots (e.g. "político-econômico", "sócio-econômico", "segunda-feira")
      if (COMPOUND_ROOTS.has(lower1) || COMPOUND_ROOTS.has(lower2) || lower2 === 'feira') {
        return `${p1}-${p2}`;
      }

      // Tier A - Case 4: Definite derivational suffixes or short syllable fragments (e.g. "desenvolvi-mento" -> "desenvolvimento", "implemen-tação" -> "implementação")
      const isSuffixOrFragment =
        COMMON_DERIVATIONAL_SUFFIXES.has(lower2) ||
        lower2.endsWith('ção') ||
        lower2.endsWith('ções') ||
        lower2.endsWith('cao') ||
        lower2.endsWith('coes') ||
        lower2.endsWith('mento') ||
        lower2.endsWith('mentos') ||
        lower2.endsWith('dade') ||
        lower2.endsWith('dades') ||
        lower2.endsWith('mente') ||
        p1.length < 4 ||
        p2.length < 4;

      if (isSuffixOrFragment) {
        return `${p1}${p2}`;
      }

      // Tier C - Case 5: Ambiguous compound check (both parts are independent Portuguese words with length >= 4)
      // e.g. "avaliação-institucional", "projeto-piloto", "custo-benefício"
      // Conservative rule: preserve content without alteration until researcher confirms
      const item: AmbiguousCorrectionItem = {
        id: `amb_${offset}_L${lineNumber}`,
        original: `${p1}-${p2}`,
        suggested: `${p1} ${p2}`,
        line: lineNumber,
        context,
        status: 'pending',
      };
      ambiguousItems.push(item);

      // Preserve hyphenated form safely until researcher reviews
      return `${p1}-${p2}`;
    }
  );

  return { cleanedText, ambiguousItems };
}

/**
 * Reconstructs continuous paragraphs from broken lines while respecting punctuation and headings
 */
export function reconstructParagraphs(text: string): string {
  if (!text) return '';

  const lines = text.split(/\r?\n/);
  const reconstructed: string[] = [];
  let currentParagraph = '';

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();

    if (!rawLine) {
      if (currentParagraph) {
        reconstructed.push(currentParagraph);
        currentParagraph = '';
      }
      continue;
    }

    // Ignore isolated page numbers e.g., "12", "Página 4", "p. 54"
    if (/^(página\s*\d+|\d+|p\.\s*\d+)$/i.test(rawLine)) {
      continue;
    }

    if (!currentParagraph) {
      currentParagraph = rawLine;
    } else {
      // Check if previous line ends with typical sentence terminator
      const endsWithTerminator = /[.?!:;]$/.test(currentParagraph);
      // Check if rawLine looks like a new section heading e.g., "1. INTRODUÇÃO"
      const isNewHeading = /^(?:[0-9]{1,2}\.|\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ\s]{4,}\b)/.test(rawLine);

      if (endsWithTerminator && isNewHeading) {
        reconstructed.push(currentParagraph);
        currentParagraph = rawLine;
      } else {
        // Join broken sentence fragment with a single space
        currentParagraph += ' ' + rawLine;
      }
    }
  }

  if (currentParagraph) {
    reconstructed.push(currentParagraph);
  }

  return reconstructed.join('\n\n');
}

/**
 * Scans the raw text to locate boundaries of academic sections with strict structural anchors:
 * - Must be anchored on its own line
 * - References must be in the final 60% of document to prevent chopping text in introduction
 */
export function detectAcademicSections(text: string): DocumentSections {
  const sections: DocumentSections = {};
  if (!text) return sections;

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length > 0) {
    sections.title = lines.slice(0, 2).join(' - ');
  }

  // Detect Abstract / Resumo with line-anchored heading
  const resumoMatch = text.match(/(?:^|\n)\s*(?:RESUMO|ABSTRACT)\b[\s\S]*?(?=\n\s*(?:[1-9]\.|\bINTRODU[ÇC][ÃA]O\b|\bPALAVRAS-CHAVE\b|\bKEYWORDS\b))/i);
  if (resumoMatch) {
    sections.abstract = resumoMatch[0].trim();
  }

  // Detect References with structural anchor: must be in the last 60% of document
  const totalLen = text.length;
  const searchStart = Math.floor(totalLen * 0.35); // only search in the second half/final portion
  const textSub = text.substring(searchStart);

  const refMatch = textSub.match(/(?:^|\n)\s*(?:[0-9]{1,2}\.?\s*)?(?:REFER[ÊE]NCIAS(?:\s+BIBLIOGR[ÁA]FICAS)?|REFERENCES)\s*(?:\n|$)[\s\S]*$/i);
  if (refMatch) {
    sections.references = refMatch[0].trim();
  }

  // Detect interviewer questions in dialogue corpora
  const interviewerMatches = text.match(/(?:^|\n)\s*(?:E:|Entrevistador:|Pesquisador:|Entrevistadora:)\s*.*?(?=\n\s*(?:P\d+:|Participante|Entrevistado|\n|$))/gi);
  if (interviewerMatches) {
    sections.interviewerQuestionsCount = interviewerMatches.length;
  }

  return sections;
}

/**
 * Applies optional section exclusions chosen by the researcher with safety guards
 */
export function applySectionExclusions(
  text: string,
  settings: ExclusionSettings,
  detected: DocumentSections
): string {
  if (!text) return '';
  let result = text;

  // Exclude References only if structurally confirmed at the end of text
  if (settings.excludeReferences && detected.references) {
    const searchStart = Math.floor(result.length * 0.35);
    const sub = result.substring(searchStart);
    const match = sub.match(/(?:^|\n)\s*(?:[0-9]{1,2}\.?\s*)?(?:REFER[ÊE]NCIAS(?:\s+BIBLIOGR[ÁA]FICAS)?|REFERENCES)\s*(?:\n|$)/i);

    if (match && match.index !== undefined) {
      result = result.substring(0, searchStart + match.index).trim();
    }
  }

  // Exclude Abstract / Resumo if enabled
  if (settings.excludeAbstract) {
    result = result.replace(/(?:^|\n)\s*(?:RESUMO|ABSTRACT)\b[\s\S]*?(?=\n\s*(?:[1-9]\.|\bINTRODU[ÇC][ÃA]O\b|\bPALAVRAS-CHAVE\b|\bKEYWORDS\b))/gi, '\n');
  }

  // Exclude Interviewer Questions if enabled (for interview corpora)
  if (settings.excludeInterviewerQuestions) {
    result = result.replace(/(?:^|\n)\s*(?:E:|Entrevistador:|Pesquisador:|Entrevistadora:)\s*[^\n]+(?:\?|\.|\n|$)/gi, '\n');
    result = result.replace(/(?:^|\n)\s*(?:P\d+:|Participante\s*\d+:|Entrevistado\s*\d+:)\s*/gi, '\n');
  }

  // Clean tables and figures if requested
  if (settings.excludeTables) {
    result = result.replace(/(?:^|\n)\s*(?:Tabela|Quadro|Figura|Gráfico)\s*\d+[:.\s][^\n]+/gi, '\n');
    result = result.replace(/(?:^|\n)\s*Fonte:\s*[^\n]+/gi, '\n');
  }

  if (settings.excludeFootnotes) {
    result = result.replace(/(?:^|\n)\s*\[\d+\]\s*[^\n]+/g, '\n');
    result = result.replace(/(?:^|\n)\s*\d+\s+Disponível em:[^\n]+/gi, '\n');
  }

  return result;
}

/**
 * Full deterministic pipeline execution for a document
 */
export function processFullDocumentCleaning(
  rawText: string,
  settings: ExclusionSettings,
  detected: DocumentSections
): {
  normalizedText: string;
  sectionCleanedText: string;
  ambiguousItems: AmbiguousCorrectionItem[];
} {
  if (!rawText) return { normalizedText: '', sectionCleanedText: '', ambiguousItems: [] };

  // 1. Unicode NFC
  let text = normalizeUnicodeNFC(rawText);

  // 2. Remove invisible chars
  text = cleanInvisibleCharacters(text);

  // 3. Fix line-break hyphenations with 3-tier rules
  const { cleanedText: dehyphenated, ambiguousItems } = fixLineBreakHyphenation(text);
  text = dehyphenated;

  // 4. Reconstruct paragraphs
  text = reconstructParagraphs(text);
  const normalizedText = text.trim();

  // 5. Apply researcher section exclusions
  const sectionCleanedText = applySectionExclusions(normalizedText, settings, detected)
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return {
    normalizedText,
    sectionCleanedText,
    ambiguousItems,
  };
}
