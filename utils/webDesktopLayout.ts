/** Allineato a `WebDesktopRail`: percentuale + min/max in px. */
export const WEB_RAIL_WIDTH_PCT = 0.25;
export const WEB_RAIL_MIN_PX = 220;
export const WEB_RAIL_MAX_PX = 320;

/**
 * Larghezza effettiva della colonna sinistra (come da stile rail: 25% tra min e max).
 */
export function webRailWidthPx(windowWidth: number): number {
  if (!Number.isFinite(windowWidth) || windowWidth <= 0) return WEB_RAIL_MIN_PX;
  const fromPct = Math.round(windowWidth * WEB_RAIL_WIDTH_PCT);
  return Math.min(WEB_RAIL_MAX_PX, Math.max(WEB_RAIL_MIN_PX, fromPct));
}

/**
 * Browser su telefono / tablet touch-first: usa sempre il layout tipo app (tab in basso),
 * anche in landscape con viewport larga (altrimenti la sidebar risulterebbe scomoda).
 */
export function webPreferCompactWebChrome(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  try {
    if (window.matchMedia?.('(pointer: coarse)').matches) return true;
  } catch {
    /* noop */
  }
  const ua = navigator.userAgent;
  /** iPad escluso: spesso UA “desktop” / layout a due colonne se la larghezza lo consente. */
  if (/Android|iPhone|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return true;
  if (/Tablet|PlayBook|Silk/i.test(ua)) return true;
  return false;
}

/**
 * Vista desktop a due colonne solo se:
 * - non è un contesto “mobile web” (UA / puntatore), e
 * - l’area del contenuto principale è **strettamente maggiore** della sidebar (evita split ~50/50).
 */
export function webUseDesktopSplit(windowWidth: number): boolean {
  if (windowWidth <= 0) return false;
  if (webPreferCompactWebChrome()) return false;
  const rail = webRailWidthPx(windowWidth);
  return windowWidth - rail > rail;
}
