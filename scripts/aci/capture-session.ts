#!/usr/bin/env node
/**
 * Cattura sessione ACI Costi km dopo login manuale CIE/SPID (Playwright, browser visibile).
 * Salva cookie + localStorage + chiavi rilevanti in `scripts/aci/aci-session.json` (gitignored).
 *
 * Il proxy `api/aci-proxy.mjs` può leggere lo stesso JSON da disco (es. `vercel dev`) o da
 * `ACI_SESSION_JSON` su Vercel (incolla il file su una riga).
 *
 * Uso:
 *   npm run aci:install-browsers   # prima volta
 *   npm run aci:capture
 *   npm run aci:capture -- --out ./scripts/aci/aci-session.json
 *
 * Opzioni:
 *   --auto-wait   Attende il login rilevato dall’app (token o /home) prima del prompt INVIO.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

import { chromium, type APIRequestContext } from 'playwright';

import type { AciSavedSession } from './session-types';
import { extractBearerFromStorage } from './session-util';
import { dumpPageStorage } from './storage-dump';
import { waitForCostikmLoggedIn } from './wait-for-login';

const DEFAULT_START = process.env.ACI_START_URL ?? 'https://costikm.aci.it/';
const ACI_WEB = 'https://costikm.aci.it';

function parseArgs(argv: string[]): { out: string; autoWait: boolean } {
  let out = resolve(process.cwd(), 'scripts/aci/aci-session.json');
  let autoWait = false;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out' && argv[i + 1]) {
      out = resolve(process.cwd(), argv[++i]);
    } else if (a === '--auto-wait') {
      autoWait = true;
    }
  }
  return { out, autoWait };
}

/** Chiavi localStorage che spesso contengono OIDC / Keycloak / sessione. */
function pickImportantKeys(localStorage: Record<string, string>): Record<string, string> {
  const needles = ['token', 'keycloak', 'auth', 'access_token', 'id_token', 'refresh', 'session'];
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(localStorage)) {
    const kl = k.toLowerCase();
    if (needles.some((n) => kl.includes(n))) out[k] = v;
  }
  return out;
}

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

async function waitForEnterLine(message: string): Promise<void> {
  const rl = createInterface({ input, output });
  try {
    await rl.question(message);
  } finally {
    rl.close();
  }
}

async function main(): Promise<void> {
  const { out, autoWait } = parseArgs(process.argv);

  console.log('Avvio Chromium (finestra visibile)...');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log(`Navigo verso: ${DEFAULT_START}`);
  await page.goto(DEFAULT_START, { waitUntil: 'domcontentloaded' });

  console.log('\n>>> Browser aperto. Completa il login manuale con CIE / SPID nel browser.\n');

  if (autoWait) {
    console.log('>>> (modalità --auto-wait) Attendo che il portale risulti autenticato...\n');
    await waitForCostikmLoggedIn(page);
    console.log('Login rilevato.\n');
  }

  await waitForEnterLine(
    'Quando sei dentro al sito (es. pagina home dopo CIE), premi INVIO qui nel terminale per salvare la sessione.\n',
  );

  const { localStorage, sessionStorage } = await dumpPageStorage(page);
  const cookies = await context.cookies();
  const importantKeys = pickImportantKeys(localStorage);
  const bearerToken = extractBearerFromStorage(localStorage);
  const finalUrl = page.url();
  const apiCaptchaPublic = await fetchApiCaptchaPublic(context.request);
  const capturedAt = new Date().toISOString();

  const snapshot: AciSavedSession = {
    capturedAt,
    timestamp: capturedAt,
    startUrl: DEFAULT_START,
    cookies,
    localStorage,
    importantKeys,
    sessionStorage,
    bearerToken,
    apiCaptchaPublic: apiCaptchaPublic ?? null,
    finalUrl,
  };

  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(snapshot, null, 2), 'utf8');

  console.log(`\nSessione salvata in: ${out}`);
  console.log(
    `Cookie: ${cookies.length} | importantKeys: ${Object.keys(importantKeys).length} | bearer: ${bearerToken ? 'sì' : 'no'} | apiCaptchaPublic: ${apiCaptchaPublic ? 'sì' : 'no'}`,
  );
  console.log(
    '\nVercel: `npm run aci:print-vercel-env` stampa ACI_SESSION_JSON (+ JWT se c’è) pronti da incollare; con `--write-one-line` salva anche scripts/aci/aci-session.one-line.json per copiarlo dal telefono (file gitignored). Oppure `vercel dev` con il file locale.',
  );

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
