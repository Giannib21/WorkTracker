import { blobToBase64 } from './webAttachmentBlob';
import {
  isWebAttachmentRef,
  putWebAttachmentFromBlob,
  putWebAttachmentRef,
  readWebAttachmentEntry,
  WEB_ATTACHMENT_REF_PREFIX,
} from './webAttachmentStore';

/** Percorso web: riferimento IndexedDB (`wt-att:`) o data URL (fallback). */

export function attachmentsDirUri(): string | null {
  return 'web:data-url';
}

export async function ensureAttachmentsDir(): Promise<string | null> {
  return 'web:data-url';
}

function extensionFromNameOrUri(originalName?: string | null, sourceUri?: string): string {
  const fromName = originalName?.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? '';
  if (fromName && fromName.length >= 2 && fromName.length <= 5) return fromName;
  const cleanUri = sourceUri?.split('?')[0] ?? '';
  const fromUri = cleanUri.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? '';
  if (fromUri && fromUri.length >= 2 && fromUri.length <= 5) return fromUri;
  return 'bin';
}

function guessMime(ext: string): string {
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

export async function persistPickedFile(
  sourceUri: string,
  originalName?: string | null,
  sourceFile?: File | Blob | null
): Promise<string> {
  const id = `pick_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  if (sourceFile) {
    return putWebAttachmentFromBlob(id, sourceFile, originalName);
  }

  const res = await fetch(sourceUri);
  if (!res.ok) throw new Error('FETCH_ATTACHMENT_FAILED');
  const blob = await res.blob();
  const ext = extensionFromNameOrUri(originalName, sourceUri);
  const mime =
    blob.type && blob.type !== 'application/octet-stream' ? blob.type : guessMime(ext);

  if (mime.startsWith('image/') && (mime.includes('heic') || mime.includes('heif') || ext === 'heic' || ext === 'heif')) {
    try {
      const { manipulateAsync, SaveFormat } = await import('expo-image-manipulator');
      const dataUri = await blobToDataUrl(blob);
      const converted = await manipulateAsync(dataUri, [], {
        format: SaveFormat.JPEG,
        compress: 0.88,
        base64: true,
      });
      if (converted.base64) {
        const name = originalName?.replace(/\.heic$/i, '.jpg') ?? 'photo.jpg';
        return putWebAttachmentRef(id, 'image/jpeg', converted.base64, name);
      }
    } catch {
      /* prova blob grezzo */
    }
  }

  const dataBase64 = await blobToBase64(blob);
  return putWebAttachmentRef(id, mime, dataBase64, originalName);
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function isProbablyImagePath(uri: string | null | undefined): boolean {
  if (!uri) return false;
  if (/^data:image\//i.test(uri)) return true;
  if (isWebAttachmentRef(uri)) return false;
  const ext = uri.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
  return ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif'].includes(ext);
}

/** Su web, verifica MIME in IndexedDB (async in `useAttachmentPreview`). */
export async function isWebStoredImagePath(uri: string): Promise<boolean> {
  if (!uri) return false;
  if (/^data:image\//i.test(uri)) return true;
  if (!isWebAttachmentRef(uri)) return isProbablyImagePath(uri);
  const entry = await readWebAttachmentEntry(uri);
  if (!entry) return false;
  return entry.mime.toLowerCase().startsWith('image/');
}

export function normalizeAttachmentDisplayUri(uri: string): string {
  return uri;
}

export { WEB_ATTACHMENT_REF_PREFIX };
