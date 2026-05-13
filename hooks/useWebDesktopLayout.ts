import { useMemo } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

import { webRailWidthPx, webUseDesktopSplit } from '../utils/webDesktopLayout';

/**
 * Layout web “desktop” (sidebar + contenuto) vs layout tipo app (tab bar in basso).
 */
export function useWebDesktopLayout() {
  const { width } = useWindowDimensions();

  return useMemo(() => {
    const railWidth = webRailWidthPx(width);
    const isDesktopSplit = Platform.OS === 'web' && webUseDesktopSplit(width);
    return { windowWidth: width, railWidth, isDesktopSplit };
  }, [width]);
}
