import * as pdfjsLib from 'pdfjs-dist';
// Use local bundled worker from pdfjs-dist via Vite asset URL
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import mammoth from 'mammoth';
import { createWorker, Worker } from 'tesseract.js';
import { DocumentOcrStats } from '../types/corpus';

if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
}

export interface ExtractedDocumentResult {
  text: string;
  isScannedPdf?: boolean;
  pagesCount: number;
  readingOrderWarning?: boolean;
  readingOrderDetails?: string;
  ocrApplied?: boolean;
  ocrStats?: DocumentOcrStats;
}

export interface OcrProgressUpdate {
  currentPage: number;
  totalPages: number;
  percent: number;
  statusText: string;
}

/**
 * Reconstructs the reading order of text elements on a PDF page using spatial layout analysis:
 * - Detects two-column layout by analyzing the horizontal (X) distribution of text items.
 * - Handles full-width headlines/titles that span across both columns.
 * - Processes left column top-to-bottom, then right column top-to-bottom.
 */
function reconstructPageText(
  items: Array<{ str: string; transform: number[]; width: number; height: number }>,
  pageWidth: number
): { text: string; isTwoColumn: boolean; warningDetails?: string } {
  if (items.length === 0) return { text: '', isTwoColumn: false };

  const midX = pageWidth / 2;
  const colMargin = 35; // margin around the central gutter

  // Categorize items: spanning full-width, left column, or right column
  const leftItems: typeof items = [];
  const rightItems: typeof items = [];
  const spanningItems: typeof items = [];

  for (const item of items) {
    if (!item.str.trim()) continue;
    const x = item.transform[4];
    const width = item.width || 0;

    // Item spans across the center gutter
    if (x < midX - colMargin && x + width > midX + colMargin && width > pageWidth * 0.5) {
      spanningItems.push(item);
    } else if (x + width / 2 < midX) {
      leftItems.push(item);
    } else {
      rightItems.push(item);
    }
  }

  // Two-column criteria: both columns have substantial text blocks
  const isTwoColumn = leftItems.length >= 10 && rightItems.length >= 10;

  const sortTopToBottom = (list: typeof items) =>
    [...list].sort((a, b) => {
      const yDiff = b.transform[5] - a.transform[5];
      if (Math.abs(yDiff) > 6) return yDiff;
      return a.transform[4] - b.transform[4];
    });

  const renderTextFlow = (list: typeof items) => {
    let result = '';
    let lastY: number | null = null;
    let lastX: number | null = null;

    for (const it of list) {
      const y = it.transform[5];
      const x = it.transform[4];

      if (lastY !== null && Math.abs(y - lastY) > 8) {
        result += '\n';
      } else if (result && !result.endsWith('\n') && !result.endsWith(' ') && (lastX === null || x > lastX + 2)) {
        result += ' ';
      }
      result += it.str;
      lastY = y;
      lastX = x + (it.width || 0);
    }
    return result;
  };

  if (!isTwoColumn) {
    const sorted = sortTopToBottom(items);
    return { text: renderTextFlow(sorted), isTwoColumn: false };
  }

  // If two columns: first render any top spanning titles, then left column, then right column
  const sortedSpanningTop = sortTopToBottom(spanningItems.filter((i) => i.transform[5] > pageWidth * 0.7));
  const sortedLeft = sortTopToBottom(leftItems);
  const sortedRight = sortTopToBottom(rightItems);
  const sortedSpanningBottom = sortTopToBottom(spanningItems.filter((i) => i.transform[5] <= pageWidth * 0.7));

  const pageText = [
    renderTextFlow(sortedSpanningTop),
    renderTextFlow(sortedLeft),
    renderTextFlow(sortedRight),
    renderTextFlow(sortedSpanningBottom),
  ]
    .filter(Boolean)
    .join('\n\n');

  return {
    text: pageText,
    isTwoColumn: true,
    warningDetails: `Página diagramada em 2 colunas (${leftItems.length} blocos à esquerda, ${rightItems.length} à direita). Sequência de leitura reconstruída geometricamente.`,
  };
}

