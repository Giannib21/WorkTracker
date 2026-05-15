import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { normalizeAttachmentDisplayUri } from '../utils/spesaAttachments';

/**
 * URI per anteprima allegato: su web risolve `wt-att:` da IndexedDB in blob URL.
 */
export function useAttachmentPreviewUri(fotoPath: string | null): string | null {
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  useEffect(() => {
    if (!fotoPath) {
      setPreviewUri(null);
      return;
    }

    let cancelled = false;

    if (Platform.OS === 'web') {
      void (async () => {
        const { isWebAttachmentRef, resolveWebAttachmentDisplayUri } = await import(
          '../utils/webAttachmentStore'
        );
        try {
          const resolved = isWebAttachmentRef(fotoPath)
            ? await resolveWebAttachmentDisplayUri(fotoPath)
            : fotoPath;
          if (!cancelled) setPreviewUri(resolved);
        } catch {
          if (!cancelled) setPreviewUri(null);
        }
      })();
      return () => {
        cancelled = true;
        void import('../utils/webAttachmentStore').then(({ isWebAttachmentRef, revokeWebAttachmentDisplayUri }) => {
          if (isWebAttachmentRef(fotoPath)) revokeWebAttachmentDisplayUri(fotoPath);
        });
      };
    }

    setPreviewUri(normalizeAttachmentDisplayUri(fotoPath));
    return () => {
      cancelled = true;
    };
  }, [fotoPath]);

  return previewUri;
}
