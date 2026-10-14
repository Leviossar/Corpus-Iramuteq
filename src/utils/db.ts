/**
 * Client-side IndexedDB persistence for CorpusLab.
 * Enables storing large document corpora, file binary blobs for multi-page OCR,
 * lexical expressions, transformation audit trails, and maintains consistent state across refreshes.
 */
import { DocumentItem, LexicalExpression, TransformationRecord } from '../types/corpus';

const DB_NAME = 'corpuslab_db';
const DB_VERSION = 3;
const DOCS_STORE = 'documents';
const FILES_STORE = 'file_blobs';
const CONFIG_STORE = 'app_config';
const EXPRS_STORE = 'expressions';
const TRANS_STORE = 'transformations';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB não suportado no ambiente.'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(DOCS_STORE)) {
        db.createObjectStore(DOCS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(FILES_STORE)) {
        db.createObjectStore(FILES_STORE);
      }
      if (!db.objectStoreNames.contains(CONFIG_STORE)) {
        db.createObjectStore(CONFIG_STORE, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(EXPRS_STORE)) {
        db.createObjectStore(EXPRS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(TRANS_STORE)) {
        db.createObjectStore(TRANS_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Saves all documents to IndexedDB, waiting for transaction completion
 */
export async function persistDocuments(documents: DocumentItem[]): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DOCS_STORE, 'readwrite');
    const store = tx.objectStore(DOCS_STORE);

    store.clear();
    for (const doc of documents) {
      store.put(doc);
    }

    tx.oncomplete = () => {
      // Also mirror to legacy localStorage as secondary backup
      try {
        localStorage.setItem('corpuslab_documents_v1', JSON.stringify(documents));
      } catch {}
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Loads all documents from IndexedDB
 */
export async function loadPersistedDocuments(): Promise<DocumentItem[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DOCS_STORE, 'readonly');
      const store = tx.objectStore(DOCS_STORE);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Erro ao carregar do IndexedDB:', err);
    return [];
  }
}

/**
 * Persists lexical expressions to IndexedDB
 */
export async function persistExpressions(expressions: LexicalExpression[]): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(EXPRS_STORE, 'readwrite');
      const store = tx.objectStore(EXPRS_STORE);

      store.clear();
      for (const expr of expressions) {
        store.put(expr);
      }

      tx.oncomplete = () => {
        try {
          localStorage.setItem('corpuslab_expressions_v1', JSON.stringify(expressions));
        } catch {}
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Falha ao persistir expressões:', err);
  }
}

/**
 * Loads persisted lexical expressions
 */
export async function loadPersistedExpressions(): Promise<LexicalExpression[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(EXPRS_STORE, 'readonly');
      const store = tx.objectStore(EXPRS_STORE);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return [];
  }
}

/**
 * Persists transformation history records to IndexedDB
 */
export async function persistTransformations(records: TransformationRecord[]): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(TRANS_STORE, 'readwrite');
      const store = tx.objectStore(TRANS_STORE);

      store.clear();
      for (const rec of records) {
        store.put(rec);
      }

      tx.oncomplete = () => {
        try {
          localStorage.setItem('corpuslab_transformations_v1', JSON.stringify(records));
        } catch {}
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Falha ao persistir transformações:', err);
  }
}

/**
 * Loads persisted transformation history records
 */
export async function loadPersistedTransformations(): Promise<TransformationRecord[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(TRANS_STORE, 'readonly');
      const store = tx.objectStore(TRANS_STORE);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return [];
  }
}

/**
 * Stores raw file Blob for subsequent on-demand OCR
 */
export async function storeFileBlob(key: string, file: File | Blob): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(FILES_STORE, 'readwrite');
      tx.objectStore(FILES_STORE).put(file, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('Não foi possível armazenar blob do arquivo no IndexedDB:', e);
  }
}

/**
 * Retrieves stored file Blob for OCR
 */
export async function getFileBlob(key: string): Promise<Blob | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(FILES_STORE, 'readonly');
      const request = tx.objectStore(FILES_STORE).get(key);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Removes file Blob from IndexedDB
 */
export async function removeFileBlob(key: string): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(FILES_STORE, 'readwrite');
      tx.objectStore(FILES_STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {}
}

/**
 * Sets configuration key/value in IndexedDB
 */
export async function setAppConfig(key: string, value: any): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(CONFIG_STORE, 'readwrite');
      tx.objectStore(CONFIG_STORE).put({ key, value });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {}
}

/**
 * Gets configuration value from IndexedDB
 */
export async function getAppConfig(key: string): Promise<any> {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(CONFIG_STORE, 'readonly');
      const request = tx.objectStore(CONFIG_STORE).get(key);
      request.onsuccess = () => resolve(request.result ? request.result.value : undefined);
      request.onerror = () => resolve(undefined);
    });
  } catch {
    return undefined;
  }
}

