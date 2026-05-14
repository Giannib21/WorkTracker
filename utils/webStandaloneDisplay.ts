import { Platform } from 'react-native';

/**
 * Web installato come app (home screen / manifest `standalone`), non scheda Safari.
 * Su iPhone è il caso in cui manca la barra di Safari e serve rispettare il bordo inferiore (home indicator).
 */
export function isWebStandaloneDisplay(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  try {
    if (window.matchMedia?.('(display-mode: standalone)')?.matches) return true;
    if (window.matchMedia?.('(display-mode: fullscreen)')?.matches) return true;
    const nav = window.navigator as Navigator & { standalone?: boolean };
    if (nav.standalone === true) return true;
  } catch {
    /* noop */
  }
  return false;
}
