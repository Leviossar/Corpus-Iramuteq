import React from 'react';
import {
  FileText,
  CheckCheck,
  BookOpen,
  Cpu,
  Pause,
  Play,
  Flame,
  ArrowRight,
  ShieldAlert,
  Database,
  RefreshCw,
  FolderOpen,
  RotateCcw,
} from 'lucide-react';
import { DocumentItem, LexicalExpression, TokenBudgetState } from '../types/corpus';

interface OverviewViewProps {
  documents: DocumentItem[];
  expressions: LexicalExpression[];
  budget: TokenBudgetState;
  onTogglePauseAI: () => void;
  onSimulateFallback: () => void;
  onLoadSampleArticles: () => void;
  onLoadSampleInterviews: () => void;
  onOpenClearModal: () => void;
  onNavigate: (tab: 'import' | 'prepare' | 'dictionary' | 'organize' | 'validate') => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  documents,
  expressions,
  budget,
  onTogglePauseAI,
  onSimulateFallback,
  onLoadSampleArticles,
  onLoadSampleInterviews,
  onOpenClearModal,
  onNavigate,
}) => {
  const totalWords = documents.reduce((acc, doc) => {
    const text = doc.reviewedText || doc.cleanedText || doc.rawText || '';
    const words = text.match(/[\p{L}\p{N}]+(?:[-_][\p{L}\p{N}]+)*/gu);
    return acc + (words ? words.length : 0);
  }, 0);

  const reviewedDocsCount = documents.filter((d) => d.status === 'reviewed').length;
  const approvedExprCount = expressions.filter((e) => e.status === 'approved').length;
  const pendingExprCount = expressions.filter((e) => e.status === 'pending').length;

  // Preparation progress percentage
  let progressPct = 0;
  if (documents.length > 0) {
    const docReviewWeight = (reviewedDocsCount / documents.length) * 60;
    const exprWeight = expressions.length > 0 ? (approvedExprCount / expressions.length) * 40 : 20;
    progressPct = Math.min(100, Math.round(docReviewWeight + exprWeight));
  }

  const tokenUsagePct = Math.min(100, Math.round((budget.tokensUsedToday / budget.dailyBudget) * 100));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Welcome & Mode Alert */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Painel de Preparação de Corpus
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Higienização determinística local de textos e estruturação lexicográfica estrita para o software IRaMuTeQ.
          </p>
        </div>

        {/* Quick Sample Load Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onLoadSampleArticles}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
          >
            <FolderOpen className="w-3.5 h-3.5 text-blue-600" />
            Carregar Exemplo: Artigos
          </button>
          <button
            onClick={onLoadSampleInterviews}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
          >
            <FolderOpen className="w-3.5 h-3.5 text-emerald-600" />
            Carregar Exemplo: Entrevistas
          </button>

          <button
            onClick={onOpenClearModal}
            className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-red-700 bg-white border border-slate-300 hover:border-red-200 hover:bg-red-50/50 rounded-md transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
            title="Limpar todos os documentos ou reiniciar o projeto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Limpar Informações
          </button>
        </div>
      </div>

      {/* Primary KPI Grid (High density, tabular nums) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-white p-5 rounded-lg border border-slate-200">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Documentos</span>
            <FileText className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-slate-900 font-mono tabular-nums">
              {documents.length}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              ({reviewedDocsCount} revisados)
            </span>
          </div>
          <div className="mt-3 text-xs text-slate-500 flex items-center justify-between">
            <span>Volume de texto</span>
            <span className="font-mono tabular-nums font-semibold text-slate-700">
              {totalWords.toLocaleString('pt-BR')} palavras
            </span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white p-5 rounded-lg border border-slate-200">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Expressões Compostas</span>
            <BookOpen className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-slate-900 font-mono tabular-nums">
              {expressions.length}
            </span>
            <span className="text-xs text-emerald-600 font-medium">
              ({approvedExprCount} aprovadas)
            </span>
          </div>
          <div className="mt-3 text-xs text-slate-500 flex items-center justify-between">
            <span>Aguardando revisão</span>
            <span className={`font-mono tabular-nums font-semibold ${pendingExprCount > 0 ? 'text-amber-600' : 'text-slate-600'}`}>
              {pendingExprCount} pendentes
            </span>
          </div>
        </div>

        {/* Metric 3: Preparation Progress */}
        <div className="bg-white p-5 rounded-lg border border-slate-200">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Progresso Geral</span>
            <CheckCheck className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-blue-600 font-mono tabular-nums">
              {progressPct}%
            </span>
            <span className="text-xs text-slate-500">concluído</span>
          </div>
          <div className="mt-3 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Metric 4: Gemini AI Status & Budget */}
        <div className="bg-white p-5 rounded-lg border border-slate-200">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Assistência Gemini</span>
            <Cpu className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-sm font-bold uppercase tracking-wider ${budget.isPaused ? 'text-slate-500' : 'text-emerald-600'}`}>
              {budget.isPaused ? 'Pausado' : 'Ativo (Econômico)'}
            </span>
          </div>
          <div className="mt-3 text-xs text-slate-500 flex items-center justify-between">
            <span>Consumo diário</span>
            <span className="font-mono tabular-nums text-slate-700 font-semibold">
              {budget.tokensUsedToday} / {budget.dailyBudget} tok
            </span>
          </div>
        </div>
      </div>

      {/* AI Governance and Budget Monitor */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-blue-600" />
              Governança da Assistência Gemini e Limites de Consumo
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              O processamento determinístico local é a solução primária. O Gemini atua exclusivamente como classificador complementar de expressões ambíguas autorizadas.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onTogglePauseAI}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                budget.isPaused
                  ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {budget.isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              {budget.isPaused ? 'Reativar Assistência IA' : 'Pausar Utilização da IA'}
            </button>

            <button
              onClick={onSimulateFallback}
              className="px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-md transition-colors cursor-pointer flex items-center gap-1.5"
              title="Testar acionamento imediato do Plano B (contingência local sem conexão externa)"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              Testar Plano B
            </button>
          </div>
        </div>

        {/* Budget Bar and Stats */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-slate-600">
            <span>Orçamento Local de Tokens: <strong className="font-mono">{budget.tokensUsedToday} de {budget.dailyBudget}</strong> consumidos hoje</span>
            <span className="font-mono font-medium">{tokenUsagePct}% utilizado</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${tokenUsagePct > 80 ? 'bg-red-500' : 'bg-emerald-500'}`}
              style={{ width: `${tokenUsagePct}%` }}
            />
          </div>
        </div>

        {/* Audit mini-table */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
          <div className="p-3 bg-slate-50 rounded border border-slate-100">
            <div className="text-slate-500">Consultas Executadas</div>
            <div className="mt-1 font-mono font-bold text-slate-900 text-base">{budget.queriesExecutedToday} de {budget.maxQueriesPerDay}</div>
          </div>
          <div className="p-3 bg-slate-50 rounded border border-slate-100">
            <div className="text-slate-500">Poupadas pelo Cache</div>
            <div className="mt-1 font-mono font-bold text-emerald-700 text-base">{budget.queriesAvoidedByCache} consultas</div>
          </div>
          <div className="p-3 bg-slate-50 rounded border border-slate-100">
            <div className="text-slate-500">Bloqueadas pelo Limite</div>
            <div className="mt-1 font-mono font-bold text-slate-700 text-base">{budget.queriesBlockedByLimit}</div>
          </div>
          <div className="p-3 bg-slate-50 rounded border border-slate-100">
            <div className="text-slate-500">Modelo Configurado</div>
            <div className="mt-1 font-mono font-bold text-slate-900 text-xs truncate">{budget.model}</div>
          </div>
        </div>

        {budget.lastStatusMessage && (
          <div className="text-xs text-slate-500 flex items-center gap-1.5 pt-1">
            <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
            <span>Último status: {budget.lastStatusMessage}</span>
          </div>
        )}
      </div>

      {/* Guided Workflow Steps */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-slate-900">
          Fluxo Metodológico de Preparação
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <button
            onClick={() => onNavigate('import')}
            className="p-4 text-left bg-white hover:bg-slate-50 rounded-lg border border-slate-200 transition-colors cursor-pointer group"
          >
            <div className="text-xs font-semibold text-blue-600 mb-1">Passo 01</div>
            <div className="font-semibold text-slate-900 text-sm group-hover:text-blue-600 transition-colors">Importar</div>
            <p className="text-xs text-slate-500 mt-1">Envie PDFs, DOCX ou TXT com detecção de OCR.</p>
          </button>

          <button
            onClick={() => onNavigate('prepare')}
            className="p-4 text-left bg-white hover:bg-slate-50 rounded-lg border border-slate-200 transition-colors cursor-pointer group"
          >
            <div className="text-xs font-semibold text-blue-600 mb-1">Passo 02</div>
            <div className="font-semibold text-slate-900 text-sm group-hover:text-blue-600 transition-colors">Preparar Textos</div>
            <p className="text-xs text-slate-500 mt-1">Exclua referências e revise no editor lado a lado.</p>
          </button>

          <button
            onClick={() => onNavigate('dictionary')}
            className="p-4 text-left bg-white hover:bg-slate-50 rounded-lg border border-slate-200 transition-colors cursor-pointer group"
          >
            <div className="text-xs font-semibold text-blue-600 mb-1">Passo 03</div>
            <div className="font-semibold text-slate-900 text-sm group-hover:text-blue-600 transition-colors">Dicionário Lexical</div>
            <p className="text-xs text-slate-500 mt-1">N-gramas, termos compostos e desambiguação.</p>
          </button>

          <button
            onClick={() => onNavigate('organize')}
            className="p-4 text-left bg-white hover:bg-slate-50 rounded-lg border border-slate-200 transition-colors cursor-pointer group"
          >
            <div className="text-xs font-semibold text-blue-600 mb-1">Passo 04</div>
            <div className="font-semibold text-slate-900 text-sm group-hover:text-blue-600 transition-colors">Organizar Corpus</div>
            <p className="text-xs text-slate-500 mt-1">Atribua variáveis, anos e anonimize entrevistas.</p>
          </button>

          <button
            onClick={() => onNavigate('validate')}
            className="p-4 text-left bg-white hover:bg-slate-50 rounded-lg border border-slate-200 transition-colors cursor-pointer group"
          >
            <div className="text-xs font-semibold text-blue-600 mb-1">Passo 05</div>
            <div className="font-semibold text-slate-900 text-sm group-hover:text-blue-600 transition-colors">Validar & Exportar</div>
            <p className="text-xs text-slate-500 mt-1">Auditoria estrita e download do TXT e pacote ZIP.</p>
          </button>
        </div>
      </div>
    </div>
  );
};
