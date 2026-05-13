/** Percorso web: allegati come data URL (persistono nel DB SQLite come stringa). */

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
    default:
      return 'application/octet-stream';
  }
}

export async function persistPickedFile(sourceUri: string, originalName?: string | null): Promise<string> {
  const res = await fetch(sourceUri);
  const blob = await res.blob();
  const ext = extensionFromNameOrUri(originalName, sourceUri);
  const mime = blob.type && blob.type !== 'application/octet-stream' ? blob.type : guessMime(ext);
  const buf = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    const sub = buf.subarray(i, Math.min(i + chunk, buf.length));
    for (let j = 0; j < sub.length; j++) binary += String.fromCharCode(sub[j]!);
  }
  const b64 = btoa(binary);
  return `data:${mime};base64,${b64}`;
}

export function isProbablyImagePath(uri: string | null | undefined): boolean {
  if (!uri) return false;
  if (/^data:image\//i.test(uri)) return true;
  const ext = uri.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
  return ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif'].includes(ext);
}
