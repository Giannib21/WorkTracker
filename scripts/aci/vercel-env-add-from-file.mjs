#!/usr/bin/env node
/**
 * Invia il contenuto di un file su stdin a `vercel env add` (funziona anche su PowerShell,
 * dove `< file` non è supportato come in bash).
 *
 * Uso (dalla root del repo, con `vercel link` già fatto e CLI autenticata):
 *   npm run aci:vercel-env-add-session
 *
 * Con argomenti opzionali:
 *   node scripts/aci/vercel-env-add-from-file.mjs [environment] [percorso-file] [nome-variabile]
 *
 * Esempi:
 *   node scripts/aci/vercel-env-add-from-file.mjs production ./scripts/aci/aci-session.one-line.json ACI_SESSION_JSON
 *   node scripts/aci/vercel-env-add-from-file.mjs production ./scripts/aci/jwt-one-line.txt ACI_COSTIKM_KEYCLOAK_TOKEN
 *
 * Se la variabile esiste già: `npx vercel env rm NOME production` poi rilancia questo script.
 * Per sessione + JWT in un colpo solo dopo il login: `npm run aci:capture-push` (vedi `capture-session.ts`).
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

const target = process.argv[2] || 'production';
const fileArg = process.argv[3] || 'scripts/aci/aci-session.one-line.json';
const name = process.argv[4] || 'ACI_SESSION_JSON';

const file = resolve(process.cwd(), fileArg);

if (!existsSync(file)) {
  console.error(`File non trovato: ${file}`);
  console.error('Genera prima: npm run aci:print-vercel-env -- --write-one-line');
  process.exit(1);
}

const value = readFileSync(file, 'utf8').trim();
if (!value) {
  console.error(`File vuoto: ${file}`);
  process.exit(1);
}

const shell = process.platform === 'win32';
const child = spawn('npx', ['vercel', 'env', 'add', name, target], {
  stdio: ['pipe', 'inherit', 'inherit'],
  cwd: process.cwd(),
  shell,
});

child.stdin.write(value);
child.stdin.write('\n');
child.stdin.end();

child.on('error', (err) => {
  console.error(err);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) process.exit(1);
  process.exit(code ?? 0);
});
