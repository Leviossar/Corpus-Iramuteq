import React, { useState, useRef } from 'react';
import {
  Upload,
  FileText,
  AlertTriangle,
  Trash2,
  Eye,
  ScanLine,
  CheckCircle2,
  FolderOpen,
  Info,
  Loader2,
} from 'lucide-react';
import { DocumentItem } from '../types/corpus';
import {
  extractTextFromPdf,
  extractTextFromDocx,
  extractTextFromTxt,
  runRealMultiPageOcr,
} from '../utils/documentExtractor';
import {
  detectAcademicSections,
  processFullDocumentCleaning,
} from '../utils/textNormalizer';
import { storeFileBlob, getFileBlob } from '../utils/db';

interface ImportViewProps {
  documents: DocumentItem[];
  onAddDocuments: (newDocs: DocumentItem[]) => void;
  onUpdateDocument?: (updatedDoc: DocumentItem) => void;
  onRemoveDocument: (id: string) => void;
  onClearAll: () => void;
  onSelectDocumentForEdit: (id: string) => void;
  onLoadSampleArticles: () => void;
  onLoadSampleInterviews: () => void;
}

export const ImportView: React.FC<ImportViewProps> = ({
  documents,
  onAddDocuments,
  onUpdateDocument,
  onRemoveDocument,
  onClearAll,
  onSelectDocumentForEdit,
  onLoadSampleArticles,
  onLoadSampleInterviews,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [processingFiles, setProcessingFiles] = useState<{ name: string; progress: string }[]>([]);
  const [ocrModalDoc, setOcrModalDoc] = useState<DocumentItem | null>(null);
  const [ocrLanguage, setOcrLanguage] = useState<'por' | 'eng'>('por');
  const [isOcrRunning, setIsOcrRunning] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatusText, setOcrStatusText] = useState<string>('');
  const [ocrMissingFile, setOcrMissingFile] = useState<File | null>(null);
  const ocrAbortControllerRef = useRef<AbortController | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const processFiles = async (files: File[]) => {
    const validFiles = files.filter((f) =>
      /\.(pdf|docx|doc|txt)$/i.test(f.name)
    );

    if (validFiles.length === 0) {
      alert('Por favor, selecione arquivos válidos nos formatos .pdf, .docx, .doc ou .txt.');
      return;
    }

    const newDocItems: DocumentItem[] = [];

    for (const file of validFiles) {
      setProcessingFiles((prev) => [...prev, { name: file.name, progress: 'Extraindo texto...' }]);

      try {
        let extractedText = '';
        let isScanned = false;
        let readingOrderWarning = false;

        const ext = file.name.split('.').pop()?.toLowerCase();

        if (ext === 'pdf') {
          const res = await extractTextFromPdf(file);
          extractedText = res.text;
          isScanned = Boolean(res.isScannedPdf);
          readingOrderWarning = Boolean(res.readingOrderWarning);
        } else if (ext === 'docx') {
          const res = await extractTextFromDocx(file);
          extractedText = res.text;
        } else if (ext === 'doc') {
          // Legacy doc note
          extractedText = `[Aviso: O arquivo "${file.name}" está em formato binário .doc antigo. Recomendamos salvar como .docx para melhor precisão].`;
        } else {
          // txt
          const res = await extractTextFromTxt(file);
          extractedText = res.text;
        }

        // Section boundaries
        const detectedSections = detectAcademicSections(extractedText);

        const defaultExclusions = {
          excludeReferences: true,
          excludeAbstract: false,
          excludeTables: true,
          excludeFootnotes: true,
          excludeInterviewerQuestions: false,
        };

        const cleaned = processFullDocumentCleaning(extractedText, defaultExclusions, detectedSections);

        const docIndex = documents.length + newDocItems.length + 1;
        const generatedId = `doc_${String(docIndex).padStart(3, '0')}`;

        const item: DocumentItem = {
          id: generatedId,
          exportId: generatedId,
          name: file.name,
          size: file.size,
          type: (ext as any) || 'txt',
          corpusMode: 'articles',
          rawText: extractedText,
          normalizedText: cleaned.normalizedText,
          sectionCleanedText: cleaned.sectionCleanedText,
          cleanedText: cleaned.sectionCleanedText,
          reviewedText: cleaned.sectionCleanedText,
          status: 'processed',
          metadata: {
            title: detectedSections.title || file.name.replace(/\.[^/.]+$/, ''),
            year: new Date().getFullYear().toString(),
            authors: 'Autor Não Identificado',
            group: 'geral',
            language: 'pt-BR',
            docType: 'artigo',
            customVars: {},
          },
          detectedSections,
          exclusionSettings: defaultExclusions,
          isScannedPdf: isScanned,
          ocrApplied: false,
          readingOrderWarning,
          extractedAt: new Date().toISOString(),
        };

        await storeFileBlob(item.id, file);
        newDocItems.push(item);
      } catch (err: any) {
        console.error('Erro ao extrair documento:', err);
        setImportError(`Erro ao extrair o documento "${file.name}": ${err?.message || 'Falha na leitura do arquivo'}`);
      } finally {
        setProcessingFiles((prev) => prev.filter((p) => p.name !== file.name));
      }
    }

    if (newDocItems.length > 0) {
      onAddDocuments(newDocItems);
    }
  };

  const handleCancelOcr = () => {
    if (ocrAbortControllerRef.current) {
      ocrAbortControllerRef.current.abort();
      ocrAbortControllerRef.current = null;
    }
    setIsOcrRunning(false);
    setOcrStatusText('Operação de OCR cancelada pelo usuário.');
  };

  const handleStartOcr = async () => {
    if (!ocrModalDoc) return;
    setIsOcrRunning(true);
    setOcrProgress(5);
    setOcrStatusText('Recuperando arquivo do armazenamento local...');

    const abortController = new AbortController();
    ocrAbortControllerRef.current = abortController;

    try {
      let targetBlob: Blob | File | null = ocrMissingFile;
      if (!targetBlob) {
        targetBlob = await getFileBlob(ocrModalDoc.id);
      }

      if (!targetBlob) {
        setIsOcrRunning(false);
        setOcrStatusText('Arquivo original não encontrado no cache. Selecione o arquivo PDF abaixo para prosseguir.');
        return;
      }

      const ocrResult = await runRealMultiPageOcr(
        targetBlob,
        ocrLanguage,
        (update) => {
          setOcrProgress(update.percent);
          setOcrStatusText(update.statusText);
        },
        abortController.signal
      );

      if (!ocrResult.text || ocrResult.text.trim().length === 0) {
        throw new Error('Nenhum texto pôde ser reconhecido pelo motor OCR nas páginas processadas.');
      }

      setOcrStatusText('Normalizando texto extraído e identificando seções...');
      const detected = detectAcademicSections(ocrResult.text);
      const cleaned = processFullDocumentCleaning(ocrResult.text, ocrModalDoc.exclusionSettings, detected);

      const updatedDoc: DocumentItem = {
        ...ocrModalDoc,
        rawText: ocrResult.text,
        normalizedText: cleaned.normalizedText,
        sectionCleanedText: cleaned.sectionCleanedText,
        cleanedText: cleaned.sectionCleanedText,
        reviewedText: cleaned.sectionCleanedText,
        isScannedPdf: false,
        ocrApplied: true,
        ocrStats: ocrResult.stats,
        ambiguousCorrections: cleaned.ambiguousItems,
      };

      if (onUpdateDocument) {
        onUpdateDocument(updatedDoc);
      }

      setOcrProgress(100);
      setOcrStatusText(
        `OCR concluído com sucesso! ${ocrResult.stats.ocrPages} página(s) processada(s) via Tesseract, ${ocrResult.stats.nativePages} preservada(s) nativamente.`
      );

      setTimeout(() => {
        setIsOcrRunning(false);
        setOcrModalDoc(null);
        setOcrMissingFile(null);
      }, 1200);
    } catch (err: any) {
      if (err?.message?.includes('cancelada')) {
        setOcrStatusText('Operação de OCR interrompida pelo pesquisador.');
      } else {
        console.error('Falha no OCR:', err);
        setOcrStatusText(`Falha no OCR: ${err?.message || 'Erro durante processamento'}`);
      }
      setIsOcrRunning(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Importar Documentos
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Extração local determinística sem envio para a nuvem. Suporta PDF (com leitura de duas colunas), DOCX e TXT.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {documents.length > 0 && (
            <button
              onClick={onClearAll}
              className="px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-md transition-colors cursor-pointer"
            >
              Limpar Todos os Documentos
            </button>
          )}
        </div>
      </div>

      {importError && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{importError}</span>
          </div>
          <button
            onClick={() => setImportError(null)}
            className="text-red-500 hover:text-red-800 cursor-pointer font-bold px-1"
          >
            ×
          </button>
        </div>
      )}

      {/* Drag & Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleFileDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50/50'
            : 'border-slate-300 hover:border-slate-400 bg-white'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.doc,.txt"
          onChange={handleFileInputChange}
          className="hidden"
        />

        <div className="max-w-md mx-auto space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
            <Upload className="w-6 h-6" />
          </div>

          <div className="text-sm font-semibold text-slate-900">
            Arraste e solte seus arquivos aqui ou clique para selecionar
          </div>

          <p className="text-xs text-slate-500">
            Formatos suportados: PDF, DOCX e TXT. Múltiplos arquivos processados em lote.
          </p>

          <div className="pt-2 flex items-center justify-center gap-2 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> 100% Local no Navegador
            </span>
            <span>·</span>
            <span>Sem Limite de Páginas</span>
          </div>
        </div>
      </div>

      {/* Loading Progress of current processing files */}
      {processingFiles.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
          <div className="text-xs font-semibold text-blue-900 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            Processando {processingFiles.length} documento(s)...
          </div>
          <div className="space-y-1">
            {processingFiles.map((f, i) => (
              <div key={i} className="text-xs text-blue-700 flex justify-between">
                <span className="truncate max-w-md">{f.name}</span>
                <span>{f.progress}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Documents Table or Empty State */}
      {documents.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 p-8 text-center space-y-4">
          <div className="w-10 h-10 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
            <FolderOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-medium text-slate-900">Nenhum documento carregado</div>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Você pode importar seus próprios artigos científicos e entrevistas, ou experimentar com conjuntos de dados prontos.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={onLoadSampleArticles}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors cursor-pointer shadow-xs"
            >
              Carregar 3 Artigos Científicos de Exemplo
            </button>
            <button
              onClick={onLoadSampleInterviews}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
            >
              Carregar 4 Entrevistas de Exemplo
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Documentos no Projeto ({documents.length})
            </div>
            <div className="text-xs text-slate-500">
              Clique em "Revisar" para abrir o editor comparativo lado a lado
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {documents.map((doc) => {
              const wordCount = (doc.cleanedText || doc.rawText || '').split(/\s+/).filter(Boolean).length;

              return (
                <div key={doc.id} className="p-4 hover:bg-slate-50/80 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900 px-1.5 py-0.5 bg-slate-100 rounded">
                        {doc.id}
                      </span>
                      <span className="text-sm font-semibold text-slate-900 truncate">
                        {doc.name}
                      </span>
                      <span className="text-xs uppercase font-mono text-slate-400">
                        {doc.type}
                      </span>

                      {doc.status === 'reviewed' && (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Revisado
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span>{doc.metadata.title || 'Sem título'}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{wordCount.toLocaleString('pt-BR')} palavras</span>
                      <span aria-hidden="true">·</span>
                      <span>{(doc.size / 1024).toFixed(1)} KB</span>

                      {doc.readingOrderWarning && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span
                            className="text-amber-600 font-medium flex items-center gap-1 cursor-help"
                            title="Diagramação em duas colunas identificada. O CorpusLab reconstruiu a sequência de leitura processando a coluna esquerda e depois a coluna direita para evitar a mistura de frases."
                          >
                            <AlertTriangle className="w-3 h-3" />
                            Duas colunas detectadas
                          </span>
                        </>
                      )}
                    </div>

                    {/* Scanned PDF prompt */}
                    {doc.isScannedPdf && !doc.ocrApplied && (
                      <div className="pt-1.5 flex items-center gap-2">
                        <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded flex items-center gap-1">
                          <ScanLine className="w-3 h-3" />
                          PDF aparentemente digitalizado (pouco texto selecionável).
                        </span>
                        <button
                          onClick={() => setOcrModalDoc(doc)}
                          className="text-xs font-semibold text-blue-700 hover:text-blue-800 underline cursor-pointer"
                        >
                          Executar OCR Local (Tesseract)
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => onSelectDocumentForEdit(doc.id)}
                      className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5 text-blue-600" />
                      Revisar Texto
                    </button>

                    <button
                      onClick={() => onRemoveDocument(doc.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                      title="Excluir documento"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* OCR Confirmation Modal */}
      {ocrModalDoc && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200">
            <div className="flex items-center gap-2 text-slate-900 font-semibold text-base">
              <ScanLine className="w-5 h-5 text-blue-600" />
              Reconhecimento Óptico de Caracteres (OCR Local)
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              O arquivo <strong>{ocrModalDoc.name}</strong> é um PDF ou imagem com páginas digitalizadas. O CorpusLab executará o motor <strong>Tesseract.js</strong> de forma local e determinística, preservando páginas que já possuem texto nativo e convertendo apenas o material digitalizado.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">Idioma do documento para OCR:</label>
              <div className="flex gap-3 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="ocrLang"
                    disabled={isOcrRunning}
                    checked={ocrLanguage === 'por'}
                    onChange={() => setOcrLanguage('por')}
                  />
                  Português (por)
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="ocrLang"
                    disabled={isOcrRunning}
                    checked={ocrLanguage === 'eng'}
                    onChange={() => setOcrLanguage('eng')}
                  />
                  Inglês (eng)
                </label>
              </div>
            </div>

            {/* Missing Blob Selector (Fallback) */}
            {ocrStatusText.includes('não encontrado') && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-2">
                <div className="flex items-center gap-1.5 font-semibold">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Selecione o arquivo PDF original para OCR</span>
                </div>
                <p>O arquivo binário não está no cache local. Selecione-o novamente no seu disco:</p>
                <input
                  type="file"
                  accept=".pdf,image/*"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      setOcrMissingFile(e.target.files[0]);
                      setOcrStatusText('Arquivo carregado. Clique em "Iniciar OCR" para prosseguir.');
                    }
                  }}
                  className="text-xs w-full text-slate-700"
                />
              </div>
            )}

            {/* OCR Progress Indicator */}
            {isOcrRunning && (
              <div className="space-y-2 pt-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="flex justify-between text-xs text-slate-600 font-medium">
                  <span className="truncate pr-2">{ocrStatusText || 'Processando OCR...'}</span>
                  <span className="font-mono text-blue-700 shrink-0">{ocrProgress}%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${ocrProgress}%` }}
                  />
                </div>
              </div>
            )}

            {!isOcrRunning && ocrStatusText && !ocrStatusText.includes('não encontrado') && (
              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
                {ocrStatusText}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              {isOcrRunning ? (
                <button
                  type="button"
                  onClick={handleCancelOcr}
                  className="px-3.5 py-1.5 text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded cursor-pointer transition-colors"
                >
                  Cancelar OCR
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setOcrModalDoc(null);
                    setOcrMissingFile(null);
                    setOcrStatusText('');
                  }}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 rounded cursor-pointer"
                >
                  Fechar
                </button>
              )}

              {!isOcrRunning && (
                <button
                  type="button"
                  onClick={handleStartOcr}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  Iniciar OCR Real
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
