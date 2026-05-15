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
 *   npm run aci:capture-push       # login → INVIO → salva + variabili Vercel + redeploy ultimo deployment
 *   npm run aci:capture -- --out ./scripts/aci/aci-session.json
 *
 * Opzioni:
 *   --auto-wait     Attende il login rilevato dall’app (token o /home) prima del prompt INVIO.
 *   --push-vercel   Dopo il salvataggio, aggiorna su Vercel `ACI_SESSION_JSON` e (se c’è) `ACI_COSTIKM_KEYCLOAK_TOKEN`
 *                   tramite CLI (`vercel link` + `vercel login` già fatti nella cartella del progetto).
 *   --vercel-env    Ambienti separati da virgola (default: production). Esempio: production,preview
 *   --no-vercel-redeploy   Con `--push-vercel`: non eseguire `vercel redeploy` dopo l’aggiornamento variabili.
 *   --vercel-redeploy-no-wait   Non attendere il completamento del redeploy (`vercel redeploy --no-wait`).
 *
 * Flusso “premi solo INVIO” dopo il login CIE:
 *   npm run aci:capture-push
 *   (equivale a: npm run aci:capture -- --auto-wait --push-vercel)
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
import { pushAciSecretsToVercel, vercelRedeployLatestForTargets } from './vercelEnvCli';

const DEFAULT_START = process.env.ACI_START_URL ?? 'https://costikm.aci.it/';
const ACI_WEB = 'https://costikm.aci.it';

function parseArgs(argv: string[]): {
  out: string;
  autoWait: boolean;
  pushVercel: boolean;
  vercelTargets: string[];
  vercelRedeploy: boolean;
  vercelRedeployNoWait: boolean;
} {
  let out = resolve(process.cwd(), 'scripts/aci/aci-session.json');
  let autoWait = false;
  let pushVercel = false;
  let vercelTargets: string[] = ['production'];
  let vercelRedeploy = true;
  let vercelRedeployNoWait = false;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out' && argv[i + 1]) {
      out = resolve(process.cwd(), argv[++i]);
    } else if (a === '--auto-wait') {
      autoWait = true;
    } else if (a === '--push-vercel') {
      pushVercel = true;
    } else if (a === '--no-vercel-redeploy') {
      vercelRedeploy = false;
    } else if (a === '--vercel-redeploy-no-wait') {
      vercelRedeployNoWait = true;
    } else if (a === '--vercel-env' && argv[i + 1]) {
      const parts = argv[++i]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (parts.length > 0) vercelTargets = parts;
    }
  }
  return { out, autoWait, pushVercel, vercelTargets, vercelRedeploy, vercelRedeployNoWait };
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
  const { out, autoWait, pushVercel, vercelTargets, vercelRedeploy, vercelRedeployNoWait } =
    parseArgs(process.argv);

  console.log('Avvio Chromium (finestra visibile)...');
  const browser = await chromium.launch({ headless: false });
  try {
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

    if (pushVercel) {
      const oneLinePath = resolve(process.cwd(), 'scripts/aci/aci-session.one-line.json');
      await mkdir(dirname(oneLinePath), { recursive: true });
      await writeFile(oneLinePath, `${JSON.stringify(snapshot)}\n`, 'utf8');
      console.log(`\nCopia locale (gitignored): ${oneLinePath}`);
      await pushAciSecretsToVercel(snapshot, vercelTargets);
      if (vercelRedeploy) {
        await vercelRedeployLatestForTargets(vercelTargets, { noWait: vercelRedeployNoWait });
      }
    } else {
      console.log(
        '\nVercel: `npm run aci:print-vercel-env` stampa ACI_SESSION_JSON (+ JWT se c’è) pronti da incollare; con `--write-one-line` salva anche scripts/aci/aci-session.one-line.json. Oppure `npm run aci:capture-push` per aggiornare le variabili da CLI dopo il login.',
      );
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
