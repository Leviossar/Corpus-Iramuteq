import React, { useState, useEffect } from 'react';
import {
  FileText,
  CheckCircle2,
  Undo2,
  Redo2,
  RotateCcw,
  Sparkles,
  Sliders,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileCheck,
} from 'lucide-react';
import { DocumentItem, ExclusionSettings } from '../types/corpus';
import {
  detectAcademicSections,
  processFullDocumentCleaning,
} from '../utils/textNormalizer';

interface PrepareTextViewProps {
  documents: DocumentItem[];
  selectedDocId: string | null;
  onSelectDoc: (id: string) => void;
  onUpdateDocument: (updated: DocumentItem) => void;
}

export const PrepareTextView: React.FC<PrepareTextViewProps> = ({
  documents,
  selectedDocId,
  onSelectDoc,
  onUpdateDocument,
}) => {
  const currentDoc = documents.find((d) => d.id === selectedDocId) || documents[0];

  const [editableText, setEditableText] = useState<string>('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [showSettings, setShowSettings] = useState<boolean>(true);
  const [exclusions, setExclusions] = useState<ExclusionSettings>({
    excludeReferences: true,
    excludeAbstract: true,
    excludeTables: true,
    excludeFootnotes: true,
    excludeInterviewerQuestions: true,
  });

  // Sync state when selected document changes
  useEffect(() => {
    if (currentDoc) {
      const initialText = currentDoc.reviewedText || currentDoc.cleanedText || currentDoc.rawText;
      setEditableText(initialText);
      setHistory([initialText]);
      setHistoryIndex(0);
      setExclusions(currentDoc.exclusionSettings);
    }
  }, [currentDoc?.id]);

  if (!currentDoc) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 text-center">
        <p className="text-sm text-slate-500">
          Nenhum documento disponível para edição. Carregue um documento na aba "Importar Documentos".
        </p>
      </div>
    );
  }

  const handleTextChange = (newVal: string) => {
    setEditableText(newVal);
    // Add to history
    const nextHistory = history.slice(0, historyIndex + 1);
    nextHistory.push(newVal);
    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      setEditableText(prev);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      setEditableText(next);
    }
  };

  const handleApplyExclusionFilter = (newSettings: ExclusionSettings) => {
    setExclusions(newSettings);
    const detected = detectAcademicSections(currentDoc.rawText);
    const freshlyCleaned = processFullDocumentCleaning(currentDoc.rawText, newSettings, detected);
    const cleanedStr = freshlyCleaned.sectionCleanedText;
    handleTextChange(cleanedStr);

    onUpdateDocument({
      ...currentDoc,
      exclusionSettings: newSettings,
      normalizedText: freshlyCleaned.normalizedText,
      sectionCleanedText: cleanedStr,
      cleanedText: cleanedStr,
      reviewedText: cleanedStr,
    });
  };

  const handleRestoreOriginal = () => {
    if (confirm('Deseja restaurar o texto bruto original exatamente como extraído do arquivo?')) {
      handleTextChange(currentDoc.rawText);
    }
  };

  const handleApproveDocument = () => {
    onUpdateDocument({
      ...currentDoc,
      cleanedText: editableText,
      reviewedText: editableText,
      status: 'reviewed',
    });
    alert(`O documento "${currentDoc.name}" foi aprovado com sucesso para inclusão no corpus do IRaMuTeQ.`);
  };

  const originalWords = (currentDoc.rawText || '').split(/\s+/).filter(Boolean).length;
  const treatedWords = editableText.split(/\s+/).filter(Boolean).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Document Selection Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-slate-500 uppercase">Documento Atual:</label>
          <select
            value={currentDoc.id}
            onChange={(e) => onSelectDoc(e.target.value)}
            className="text-xs font-medium bg-white border border-slate-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-xs cursor-pointer"
          >
            {documents.map((d) => (
              <option key={d.id} value={d.id}>
                {d.id} — {d.name} ({d.status === 'reviewed' ? '✓ Revisado' : 'Pendente'})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
              showSettings ? 'bg-slate-200 text-slate-800' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            {showSettings ? 'Ocultar Opções de Exclusão' : 'Configurar Exclusões Acadêmicas'}
          </button>

          <button
            onClick={handleApproveDocument}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
          >
            <FileCheck className="w-3.5 h-3.5" />
            Aprovar Texto para Corpus
          </button>
        </div>
      </div>

      {/* Academic Exclusion Settings Panel */}
      {showSettings && (
        <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
          <div className="text-xs font-semibold text-slate-900 flex items-center justify-between">
            <span>Filtros Acadêmicos Determinísticos (Seções a excluir do texto analisado)</span>
            <span className="text-slate-400 font-normal">Exclusões exigem confirmação do pesquisador</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={exclusions.excludeReferences}
                onChange={(e) =>
                  handleApplyExclusionFilter({ ...exclusions, excludeReferences: e.target.checked })
                }
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span>Excluir Referências</span>
            </label>

            <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={exclusions.excludeAbstract}
                onChange={(e) =>
                  handleApplyExclusionFilter({ ...exclusions, excludeAbstract: e.target.checked })
                }
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span>Excluir Resumo / Abstract</span>
            </label>

            <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={exclusions.excludeTables}
                onChange={(e) =>
                  handleApplyExclusionFilter({ ...exclusions, excludeTables: e.target.checked })
                }
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span>Excluir Tabelas e Figuras</span>
            </label>

            <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={exclusions.excludeInterviewerQuestions}
                onChange={(e) =>
                  handleApplyExclusionFilter({
                    ...exclusions,
                    excludeInterviewerQuestions: e.target.checked,
                  })
                }
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span>Excluir Perguntas Entrevistador</span>
            </label>
          </div>
        </div>
      )}

      {/* Editor Controls Bar */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <button
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
            title="Desfazer alteração"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
            title="Refazer alteração"
          >
            <Redo2 className="w-4 h-4" />
          </button>
          <span className="text-slate-300">|</span>
          <button
            onClick={handleRestoreOriginal}
            className="px-2 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded cursor-pointer flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restaurar Original
          </button>
        </div>

        <div className="flex items-center gap-4 font-mono tabular-nums">
          <span>Original: {originalWords} palavras</span>
          <span>·</span>
          <span className="text-blue-600 font-semibold">Tratado: {treatedWords} palavras</span>
          <span>·</span>
          <span>Status: {currentDoc.status === 'reviewed' ? '✓ Aprovado' : 'Em Preparação'}</span>
        </div>
      </div>

      {/* Side-by-Side Comparison Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[580px]">
        {/* Left: Original Extracted Text */}
        <div className="flex flex-col bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              1. Texto Original Extraído (Somente Leitura)
            </span>
            <span className="text-xs text-slate-400 font-mono">
              {currentDoc.rawText.length} caracteres
            </span>
          </div>
          <div className="flex-1 p-4 overflow-y-auto font-mono text-xs text-slate-600 whitespace-pre-wrap leading-relaxed select-text bg-slate-50/30">
            {currentDoc.rawText}
          </div>
        </div>

        {/* Right: Cleaned & Normalized Editable Text */}
        <div className="flex flex-col bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs ring-1 ring-blue-500/20">
          <div className="px-4 py-2.5 bg-blue-50/50 border-b border-blue-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              2. Texto Tratado para o IRaMuTeQ (Editável pelo Pesquisador)
            </span>
            <span className="text-xs text-blue-700 font-mono">
              {editableText.length} caracteres
            </span>
          </div>
          <textarea
            value={editableText}
            onChange={(e) => handleTextChange(e.target.value)}
            className="flex-1 p-4 font-mono text-xs text-slate-800 leading-relaxed resize-none focus:outline-none focus:ring-0 bg-white"
            placeholder="O texto higienizado aparecerá aqui..."
          />
        </div>
      </div>
    </div>
  );
};
