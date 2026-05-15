import { createElement } from 'react';
import { Image, Linking, Platform, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import type { AttachmentPreviewState } from '../hooks/useAttachmentPreview';
import { HapticButton } from './HapticButton';
import { WebAttachmentImage } from './WebAttachmentImage';

type Props = {
  preview: AttachmentPreviewState;
  allegatoLabel: string;
  openPdfLabel: string;
};

/** Anteprima allegato con layout corretto su web desktop (img/iframe nativi). */
export function WebAttachmentPreview({ preview, allegatoLabel, openPdfLabel }: Props) {
  if (preview.status === 'idle') return null;
  if (preview.status === 'loading') {
    return <Text style={styles.muted}>…</Text>;
  }
  if (!preview.openUri && !preview.displayUri) {
    return (
      <Text style={styles.muted} numberOfLines={2}>
        {allegatoLabel} {preview.label}
      </Text>
    );
  }

  if (Platform.OS !== 'web') {
    if (preview.kind === 'image' && preview.displayUri) {
      return (
        <Image source={{ uri: preview.displayUri }} style={styles.nativePreview} resizeMode="contain" />
      );
    }
    return (
      <Text style={styles.muted} numberOfLines={2}>
        {allegatoLabel} {preview.label}
      </Text>
    );
  }

  if (preview.kind === 'image' && preview.displayUri) {
    return <WebAttachmentImage src={preview.displayUri} />;
  }

  if (preview.kind === 'pdf' && preview.openUri) {
    return (
      <View style={styles.pdfBlock}>
        <Text style={styles.muted} numberOfLines={2}>
          {allegatoLabel} {preview.label}
        </Text>
        <HapticButton
          mode="outlined"
          icon="file-pdf-box"
          onPress={() => {
            if (typeof window !== 'undefined') {
              window.open(preview.openUri!, '_blank', 'noopener,noreferrer');
            } else {
              void Linking.openURL(preview.openUri!);
            }
          }}
        >
          {openPdfLabel}
        </HapticButton>
        <View style={styles.pdfFrame}>
          {createElement('iframe', {
            src: preview.openUri,
            title: preview.label,
            style: {
              width: '100%',
              height: 360,
              border: 'none',
              borderRadius: 10,
              backgroundColor: '#f3f4f6',
            },
          })}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.fileRow}>
      <Text style={styles.muted} numberOfLines={2}>
        {allegatoLabel} {preview.label}
      </Text>
      {preview.openUri ? (
        <HapticButton
          mode="text"
          onPress={() => {
            if (typeof window !== 'undefined') {
              window.open(preview.openUri!, '_blank', 'noopener,noreferrer');
            }
          }}
        >
          {openPdfLabel}
        </HapticButton>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  imageWrap: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  nativePreview: {
    width: '100%',
    maxWidth: 420,
    height: 280,
    alignSelf: 'center',
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
  },
  pdfBlock: {
    gap: 10,
  },
  pdfFrame: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    overflow: 'hidden',
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
  },
  fileRow: {
    gap: 6,
  },
  muted: {
    opacity: 0.8,
    fontSize: 13,
  },
});
