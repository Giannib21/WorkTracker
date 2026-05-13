import { Platform } from 'react-native';

const NATIVE_SCREEN_HEADER_TOP = 52;

/**
 * Padding superiore per header sticky / scroll full-screen.
 * Su web non c’è la status bar nativa: evita il buco fisso da ~52px e usa l’eventuale safe-area (notch / PWA).
 */
export function screenHeaderPaddingTop(safeAreaInsetTop: number): number {
  if (Platform.OS === 'web') {
    return Math.max(safeAreaInsetTop, 10) + 8;
  }
  return NATIVE_SCREEN_HEADER_TOP;
}
