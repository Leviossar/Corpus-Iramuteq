import React, { useState } from 'react';
import {
  BookOpen,
  Plus,
  Check,
  X,
  Sparkles,
  Download,
  Upload,
  Cpu,
  Search,
  Filter,
  CheckCheck,
  RotateCcw,
  AlertCircle,
  HelpCircle,
  Edit2,
  FileSpreadsheet,
} from 'lucide-react';
import {
  DocumentItem,
  LexicalExpression,
  TokenBudgetState,
} from '../types/corpus';
import {
  applyApprovedCompoundWords,
  extractStatisticalCandidates,
} from '../utils/lexicalEngine';
import { classifyExpressionsBatch } from '../services/geminiService';
import { downloadFile } from '../utils/exportManager';

interface DictionaryViewProps {
  expressions: LexicalExpression[];
  documents: DocumentItem[];
  budget: TokenBudgetState;
  onUpdateExpressions: (exprs: LexicalExpression[]) => void;
  onUpdateDocuments: (docs: DocumentItem[]) => void;
  onUpdateBudget: (budget: TokenBudgetState) => void;
}

export const DictionaryView: React.FC<DictionaryViewProps> = ({
  expressions,
  documents,
  budget,
  onUpdateExpressions,
  onUpdateDocuments,
  onUpdateBudget,
}) => {
  const [activeFilter, setActiveFilter] = useState<'all' | 'dictionary' | 'statistical' | 'custom' | 'pending' | 'approved'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [newTermOriginal, setNewTermOriginal] = useState<string>('');
  const [newTermNormalized, setNewTermNormalized] = useState<string>('');
  const [isClassifying, setIsClassifying] = useState<boolean>(false);
  const [aiBatchConfirmOpen, setAiBatchConfirmOpen] = useState<boolean>(false);
  const [statusNotification, setStatusNotification] = useState<string | null>(null);

  // Filtered expressions
  const filteredExpressions = expressions.filter((expr) => {
    // Search
    const matchesSearch =
      expr.original.toLowerCase().includes(searchQuery.toLowerCase()) ||
      expr.normalized.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    // Filter
    if (activeFilter === 'dictionary') return expr.source === 'dictionary';
    if (activeFilter === 'statistical') return expr.source === 'statistical';
    if (activeFilter === 'custom') return expr.isUserAdded;
    if (activeFilter === 'pending') return expr.status === 'pending';
    if (activeFilter === 'approved') return expr.status === 'approved';
    return true;
  });

  // Candidate ambiguous expressions for AI
  const ambiguousPending = expressions.filter(
    (e) => e.status === 'pending' && e.ambiguityScore >= 0.4 && e.source !== 'dictionary'
  );

  const handleApprove = (id: string) => {
    const updated = expressions.map((e) => (e.id === id ? { ...e, status: 'approved' as const } : e));
    onUpdateExpressions(updated);
  };

  const handleReject = (id: string) => {
    const updated = expressions.map((e) => (e.id === id ? { ...e, status: 'rejected' as const } : e));
    onUpdateExpressions(updated);
  };

  const handleAddCustomTerm = () => {
    if (!newTermOriginal.trim()) return;
    const norm = newTermNormalized.trim() || newTermOriginal.trim().toLowerCase().replace(/\s+/g, '_');

    const newExpr: LexicalExpression = {
      id: `custom_${Date.now()}`,
      original: newTermOriginal.trim(),
      normalized: norm,
      source: 'manual',
      frequency: 1,
      docCount: 1,
      contexts: [],
      status: 'approved',
      ambiguityScore: 0.1,
      isUserAdded: true,
      appliedCount: 0,
      justification: 'Cadastrado manualmente pelo pesquisador.',
    };

    onUpdateExpressions([newExpr, ...expressions]);
    setNewTermOriginal('');
    setNewTermNormalized('');
  };

  const handleApplyAllApprovedToCorpus = () => {
    const approved = expressions.filter((e) => e.status === 'approved');
    if (approved.length === 0) {
      alert('Nenhuma expressão aprovada para aplicar. Aprove expressões na lista antes de unificar.');
      return;
    }

    let totalTransformations = 0;
    const updatedDocs = documents.map((doc) => {
      const textToTransform = doc.reviewedText || doc.cleanedText || doc.rawText;
      const { updatedText, transformations } = applyApprovedCompoundWords(
        textToTransform,
        approved,
        doc.id,
        doc.name
      );
      totalTransformations += transformations.length;

      return {
        ...doc,
        cleanedText: updatedText,
        reviewedText: updatedText,
      };
    });

    onUpdateDocuments(updatedDocs);
    setStatusNotification(
      `Sucesso: ${approved.length} expressões aprovadas foram aplicadas a todos os ${documents.length} documentos (${totalTransformations} substituições realizadas).`
    );
    setTimeout(() => setStatusNotification(null), 6000);
  };

  const handleTriggerAIBatch = async () => {
    setAiBatchConfirmOpen(false);
    setIsClassifying(true);

    try {
      const res = await classifyExpressionsBatch(expressions, true, false);
      onUpdateExpressions(res.updatedExpressions);
      onUpdateBudget(res.budgetState);
      setStatusNotification(res.message);
      setTimeout(() => setStatusNotification(null), 7000);
    } catch (err: any) {
      console.error(err);
      setStatusNotification('Erro ao processar lote: ' + err.message);
    } finally {
      setIsClassifying(false);
    }
  };

  const handleExportDictionaryCsv = () => {
    const csvContent =
      'original,normalizado,fonte,frequencia,status,justificativa\n' +
      expressions
        .map(
          (e) =>
            `"${e.original}","${e.normalized}","${e.source}",${e.frequency},"${e.status}","${e.justification || ''}"`
        )
        .join('\n');
    downloadFile(csvContent, 'dicionario_lexical_corpuslab.csv', 'text/csv;charset=utf-8');
  };

  const handleExportDictionaryJson = () => {
    const jsonStr = JSON.stringify(expressions, null, 2);
    downloadFile(jsonStr, 'dicionario_lexical_corpuslab.json', 'application/json;charset=utf-8');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Dicionário Lexical & Palavras Compostas
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Três métodos de identificação: Dicionário acadêmico, detecção estatística (n-gramas) e vocabulário do projeto com desambiguação assistida opcional.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportDictionaryCsv}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
            title="Exportar dicionário em formato CSV"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar CSV
          </button>
          <button
            onClick={handleExportDictionaryJson}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
            title="Exportar dicionário em formato JSON"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar JSON
          </button>

          <button
            onClick={handleApplyAllApprovedToCorpus}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Aplicar Aprovadas aos Documentos
          </button>
        </div>
      </div>

      {statusNotification && (
        <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-lg flex items-center justify-between">
          <span>{statusNotification}</span>
          <button onClick={() => setStatusNotification(null)} className="text-blue-500 hover:text-blue-800 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* AI Assisted Disambiguation Banner (Controlled & Frugal) */}
      <div className="bg-slate-900 text-white rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-400">
            <Cpu className="w-4 h-4" />
            Validação Linguística Assistida por IA (Gemini Flash-Lite)
          </div>
          <div className="text-sm font-semibold">
            {ambiguousPending.length > 0
              ? `${ambiguousPending.length} expressão(ões) ambígua(s) identificada(s) para segunda análise.`
              : 'Nenhuma expressão ambígua pendente de desambiguação no momento.'}
          </div>
          <p className="text-xs text-slate-400 max-w-2xl">
            Envia apenas expressões e frases curtas em lotes agrupados, nunca documentos inteiros. Respostas estruturadas com justificativas de até 12 palavras.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            disabled={ambiguousPending.length === 0 || isClassifying || budget.isPaused}
            onClick={() => setAiBatchConfirmOpen(true)}
            className="px-4 py-2 text-xs font-semibold text-slate-900 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed rounded-md transition-colors cursor-pointer shadow-xs flex items-center gap-2"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            {isClassifying ? 'Consultando Gemini...' : 'Solicitar Análise de Ambiguidades'}
          </button>
        </div>
      </div>

      {/* Add Custom Expression Form (Method C) */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 space-y-3">
        <div className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
          Método C — Cadastrar Nova Palavra Composta no Projeto
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <input
            type="text"
            placeholder="Expressão original (ex: segunda-feira ou capital humano)"
            value={newTermOriginal}
            onChange={(e) => setNewTermOriginal(e.target.value)}
            className="flex-1 text-xs bg-slate-50 border border-slate-300 rounded px-3 py-2 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 w-full"
          />
          <input
            type="text"
            placeholder="Forma com sublinhado (ex: capital_humano)"
            value={newTermNormalized}
            onChange={(e) => setNewTermNormalized(e.target.value)}
            className="flex-1 text-xs bg-slate-50 border border-slate-300 rounded px-3 py-2 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 w-full font-mono"
          />
          <button
            onClick={handleAddCustomTerm}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded transition-colors cursor-pointer shrink-0 shadow-xs flex items-center gap-1.5 w-full sm:w-auto justify-center"
          >
            <Plus className="w-3.5 h-3.5" />
            Adicionar ao Dicionário
          </button>
        </div>
      </div>

      {/* Search and Tabs Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Segmented filter tabs */}
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs font-medium">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
              activeFilter === 'all' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Todas ({expressions.length})
          </button>
          <button
            onClick={() => setActiveFilter('dictionary')}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
              activeFilter === 'dictionary' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Dicionário Padrão
          </button>
          <button
            onClick={() => setActiveFilter('statistical')}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
              activeFilter === 'statistical' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            N-gramas Estatísticos
          </button>
          <button
            onClick={() => setActiveFilter('pending')}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
              activeFilter === 'pending' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Pendentes de Revisão
          </button>
          <button
            onClick={() => setActiveFilter('approved')}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
              activeFilter === 'approved' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Aprovadas
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Filtrar expressões..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-xs"
          />
        </div>
      </div>

      {/* Expressions Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
              <tr>
                <th className="px-4 py-3">Expressão Original</th>
                <th className="px-4 py-3">Forma Unificada</th>
                <th className="px-4 py-3">Fonte</th>
                <th className="px-4 py-3 text-right">Ocorrências</th>
                <th className="px-4 py-3">Contexto Acadêmico</th>
                <th className="px-4 py-3">Classificação / Justificativa</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExpressions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    Nenhuma expressão encontrada para o filtro selecionado.
                  </td>
                </tr>
              ) : (
                filteredExpressions.map((expr) => {
                  const isApproved = expr.status === 'approved';
                  const isRejected = expr.status === 'rejected';

                  return (
                    <tr key={expr.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {expr.original}
                      </td>
                      <td className="px-4 py-3 font-mono text-blue-700 font-medium">
                        {expr.normalized}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {expr.source === 'dictionary'
                          ? 'Dicionário'
                          : expr.source === 'statistical'
                          ? 'N-grama Local'
                          : expr.source === 'gemini'
                          ? 'Assistida por IA'
                          : 'Manual'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">
                        {expr.frequency} em {expr.docCount} doc{expr.docCount > 1 ? 's' : ''}
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-xs truncate" title={expr.contexts[0]?.snippet}>
                        {expr.contexts[0]?.snippet || '—'}
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        {expr.aiClassification && (
                          <div className="font-mono text-xs text-blue-700 font-semibold mb-0.5">
                            [{expr.aiClassification}]
                          </div>
                        )}
                        <div className="text-slate-500 text-xs truncate" title={expr.justification}>
                          {expr.justification || '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${
                            isApproved
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : isRejected
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {isApproved ? 'Aprovada' : isRejected ? 'Rejeitada' : 'Pendente'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleApprove(expr.id)}
                            className={`p-1.5 rounded transition-colors cursor-pointer ${
                              isApproved
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                            }`}
                            title="Aprovar substituição"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleReject(expr.id)}
                            className={`p-1.5 rounded transition-colors cursor-pointer ${
                              isRejected
                                ? 'bg-red-100 text-red-800'
                                : 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                            }`}
                            title="Rejeitar substituição"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Batch AI Confirmation Modal */}
      {aiBatchConfirmOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200">
            <div className="flex items-center gap-2 text-slate-900 font-semibold text-base">
              <Cpu className="w-5 h-5 text-blue-600" />
              Autorização de Consulta ao Gemini
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              O pesquisador autoriza o envio de um lote compacto de{' '}
              <strong>{Math.min(8, ambiguousPending.length)} expressões ambíguas</strong> com frases curtas de contexto para o modelo <strong>{budget.model}</strong>?
            </p>

            <div className="p-3 bg-slate-50 rounded border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between text-slate-600">
                <span>Estimativa de consumo:</span>
                <span className="font-mono font-bold text-slate-900">~150 tokens</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Saldo diário restante:</span>
                <span className="font-mono font-bold text-emerald-600">
                  {budget.dailyBudget - budget.tokensUsedToday} tokens
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Contingência:</span>
                <span className="text-slate-700">Plano B automático em caso de 429 ou erro</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setAiBatchConfirmOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 rounded cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleTriggerAIBatch}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded shadow-xs cursor-pointer"
              >
                Autorizar e Consultar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
