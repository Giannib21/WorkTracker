import { format } from 'date-fns';
import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Platform } from 'react-native';

import {
  listAllGiorni,
  listAllSpese,
  getImpostazioniAll,
  replaceAllDataFromBackup,
  type GiornoInsert,
  type GiornoRow,
  type SpesaInsert,
  type SpesaRow,
} from '../db/database';
import { getAppReleaseVersion } from './appVersion';
import { attachmentsDirUri, ensureAttachmentsDir } from './spesaAttachments';
import {
  clearAllWebAttachments,
  putWebAttachmentRef,
} from './webAttachmentStore';

export const BACKUP_FORMAT_ID = 'worktracker-backup' as const;
export const BACKUP_FORMAT_VERSION = 1;

export type BackupAttachment = {
  fileName: string;
  mimeType: string;
  dataBase64: string;
};

export type BackupSpesaRecord = Omit<SpesaInsert, 'foto_path'> & {
  attachmentKey: string | null;
};

export type WorkTrackerBackupV1 = {
  format: typeof BACKUP_FORMAT_ID;
  version: typeof BACKUP_FORMAT_VERSION;
  appVersion: string;
  createdAt: string;
  giorni: GiornoInsert[];
  spese: BackupSpesaRecord[];
  impostazioni: Record<string, string>;
  attachments: Record<string, BackupAttachment>;
};

export type BackupSummary = {
  giorniCount: number;
  speseCount: number;
  attachmentsCount: number;
  createdAt: string;
  appVersion: string;
};

function giornoToInsert(row: GiornoRow): GiornoInsert {
  return {
    data: row.data,
    tipo: row.tipo,
    ore: row.ore,
    trasferta: row.trasferta,
    ore_trasferta: row.ore_trasferta,
    ore_permesso: row.ore_permesso,
    luogo: row.luogo,
    progetto: row.progetto,
    note: row.note,
  };
}

function extensionFromPath(path: string): string {
  const clean = path.split('?')[0] ?? path;
  if (/^data:image\/jpe?g/i.test(path)) return 'jpg';
  if (/^data:image\/png/i.test(path)) return 'png';
  if (/^data:image\/webp/i.test(path)) return 'webp';
  if (/^data:application\/pdf/i.test(path)) return 'pdf';
  const ext = clean.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? '';
  if (ext.length >= 2 && ext.length <= 5) return ext;
  return 'bin';
}

function extensionFromMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes('jpeg') || m.includes('jpg')) return 'jpg';
  if (m.includes('png')) return 'png';
  if (m.includes('webp')) return 'webp';
  if (m.includes('gif')) return 'gif';
  if (m.includes('pdf')) return 'pdf';
  if (m.includes('heic')) return 'heic';
  if (m.includes('heif')) return 'heif';
  return 'bin';
}

function normalizeNativeFileUri(uri: string): string {
  if (/^(file|content|data|https?):/i.test(uri)) return uri;
  if (uri.startsWith('/')) return `file://${uri}`;
  return uri;
}

function mimeFromExtension(ext: string): string {
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
    case 'heif':
      return 'image/heic';
    default:
      return 'application/octet-stream';
  }
}

function parseDataUrl(uri: string): { mimeType: string; dataBase64: string } | null {
  const m = /^data:([^;,]+)?(?:;[^,]*)?;base64,([\s\S]+)$/i.exec(uri.trim());
  if (!m) return null;
  return {
    mimeType: (m[1] ?? 'application/octet-stream').trim() || 'application/octet-stream',
    dataBase64: m[2] ?? '',
  };
}

async function readAttachmentPayload(
  uri: string
): Promise<{ fileName: string; mimeType: string; dataBase64: string } | null> {
  const trimmed = uri.trim();
  if (!trimmed) return null;

  const dataUrl = parseDataUrl(trimmed);
  if (dataUrl) {
    const ext = extensionFromPath(trimmed);
    return {
      fileName: `receipt.${ext}`,
      mimeType: dataUrl.mimeType,
      dataBase64: dataUrl.dataBase64,
    };
  }

  if (Platform.OS === 'web') {
    try {
      const res = await fetch(trimmed);
      const blob = await res.blob();
      const buf = new Uint8Array(await blob.arrayBuffer());
      let binary = '';
      const chunk = 0x8000;
      for (let i = 0; i < buf.length; i += chunk) {
        const sub = buf.subarray(i, Math.min(i + chunk, buf.length));
        for (let j = 0; j < sub.length; j++) binary += String.fromCharCode(sub[j]!);
      }
      const ext = extensionFromPath(trimmed);
      return {
        fileName: `receipt.${ext}`,
        mimeType: blob.type && blob.type !== 'application/octet-stream' ? blob.type : mimeFromExtension(ext),
        dataBase64: btoa(binary),
      };
    } catch {
      return null;
    }
  }

  try {
    const info = await FileSystem.getInfoAsync(trimmed);
    if (!info.exists) return null;
    const dataBase64 = await FileSystem.readAsStringAsync(trimmed, {
      encoding: 'base64',
    });
    const ext = extensionFromPath(trimmed);
    const baseName = trimmed.split('/').pop()?.split('?')[0] ?? `receipt.${ext}`;
    return {
      fileName: baseName,
      mimeType: mimeFromExtension(ext),
      dataBase64,
    };
  } catch {
    return null;
  }
}

