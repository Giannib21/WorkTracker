import type { Page } from 'playwright';

const DEFAULT_LOGIN_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * Attende che l'utente completi il login OIDC/CIE e che l'app costikm
 * risulti autenticata (token in localStorage o rotta tipica post-login).
 */
export async function waitForCostikmLoggedIn(page: Page, timeoutMs = DEFAULT_LOGIN_TIMEOUT_MS): Promise<void> {
  await page.waitForFunction(
    () => {
      try {
        if (!location.hostname.endsWith('costikm.aci.it')) return false;
        const token = localStorage.getItem('token');
        if (token && token.length > 30) return true;
        const p = location.pathname.toLowerCase();
        if (p === '/home' || p.startsWith('/home/')) return true;
        return false;
      } catch {
        return false;
      }
    },
    undefined,
    { timeout: timeoutMs },
  );
}

/**
 * Attende che reCAPTCHA v2 compili la textarea nascosta (dopo interazione utente nel browser).
 */
export async function waitForRecaptchaResponseToken(page: Page, timeoutMs = DEFAULT_LOGIN_TIMEOUT_MS): Promise<string> {
  await page.waitForFunction(
    () => {
      const el = document.querySelector('textarea[name="g-recaptcha-response"]');
      if (!el || !('value' in el)) return false;
      const v = (el as HTMLTextAreaElement).value;
      return typeof v === 'string' && v.length > 40;
    },
    undefined,
    { timeout: timeoutMs },
  );
  const token = await page.$eval('textarea[name="g-recaptcha-response"]', (el) => (el as HTMLTextAreaElement).value);
  if (!token) throw new Error('reCAPTCHA: textarea vuota dopo wait');
  return token;
}