export interface HydratedWorkspaceData {
  isInitialized: boolean;
  documents: DocumentItem[];
  expressions: LexicalExpression[];
  transformations: TransformationRecord[];
}

/**
 * Master lifecycle loader with deterministic migration:
 * 1. Checks IndexedDB for existing data.
 * 2. If 'project_initialized' is set, returns IndexedDB state directly (even if empty, respecting user's clear action!).
 * 3. If IndexedDB has documents, sets initialized and returns them.
 * 4. Checks legacy localStorage and migrates to IndexedDB safely without duplicating.
 * 5. Returns { isInitialized: false } if brand new workspace.
 */
export async function loadAllPersistedData(): Promise<HydratedWorkspaceData> {
  try {
    const initializedConfig = await getAppConfig('project_initialized');

    if (initializedConfig === true) {
      const [docs, exprs, trans] = await Promise.all([
        loadPersistedDocuments(),
        loadPersistedExpressions(),
        loadPersistedTransformations(),
      ]);
      return {
        isInitialized: true,
        documents: docs,
        expressions: exprs,
        transformations: trans,
      };
    }

    // Check if documents already exist in IndexedDB without the flag
    const docs = await loadPersistedDocuments();
    if (docs && docs.length > 0) {
      await setAppConfig('project_initialized', true);
      const [exprs, trans] = await Promise.all([
        loadPersistedExpressions(),
        loadPersistedTransformations(),
      ]);
      return {
        isInitialized: true,
        documents: docs,
        expressions: exprs,
        transformations: trans,
      };
    }

    // Check legacy localStorage migration
    const legacyDocsStr = localStorage.getItem('corpuslab_documents_v1');
    if (legacyDocsStr) {
      try {
        const legacyDocs = JSON.parse(legacyDocsStr);
        if (Array.isArray(legacyDocs) && legacyDocs.length > 0) {
          let legacyExprs: LexicalExpression[] = [];
          const exprsStr = localStorage.getItem('corpuslab_expressions_v1');
          if (exprsStr) {
            try {
              legacyExprs = JSON.parse(exprsStr);
            } catch {}
          }

          let legacyTrans: TransformationRecord[] = [];
          const transStr = localStorage.getItem('corpuslab_transformations_v1');
          if (transStr) {
            try {
              legacyTrans = JSON.parse(transStr);
            } catch {}
          }

          // Migrate to IndexedDB
          await persistDocuments(legacyDocs);
          if (legacyExprs.length > 0) await persistExpressions(legacyExprs);
          if (legacyTrans.length > 0) await persistTransformations(legacyTrans);
          await setAppConfig('project_initialized', true);

          return {
            isInitialized: true,
            documents: legacyDocs,
            expressions: legacyExprs,
            transformations: legacyTrans,
          };
        }
      } catch (e) {
        console.warn('Erro ao migrar dados legados:', e);
      }
    }
  } catch (err) {
    console.warn('Erro no carregamento do IndexedDB:', err);
  }

  return {
    isInitialized: false,
    documents: [],
    expressions: [],
    transformations: [],
  };
}

/**
 * Clears selected stores in IndexedDB while preserving the 'project_initialized: true' flag
 * so empty projects are respected and sample documents are not reloaded automatically.
 */
export async function clearProjectStores(options: {
  clearDocuments: boolean;
  resetDictionary: boolean;
  clearHistory: boolean;
}): Promise<void> {
  try {
    const db = await openDatabase();
    const storesToClear: string[] = [];
    if (options.clearDocuments) {
      storesToClear.push(DOCS_STORE, FILES_STORE);
    }
    if (options.resetDictionary) {
      storesToClear.push(EXPRS_STORE);
    }
    if (options.clearHistory) {
      storesToClear.push(TRANS_STORE);
    }

    if (storesToClear.length > 0) {
      const tx = db.transaction(storesToClear, 'readwrite');
      for (const s of storesToClear) {
        tx.objectStore(s).clear();
      }
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }

    // Always maintain initialized flag
    await setAppConfig('project_initialized', true);
  } catch (e) {
    console.warn('Erro ao limpar lojas do IndexedDB:', e);
  }
}

/**
 * Clears all stores in IndexedDB
 */
export async function clearAllDatabase(): Promise<void> {
  try {
    const db = await openDatabase();
    const tx = db.transaction([DOCS_STORE, FILES_STORE, CONFIG_STORE, EXPRS_STORE, TRANS_STORE], 'readwrite');
    tx.objectStore(DOCS_STORE).clear();
    tx.objectStore(FILES_STORE).clear();
    tx.objectStore(CONFIG_STORE).clear();
    tx.objectStore(EXPRS_STORE).clear();
    tx.objectStore(TRANS_STORE).clear();
  } catch {}
}
