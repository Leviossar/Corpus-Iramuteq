import { DocumentSections, ExclusionSettings } from '../types/corpus';

/**
 * Normalizes unicode text to NFC and performs deterministic academic text sanitization
 * for IRaMuTeQ compatibility without altering scientific meaning or diacritics.
 */
export function normalizeUnicodeNFC(text: string): string {
  if (!text) return '';
  return text.normalize('NFC');
}

/**
 * Repairs de-hyphenation across line breaks:
 * e.g., "desenvolvi-\nmento" -> "desenvolvimento"
 * BUT preserves true lexical hyphens: e.g. "segunda-feira" or "sócio-econômico"
 */
export function fixLineBreakHyphenation(text: string): string {
  if (!text) return '';

  // Matches word fragment ending in hyphen or soft hyphen followed by newline and next word fragment
  // Handles soft-hyphen \u00AD, standard hyphen -, non-breaking hyphen \u2011
  return text.replace(/([\p{L}]+)[-\u00AD\u2011]\s*[\r\n]+\s*([\p{L}]+)/gu, (match, p1, p2) => {
    // If lowercased suffix is a common grammatical enclitic (e.g. "se", "lhe", "nos", "o", "a", "os", "as"),
    // preserve hyphen without newline: "recomenda-se"
    const enclitics = ['se', 'lhe', 'lhes', 'nos', 'me', 'te', 'vos', 'o', 'a', 'os', 'as', 'lo', 'la', 'los', 'las', 'no', 'na', 'nos', 'nas'];
    if (enclitics.includes(p2.toLowerCase())) {
      return `${p1}-${p2}`;
    }
    // Check if it's a recognized compound with hyphen like "segunda-feira"
    const combinedHyphen = `${p1}-${p2}`.toLowerCase();
    if (combinedHyphen.includes('feira')) {
      return `${p1}-${p2}`;
    }
    // Otherwise it was an artificial hyphenation caused by justification / translineation
    return `${p1}${p2}`;
  });
}

/**
 * Reconstructs continuous paragraphs from fragmented line breaks:
 * Lines ending without sentence-ending punctuation (. ? ! : ) are merged into a single line.
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
      // If previous line ends with a typical sentence terminator, start a new sentence or join with space
      const endsWithPunct = /[.?!:;]$/.test(currentParagraph);
      const startsWithCapital = /^[\p{Lu}\d]/u.test(rawLine);

      if (endsWithPunct && startsWithCapital && (lines[i - 1]?.trim() === '' || rawLine.length < 40)) {
        // Distinct paragraph boundary
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
 * Removes non-printable, zero-width, and problematic characters while preserving standard Portuguese punctuation.
 */
export function cleanInvisibleCharacters(text: string): string {
  if (!text) return '';

  return (
    text
      // Remove zero-width spaces, joiners, directional marks
      .replace(/[\u200B-\u200D\uFEFF\u00A0\u200E\u200F]/g, ' ')
      // Normalize curly quotes and accents to standard academic forms
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

/**
 * Scans the raw text to locate boundaries of common academic sections
 */
export function detectAcademicSections(text: string): DocumentSections {
  const sections: DocumentSections = {};
  if (!text) return sections;

  // Title detection (usually first non-empty lines)
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length > 0) {
    sections.title = lines.slice(0, 2).join(' - ');
  }

  // Detect Abstract / Resumo
  const resumoMatch = text.match(/(?:RESUMO|ABSTRACT)[\s\S]*?(?=\n\s*(?:[1-9]\.|\bINTRODU[ÇC][ÃA]O\b|\bPALAVRAS-CHAVE\b|\bKEYWORDS\b))/i);
  if (resumoMatch) {
    sections.abstract = resumoMatch[0].trim();
  }

  // Detect References / Referências
  const refMatch = text.match(/(?:\bREFER[ÊE]NCIAS(?:\s+BIBLIOGR[ÁA]FICAS)?\b|\bREFERENCES\b)[\s\S]*$/i);
  if (refMatch) {
    sections.references = refMatch[0].trim();
  }

  // Detect interviewer questions count (for interviews)
  const interviewerMatches = text.match(/(?:^|\n)\s*(?:E:|Entrevistador:|Pesquisador:|Entrevistadora:)\s*.*?(?=\n\s*(?:P\d+:|Participante|Entrevistado|\n|$))/gi);
  if (interviewerMatches) {
    sections.interviewerQuestionsCount = interviewerMatches.length;
  }

  return sections;
}

/**
 * Applies optional section exclusions chosen by the researcher
 */
export function applySectionExclusions(
  text: string,
  settings: ExclusionSettings,
  detected: DocumentSections
): string {
  if (!text) return '';
  let result = text;

  // Exclude References if enabled
  if (settings.excludeReferences && detected.references) {
    const refIndex = result.search(/(?:\bREFER[ÊE]NCIAS(?:\s+BIBLIOGR[ÁA]FICAS)?\b|\bREFERENCES\b)/i);
    if (refIndex !== -1) {
      result = result.substring(0, refIndex).trim();
    }
  }

  // Exclude Abstract / Resumo if enabled
  if (settings.excludeAbstract) {
    result = result.replace(/(?:^|\n)\s*(?:RESUMO|ABSTRACT)[\s\S]*?(?=\n\s*(?:[1-9]\.|\bINTRODU[ÇC][ÃA]O\b|\bPALAVRAS-CHAVE\b|\bKEYWORDS\b))/gi, '\n');
  }

  // Exclude Interviewer Questions if enabled (crucial for interview corpora)
  if (settings.excludeInterviewerQuestions) {
    // Strips out "Entrevistador: ... ?" or "E: ... ?" leaving only the participant response
    result = result.replace(/(?:^|\n)\s*(?:E:|Entrevistador:|Pesquisador:|Entrevistadora:)\s*[^\n]+(?:\?|\.|\n|$)/gi, '\n');
    // Also clean participant prefix like "P01: " or "Participante 01: " so the text flows as clean monologue
    result = result.replace(/(?:^|\n)\s*(?:P\d+:|Participante\s*\d+:|Entrevistado\s*\d+:)\s*/gi, '\n');
  }

  // Clean tables, notes and figures if requested
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
): string {
  if (!rawText) return '';

  // 1. Unicode NFC
  let text = normalizeUnicodeNFC(rawText);

  // 2. Remove invisible chars
  text = cleanInvisibleCharacters(text);

  // 3. Fix line-break hyphenations
  text = fixLineBreakHyphenation(text);

  // 4. Apply researcher section exclusions
  text = applySectionExclusions(text, settings, detected);

  // 5. Reconstruct paragraphs
  text = reconstructParagraphs(text);

  // 6. Clean excess empty lines (max 2 consecutive newlines)
  text = text.replace(/\n{3,}/g, '\n\n').trim();

  return text;
}
