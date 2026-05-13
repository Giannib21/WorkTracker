import { Keyboard, Platform, type TextInputProps } from 'react-native';

import {
  notifyFloatingNumericKeyboardBlur,
  notifyFloatingNumericKeyboardFocus,
} from './floatingNumericKeyboardRegistry';

type NumericKeyboardExtra = {
  onFocus?: TextInputProps['onFocus'];
  onBlur?: TextInputProps['onBlur'];
};

function shouldTrackFloatingBar() {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

export type NumericKeyboardDismissProps = Pick<TextInputProps, 'onFocus' | 'onBlur'> &
  Partial<Pick<TextInputProps, 'returnKeyType' | 'blurOnSubmit' | 'onSubmitEditing'>>;

/**
 * Campi con tastiera numerica senza Invio.
 * Su **iOS** non impostare `returnKeyType: 'done'` con `decimal-pad`: RN aggiunge una seconda toolbar nativa (“Done” bianco) oltre alla barra `FloatingNumericKeyboardProvider`.
 * Su **Android** si mantiene `returnKeyType: 'done'` dove ha effetto.
 */
export function numericKeyboardDismissProps(extra?: NumericKeyboardExtra): NumericKeyboardDismissProps {
  const track = shouldTrackFloatingBar();

  const shared: Pick<TextInputProps, 'onFocus' | 'onBlur'> = {
    onFocus: (e) => {
      if (track) {
        notifyFloatingNumericKeyboardFocus();
      }
      extra?.onFocus?.(e);
    },
    onBlur: (e) => {
      if (track) {
        notifyFloatingNumericKeyboardBlur();
      }
      extra?.onBlur?.(e);
    },
  };

  if (Platform.OS === 'android') {
    return {
      ...shared,
      returnKeyType: 'done',
      blurOnSubmit: true,
      onSubmitEditing: () => {
        Keyboard.dismiss();
      },
    };
  }

  return shared;
}
