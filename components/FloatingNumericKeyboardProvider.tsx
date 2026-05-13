import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from 'react-native-paper';

import { useAppLocale } from '../context/AppLocaleContext';
import {
  registerFloatingNumericKeyboardLifecycle,
  type FloatingNumericLifecycle,
} from '../utils/floatingNumericKeyboardRegistry';

const BAR_HEIGHT = 36;

type Props = {
  children: ReactNode;
};

/**
 * Barra “Fatto” sopra la tastiera senza `InputAccessoryView`: posizionata con `bottom = altezza tastiera`.
 * Registra il lifecycle usato da `numericKeyboardDismissProps()` (onFocus / onBlur sui campi numerici).
 */
export function FloatingNumericKeyboardProvider({ children }: Props) {
  const theme = useTheme();
  const { messages } = useAppLocale();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [numericActive, setNumericActive] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearBlurTimer = useCallback(() => {
    if (blurTimer.current) {
      clearTimeout(blurTimer.current);
      blurTimer.current = null;
    }
  }, []);

  const onNumericFocusIntent = useCallback(() => {
    clearBlurTimer();
    setNumericActive(true);
  }, [clearBlurTimer]);

  const onNumericBlurIntent = useCallback(() => {
    clearBlurTimer();
    blurTimer.current = setTimeout(() => {
      blurTimer.current = null;
      setNumericActive(false);
    }, 160);
  }, [clearBlurTimer]);

  const lifecycle = useMemo<FloatingNumericLifecycle>(
    () => ({
      onNumericFocusIntent,
      onNumericBlurIntent,
    }),
    [onNumericBlurIntent, onNumericFocusIntent]
  );

  useEffect(() => {
    registerFloatingNumericKeyboardLifecycle(lifecycle);
    return () => {
      clearBlurTimer();
      registerFloatingNumericKeyboardLifecycle(null);
    };
  }, [clearBlurTimer, lifecycle]);

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: { endCoordinates: { height: number } }) => {
      setKeyboardHeight(e.endCoordinates.height);
    };
    const onHide = () => {
      setKeyboardHeight(0);
      clearBlurTimer();
      setNumericActive(false);
    };

    const subShow = Keyboard.addListener(showEvent, onShow);
    const subHide = Keyboard.addListener(hideEvent, onHide);
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, [clearBlurTimer]);

  const visible = Platform.OS !== 'web' && numericActive && keyboardHeight > 0;

  const onDonePress = () => {
    Keyboard.dismiss();
    clearBlurTimer();
    setNumericActive(false);
  };

  return (
    <View style={styles.root}>
      {children}
      {visible ? (
        <View style={styles.overlay} pointerEvents="box-none">
          <View
            style={[
              styles.bar,
              {
                bottom: keyboardHeight,
                height: BAR_HEIGHT,
                backgroundColor: theme.colors.surfaceVariant,
                borderTopColor: theme.colors.outlineVariant,
              },
            ]}
            pointerEvents="auto"
          >
            <Pressable
              onPress={onDonePress}
              style={({ pressed }) => [
                styles.btn,
                { backgroundColor: theme.colors.primary, opacity: pressed ? 0.9 : 1 },
              ]}
              hitSlop={8}
            >
              <Text style={[styles.btnLabel, { color: theme.colors.onPrimary }]}>{messages.keyboardDone}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99999,
    elevation: 24,
  },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
});
