/**
 * Client-side IndexedDB persistence for CorpusLab.
 * Enables storing large document corpora, file binary blobs for multi-page OCR,
 * and maintains consistent state across refreshes.
 */
import { DocumentItem } from '../types/corpus';

const DB_NAME = 'corpuslab_db';
const DB_VERSION = 2;
const DOCS_STORE = 'documents';
const FILES_STORE = 'file_blobs';
const CONFIG_STORE = 'app_config';

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
        db.createObjectStore(CONFIG_STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Saves all documents to IndexedDB
 */
export async function persistDocuments(documents: DocumentItem[]): Promise<void> {
  try {
    const db = await openDatabase();
    const tx = db.transaction(DOCS_STORE, 'readwrite');
    const store = tx.objectStore(DOCS_STORE);

    // Clear and re-populate to keep strict sync
    store.clear();
    for (const doc of documents) {
      store.put(doc);
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    // Fallback to localStorage if IndexedDB fails
    try {
      localStorage.setItem('corpuslab_documents_v1', JSON.stringify(documents));
    } catch {}
  }
}

/**
 * Loads all documents from IndexedDB, migrating from localStorage if needed
 */
export async function loadPersistedDocuments(): Promise<DocumentItem[] | null> {
  try {
    const db = await openDatabase();
    const tx = db.transaction(DOCS_STORE, 'readonly');
    const store = tx.objectStore(DOCS_STORE);
    const request = store.getAll();

    const docs: DocumentItem[] = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });

    if (docs.length > 0) {
      return docs;
    }
  } catch (err) {
    console.warn('Erro ao carregar do IndexedDB, tentando fallback:', err);
  }

  // Fallback: check localStorage migration
  try {
    const stored = localStorage.getItem('corpuslab_documents_v1');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Asynchronously migrate to IndexedDB
        persistDocuments(parsed).catch(() => {});
        return parsed;
      }
    }
  } catch {}

  return null;
}

/**
 * Stores raw file Blob for subsequent on-demand OCR
 */
export async function storeFileBlob(key: string, file: File | Blob): Promise<void> {
  try {
    const db = await openDatabase();
    const tx = db.transaction(FILES_STORE, 'readwrite');
    tx.objectStore(FILES_STORE).put(file, key);
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
    const tx = db.transaction(FILES_STORE, 'readonly');
    const request = tx.objectStore(FILES_STORE).get(key);

    return new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Clears all stores in IndexedDB
 */
export async function clearAllDatabase(): Promise<void> {
  try {
    const db = await openDatabase();
    const tx = db.transaction([DOCS_STORE, FILES_STORE, CONFIG_STORE], 'readwrite');
    tx.objectStore(DOCS_STORE).clear();
    tx.objectStore(FILES_STORE).clear();
    tx.objectStore(CONFIG_STORE).clear();
  } catch {}
}