/**
 * Extracts text from PDF with page-by-page layout analysis
 */
export async function extractTextFromPdf(file: File): Promise<ExtractedDocumentResult> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: arrayBuffer,
    useSystemFonts: true,
  });
  const pdfDoc = await loadingTask.promise;

  let totalText = '';
  let scannedPagesCount = 0;
  let hasTwoColumnsWarning = false;
  let columnDetails = '';

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1.0 });

    const items = textContent.items as Array<{
      str: string;
      transform: number[];
      width: number;
      height: number;
    }>;

    // Check if this page is scanned (fewer than 35 characters of selectable text)
    const pageSelectableChars = items.reduce((acc, it) => acc + (it.str?.trim()?.length || 0), 0);
    if (pageSelectableChars < 35) {
      scannedPagesCount++;
    }

    const { text: pageText, isTwoColumn, warningDetails } = reconstructPageText(items, viewport.width);
    if (isTwoColumn) {
      hasTwoColumnsWarning = true;
      if (!columnDetails) columnDetails = warningDetails || '';
    }

    if (pageText) {
      totalText += (totalText ? '\n\n' : '') + pageText;
    }
  }

  // Flag as scanned if more than 50% of the document pages lack selectable text
  const isScanned = scannedPagesCount > 0 && scannedPagesCount >= Math.ceil(pdfDoc.numPages / 2);

  return {
    text: totalText.trim(),
    isScannedPdf: isScanned,
    pagesCount: pdfDoc.numPages,
    readingOrderWarning: hasTwoColumnsWarning,
    readingOrderDetails: columnDetails,
  };
}

/**
 * Executes REAL multi-page Tesseract.js OCR on a PDF or Image file.
 * Handles mixed documents: only processes pages that lack native text, preserving native text for the rest!
 */
