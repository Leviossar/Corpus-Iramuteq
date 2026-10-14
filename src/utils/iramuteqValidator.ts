import { DocumentItem, LexicalExpression, ValidationIssue, ValidationReport } from '../types/corpus';

/**
 * Validates variables according to IRaMuTeQ strict syntax rules:
 * - Must start with asterisk: *var_val
 * - No spaces, no hyphens inside the tag (only underscores allowed)
 * - Lowercase or uppercase letters, numbers, and underscores only
 */
export function sanitizeIramuteqVar(name: string, value: string): string {
  const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const cleanVal = value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
  return `*${cleanName}_${cleanVal}`;
}

/**
 * Generates the command line for a document in IRaMuTeQ
 * e.g., "**** *artigo_001 *ano_2024 *grupo_gestao"
 */
export function buildIramuteqCommandLine(doc: DocumentItem): string {
  const parts: string[] = ['****'];

  // Document ID variable
  const cleanId = doc.id.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
  parts.push(`*${cleanId}`);

  // Year variable
  if (doc.metadata.year) {
    const cleanYear = doc.metadata.year.replace(/[^0-9]/g, '');
    if (cleanYear) {
      parts.push(`*ano_${cleanYear}`);
    }
  }

  // Type / Mode variable
  if (doc.corpusMode === 'interviews' && doc.metadata.participantId) {
    const cleanPart = doc.metadata.participantId.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    parts.push(`*part_${cleanPart}`);
  } else if (doc.metadata.docType) {
    const cleanType = doc.metadata.docType.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    parts.push(`*tipo_${cleanType}`);
  }

  // Group variable
  if (doc.metadata.group) {
    const cleanGroup = doc.metadata.group.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    parts.push(`*grp_${cleanGroup}`);
  }

  // Custom variables
  if (doc.metadata.customVars) {
    for (const [key, val] of Object.entries(doc.metadata.customVars)) {
      if (val && val.trim()) {
        parts.push(sanitizeIramuteqVar(key, val));
      }
    }
  }

  return parts.join(' ');
}

/**
 * Performs full structural and linguistic audit of the corpus before export
 */