async function clearNativeAttachmentsDir(): Promise<void> {
  if (Platform.OS === 'web') return;
  const dir = attachmentsDirUri();
  if (!dir) return;
  try {
    const entries = await FileSystem.readDirectoryAsync(dir);
    await Promise.all(
      entries.map((name) => FileSystem.deleteAsync(`${dir}${name}`, { idempotent: true }))
    );
  } catch {
    /* directory may not exist */
  }
}

async function writeBase64AttachmentToFile(
  att: BackupAttachment,
  dest: string,
  mime: string
): Promise<void> {
  const dataUri = `data:${mime};base64,${att.dataBase64}`;
  try {
    const result = await FileSystem.downloadAsync(dataUri, dest);
    if (result.status >= 200 && result.status < 300) return;
  } catch {
    /* fallback sotto */
  }
  await FileSystem.writeAsStringAsync(dest, att.dataBase64, { encoding: 'base64' });
}

async function convertAttachmentForWeb(att: BackupAttachment): Promise<{ mime: string; dataBase64: string }> {
  const mime = (att.mimeType || mimeFromExtension(extensionFromPath(att.fileName))).toLowerCase();
  const dataBase64 = att.dataBase64.replace(/\s/g, '');
  const ext = extensionFromPath(att.fileName);
  const isHeic =
    ext === 'heic' ||
    ext === 'heif' ||
    mime.includes('heic') ||
    mime.includes('heif');
  const isWebSafeImage =
    mime.includes('jpeg') ||
    mime.includes('jpg') ||
    mime === 'image/png' ||
    mime.includes('png') ||
    mime.includes('webp') ||
    mime.includes('gif');

  if (!isHeic && isWebSafeImage) {
    const outMime = mime.includes('png')
      ? 'image/png'
      : mime.includes('webp')
        ? 'image/webp'
        : mime.includes('gif')
          ? 'image/gif'
          : 'image/jpeg';
    return { mime: outMime, dataBase64 };
  }

  const dataUri = `data:${mime};base64,${dataBase64}`;
  try {
    const result = await manipulateAsync(dataUri, [], {
      format: SaveFormat.JPEG,
      compress: 0.88,
      base64: true,
    });
    if (result.base64) {
      return { mime: 'image/jpeg', dataBase64: result.base64 };
    }
    if (result.uri) {
      const res = await fetch(result.uri);
      const buf = new Uint8Array(await res.arrayBuffer());
      let binary = '';
      const chunk = 0x8000;
      for (let i = 0; i < buf.length; i += chunk) {
        const sub = buf.subarray(i, Math.min(i + chunk, buf.length));
        for (let j = 0; j < sub.length; j++) binary += String.fromCharCode(sub[j]!);
      }
      return { mime: 'image/jpeg', dataBase64: btoa(binary) };
    }
  } catch {
    if (isWebSafeImage) return { mime, dataBase64 };
  }
  return { mime: 'image/jpeg', dataBase64 };
}

