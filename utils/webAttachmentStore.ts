/** Storage allegati su web (IndexedDB) — evita data URL giganti in SQLite. */

export const WEB_ATTACHMENT_REF_PREFIX = 'wt-att:';

const DB_NAME = 'worktracker-web-attachments';
const DB_VERSION = 1;
const STORE_NAME = 'attachments';

type StoredAttachment = {
  mime: string;
  dataBase64: string;
};

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB unavailable'));
  }
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

function idbPut(id: string, value: StoredAttachment): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error ?? new Error('IndexedDB put failed'));
        };
        tx.objectStore(STORE_NAME).put(value, id);
      })
  );
}

function idbGet(id: string): Promise<StoredAttachment | undefined> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(id);
        req.onsuccess = () => {
          db.close();
          resolve(req.result as StoredAttachment | undefined);
        };
        req.onerror = () => {
          db.close();
          reject(req.error ?? new Error('IndexedDB get failed'));
        };
      })
  );
}

export function isWebAttachmentRef(path: string | null | undefined): boolean {
  return Boolean(path?.startsWith(WEB_ATTACHMENT_REF_PREFIX));
}

export function webAttachmentRefId(path: string): string {
  return path.slice(WEB_ATTACHMENT_REF_PREFIX.length);
}

export async function clearAllWebAttachments(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('IndexedDB clear failed'));
    };
    tx.objectStore(STORE_NAME).clear();
  });
}

/** Salva allegato in IndexedDB; ritorna riferimento corto per SQLite (`wt-att:…`). */
export async function putWebAttachmentRef(
  id: string,
  mime: string,
  dataBase64: string
): Promise<string> {
  const clean = dataBase64.replace(/\s/g, '');
  await idbPut(id, { mime, dataBase64: clean });
  return `${WEB_ATTACHMENT_REF_PREFIX}${id}`;
}

export async function readWebAttachmentAsDataUrl(path: string): Promise<string | null> {
  if (!isWebAttachmentRef(path)) return null;
  const entry = await idbGet(webAttachmentRefId(path));
  if (!entry?.dataBase64) return null;
  const mime = entry.mime || 'application/octet-stream';
  return `data:${mime};base64,${entry.dataBase64}`;
}

const blobUrlCache = new Map<string, string>();

/** URI per anteprima (`<img>` / `Image`): blob URL da IndexedDB. */
export async function resolveWebAttachmentDisplayUri(path: string): Promise<string> {
  if (!isWebAttachmentRef(path)) return path;
  const cached = blobUrlCache.get(path);
  if (cached) return cached;

  const dataUrl = await readWebAttachmentAsDataUrl(path);
  if (!dataUrl) return path;

  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  blobUrlCache.set(path, blobUrl);
  return blobUrl;
}

export function revokeWebAttachmentDisplayUri(path: string): void {
  const cached = blobUrlCache.get(path);
  if (cached?.startsWith('blob:')) {
    URL.revokeObjectURL(cached);
  }
  blobUrlCache.delete(path);
}
