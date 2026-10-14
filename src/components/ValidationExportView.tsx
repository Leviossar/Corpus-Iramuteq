import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  FileText,
  FileSpreadsheet,
  Archive,
  Copy,
  Check,
  Search,
  Info,
  ExternalLink,
} from 'lucide-react';
import {
  AILogEntry,
  DocumentItem,
  LexicalExpression,
  TransformationRecord,
} from '../types/corpus';
import {
  generateIramuteqTxt,
  validateCorpus,
} from '../utils/iramuteqValidator';
import {
  downloadFile,
  downloadFullCorpusZip,
  generateAIConsumptionCsv,
  generateExpressionsCsv,
  generateMetadataCsv,
  generateTransformationsCsv,
  generateValidationTextReport,
} from '../utils/exportManager';

interface ValidationExportViewProps {
  documents: DocumentItem[];
  expressions: LexicalExpression[];
  transformations: TransformationRecord[];
  aiLogs: AILogEntry[];
}

export const ValidationExportView: React.FC<ValidationExportViewProps> = ({
  documents,
  expressions,
  transformations,
  aiLogs,
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [searchPreview, setSearchPreview] = useState<string>('');
  const [isExportingZip, setIsExportingZip] = useState<boolean>(false);

  // Run real validation check
  const report = validateCorpus(documents, expressions);
  const fullTxtContent = generateIramuteqTxt(documents);

  const handleCopyTxt = () => {
    navigator.clipboard.writeText(fullTxtContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadZip = async () => {
    setIsExportingZip(true);
    try {
      await downloadFullCorpusZip(documents, expressions, transformations, aiLogs, report);
    } catch (err) {
      console.error(err);
      alert('Erro ao gerar arquivo ZIP.');
    } finally {
      setIsExportingZip(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Validação Estrutural & Exportação IRaMuTeQ
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Auditoria automatizada das convenções do IRaMuTeQ e download de arquivos em UTF-8 sem BOM com quebras LF.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleDownloadZip}
            disabled={isExportingZip || documents.length === 0}
            className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-md transition-colors cursor-pointer shadow-xs flex items-center gap-2"
          >
            <Archive className="w-4 h-4" />
            {isExportingZip ? 'Compactando Pacote...' : 'Baixar Pacote Completo (.ZIP)'}
          </button>
        </div>
      </div>

      {/* Audit Status Banner */}
      <div
        className={`rounded-xl p-5 border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
          report.status === 'ready'
            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
            : report.status === 'needs_review'
            ? 'bg-amber-50/70 border-amber-200 text-amber-900'
            : 'bg-red-50/70 border-red-200 text-red-900'
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            {report.status === 'ready' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            ) : report.status === 'needs_review' ? (
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600" />
            )}
          </div>
          <div>
            <div className="text-sm font-bold">
              {report.status === 'ready'
                ? 'Corpus Totalmente Validado — Pronto para Importação no IRaMuTeQ'
                : report.status === 'needs_review'
                ? 'Necessita Atenção: Alertas Metodológicos Detectados'
                : 'Erro Estrutural: Correções Obrigatórias Pendentes'}
            </div>
            <p className="text-xs mt-1 opacity-90 max-w-2xl leading-relaxed">
              {report.status === 'ready'
                ? 'Todas as linhas de comando, identificadores, variáveis e codificação UTF-8 pura foram auditadas com sucesso.'
                : report.status === 'needs_review'
                ? 'O corpus pode ser exportado, mas foram encontrados avisos (expressões pendentes no dicionário ou textos curtos).'
                : 'Existem erros estruturais que impedirão o IRaMuTeQ de segmentar o texto. Verifique a lista de apontamentos abaixo.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono font-medium shrink-0">
          <span>Erros: <strong className="text-red-700">{report.errorsCount}</strong></span>
          <span>·</span>
          <span>Alertas: <strong className="text-amber-700">{report.warningsCount}</strong></span>
          <span>·</span>
          <span>Documentos: <strong>{report.totalDocuments}</strong></span>
        </div>
      </div>

      {/* Detailed Issues Checklist */}
      {report.issues.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-3">
          <div className="text-xs font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-blue-600" />
            Apontamentos da Auditoria ({report.issues.length})
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {report.issues.map((iss) => (
              <div key={iss.id} className="py-2.5 flex items-start justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                        iss.severity === 'error'
                          ? 'bg-red-100 text-red-700'
                          : iss.severity === 'warning'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {iss.severity}
                    </span>
                    <span className="font-semibold text-slate-800">{iss.message}</span>
                  </div>
                  {iss.suggestion && (
                    <div className="text-slate-500 pl-7">{iss.suggestion}</div>
                  )}
                </div>

                {iss.docName && (
                  <span className="text-slate-400 font-mono text-[11px] shrink-0">
                    {iss.docName}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Individual Download Cards Grid */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-slate-900">
          Arquivos Individuais Disponíveis para Download
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Card 1: corpus_iramuteq.txt */}
          <div className="p-4 bg-white rounded-lg border border-slate-200 space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-blue-600 mb-1">
                <FileText className="w-5 h-5" />
                <span className="font-mono text-[10px] text-slate-400 font-semibold">UTF-8 LF</span>
              </div>
              <div className="font-semibold text-sm text-slate-900 font-mono">corpus_iramuteq.txt</div>
              <p className="text-xs text-slate-500 mt-1">
                Arquivo principal para análise no IRaMuTeQ. Contém apenas os identificadores com asteriscos e textos limpos.
              </p>
            </div>
            <button
              onClick={() => downloadFile(fullTxtContent, 'corpus_iramuteq.txt', 'text/plain;charset=utf-8')}
              className="w-full py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Baixar Corpus TXT
            </button>
          </div>

          {/* Card 2: metadados.csv */}
          <div className="p-4 bg-white rounded-lg border border-slate-200 space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-emerald-600 mb-1">
                <FileSpreadsheet className="w-5 h-5" />
                <span className="font-mono text-[10px] text-slate-400 font-semibold">CSV</span>
              </div>
              <div className="font-semibold text-sm text-slate-900 font-mono">metadados.csv</div>
              <p className="text-xs text-slate-500 mt-1">
                Catálogo completo de metadados: identificadores, anos, autores, categorias e variáveis customizadas.
              </p>
            </div>
            <button
              onClick={() => downloadFile(generateMetadataCsv(documents), 'metadados.csv', 'text/csv;charset=utf-8')}
              className="w-full py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Baixar Metadados CSV
            </button>
          </div>

          {/* Card 3: dicionario_expressoes.csv */}
          <div className="p-4 bg-white rounded-lg border border-slate-200 space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-indigo-600 mb-1">
                <FileSpreadsheet className="w-5 h-5" />
                <span className="font-mono text-[10px] text-slate-400 font-semibold">CSV</span>
              </div>
              <div className="font-semibold text-sm text-slate-900 font-mono">dicionario_expressoes.csv</div>
              <p className="text-xs text-slate-500 mt-1">
                Relação das palavras compostas aplicadas, frequência no corpus, fonte de identificação e decisões.
              </p>
            </div>
            <button
              onClick={() => downloadFile(generateExpressionsCsv(expressions), 'dicionario_expressoes.csv', 'text/csv;charset=utf-8')}
              className="w-full py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Baixar Dicionário CSV
            </button>
          </div>

          {/* Card 4: relatorio_transformacoes.csv */}
          <div className="p-4 bg-white rounded-lg border border-slate-200 space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-slate-600 mb-1">
                <FileSpreadsheet className="w-5 h-5" />
                <span className="font-mono text-[10px] text-slate-400 font-semibold">CSV</span>
              </div>
              <div className="font-semibold text-sm text-slate-900 font-mono">relatorio_transformacoes.csv</div>
              <p className="text-xs text-slate-500 mt-1">
                Registro de auditoria com rastreabilidade de todas as alterações determinísticas aplicadas aos textos.
              </p>
            </div>
            <button
              onClick={() => downloadFile(generateTransformationsCsv(transformations), 'relatorio_transformacoes.csv', 'text/csv;charset=utf-8')}
              className="w-full py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Baixar Transformações
            </button>
          </div>

          {/* Card 5: relatorio_validacao.txt */}
          <div className="p-4 bg-white rounded-lg border border-slate-200 space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-slate-600 mb-1">
                <FileText className="w-5 h-5" />
                <span className="font-mono text-[10px] text-slate-400 font-semibold">TXT</span>
              </div>
              <div className="font-semibold text-sm text-slate-900 font-mono">relatorio_validacao.txt</div>
              <p className="text-xs text-slate-500 mt-1">
                Laudo técnico de conformidade com as regras sintáticas e estatísticas requeridas pelo software IRaMuTeQ.
              </p>
            </div>
            <button
              onClick={() => downloadFile(generateValidationTextReport(report), 'relatorio_validacao.txt', 'text/plain;charset=utf-8')}
              className="w-full py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Baixar Laudo de Validação
            </button>
          </div>

          {/* Card 6: relatorio_consumo_ia.csv */}
          <div className="p-4 bg-white rounded-lg border border-slate-200 space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-amber-600 mb-1">
                <FileSpreadsheet className="w-5 h-5" />
                <span className="font-mono text-[10px] text-slate-400 font-semibold">CSV</span>
              </div>
              <div className="font-semibold text-sm text-slate-900 font-mono">relatorio_consumo_ia.csv</div>
              <p className="text-xs text-slate-500 mt-1">
                Histórico detalhado do uso de IA: tokens consumidos, modelo, data/hora, cache e acionamento do Plano B.
              </p>
            </div>
            <button
              onClick={() => downloadFile(generateAIConsumptionCsv(aiLogs), 'relatorio_consumo_ia.csv', 'text/csv;charset=utf-8')}
              className="w-full py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Baixar Consumo de IA
            </button>
          </div>
        </div>
      </div>

      {/* Live Preview of the Full IRaMuTeQ TXT file */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
              Pré-Visualização Integral do Corpus (corpus_iramuteq.txt)
            </span>
            <span className="text-xs text-slate-400 font-mono tabular-nums">
              {fullTxtContent.split('\n').length} linhas · {report.totalWords} palavras
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyTxt}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copiado!' : 'Copiar Texto Integral'}
            </button>
          </div>
        </div>

        <div className="p-4 bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto max-h-[500px] leading-relaxed selection:bg-blue-600 selection:text-white">
          <pre className="whitespace-pre-wrap">{fullTxtContent || 'Nenhum documento processado ainda.'}</pre>
        </div>
      </div>
    </div>
  );
};
