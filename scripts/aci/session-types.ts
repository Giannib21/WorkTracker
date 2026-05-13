import type { Cookie } from 'playwright';

/**
 * Snapshot salvata dopo login manuale (CIE) nel browser Playwright.
 * Non committare: `scripts/aci/session.json` è in `.gitignore`.
 */
export interface AciSavedSession {
  capturedAt: string;
  startUrl: string;
  /** Cookie del contesto browser (inclusi HttpOnly). */
  cookies: Cookie[];
  /** Copia serializzata di `localStorage` della pagina costikm. */
  localStorage: Record<string, string>;
  /** Copia opzionale di `sessionStorage`. */
  sessionStorage?: Record<string, string>;
  /** Bearer JWT se presente in storage (es. chiave `token` nel client Angular ACI). */
  bearerToken: string | null;
  /** Site key reCAPTCHA v2 letta da `assets/env.js` (se disponibile). */
  apiCaptchaPublic?: string | null;
  /** URL finale al momento del salvataggio. */
  finalUrl: string;
}
