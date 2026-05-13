import * as FileSystem from 'expo-file-system/legacy';

const SUBDIR = 'spese_allegati/';

export function attachmentsDirUri(): string | null {
  const base = FileSystem.documentDirectory ?? null;
  if (!base) return null;
  return `${base}${SUBDIR}`;
}

export async function ensureAttachmentsDir(): Promise<string | null> {
  const dir = attachmentsDirUri();
  if (!dir) return null;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  return dir;
}

function extensionFromNameOrUri(originalName?: string | null, sourceUri?: string): string {
  const fromName = originalName?.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? '';
  if (fromName && fromName.length >= 2 && fromName.length <= 5) return fromName;
  const cleanUri = sourceUri?.split('?')[0] ?? '';
  const fromUri = cleanUri.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? '';
  if (fromUri && fromUri.length >= 2 && fromUri.length <= 5) return fromUri;
  return 'bin';
}

/** Copia un file scelto (galleria / document picker) in una cartella persistente sotto documentDirectory. */
export async function persistPickedFile(sourceUri: string, originalName?: string | null): Promise<string> {
  const dir = await ensureAttachmentsDir();
  if (!dir) throw new Error('Document directory not available');
  const ext = extensionFromNameOrUri(originalName, sourceUri);
  const name = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const dest = `${dir}${name}`;
  await FileSystem.copyAsync({ from: sourceUri, to: dest });
  return dest;
}

export function isProbablyImagePath(uri: string | null | undefined): boolean {
  if (!uri) return false;
  const ext = uri.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
  return ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif'].includes(ext);
}
