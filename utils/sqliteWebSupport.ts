import { Platform } from 'react-native';

/**
 * expo-sqlite sul web registra sempre OPFS (`navigator.storage.getDirectory()`), che i browser
 * espongono solo in contesto sicuro: HTTPS, `localhost`, `127.0.0.1`.
 * Un indirizzo tipo `http://192.168.x.x` o `http://10.x.x.x` non è sicuro → API assente → crash nel worker.
 */
export function isExpoSqliteWebStorageAvailable(): boolean {
  if (Platform.OS !== 'web') return true;
  if (typeof navigator === 'undefined') return false;
  return typeof navigator.storage?.getDirectory === 'function';
}
