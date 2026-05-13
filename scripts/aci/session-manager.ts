#!/usr/bin/env node
/**
 * Bootstrap sessione ACI (CIE / SPID): browser visibile, login manuale, export `aci-session.json`.
 * Preferisci `npm run aci:capture` (prompt INVIO + `importantKeys`): stesso file di default e allineato al proxy.
 *
 * Salva:
 * - Cookie Playwright (inclusi HttpOnly) per domini `.aci.it`
 * - `localStorage` / `sessionStorage`
 * - `apiCaptchaPublic` estratta da https://costikm.aci.it/assets/env.js
 * - bearer da storage (se presente)
 *
 * Il file può servire a script Node personali (es. `AciCostiService` in `scripts/aci/`), non all’app Expo.
 *
 * Uso:
 *   npm run aci:bootstrap
 *   npm run aci:bootstrap -- --out ./scripts/aci/aci-session.json
 *
 * Timestamp modelli (ms a mezzanotte locale): vedi `utils/aciCostikmTimestamp.ts` e `scripts/aci/timestamp.ts`
 * — la lista modelli usa `GET /vehicles/models?...&date=<ms>` con data di calendario normalizzata a UTC midnight.
 *
 * Prima: npm run aci:install-browsers
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { chromium, type APIRequestContext } from 'playwright';

import type { AciSavedSession } from './session-types';
import { extractBearerFromStorage } from './session-util';
import { dumpPageStorage } from './storage-dump';
import { waitForCostikmLoggedIn } from './wait-for-login';

const DEFAULT_START = process.env.ACI_START_URL ?? 'https://costikm.aci.it/';
const ACI_WEB = 'https://costikm.aci.it';

function parseArgs(argv: string[]): { out: string } {
  let out = resolve(process.cwd(), 'scripts/aci/aci-session.json');
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out' && argv[i + 1]) {
      out = resolve(process.cwd(), argv[++i]);
    }
  }
  return { out };
}

/**
 * `assets/env.js` è tipicamente JS assegnato a un oggetto config; estraiamo la site key reCAPTCHA.
 */
async function fetchApiCaptchaPublic(req: APIRequestContext): Promise<string | null> {
  const res = await req.get(`${ACI_WEB}/assets/env.js`);
  if (!res.ok()) return null;
  const text = await res.text();
  const patterns = [
    /apiCaptchaPublic\s*[:=]\s*["']([^"'\\]+)["']/,
    /"apiCaptchaPublic"\s*:\s*"([^"]+)"/,
    /apiCaptchaPublic\s*:\s*([A-Za-z0-9_-]{20,})/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

async function main(): Promise<void> {
  const { out } = parseArgs(process.argv);

  console.log('Avvio Chromium (finestra visibile)...');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log(`Navigo verso: ${DEFAULT_START}`);
  await page.goto(DEFAULT_START, { waitUntil: 'domcontentloaded' });

  console.log('\n>>> Completa il login con CIE / SPID nel browser.');
  console.log('>>> Lo script attende fino a 30 minuti...\n');

  await waitForCostikmLoggedIn(page);
  console.log('Sessione attiva rilevata.');

  const { localStorage, sessionStorage } = await dumpPageStorage(page);
  const cookies = await context.cookies();
  const bearerToken = extractBearerFromStorage(localStorage);
  const finalUrl = page.url();
  const apiCaptchaPublic = await fetchApiCaptchaPublic(context.request);

  const snapshot: AciSavedSession = {
    capturedAt: new Date().toISOString(),
    startUrl: DEFAULT_START,
    cookies,
    localStorage,
    sessionStorage,
    bearerToken,
    apiCaptchaPublic: apiCaptchaPublic ?? null,
    finalUrl,
  };

  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(snapshot, null, 2), 'utf8');

  console.log(`\nSnapshot salvata in: ${out}`);
  console.log(
    `Cookie: ${cookies.length} voci | apiCaptchaPublic: ${apiCaptchaPublic ? 'sì' : 'non trovata'} | bearer: ${bearerToken ? 'sì' : 'no'}`,
  );
  console.log(
    '\nPer Vercel: imposta ACI_SESSION_JSON con il contenuto del file (JSON su una riga), oppure usa uno script di deploy che aggiorna la variabile.',
  );

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
