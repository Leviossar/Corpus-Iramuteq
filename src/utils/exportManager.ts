import JSZip from 'jszip';
import {
  AILogEntry,
  DocumentItem,
  LexicalExpression,
  TransformationRecord,
  ValidationReport,
} from '../types/corpus';
import { generateIramuteqTxt } from './iramuteqValidator';

/**
 * Escapes CSV values conforming to RFC 4180
 */
function escapeCsv(val: any): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Generates metadados.csv
 */
export function generateMetadataCsv(documents: DocumentItem[]): string {
  const headers = ['id', 'arquivo', 'titulo', 'ano', 'autores', 'tipo', 'idioma', 'grupo', 'status_revisao', 'variaveis_adicionais'];
  const rows = documents.map((doc) => {
    const customVarsStr = Object.entries(doc.metadata.customVars || {})
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');

    return [
      escapeCsv(doc.id),
      escapeCsv(doc.name),
      escapeCsv(doc.metadata.title),
      escapeCsv(doc.metadata.year),
      escapeCsv(doc.metadata.authors),
      escapeCsv(doc.metadata.docType || doc.corpusMode),
      escapeCsv(doc.metadata.language),
      escapeCsv(doc.metadata.group),
      escapeCsv(doc.status),
      escapeCsv(customVarsStr),
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Generates dicionario_expressoes.csv
 */
export function generateExpressionsCsv(expressions: LexicalExpression[]): string {
  const headers = ['expressao_original', 'expressao_unificada', 'fonte', 'ocorrencias_totais', 'documentos_com_ocorrencia', 'status_decisao', 'classificacao_ia', 'justificativa'];
  const rows = expressions.map((e) => [
    escapeCsv(e.original),
    escapeCsv(e.normalized),
    escapeCsv(e.source),
    escapeCsv(e.frequency),
    escapeCsv(e.docCount),
    escapeCsv(e.status),
    escapeCsv(e.aiClassification || 'nao_consultado'),
    escapeCsv(e.justification || ''),
  ].join(','));

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Generates relatorio_transformacoes.csv
 */
export function generateTransformationsCsv(transformations: TransformationRecord[]): string {
  const headers = ['id', 'timestamp', 'documento_id', 'documento_nome', 'tipo_transformacao', 'descricao', 'termo_antes', 'termo_depois'];
  const rows = transformations.map((t) => [
    escapeCsv(t.id),
    escapeCsv(t.timestamp),
    escapeCsv(t.docId),
    escapeCsv(t.docName),
    escapeCsv(t.type),
    escapeCsv(t.description),
    escapeCsv(t.beforeSnippet),
    escapeCsv(t.afterSnippet),
  ].join(','));

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Generates relatorio_consumo_ia.csv
 */
export function generateAIConsumptionCsv(logs: AILogEntry[]): string {
  const headers = ['id', 'data_hora', 'modelo', 'expressoes_analisadas', 'tokens_entrada', 'tokens_saida', 'recuperado_cache', 'plano_b_acionado', 'status', 'custo_estimado_brl'];
  const rows = logs.map((l) => [
    escapeCsv(l.id),
    escapeCsv(l.timestamp),
    escapeCsv(l.model),
    escapeCsv(l.expressionsCount),
    escapeCsv(l.inputTokens),
    escapeCsv(l.outputTokens),
    escapeCsv(l.fromCache ? 'sim' : 'nao'),
    escapeCsv(l.fallbackTriggered ? 'sim' : 'nao'),
    escapeCsv(l.status),
    escapeCsv(l.costEstimatedBrl.toFixed(4)),
  ].join(','));

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Generates relatorio_validacao.txt
 */
export function generateValidationTextReport(report: ValidationReport): string {
  const lines: string[] = [
    '=================================================================',
    'CORPUSLAB — RELATÓRIO DE AUDITORIA ESTRUTURAL PARA O IRAMUTEQ',
    `Data/Hora: ${report.timestamp}`,
    `Situação Geral: ${report.status === 'ready' ? 'PRONTO PARA EXPORTAÇÃO' : report.status === 'needs_review' ? 'NECESSITA REVISÃO' : 'ERRO ESTRUTURAL'}`,
    '=================================================================',
    '',
    `Total de Documentos no Corpus: ${report.totalDocuments}`,
    `Total de Palavras Aproximadas: ${report.totalWords}`,
    `Total de Caracteres: ${report.totalCharacters}`,
    `Erros Estruturais Críticos: ${report.errorsCount}`,
    `Alertas de Revisão Metodológica: ${report.warningsCount}`,
    '',
    '-----------------------------------------------------------------',
    'APONTAMENTOS DETALHADOS:',
    '-----------------------------------------------------------------',
  ];

  if (report.issues.length === 0) {
    lines.push('Nenhum problema estrutural encontrado. O corpus atende rigorosamente aos parâmetros do IRaMuTeQ.');
  } else {
    report.issues.forEach((iss, index) => {
      lines.push(`${index + 1}. [${iss.severity.toUpperCase()}] ${iss.message}`);
      if (iss.docName) lines.push(`   Documento: ${iss.docName} (ID: ${iss.docId})`);
      if (iss.suggestion) lines.push(`   Recomendação: ${iss.suggestion}`);
      lines.push('');
    });
  }

  lines.push('=================================================================');
  lines.push('Observação: O arquivo principal gerado (corpus_iramuteq.txt) utiliza');
  lines.push('codificação UTF-8 pura (sem marca de ordem de byte BOM) e quebras');
  lines.push('de linha em formato UNIX (LF), conforme exigido pelo software IRaMuTeQ.');

  return lines.join('\n');
}

/**
 * Helper to trigger browser download for any string / blob
 */
export function downloadFile(content: string, filename: string, mimeType: string = 'text/plain;charset=utf-8'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Packages the entire project bundle into a single ZIP file containing all 6 artifacts + project JSON
 */
export async function downloadFullCorpusZip(
  documents: DocumentItem[],
  expressions: LexicalExpression[],
  transformations: TransformationRecord[],
  aiLogs: AILogEntry[],
  validationReport: ValidationReport
): Promise<void> {
  const zip = new JSZip();

  // 1. corpus_iramuteq.txt
  const corpusTxt = generateIramuteqTxt(documents);
  zip.file('corpus_iramuteq.txt', corpusTxt);

  // 2. metadados.csv
  const metadataCsv = generateMetadataCsv(documents);
  zip.file('metadados.csv', metadataCsv);

  // 3. dicionario_expressoes.csv
  const expressionsCsv = generateExpressionsCsv(expressions);
  zip.file('dicionario_expressoes.csv', expressionsCsv);

  // 4. relatorio_transformacoes.csv
  const transformationsCsv = generateTransformationsCsv(transformations);
  zip.file('relatorio_transformacoes.csv', transformationsCsv);

  // 5. relatorio_validacao.txt
  const validationTxt = generateValidationTextReport(validationReport);
  zip.file('relatorio_validacao.txt', validationTxt);

  // 6. relatorio_consumo_ia.csv
  const aiCsv = generateAIConsumptionCsv(aiLogs);
  zip.file('relatorio_consumo_ia.csv', aiCsv);

  // 7. Backup do projeto em JSON para recarga futura
  const projectJson = JSON.stringify(
    {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      documents,
      expressions,
      transformations,
    },
    null,
    2
  );
  zip.file('projeto_corpuslab.json', projectJson);

  // Generate and trigger download
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'projeto_corpuslab.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