async function restoreAttachmentFile(
  att: BackupAttachment,
  storageKey: string
): Promise<string | null> {
  const mime = att.mimeType || mimeFromExtension(extensionFromPath(att.fileName));

  if (Platform.OS === 'web') {
    try {
      const converted = await convertAttachmentForWeb(att);
      return await putWebAttachmentRef(storageKey, converted.mime, converted.dataBase64);
    } catch {
      return null;
    }
  }

  const dir = await ensureAttachmentsDir();
  if (!dir) return null;

  const ext =
    extensionFromMime(mime) !== 'bin'
      ? extensionFromMime(mime)
      : extensionFromPath(att.fileName);
  const dest = `${dir}${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

  try {
    await writeBase64AttachmentToFile(att, dest, mime);
  } catch {
    return null;
  }

  try {
    const info = await FileSystem.getInfoAsync(dest);
    if (!info.exists) return null;
  } catch {
    return null;
  }

  const isHeic =
    ext === 'heic' ||
    ext === 'heif' ||
    mime.includes('heic') ||
    mime.includes('heif');

  if (isHeic) {
    try {
      const converted = await manipulateAsync(dest, [], {
        compress: 0.9,
        format: SaveFormat.JPEG,
      });
      await FileSystem.deleteAsync(dest, { idempotent: true });
      return normalizeNativeFileUri(converted.uri);
    } catch {
      return normalizeNativeFileUri(dest);
    }
  }

  return normalizeNativeFileUri(dest);
}

export function backupFilenameForNow(d = new Date()): string {
  const stamp = format(d, 'yyyy-MM-dd_HHmm');
  return `WorkTracker-backup_${stamp}.wtbackup`;
}

export function summarizeBackup(payload: WorkTrackerBackupV1): BackupSummary {
  return {
    giorniCount: payload.giorni.length,
    speseCount: payload.spese.length,
    attachmentsCount: Object.keys(payload.attachments).length,
    createdAt: payload.createdAt,
    appVersion: payload.appVersion,
  };
}

export async function buildWorkTrackerBackup(): Promise<WorkTrackerBackupV1> {
  const [giorniRows, speseRows, impostazioni] = await Promise.all([
    listAllGiorni(),
    listAllSpese(),
    getImpostazioniAll(),
  ]);

  const attachments: Record<string, BackupAttachment> = {};
  const pathToKey = new Map<string, string>();
  let attIndex = 0;

  const spese: BackupSpesaRecord[] = [];

  for (const row of speseRows) {
    let attachmentKey: string | null = null;
    const path = row.foto_path?.trim();
    if (path) {
      let key = pathToKey.get(path);
      if (!key) {
        const payload = await readAttachmentPayload(path);
        if (payload) {
          key = `att_${String(attIndex).padStart(4, '0')}`;
          attIndex += 1;
          attachments[key] = {
            fileName: payload.fileName,
            mimeType: payload.mimeType,
            dataBase64: payload.dataBase64,
          };
          pathToKey.set(path, key);
        }
      }
      attachmentKey = key ?? null;
    }

    spese.push({
      data: row.data,
      tipo: row.tipo,
      importo: row.importo,
      valuta: row.valuta,
      descrizione: row.descrizione,
      fornitore: row.fornitore,
      km: row.km,
      eur_per_km: row.eur_per_km,
      modello_auto: row.modello_auto,
      percorso_da: row.percorso_da,
      percorso_a: row.percorso_a,
      localita: row.localita,
      progetto: row.progetto,
      attachmentKey,
    });
  }

  const impostazioniOut: Record<string, string> = {};
  for (const [k, v] of Object.entries(impostazioni)) {
    impostazioniOut[k] = v == null ? '' : String(v);
  }

  return {
    format: BACKUP_FORMAT_ID,
    version: BACKUP_FORMAT_VERSION,
    appVersion: getAppReleaseVersion(),
    createdAt: new Date().toISOString(),
    giorni: giorniRows.map(giornoToInsert),
    spese,
    impostazioni: impostazioniOut,
    attachments,
  };
}

export function serializeBackup(payload: WorkTrackerBackupV1): string {
  return JSON.stringify(payload);
}

export function parseBackupJson(text: string): WorkTrackerBackupV1 {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('BACKUP_INVALID_JSON');
  }
  if (!raw || typeof raw !== 'object') throw new Error('BACKUP_INVALID_FORMAT');

  const o = raw as Record<string, unknown>;
  if (o.format !== BACKUP_FORMAT_ID) throw new Error('BACKUP_WRONG_FORMAT');
  if (o.version !== BACKUP_FORMAT_VERSION) throw new Error('BACKUP_UNSUPPORTED_VERSION');
  if (!Array.isArray(o.giorni) || !Array.isArray(o.spese)) throw new Error('BACKUP_INVALID_FORMAT');
  if (!o.impostazioni || typeof o.impostazioni !== 'object') throw new Error('BACKUP_INVALID_FORMAT');

  const attachments =
    o.attachments && typeof o.attachments === 'object'
      ? (o.attachments as Record<string, BackupAttachment>)
      : {};

  return {
    format: BACKUP_FORMAT_ID,
    version: BACKUP_FORMAT_VERSION,
    appVersion: String(o.appVersion ?? ''),
    createdAt: String(o.createdAt ?? ''),
    giorni: o.giorni as GiornoInsert[],
    spese: o.spese as BackupSpesaRecord[],
    impostazioni: o.impostazioni as Record<string, string>,
    attachments,
  };
}

export async function restoreWorkTrackerBackup(payload: WorkTrackerBackupV1): Promise<void> {
  await clearNativeAttachmentsDir();
  if (Platform.OS === 'web') {
    await clearAllWebAttachments();
  }

  const spese: SpesaInsert[] = [];
  for (const row of payload.spese) {
    let foto_path: string | null = null;
    if (row.attachmentKey) {
      const att = payload.attachments[row.attachmentKey];
      if (att?.dataBase64) {
        foto_path = await restoreAttachmentFile(att, row.attachmentKey);
      }
    }
    spese.push({
      data: row.data,
      tipo: row.tipo,
      importo: row.importo,
      valuta: row.valuta ?? 'EUR',
      descrizione: row.descrizione,
      fornitore: row.fornitore,
      foto_path,
      km: row.km,
      eur_per_km: row.eur_per_km,
      modello_auto: row.modello_auto,
      percorso_da: row.percorso_da,
      percorso_a: row.percorso_a,
      localita: row.localita,
      progetto: row.progetto,
    });
  }

  await replaceAllDataFromBackup({
    giorni: payload.giorni,
    spese,
    impostazioni: payload.impostazioni,
  });
}

export function formatBackupSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
