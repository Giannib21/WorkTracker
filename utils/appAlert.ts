import { Alert, Platform } from 'react-native';

/** Stesso contratto di `Alert.alert` (pulsanti opzionali). */
export type AppAlertButton = {
  text?: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: (() => void) | (() => Promise<void>);
};

export type AppAlertOptions = {
  cancelable?: boolean;
};

export type WebAlertPayload = {
  title: string;
  message?: string;
  buttons: AppAlertButton[];
  options?: AppAlertOptions;
};

type WebAlertListener = (payload: WebAlertPayload) => void;

let webAlertListener: WebAlertListener | null = null;

/** Solo `WebAlertPortal` (web) deve registrarsi. */
export function setWebAlertListener(listener: WebAlertListener | null): void {
  webAlertListener = listener;
}

function normalizeButtons(buttons?: AppAlertButton[]): AppAlertButton[] {
  if (buttons && buttons.length > 0) return buttons.map((b) => ({ ...b }));
  return [{ text: 'OK', style: 'default' as const }];
}

/**
 * Su iOS/Android delega a `Alert.alert`. Su **web** emette verso `WebAlertPortal` (Dialog Paper),
 * perché l’implementazione RN di `Alert.alert` non gestisce `web` e non mostra nulla.
 */
export function appAlert(
  title: string,
  message?: string,
  buttons?: AppAlertButton[],
  options?: AppAlertOptions,
): void {
  if (Platform.OS === 'web') {
    webAlertListener?.({
      title: title ?? '',
      message,
      buttons: normalizeButtons(buttons),
      options,
    });
    return;
  }
  Alert.alert(title, message, buttons, options);
}
