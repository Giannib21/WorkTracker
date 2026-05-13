#!/usr/bin/env node
/**
 * Browser visibile: apri costikm, attendi login CIE manuale, salva session.json.
 *
 * Opzionale: dopo il login attende il token reCAPTCHA dalla textarea del widget.
 *
 * Uso:
 *   npm run aci:capture
 *   npm run aci:capture -- --out ./scripts/aci/session.json
 *   npm run aci:capture -- --wait-recaptcha
 *
 * Prima esegui: npm run aci:install-browsers
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { chromium } from 'playwright';

import type { AciSavedSession } from './session-types';
import { extractBearerFromStorage } from './session-util';
import { dumpPageStorage } from './storage-dump';
import { waitForCostikmLoggedIn, waitForRecaptchaResponseToken } from './wait-for-login';

const DEFAULT_START = process.env.ACI_START_URL ?? 'https://costikm.aci.it/';

function parseArgs(argv: string[]): { out: string; waitRecaptcha: boolean } {
  let out = resolve(process.cwd(), 'scripts/aci/session.json');
  let waitRecaptcha = false;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out' && argv[i + 1]) {
      out = resolve(process.cwd(), argv[++i]);
    } else if (a === '--wait-recaptcha') {
      waitRecaptcha = true;
    }
  }
  return { out, waitRecaptcha };
}

async function main(): Promise<void> {
  const { out, waitRecaptcha } = parseArgs(process.argv);

  console.log('Avvio Chromium (finestra visibile)...');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log(`Navigo verso: ${DEFAULT_START}`);
  await page.goto(DEFAULT_START, { waitUntil: 'domcontentloaded' });

  console.log('\n>>> Completa il login con CIE / SPID nel browser.');
  console.log('>>> Questo script attende fino a 30 minuti...\n');

  await waitForCostikmLoggedIn(page);
  console.log('Login rilevato.');

  let recaptchaNote: string | undefined;
  if (waitRecaptcha) {
    console.log('\n>>> Vai alla schermata con reCAPTCHA e risolvilo. Attendo il token...\n');
    const token = await waitForRecaptchaResponseToken(page);
    recaptchaNote = `Token reCAPTCHA catturato (${token.length} caratteri). Usalo con AciCostiService.verifyCaptcha(token) — non salvato in session.json.`;
    console.log(recaptchaNote);
  }

  const { localStorage, sessionStorage } = await dumpPageStorage(page);
  const cookies = await context.cookies();
  const bearerToken = extractBearerFromStorage(localStorage);
  const finalUrl = page.url();

  const snapshot: AciSavedSession = {
    capturedAt: new Date().toISOString(),
    startUrl: DEFAULT_START,
    cookies,
    localStorage,
    sessionStorage,
    bearerToken,
    finalUrl,
  };

  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(snapshot, null, 2), 'utf8');

  console.log(`\nSessione salvata in: ${out}`);
  if (recaptchaNote) console.log(recaptchaNote);

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
