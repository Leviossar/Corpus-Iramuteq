import React, { useState, useEffect } from 'react';
import {
  CorpusMode,
  DocumentItem,
  LexicalExpression,
  TokenBudgetState,
  TransformationRecord,
  AILogEntry,
} from './types/corpus';
import {
  DEFAULT_ACADEMIC_COMPOUND_WORDS,
  SAMPLE_ARTICLES,
  SAMPLE_INTERVIEWS,
} from './data/sampleDatasets';
import {
  extractStatisticalCandidates,
  initializeDefaultDictionary,
} from './utils/lexicalEngine';
import {
  loadAILogs,
  loadTokenBudget,
  saveTokenBudget,
} from './services/aiDecisionEngine';
import { classifyExpressionsBatch } from './services/geminiService';
import { validateCorpus } from './utils/iramuteqValidator';

// Components
import { ActiveTab, Navbar } from './components/Navbar';
import { OverviewView } from './components/OverviewView';
import { ImportView } from './components/ImportView';
import { PrepareTextView } from './components/PrepareTextView';
import { DictionaryView } from './components/DictionaryView';
import { CorpusOrganizationView } from './components/CorpusOrganizationView';
import { ValidationExportView } from './components/ValidationExportView';
import { TestsModal } from './components/TestsModal';
import { ClearDataModal } from './components/ClearDataModal';

