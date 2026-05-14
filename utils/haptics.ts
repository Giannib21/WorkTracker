import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

function isNative(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

/** Pulsanti principali (contained, azioni esplicite). */
export function hapticButton(): void {
  if (!isNative()) return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

/** Schede, giorni calendario, righe lista, picker: tick leggero. */
export function hapticSelection(): void {
  if (!isNative()) return;
  void Haptics.selectionAsync().catch(() => {});
}
