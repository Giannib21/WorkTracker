import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import {
  backupFilenameForNow,
  buildWorkTrackerBackup,
  parseBackupJson,
  serializeBackup,
  type WorkTrackerBackupV1,
} from './backupRestore';
import { shareFile } from './pdf';

const BACKUP_MIME = 'application/json';

export async function createAndShareBackupFile(): Promise<{
  filename: string;
  byteSize: number;
  payload: WorkTrackerBackupV1;
}> {
  const payload = await buildWorkTrackerBackup();
  const json = serializeBackup(payload);
  const filename = backupFilenameForNow();
  const byteSize = new TextEncoder().encode(json).length;

  if (Platform.OS === 'web') {
    await shareBackupOnWeb(json, filename);
    return { filename, byteSize, payload };
  }

  const baseDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!baseDir) throw new Error('BACKUP_NO_WRITABLE_DIR');
  const uri = `${baseDir}${filename}`;
  await FileSystem.writeAsStringAsync(uri, json, { encoding: 'utf8' });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: BACKUP_MIME,
      dialogTitle: filename,
    });
  } else {
    throw new Error('BACKUP_SHARE_UNAVAILABLE');
  }

  return { filename, byteSize, payload };
}

async function shareBackupOnWeb(json: string, filename: string): Promise<void> {
  const blob = new Blob([json], { type: BACKUP_MIME });
  const uri = URL.createObjectURL(blob);

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      const file = new File([blob], filename, { type: BACKUP_MIME });
      const data: ShareData = { files: [file], title: filename };
      if (typeof navigator.canShare !== 'function' || navigator.canShare(data)) {
        await navigator.share(data);
        setTimeout(() => URL.revokeObjectURL(uri), 5000);
        return;
      }
    } catch (e: unknown) {
      const name = e && typeof e === 'object' && 'name' in e ? String((e as { name: string }).name) : '';
      if (name === 'AbortError') {
        URL.revokeObjectURL(uri);
        return;
      }
    }
  }

  await shareFile(uri, filename);
}

async function readTextFromUri(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    const res = await fetch(uri);
    if (!res.ok) throw new Error('BACKUP_READ_FAILED');
    return await res.text();
  }
  return await FileSystem.readAsStringAsync(uri, { encoding: 'utf8' });
}

export async function pickAndParseBackupFile(): Promise<WorkTrackerBackupV1> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
  });
  if (res.canceled || !res.assets?.[0]?.uri) {
    throw new Error('BACKUP_PICKER_CANCELED');
  }
  const text = await readTextFromUri(res.assets[0].uri);
  return parseBackupJson(text);
}
