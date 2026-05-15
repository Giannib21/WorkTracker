import { createElement, useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

const MAX_W = 400;
const MAX_H = 480;

type Props = {
  src: string;
};

/** Anteprima immagine web con proporzioni originali (no stretch su layout desktop largo). */
export function WebAttachmentImage({ src }: Props) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  const onLoad = useCallback((e: Event) => {
    const img = e.target as HTMLImageElement;
    if (!img.naturalWidth || !img.naturalHeight) return;
    const scale = Math.min(1, MAX_W / img.naturalWidth, MAX_H / img.naturalHeight);
    setSize({
      w: Math.max(1, Math.round(img.naturalWidth * scale)),
      h: Math.max(1, Math.round(img.naturalHeight * scale)),
    });
  }, []);

  return (
    <View style={styles.wrap}>
      {createElement('img', {
        src,
        alt: '',
        onLoad,
        style: {
          display: 'block',
          margin: '0 auto',
          width: size ? size.w : undefined,
          height: size ? size.h : undefined,
          maxWidth: MAX_W,
          maxHeight: MAX_H,
          objectFit: 'contain',
          borderRadius: 10,
        },
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
});
