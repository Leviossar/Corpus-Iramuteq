export type CorpusMode = 'articles' | 'interviews' | 'institutional';

export type DocumentStatus = 'imported' | 'processed' | 'pending_review' | 'reviewed';

export interface DocumentMetadata {
  title: string;
  year?: string;
  authors: string;
  group: string;
  language: string;
  docType: string;
  participantId?: string; // e.g. P01 for interviews
  customVars: Record<string, string>;
}

export interface DocumentSections {
  title?: string;
  abstract?: string;
  references?: string;
  footnotes?: string;
  tables?: string;
  interviewerQuestionsCount?: number;
}

export interface ExclusionSettings {
  excludeReferences: boolean;
  excludeAbstract: boolean;
  excludeTables: boolean;
  excludeFootnotes: boolean;
  excludeInterviewerQuestions: boolean; // only for interviews
}

export interface AmbiguousCorrectionItem {
  id: string;
  original: string;
  suggested: string;
  line: number;
  context: string;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface DocumentOcrStats {
  totalPages: number;
  ocrPages: number;
  nativePages: number;
  failedPages: number[];
  language: string;
}

export interface DocumentItem {
  // Stable internal ID (UUID/timestamp based) that never breaks project references
  id: string;
  // User-facing export identifier for IRaMuTeQ **** *exportId line
  exportId?: string;
  name: string;
  size: number;
  type: 'pdf' | 'docx' | 'doc' | 'txt';
  corpusMode: CorpusMode;

  // Explicit separation of text lifecycle stages
  rawText: string;            // Stage 1: verbatim extracted content (immutable baseline)
  normalizedText?: string;     // Stage 2: after deterministic de-hyphenation and punctuation cleanup
  sectionCleanedText?: string; // Stage 3: after confirmed academic section exclusions
  lexicalUnifiedText?: string; // Stage 4: after approved compound words substitution
  reviewedText: string;       // Stage 5: final version edited/confirmed by researcher
  cleanedText: string;        // Compatibility bridge

  status: DocumentStatus;
  metadata: DocumentMetadata;
  detectedSections: DocumentSections;
  exclusionSettings: ExclusionSettings;

  isScannedPdf?: boolean;
  ocrApplied?: boolean;
  ocrStats?: DocumentOcrStats;
  readingOrderWarning?: boolean;
  readingOrderDetails?: string;
  ambiguousCorrections?: AmbiguousCorrectionItem[];
  extractedAt: string;
  updatedAt?: string;

  // Stored file reference id for re-running OCR without re-uploading
  fileBlobKey?: string;
}

export type ExpressionSource = 'dictionary' | 'statistical' | 'gemini' | 'manual';
export type ExpressionStatus = 'pending' | 'approved' | 'rejected';
export type AIClassification = 'palavra_composta' | 'termo_tecnico' | 'combinacao_livre' | 'ambiguo';

export interface ExpressionContext {
  docId: string;
  docName: string;
  snippet: string;
}

export interface LexicalExpression {
  id: string;
  original: string; // e.g. "gestão de processos"
  normalized: string; // e.g. "gestão_de_processos"
  source: ExpressionSource;
  frequency: number;
  docCount: number;
  contexts: ExpressionContext[];
  status: ExpressionStatus;
  ambiguityScore: number; // 0 (clear) to 1 (highly ambiguous)
  npmiScore?: number; // Normalized Pointwise Mutual Information
  aiClassification?: AIClassification;
  aiSuggestedUnify?: boolean;
  justification?: string;
  appliedCount: number;
  isUserAdded?: boolean;
  category?: string;
}

export interface TokenBudgetState {
  dailyBudget: number; // default: 5000
  tokensUsedToday: number;
  maxTokensPerRequest: number; // default: 1500
  maxOutputTokens: number; // default: 300
  maxQueriesPerDay: number; // default: 10
  queriesExecutedToday: number;
  queriesAvoidedByCache: number;
  queriesBlockedByLimit: number;
  isPaused: boolean;
  model: string;
  apiStatus: 'ready' | 'offline' | 'exhausted' | 'rate_limited' | 'error';
  lastStatusMessage?: string;
  lastBudgetResetDate: string; // YYYY-MM-DD
}

export interface TransformationRecord {
  id: string;
  timestamp: string;
  docId: string;
  docName: string;
  stage: 'extraction' | 'normalization' | 'section_removal' | 'lexical_unification' | 'manual_edit';
  type: 'normalization' | 'section_removal' | 'compound_replacement' | 'manual_edit';
  description: string;
  ruleName?: string;
  beforeSnippet: string;
  afterSnippet: string;
  occurrencesCount?: number;
  reversible: boolean;
}

export interface AILogEntry {
  id: string;
  timestamp: string;
  model: string;
  expressionsCount: number;
  inputTokens: number;
  outputTokens: number;
  fromCache: boolean;
  fallbackTriggered: boolean;
  status: string;
  costEstimatedBrl: number;
}

export interface ValidationIssue {
  id: string;
  severity: 'error' | 'warning' | 'info';
  category: 'encoding' | 'command_line' | 'variable' | 'empty_text' | 'duplicate' | 'illegal_char' | 'pending_review' | 'doc_format';
  docId?: string;
  docName?: string;
  line?: number;
  message: string;
  suggestion?: string;
}

export interface ValidationReport {
  timestamp: string;
  isValid: boolean;
  status: 'ready' | 'needs_review' | 'structural_error';
  totalDocuments: number;
  totalWords: number;
  totalCharacters: number;
  issues: ValidationIssue[];
  warningsCount: number;
  errorsCount: number;
}

export interface PseudonymCandidate {
  id: string;
  docId: string;
  originalText: string;
  suggestedPseudonym: string;
  type: 'name' | 'contact' | 'identifier';
  contextSnippet: string;
  confirmed: boolean;
}