const APP_DOCS_KEY = 'corpuslab_documents_v1';
const APP_EXPRS_KEY = 'corpuslab_expressions_v1';
const APP_TRANS_KEY = 'corpuslab_transformations_v1';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [corpusMode, setCorpusMode] = useState<CorpusMode>('articles');
  const [isTestsModalOpen, setIsTestsModalOpen] = useState<boolean>(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState<boolean>(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  // Initialize documents: load from localStorage or default to SAMPLE_ARTICLES
  const [documents, setDocuments] = useState<DocumentItem[]>(() => {
    try {
      const stored = localStorage.getItem(APP_DOCS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Erro ao carregar documentos do storage:', e);
    }
    return SAMPLE_ARTICLES;
  });

  // Initialize expressions
  const [expressions, setExpressions] = useState<LexicalExpression[]>(() => {
    try {
      const stored = localStorage.getItem(APP_EXPRS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Erro ao carregar expressões do storage:', e);
    }
    const dict = initializeDefaultDictionary(SAMPLE_ARTICLES);
    const stats = extractStatisticalCandidates(SAMPLE_ARTICLES, dict);
    return [...dict, ...stats];
  });

  // Transformations log
  const [transformations, setTransformations] = useState<TransformationRecord[]>(() => {
    try {
      const stored = localStorage.getItem(APP_TRANS_KEY);
      if (stored) return JSON.parse(stored);
    } catch {}
    return [];
  });

  // Token budget state
  const [budget, setBudget] = useState<TokenBudgetState>(() => loadTokenBudget());

  // AI Logs
  const [aiLogs, setAiLogs] = useState<AILogEntry[]>(() => loadAILogs());

  // Notification message
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 5000);
  };

  // Persist documents on change
  useEffect(() => {
    try {
      localStorage.setItem(APP_DOCS_KEY, JSON.stringify(documents));
    } catch (e) {
      console.warn('Erro ao salvar documentos:', e);
    }
  }, [documents]);

  // Persist expressions on change
  useEffect(() => {
    try {
      localStorage.setItem(APP_EXPRS_KEY, JSON.stringify(expressions));
    } catch (e) {
      console.warn('Erro ao salvar expressões:', e);
    }
  }, [expressions]);

  // Persist transformations on change
  useEffect(() => {
    try {
      localStorage.setItem(APP_TRANS_KEY, JSON.stringify(transformations));
    } catch (e) {
      console.warn('Erro ao salvar transformações:', e);
    }
  }, [transformations]);

  // Handlers
  const handleLoadSampleArticles = () => {
    setDocuments(SAMPLE_ARTICLES);
    setCorpusMode('articles');
    setSelectedDocId(SAMPLE_ARTICLES[0].id);

    const dict = initializeDefaultDictionary(SAMPLE_ARTICLES);
    const stats = extractStatisticalCandidates(SAMPLE_ARTICLES, dict);
    setExpressions([...dict, ...stats]);

    showToast('Amostra de 3 Artigos Científicos carregada com sucesso.');
  };

  const handleLoadSampleInterviews = () => {
    setDocuments(SAMPLE_INTERVIEWS);
    setCorpusMode('interviews');
    setSelectedDocId(SAMPLE_INTERVIEWS[0].id);

    const dict = initializeDefaultDictionary(SAMPLE_INTERVIEWS);
    const stats = extractStatisticalCandidates(SAMPLE_INTERVIEWS, dict);
    setExpressions([...dict, ...stats]);

    showToast('Amostra de 4 Entrevistas com participantes anônimos carregada com sucesso.');
  };

  const handleTogglePauseAI = () => {
    const nextState = !budget.isPaused;
    const updated = {
      ...budget,
      isPaused: nextState,
      lastStatusMessage: nextState
        ? 'Utilização do Gemini pausada manualmente pelo usuário. Processamento local ativo.'
        : 'Assistência do Gemini reativada.',
    };
    setBudget(updated);
    saveTokenBudget(updated);
    showToast(nextState ? 'Assistência de IA pausada. Modo local ativo.' : 'Assistência de IA reativada.');
  };

  const handleSimulateFallback = async () => {
    const res = await classifyExpressionsBatch(expressions, true, true);
    setExpressions(res.updatedExpressions);
    setBudget(res.budgetState);
    setAiLogs(loadAILogs());
    showToast('Plano B de contingência local testado com sucesso.');
  };

  const handleAddDocuments = (newDocs: DocumentItem[]) => {
    const updated = [...documents, ...newDocs];
    setDocuments(updated);

    // Refresh candidate statistical expressions
    const stats = extractStatisticalCandidates(updated, expressions);
    const existingMap = new Map(expressions.map((e) => [e.original.toLowerCase(), e]));

    const merged = [...expressions];
    for (const stat of stats) {
      if (!existingMap.has(stat.original.toLowerCase())) {
        merged.push(stat);
      }
    }
    setExpressions(merged);

    showToast(`${newDocs.length} documento(s) adicionado(s) e processado(s) localmente.`);
  };

  const handleRemoveDocument = (id: string) => {
    setDocuments(documents.filter((d) => d.id !== id));
    if (selectedDocId === id) {
      setSelectedDocId(null);
    }
    showToast('Documento removido.');
  };

  const handleConfirmClear = (options: {
    clearDocuments: boolean;
    resetDictionary: boolean;
    clearHistory: boolean;
  }) => {
    if (options.clearDocuments) {
      setDocuments([]);
      setSelectedDocId(null);
      localStorage.removeItem(APP_DOCS_KEY);
    }

    if (options.clearHistory) {
      setTransformations([]);
      localStorage.removeItem(APP_TRANS_KEY);
    }

    if (options.resetDictionary) {
      const defaultDict = initializeDefaultDictionary([]);
      setExpressions(defaultDict);
      localStorage.removeItem(APP_EXPRS_KEY);
    }

    showToast('As informações selecionadas foram limpas com sucesso.');
  };

  const handleUpdateDocument = (updatedDoc: DocumentItem) => {
    setDocuments(documents.map((d) => (d.id === updatedDoc.id ? updatedDoc : d)));
  };

  // Validation report
  const validationReport = validateCorpus(documents, expressions);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* 3-Zone Top Navigation Contract */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        documentsCount={documents.length}
        corpusMode={corpusMode}
        onOpenTests={() => setIsTestsModalOpen(true)}
        onOpenClearModal={() => setIsClearModalOpen(true)}
        isValidCorpus={validationReport.isValid}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white text-xs px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-bottom-2">
          <span className="w-2 h-2 rounded-full bg-blue-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Content Viewport */}
      <main className="flex-1">
        {activeTab === 'overview' && (
          <OverviewView
            documents={documents}
            expressions={expressions}
            budget={budget}
            onTogglePauseAI={handleTogglePauseAI}
            onSimulateFallback={handleSimulateFallback}
            onLoadSampleArticles={handleLoadSampleArticles}
            onLoadSampleInterviews={handleLoadSampleInterviews}
            onOpenClearModal={() => setIsClearModalOpen(true)}
            onNavigate={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'import' && (
          <ImportView
            documents={documents}
            onAddDocuments={handleAddDocuments}
            onRemoveDocument={handleRemoveDocument}
            onClearAll={() => setIsClearModalOpen(true)}
            onSelectDocumentForEdit={(id) => {
              setSelectedDocId(id);
              setActiveTab('prepare');
            }}
            onLoadSampleArticles={handleLoadSampleArticles}
            onLoadSampleInterviews={handleLoadSampleInterviews}
          />
        )}

        {activeTab === 'prepare' && (
          <PrepareTextView
            documents={documents}
            selectedDocId={selectedDocId}
            onSelectDoc={(id) => setSelectedDocId(id)}
            onUpdateDocument={handleUpdateDocument}
          />
        )}

        {activeTab === 'dictionary' && (
          <DictionaryView
            expressions={expressions}
            documents={documents}
            budget={budget}
            onUpdateExpressions={(exprs) => setExpressions(exprs)}
            onUpdateDocuments={(docs) => setDocuments(docs)}
            onUpdateBudget={(b) => setBudget(b)}
          />
        )}

        {activeTab === 'organize' && (
          <CorpusOrganizationView
            documents={documents}
            corpusMode={corpusMode}
            onUpdateCorpusMode={(mode) => setCorpusMode(mode)}
            onUpdateDocuments={(docs) => setDocuments(docs)}
          />
        )}

        {activeTab === 'validate' && (
          <ValidationExportView
            documents={documents}
            expressions={expressions}
            transformations={transformations}
            aiLogs={aiLogs}
          />
        )}
      </main>

      {/* Automated Tests Runner Modal */}
      <TestsModal
        isOpen={isTestsModalOpen}
        onClose={() => setIsTestsModalOpen(false)}
      />

      {/* Clear Project Data Modal */}
      <ClearDataModal
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        onConfirmClear={handleConfirmClear}
        documentsCount={documents.length}
        expressionsCount={expressions.length}
      />
    </div>
  );
}
