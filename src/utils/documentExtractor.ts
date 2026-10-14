import * as pdfjsLib from 'pdfjs-dist';
// Use local bundled worker from pdfjs-dist via Vite asset URL
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import mammoth from 'mammoth';
import { createWorker } from 'tesseract.js';

if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
}

export interface ExtractedDocumentResult {
  text: string;
  isScannedPdf?: boolean;
  pagesCount: number;
  readingOrderWarning?: boolean;
  ocrApplied?: boolean;
}

/**
 * Extracts text from PDF with smart reading-order reconstruction (supports 2 columns)
 */
export async function extractTextFromPdf(file: File): Promise<ExtractedDocumentResult> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;

  let totalText = '';
  let isScanned = false;
  let hasTwoColumnsWarning = false;

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1.0 });
    const pageWidth = viewport.width;

    const items = textContent.items as Array<{
      str: string;
      transform: number[]; // [scaleX, skewY, skewX, scaleY, transX, transY]
      width: number;
      height: number;
    }>;

    if (!items || items.length === 0) {
      continue;
    }

    // Check if page appears to have a two-column layout
    // (items clustered significantly on left and right sides)
    const midX = pageWidth / 2;
    let leftCount = 0;
    let rightCount = 0;

    for (const item of items) {
      if (item.str.trim()) {
        const x = item.transform[4];
        if (x < midX - 20) leftCount++;
        else if (x > midX + 20) rightCount++;
      }
    }

    const isTwoColumn = leftCount > 15 && rightCount > 15;
    if (isTwoColumn) {
      hasTwoColumnsWarning = true;
    }

    if (isTwoColumn) {
      // Sort in two columns: first process left column (top to bottom), then right column
      const leftItems = items.filter((it) => it.transform[4] < midX);
      const rightItems = items.filter((it) => it.transform[4] >= midX);

      const sortColumn = (col: typeof items) =>
        col.sort((a, b) => {
          const yDiff = b.transform[5] - a.transform[5];
          if (Math.abs(yDiff) > 5) return yDiff;
          return a.transform[4] - b.transform[4];
        });

      const sortedLeft = sortColumn(leftItems);
      const sortedRight = sortColumn(rightItems);

      const renderColumn = (col: typeof items) => {
        let colText = '';
        let lastY: number | null = null;
        for (const it of col) {
          const y = it.transform[5];
          if (lastY !== null && Math.abs(y - lastY) > 8) {
            colText += '\n';
          } else if (colText && !colText.endsWith('\n') && !colText.endsWith(' ')) {
            colText += ' ';
          }
          colText += it.str;
          lastY = y;
        }
        return colText;
      };

      totalText += renderColumn(sortedLeft) + '\n\n' + renderColumn(sortedRight) + '\n\n';
    } else {
      // Single column: sort by Y descending (top to bottom), then X ascending (left to right)
      items.sort((a, b) => {
        const yDiff = b.transform[5] - a.transform[5];
        if (Math.abs(yDiff) > 5) return yDiff;
        return a.transform[4] - b.transform[4];
      });

      let pageText = '';
      let lastY: number | null = null;

      for (const it of items) {
        const y = it.transform[5];
        if (lastY !== null && Math.abs(y - lastY) > 8) {
          pageText += '\n';
        } else if (pageText && !pageText.endsWith('\n') && !pageText.endsWith(' ')) {
          pageText += ' ';
        }
        pageText += it.str;
        lastY = y;
      }
      totalText += pageText + '\n\n';
    }
  }

  // Detect scanned PDF (insufficient textual content per page)
  const averageCharsPerPage = totalText.trim().length / Math.max(1, pdfDoc.numPages);
  if (averageCharsPerPage < 40) {
    isScanned = true;
  }

  return {
    text: totalText.trim(),
    isScannedPdf: isScanned,
    pagesCount: pdfDoc.numPages,
    readingOrderWarning: hasTwoColumnsWarning,
  };
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

/**
 * Runs local Tesseract OCR on a scanned PDF page or image file
 */
export async function runOcrOnScannedFile(
  file: File,
  language: 'por' | 'eng' = 'por',
  onProgress?: (progress: number) => void
): Promise<string> {
  const worker = await createWorker(language);

  // If it's a PDF, render first page to canvas
  let imageUrl: string = '';
  if (file.type === 'application/pdf') {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdfDoc.getPage(1);
    const viewport = page.getViewport({ scale: 2.0 });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
      imageUrl = canvas.toDataURL('image/png');
    }
  } else {
    imageUrl = URL.createObjectURL(file);
  }

  if (onProgress) {
    onProgress(0.3);
  }

  const ret = await worker.recognize(imageUrl);
  await worker.terminate();

  if (imageUrl.startsWith('blob:')) {
    URL.revokeObjectURL(imageUrl);
  }

  if (onProgress) {
    onProgress(1.0);
  }

  return ret.data.text.trim();
}
