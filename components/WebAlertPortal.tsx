import { useCallback, useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet } from 'react-native';
import { Button, Dialog, Portal, Text, useTheme } from 'react-native-paper';

import { setWebAlertListener, type WebAlertPayload } from '../utils/appAlert';

/**
 * Coda di dialoghi per web (stesso comportamento “uno alla volta” di Alert nativo).
 */
export function WebAlertPortal() {
  const theme = useTheme();
  const [queue, setQueue] = useState<WebAlertPayload[]>([]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const push = (p: WebAlertPayload) => setQueue((q) => [...q, p]);
    setWebAlertListener(push);
    return () => {
      setWebAlertListener(null);
    };
  }, []);

  const top = queue[0];
  const closeTop = useCallback(() => {
    setQueue((q) => q.slice(1));
  }, []);

  const onDismiss = useCallback(() => {
    if (!top) return;
    const cancel = top.buttons.find((b) => b.style === 'cancel');
    closeTop();
    void Promise.resolve(cancel?.onPress?.());
  }, [top, closeTop]);

  const onButtonPress = useCallback(
    (b: WebAlertPayload['buttons'][0]) => {
      const fn = b.onPress;
      closeTop();
      if (fn) void Promise.resolve(fn()).catch(() => {});
    },
    [closeTop],
  );

  if (Platform.OS !== 'web' || !top) {
    return null;
  }

  return (
    <Portal>
      <Dialog visible={Boolean(top)} dismissable={top.options?.cancelable !== false} onDismiss={onDismiss}>
        <Dialog.Title>{top.title}</Dialog.Title>
        {top.message ? (
          <Dialog.ScrollArea style={styles.scrollArea}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
              <Text variant="bodyMedium" selectable>
                {top.message}
              </Text>
            </ScrollView>
          </Dialog.ScrollArea>
        ) : null}
        <Dialog.Actions style={styles.actions}>
          {top.buttons.map((b, i) => (
            <Button
              key={`${b.text ?? i}-${i}`}
              mode={b.style === 'destructive' ? 'contained-tonal' : 'text'}
              buttonColor={b.style === 'destructive' ? theme.colors.errorContainer : undefined}
              textColor={b.style === 'destructive' ? theme.colors.onErrorContainer : undefined}
              onPress={() => onButtonPress(b)}
            >
              {b.text ?? 'OK'}
            </Button>
          ))}
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  scrollArea: { maxHeight: 360 },
  scrollContent: { paddingRight: 8 },
  actions: { flexWrap: 'wrap', justifyContent: 'flex-end', gap: 4, rowGap: 8 },
});
