export type CorpusMode = 'articles' | 'interviews' | 'institutional';

export type DocumentStatus = 'imported' | 'processed' | 'reviewed';

export interface DocumentMetadata {
  title: string;
  year: string;
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

export interface DocumentItem {
  id: string; // e.g. doc_001
  name: string;
  size: number;
  type: 'pdf' | 'docx' | 'doc' | 'txt';
  corpusMode: CorpusMode;
  rawText: string;
  cleanedText: string;
  reviewedText: string;
  status: DocumentStatus;
  metadata: DocumentMetadata;
  detectedSections: DocumentSections;
  exclusionSettings: ExclusionSettings;
  isScannedPdf?: boolean;
  ocrApplied?: boolean;
  readingOrderWarning?: boolean;
  extractedAt: string;
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
  aiClassification?: AIClassification;
  aiSuggestedUnify?: boolean;
  justification?: string;
  appliedCount: number;
  isUserAdded?: boolean;
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
}

export interface TransformationRecord {
  id: string;
  timestamp: string;
  docId: string;
  docName: string;
  type: 'normalization' | 'section_removal' | 'compound_replacement' | 'manual_edit';
  description: string;
  beforeSnippet: string;
  afterSnippet: string;
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
  category: 'encoding' | 'command_line' | 'variable' | 'empty_text' | 'duplicate' | 'illegal_char' | 'pending_review';
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

export interface CustomDictionaryEntry {
  term: string;
  normalized: string;
  category: string;
  notes?: string;
}