export function validateCorpus(
  documents: DocumentItem[],
  expressions: LexicalExpression[]
): ValidationReport {
  const issues: ValidationIssue[] = [];
  const seenIds = new Set<string>();

  let totalWords = 0;
  let totalCharacters = 0;

  if (documents.length === 0) {
    issues.push({
      id: 'err_no_docs',
      severity: 'error',
      category: 'empty_text',
      message: 'O corpus não contém documentos para exportação.',
      suggestion: 'Importe documentos na aba "Importar Documentos" ou carregue a amostra de exemplo.',
    });
  }

  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i];
    const text = (doc.reviewedText || doc.cleanedText || '').trim();

    // Check 1: Duplicate Document IDs
    if (seenIds.has(doc.id)) {
      issues.push({
        id: `err_dup_${doc.id}`,
        severity: 'error',
        category: 'duplicate',
        docId: doc.id,
        docName: doc.name,
        message: `Identificador duplicado: "${doc.id}". Cada texto no IRaMuTeQ deve possuir ID único.`,
        suggestion: 'Renomeie o ID na aba "Organizar Corpus".',
      });
    }
    seenIds.add(doc.id);

    // Check 2: Empty text
    if (!text) {
      issues.push({
        id: `err_empty_${doc.id}`,
        severity: 'error',
        category: 'empty_text',
        docId: doc.id,
        docName: doc.name,
        message: `Documento "${doc.name}" está vazio ou sem conteúdo textual após a limpeza.`,
        suggestion: 'Revise o texto original ou a extração do documento.',
      });
      continue;
    }

    const words = text.match(/[\p{L}\p{N}]+(?:[-_][\p{L}\p{N}]+)*/gu) || [];
    totalWords += words.length;
    totalCharacters += text.length;

    // Check 3: Short text warning (less than 100 words might yield few text segments in IRaMuTeQ)
    if (words.length < 50) {
      issues.push({
        id: `warn_short_${doc.id}`,
        severity: 'warning',
        category: 'empty_text',
        docId: doc.id,
        docName: doc.name,
        message: `Documento "${doc.name}" possui apenas ${words.length} palavras. Textos muito curtos podem prejudicar a análise de clusters (CHD).`,
        suggestion: 'Considere complementar o documento ou verificar se parte do texto foi indevidamente excluída.',
      });
    }

    // Check 4: Variable syntax in command line
    const commandLine = buildIramuteqCommandLine(doc);
    const varMatches = commandLine.match(/\*[^\s]+/g) || [];
    for (const v of varMatches) {
      if (/[^a-zA-Z0-9_*]/.test(v)) {
        issues.push({
          id: `err_var_${doc.id}_${v}`,
          severity: 'error',
          category: 'variable',
          docId: doc.id,
          docName: doc.name,
          message: `Variável "${v}" contém caracteres proibidos pelo IRaMuTeQ (apenas letras, números e sublinhados são válidos).`,
          suggestion: 'Ajuste os valores dos metadados removendo acentos, hífens e pontuações.',
        });
      }
    }

    // Check 5: Scanned PDF without OCR warning
    if (doc.isScannedPdf && !doc.ocrApplied && text.length < 150) {
      issues.push({
        id: `warn_ocr_${doc.id}`,
        severity: 'warning',
        category: 'illegal_char',
        docId: doc.id,
        docName: doc.name,
        message: `O documento "${doc.name}" aparenta ser um PDF digitalizado sem camada de texto vetorial.`,
        suggestion: 'Acione o OCR Tesseract na aba "Importar Documentos".',
      });
    }

    // Check 6: Check for unapproved or non-reviewed status
    if (doc.status !== 'reviewed') {
      issues.push({
        id: `info_unreviewed_${doc.id}`,
        severity: 'info',
        category: 'pending_review',
        docId: doc.id,
        docName: doc.name,
        message: `Documento "${doc.name}" ainda não foi marcado como revisado pelo pesquisador.`,
        suggestion: 'Revise o texto lado a lado na aba "Preparar Textos" e clique em "Aprovar Texto".',
      });
    }
  }

  // Check 7: Ambiguous expressions still pending review in lexical dictionary
  const pendingAmbiguous = expressions.filter((e) => e.status === 'pending' && e.ambiguityScore >= 0.4);
  if (pendingAmbiguous.length > 0) {
    issues.push({
      id: 'warn_pending_expr',
      severity: 'warning',
      category: 'pending_review',
      message: `Existem ${pendingAmbiguous.length} expressões candidatas pendentes de aprovação ou rejeição no Dicionário Lexical.`,
      suggestion: 'Acesse a aba "Dicionário Lexical" para aprovar ou rejeitar as expressões identificadas.',
    });
  }

  const errorsCount = issues.filter((i) => i.severity === 'error').length;
  const warningsCount = issues.filter((i) => i.severity === 'warning').length;

  let status: ValidationReport['status'] = 'ready';
  if (errorsCount > 0) {
    status = 'structural_error';
  } else if (warningsCount > 0) {
    status = 'needs_review';
  }

  return {
    timestamp: new Date().toISOString(),
    isValid: errorsCount === 0,
    status,
    totalDocuments: documents.length,
    totalWords,
    totalCharacters,
    issues,
    warningsCount,
    errorsCount,
  };
}

/**
 * Builds the complete IRaMuTeQ TXT formatted content (LF line endings, UTF-8 without BOM)
 */
export function generateIramuteqTxt(documents: DocumentItem[]): string {
  const parts: string[] = [];

  for (const doc of documents) {
    const commandLine = buildIramuteqCommandLine(doc);
    const content = (doc.reviewedText || doc.cleanedText || doc.rawText).trim();

    // Ensure command line is separated from text by single newline,
    // and paragraphs inside text are separated cleanly.
    parts.push(`${commandLine}\n${content}`);
  }

  // Join documents with double newline and enforce UNIX LF (\n)
  return parts.join('\n\n').replace(/\r\n/g, '\n');
}
