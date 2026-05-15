import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { isProbablyImagePath, normalizeAttachmentDisplayUri } from '../utils/spesaAttachments';
import type { WebAttachmentKind } from '../utils/webAttachmentStore';

export type AttachmentPreviewState =
  | { status: 'idle' }
  | { status: 'loading' }
  | {
      status: 'ready';
      kind: WebAttachmentKind;
      displayUri: string | null;
      openUri: string | null;
      label: string;
    };

export function useAttachmentPreview(fotoPath: string | null): AttachmentPreviewState {
  const [state, setState] = useState<AttachmentPreviewState>(
    fotoPath ? { status: 'loading' } : { status: 'idle' }
  );

  useEffect(() => {
    if (!fotoPath) {
      setState({ status: 'idle' });
      return;
    }

    let cancelled = false;

    if (Platform.OS === 'web') {
      void (async () => {
        const { resolveWebAttachmentPreview } = await import('../utils/webAttachmentStore');
        try {
          const info = await resolveWebAttachmentPreview(fotoPath);
          if (cancelled) return;
          setState({
            status: 'ready',
            kind: info.kind,
            displayUri: info.displayUri,
            openUri: info.openUri,
            label: info.label,
          });
        } catch {
          if (!cancelled) {
            setState({
              status: 'ready',
              kind: 'other',
              displayUri: null,
              openUri: null,
              label: fotoPath,
            });
          }
        }
      })();
      return () => {
        cancelled = true;
        void import('../utils/webAttachmentStore').then(({ revokeWebAttachmentPreview }) => {
          revokeWebAttachmentPreview(fotoPath);
        });
      };
    }

    const isImage = isProbablyImagePath(fotoPath);
    setState({
      status: 'ready',
      kind: isImage ? 'image' : 'other',
      displayUri: isImage ? normalizeAttachmentDisplayUri(fotoPath) : null,
      openUri: fotoPath,
      label: fotoPath.split('/').pop() ?? fotoPath,
    });
    return () => {
      cancelled = true;
    };
  }, [fotoPath]);

  return state;
}
