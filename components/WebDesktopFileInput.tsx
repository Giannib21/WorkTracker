import { createElement, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import { HapticButton } from './HapticButton';
import { useWebDesktopLayout } from '../hooks/useWebDesktopLayout';
import { persistPickedFile } from '../utils/spesaAttachments';

type Props = {
  label: string;
  disabled?: boolean;
  onPicked: (storedPath: string) => void;
  onError: () => void;
};

/**
 * Su web desktop il Document Picker Expo è meno affidabile: usiamo `<input type="file">` nativo.
 */
export function WebDesktopFileInput({ label, disabled, onPicked, onError }: Props) {
  const { isDesktopSplit } = useWebDesktopLayout();
  const inputRef = useRef<HTMLInputElement | null>(null);

  if (Platform.OS !== 'web' || !isDesktopSplit || typeof document === 'undefined') {
    return null;
  }

  return (
    <View style={styles.wrap}>
      {createElement('input', {
        ref: inputRef,
        type: 'file',
        accept: 'image/*,application/pdf,.pdf,.heic,.heif',
        style: { display: 'none' },
        onChange: (e: Event) => {
          const target = e.target as HTMLInputElement;
          const file = target.files?.[0];
          target.value = '';
          if (!file) return;
          void (async () => {
            try {
              const blobUrl = URL.createObjectURL(file);
              try {
                const stored = await persistPickedFile(blobUrl, file.name, file);
                onPicked(stored);
              } finally {
                URL.revokeObjectURL(blobUrl);
              }
            } catch {
              onError();
            }
          })();
        },
      })}
      <HapticButton
        mode="outlined"
        icon="file-document-outline"
        disabled={disabled}
        onPress={() => inputRef.current?.click()}
      >
        {label}
      </HapticButton>
      <Text style={styles.hint}>PDF e immagini — consigliato su PC</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 4,
  },
  hint: {
    fontSize: 11,
    opacity: 0.55,
    marginLeft: 2,
  },
});
