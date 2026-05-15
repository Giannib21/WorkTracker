/** Storage allegati su web (IndexedDB) — evita data URL giganti in SQLite. */

import { base64ToBlob, blobToBase64, mimeKind } from './webAttachmentBlob';

export const WEB_ATTACHMENT_REF_PREFIX = 'wt-att:';

const DB_NAME = 'worktracker-web-attachments';
const DB_VERSION = 1;
const STORE_NAME = 'attachments';

export type WebAttachmentKind = 'image' | 'pdf' | 'other';

type StoredAttachment = {
  mime: string;
  dataBase64: string;
  fileName?: string;
};

export type WebAttachmentPreviewInfo = {
  kind: WebAttachmentKind;
  mime: string;
  displayUri: string | null;
  openUri: string;
  label: string;
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
  blobUrlCache.clear();
}

/** Salva allegato in IndexedDB; ritorna riferimento corto per SQLite (`wt-att:…`). */
export async function putWebAttachmentRef(
  id: string,
  mime: string,
  dataBase64: string,
  fileName?: string | null
): Promise<string> {
  const clean = dataBase64.replace(/\s/g, '');
  const entry: StoredAttachment = {
    mime: mime || 'application/octet-stream',
    dataBase64: clean,
    ...(fileName?.trim() ? { fileName: fileName.trim() } : {}),
  };

  try {
    await idbPut(id, entry);
    return `${WEB_ATTACHMENT_REF_PREFIX}${id}`;
  } catch (err) {
    const maxInline = 1_500_000;
    if (clean.length <= maxInline) {
      return `data:${entry.mime};base64,${clean}`;
    }
    throw err;
  }
}

export async function putWebAttachmentFromBlob(
  id: string,
  blob: Blob,
  fileName?: string | null
): Promise<string> {
  const mime =
    blob.type && blob.type !== 'application/octet-stream'
      ? blob.type
      : guessMimeFromName(fileName ?? '');
  const dataBase64 = await blobToBase64(blob);
  return putWebAttachmentRef(id, mime, dataBase64, fileName);
}

function guessMimeFromName(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'pdf':
      return 'application/pdf';
    case 'heic':
      return 'image/heic';
    case 'heif':
      return 'image/heif';
    default:
      return 'application/octet-stream';
  }
}

export async function readWebAttachmentEntry(path: string): Promise<StoredAttachment | null> {
  if (!isWebAttachmentRef(path)) return null;
  const entry = await idbGet(webAttachmentRefId(path));
  return entry ?? null;
}

export async function readWebAttachmentAsDataUrl(path: string): Promise<string | null> {
  const entry = await readWebAttachmentEntry(path);
  if (!entry?.dataBase64) return null;
  const mime = entry.mime || 'application/octet-stream';
  return `data:${mime};base64,${entry.dataBase64}`;
}

const blobUrlCache = new Map<string, string>();

function cacheBlobUrl(ref: string, blob: Blob): string {
  revokeWebAttachmentPreview(ref);
  const blobUrl = URL.createObjectURL(blob);
  blobUrlCache.set(ref, blobUrl);
  return blobUrl;
}

export async function resolveWebAttachmentPreview(path: string): Promise<WebAttachmentPreviewInfo> {
  if (path.startsWith('data:')) {
    const mime = path.split(';')[0]?.replace(/^data:/i, '') ?? 'application/octet-stream';
    const kind = mimeKind(mime);
    return {
      kind,
      mime,
      displayUri: kind === 'image' ? path : null,
      openUri: path,
      label: kind === 'pdf' ? 'document.pdf' : 'allegato',
    };
  }

  if (!isWebAttachmentRef(path)) {
    const kind = mimeKind(guessMimeFromName(path));
    return {
      kind,
      mime: guessMimeFromName(path),
      displayUri: kind === 'image' ? path : null,
      openUri: path,
      label: path.split('/').pop() ?? path,
    };
  }

  const entry = await readWebAttachmentEntry(path);
  if (!entry?.dataBase64) {
    return {
      kind: 'other',
      mime: 'application/octet-stream',
      displayUri: null,
      openUri: path,
      label: path,
    };
  }

  const mime = entry.mime || 'application/octet-stream';
  const kind = mimeKind(mime);
  const label = entry.fileName ?? `${kind === 'pdf' ? 'documento' : 'allegato'}.${mime.split('/')[1] ?? 'bin'}`;
  const blob = base64ToBlob(entry.dataBase64, mime);
  const openUri = cacheBlobUrl(path, blob);

  return {
    kind,
    mime,
    displayUri: kind === 'image' ? openUri : kind === 'pdf' ? openUri : null,
    openUri,
    label,
  };
}

/** @deprecated Usare resolveWebAttachmentPreview */
export async function resolveWebAttachmentDisplayUri(path: string): Promise<string> {
  const info = await resolveWebAttachmentPreview(path);
  return info.displayUri ?? info.openUri;
}

export function revokeWebAttachmentPreview(path: string): void {
  const cached = blobUrlCache.get(path);
  if (cached?.startsWith('blob:')) {
    URL.revokeObjectURL(cached);
  }
  blobUrlCache.delete(path);
}

/** @deprecated Usare revokeWebAttachmentPreview */
export function revokeWebAttachmentDisplayUri(path: string): void {
  revokeWebAttachmentPreview(path);
}
