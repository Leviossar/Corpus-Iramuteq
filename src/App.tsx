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

import {
  loadAllPersistedData,
  persistDocuments,
  persistExpressions,
  persistTransformations,
  clearProjectStores,
  removeFileBlob,
  setAppConfig,
} from './utils/db';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [corpusMode, setCorpusMode] = useState<CorpusMode>('articles');
  const [isTestsModalOpen, setIsTestsModalOpen] = useState<boolean>(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState<boolean>(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  // Storage readiness to prevent race conditions during hydration
  const [isStorageReady, setIsStorageReady] = useState<boolean>(false);

  // Managed application state
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [expressions, setExpressions] = useState<LexicalExpression[]>([]);
  const [transformations, setTransformations] = useState<TransformationRecord[]>([]);

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

  // Lifecycle: Hydrate state asynchronously from IndexedDB
  useEffect(() => {
    let isCancelled = false;

    async function initializeWorkspace() {
      try {
        const stored = await loadAllPersistedData();
        if (isCancelled) return;

        if (stored.isInitialized) {
          // Project exists: load exactly what user has (even if user deliberately emptied it)
          setDocuments(stored.documents);
          setExpressions(stored.expressions);
          setTransformations(stored.transformations);
          if (stored.documents.length > 0) {
            setSelectedDocId(stored.documents[0].id);
          }
        } else {
          // Brand new user workspace: populate default sample articles
          setDocuments(SAMPLE_ARTICLES);
          setSelectedDocId(SAMPLE_ARTICLES[0].id);

          const dict = initializeDefaultDictionary(SAMPLE_ARTICLES);
          const stats = extractStatisticalCandidates(SAMPLE_ARTICLES, dict);
          const initialExprs = [...dict, ...stats];
          setExpressions(initialExprs);
          setTransformations([]);

          // Persist the default dataset to IndexedDB
          await persistDocuments(SAMPLE_ARTICLES);
          await persistExpressions(initialExprs);
          await persistTransformations([]);
          await setAppConfig('project_initialized', true);
        }
      } catch (err) {
        console.warn('Erro ao inicializar espaço de trabalho via IndexedDB:', err);
      } finally {
        if (!isCancelled) {
          setIsStorageReady(true);
        }
      }
    }

    initializeWorkspace();

    return () => {
      isCancelled = true;
    };
  }, []);

  // Persist documents on change (Only after hydration to prevent empty overwrite)
  useEffect(() => {
    if (!isStorageReady) return;
    persistDocuments(documents).catch((e) => console.warn('Erro ao persistir documentos:', e));
  }, [documents, isStorageReady]);

  // Persist expressions on change
  useEffect(() => {
    if (!isStorageReady) return;
    persistExpressions(expressions).catch((e) => console.warn('Erro ao persistir expressões:', e));
  }, [expressions, isStorageReady]);

  // Persist transformations on change
  useEffect(() => {
    if (!isStorageReady) return;
    persistTransformations(transformations).catch((e) => console.warn('Erro ao persistir transformações:', e));
  }, [transformations, isStorageReady]);

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
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    removeFileBlob(id).catch(() => {});
    if (selectedDocId === id) {
      setSelectedDocId(null);
    }
    showToast('Documento removido do projeto.');
  };

  const handleConfirmClear = async (options: {
    clearDocuments: boolean;
    resetDictionary: boolean;
    clearHistory: boolean;
  }) => {
    if (options.clearDocuments) {
      setDocuments([]);
      setSelectedDocId(null);
      try {
        localStorage.removeItem('corpuslab_documents_v1');
      } catch {}
    }

    if (options.clearHistory) {
      setTransformations([]);
      try {
        localStorage.removeItem('corpuslab_transformations_v1');
      } catch {}
    }

    if (options.resetDictionary) {
      const defaultDict = initializeDefaultDictionary([]);
      setExpressions(defaultDict);
      try {
        localStorage.removeItem('corpuslab_expressions_v1');
      } catch {}
    }

    await clearProjectStores(options);
    showToast('As informações selecionadas foram limpas com sucesso no banco de dados local.');
  };

  const handleUpdateDocument = (updatedDoc: DocumentItem) => {
    setDocuments((prev) => prev.map((d) => (d.id === updatedDoc.id ? updatedDoc : d)));
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
            onUpdateDocument={handleUpdateDocument}
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
