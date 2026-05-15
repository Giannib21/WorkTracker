#!/usr/bin/env node
/**
 * Dopo `npm run aci:capture`, prepara i valori per le variabili Vercel del proxy ACI:
 * - `ACI_SESSION_JSON` (JSON su una riga, come richiesto da `api/aci-proxy.mjs`)
 * - `ACI_COSTIKM_KEYCLOAK_TOKEN` (JWT Keycloak se presente nello snapshot)
 *
 * Uso:
 *   npm run aci:print-vercel-env
 *   npm run aci:print-vercel-env -- --in ./scripts/aci/aci-session.json
 *   npm run aci:print-vercel-env -- --write-one-line   # scrive anche scripts/aci/aci-session.one-line.json (gitignored)
 *
 * Automazione deploy (richiede `vercel` CLI, progetto già collegato con `vercel link`):
 *   npm run aci:capture-push       # consigliato: cattura + push variabili + redeploy ultimo deployment
 *   npm run aci:vercel-env-add-session
 *   (PowerShell non supporta `comando < file` come bash; usa lo script sopra oppure:
 *   Get-Content .\\scripts\\aci\\aci-session.one-line.json -Raw | npx vercel env add ACI_SESSION_JSON production)
 *   Su bash: npx vercel env add ACI_SESSION_JSON production < scripts/aci/aci-session.one-line.json
 *   Poi `npx vercel --prod` o Redeploy da dashboard. Se la variabile esiste: `npx vercel env rm ACI_SESSION_JSON production`
 *
 * Output: tutto nel terminale (stdout), nella sessione dove esegui il comando.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { AciSavedSession } from './session-types';
import { keycloakJwtFromSession } from './session-vercel';

const DEFAULT_IN = resolve(process.cwd(), 'scripts/aci/aci-session.json');
const ONE_LINE_OUT = resolve(process.cwd(), 'scripts/aci/aci-session.one-line.json');

function parseArgs(argv: string[]): { inputPath: string; writeOneLine: boolean } {
  let inputPath = DEFAULT_IN;
  let writeOneLine = false;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--in' && argv[i + 1]) inputPath = resolve(process.cwd(), argv[++i]);
    else if (a === '--write-one-line') writeOneLine = true;
  }
  return { inputPath, writeOneLine };
}

async function main(): Promise<void> {
  const { inputPath, writeOneLine } = parseArgs(process.argv);

  const raw = await readFile(inputPath, 'utf8');
  const session = JSON.parse(raw) as AciSavedSession;
  const oneLine = JSON.stringify(session);

  if (writeOneLine) {
    await writeFile(ONE_LINE_OUT, `${oneLine}\n`, 'utf8');
    console.log(`\nOK: scritto anche su file (gitignored):\n${ONE_LINE_OUT}`);
    console.log(
      'Sul telefono: apri quel file da OneDrive/files e copia l’unica riga in Vercel → Settings → Environment Variables → ACI_SESSION_JSON (Production).\n',
    );
  }

  const jwt = keycloakJwtFromSession(session);

  // Tutto su stdout: stessa finestra di terminale del comando `npm run aci:print-vercel-env`.
  console.log('\n=== Valori per Vercel (NON condividere) ===\n');
  console.log('1) Variabile: ACI_SESSION_JSON (Production, Preview se serve)');
  console.log('   Incolla UNA SOLA RIGA (tra ---BEGIN e ---END):\n');
  console.log('---BEGIN ACI_SESSION_JSON---');
  console.log(oneLine);
  console.log('---END ACI_SESSION_JSON---\n');

  if (jwt) {
    console.log('2) Variabile: ACI_COSTIKM_KEYCLOAK_TOKEN (stesso ambiente)\n');
    console.log('---BEGIN ACI_COSTIKM_KEYCLOAK_TOKEN---');
    console.log(jwt);
    console.log('---END ACI_COSTIKM_KEYCLOAK_TOKEN---\n');
  } else {
    console.log(
      '2) ACI_COSTIKM_KEYCLOAK_TOKEN: non trovato nello snapshot (solo cookie). Se il proxy risponde 403, aggiungi il JWT manualmente da DevTools su costikm dopo login.\n',
    );
  }

  console.log(
    'Redeploy: Vercel Dashboard → Deployments → … → Redeploy, oppure da PC: `npx vercel --prod` (se usi CLI).\n' +
      'Su Windows (PowerShell) per caricare il file su Vercel senza `<`: `npm run aci:vercel-env-add-session` (dopo `--write-one-line` o con aci-session.one-line.json già pronto).\n',
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