export async function runRealMultiPageOcr(
  fileOrBlob: Blob | File,
  language: 'por' | 'eng' = 'por',
  onProgress?: (update: OcrProgressUpdate) => void,
  abortSignal?: AbortSignal
): Promise<{ text: string; stats: DocumentOcrStats }> {
  let worker: Worker | null = null;

  try {
    const arrayBuffer = await fileOrBlob.arrayBuffer();
    const isPdf = fileOrBlob.type === 'application/pdf' || ('name' in fileOrBlob && (fileOrBlob as File).name.endsWith('.pdf'));

    if (!isPdf) {
      // Single image OCR
      if (onProgress) onProgress({ currentPage: 1, totalPages: 1, percent: 10, statusText: 'Iniciando Tesseract OCR...' });
      worker = await createWorker(language);

      const imageUrl = URL.createObjectURL(fileOrBlob);
      if (onProgress) onProgress({ currentPage: 1, totalPages: 1, percent: 50, statusText: 'Reconhecendo caracteres...' });

      const ret = await worker.recognize(imageUrl);
      URL.revokeObjectURL(imageUrl);

      if (onProgress) onProgress({ currentPage: 1, totalPages: 1, percent: 100, statusText: 'Concluído' });

      return {
        text: ret.data.text.trim(),
        stats: {
          totalPages: 1,
          ocrPages: 1,
          nativePages: 0,
          failedPages: [],
          language,
        },
      };
    }

    // PDF Multi-page processing
    const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const totalPages = pdfDoc.numPages;

    const pageTexts: string[] = [];
    let ocrPagesCount = 0;
    let nativePagesCount = 0;
    const failedPages: number[] = [];

    // Initialize worker lazily only if needed
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      if (abortSignal?.aborted) {
        throw new Error('Operação de OCR cancelada pelo usuário.');
      }

      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const viewport = page.getViewport({ scale: 1.0 });

      const items = textContent.items as Array<{ str: string; transform: number[]; width: number; height: number }>;
      const selectableChars = items.reduce((acc, it) => acc + (it.str?.trim()?.length || 0), 0);

      // If page already has rich selectable text, preserve it directly without lossy OCR
      if (selectableChars >= 50) {
        const { text } = reconstructPageText(items, viewport.width);
        pageTexts.push(text);
        nativePagesCount++;

        if (onProgress) {
          const percent = Math.round((pageNum / totalPages) * 100);
          onProgress({
            currentPage: pageNum,
            totalPages,
            percent,
            statusText: `Página ${pageNum}/${totalPages}: Camada de texto nativo identificada (OCR dispensado).`,
          });
        }
        continue;
      }

      // Page is scanned/empty: Render to canvas and run real OCR
      if (!worker) {
        if (onProgress) {
          onProgress({
            currentPage: pageNum,
            totalPages,
            percent: Math.round(((pageNum - 0.5) / totalPages) * 100),
            statusText: `Inicializando motor Tesseract (${language === 'por' ? 'Português' : 'Inglês'})...`,
          });
        }
        worker = await createWorker(language);
      }

      try {
        const renderViewport = page.getViewport({ scale: 2.0 }); // High resolution for OCR precision
        const canvas = document.createElement('canvas');
        canvas.width = renderViewport.width;
        canvas.height = renderViewport.height;
        const ctx = canvas.getContext('2d');

        if (!ctx) throw new Error('Não foi possível inicializar o contexto Canvas');

        await page.render({ canvasContext: ctx, viewport: renderViewport, canvas } as any).promise;
        const pageImageUrl = canvas.toDataURL('image/png');

        if (onProgress) {
          const percent = Math.round(((pageNum - 0.2) / totalPages) * 100);
          onProgress({
            currentPage: pageNum,
            totalPages,
            percent,
            statusText: `Reconhecendo caracteres da página ${pageNum} de ${totalPages}...`,
          });
        }

        const ocrResult = await worker.recognize(pageImageUrl);
        const extracted = ocrResult.data.text.trim();

        if (extracted) {
          pageTexts.push(extracted);
          ocrPagesCount++;
        } else {
          failedPages.push(pageNum);
        }
      } catch (pageErr) {
        console.error(`Falha no OCR da página ${pageNum}:`, pageErr);
        failedPages.push(pageNum);
      }

      if (onProgress) {
        const percent = Math.round((pageNum / totalPages) * 100);
        onProgress({
          currentPage: pageNum,
          totalPages,
          percent,
          statusText: `Página ${pageNum}/${totalPages} concluída.`,
        });
      }
    }

    const fullText = pageTexts.filter(Boolean).join('\n\n');

    return {
      text: fullText,
      stats: {
        totalPages,
        ocrPages: ocrPagesCount,
        nativePages: nativePagesCount,
        failedPages,
        language,
      },
    };
  } finally {
    // ALWAYS release worker and memory resources
    if (worker) {
      try {
        await worker.terminate();
      } catch (e) {
        console.warn('Erro ao finalizar worker do Tesseract:', e);
      }
    }
  }
}

/**
 * Extracts text from DOCX using Mammoth.js
 */
export async function extractTextFromDocx(file: File): Promise<ExtractedDocumentResult> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return {
    text: result.value.trim(),
    pagesCount: 1,
    isScannedPdf: false,
  };
}

/**
 * Extracts text from plain TXT file preserving UTF-8
 */
export async function extractTextFromTxt(file: File): Promise<ExtractedDocumentResult> {
  const arrayBuffer = await file.arrayBuffer();
  const decoder = new TextDecoder('utf-8');
  const text = decoder.decode(arrayBuffer);
  return {
    text: text.trim(),
    pagesCount: 1,
    isScannedPdf: false,
  };
}

// Alias for compatibility
export const runOcrOnScannedFile = runRealMultiPageOcr;
