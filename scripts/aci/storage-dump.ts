import type { Page } from 'playwright';

/** Serializza localStorage e sessionStorage della pagina corrente (origine costikm). */
export async function dumpPageStorage(page: Page): Promise<{
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
}> {
  return page.evaluate(() => {
    const ls: Record<string, string> = {};
    const ss: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) ls[k] = localStorage.getItem(k) ?? '';
    }
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k) ss[k] = sessionStorage.getItem(k) ?? '';
    }
    return { localStorage: ls, sessionStorage: ss };
  });
}
