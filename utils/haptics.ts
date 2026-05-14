import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

function isNative(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

/**
 * Solo build native iOS/Android: `expo-haptics` non è disponibile su web
 * (Safari / PWA su iPhone = `Platform.OS === 'web'` → nessun aptico).
 */
export function hapticButton(): void {
  if (!isNative()) return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

/** Schede, giorni calendario, righe lista, picker: tick leggero (solo native, come sopra). */
export function hapticSelection(): void {
  if (!isNative()) return;
  void Haptics.selectionAsync().catch(() => {});
}
