import { spawn } from 'node:child_process';

import type { AciSavedSession } from './session-types';
import { keycloakJwtFromSession } from './session-vercel';

const SHELL = process.platform === 'win32';

function runVercel(args: string[], stdin?: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['vercel', ...args], {
      stdio: stdin !== undefined ? ['pipe', 'inherit', 'inherit'] : 'inherit',
      cwd: process.cwd(),
      shell: SHELL,
    });
    if (stdin !== undefined) {
      child.stdin?.write(stdin);
      child.stdin?.write('\n');
      child.stdin?.end();
    }
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (signal) reject(new Error(`vercel terminato con signal ${signal}`));
      else resolve(code ?? 0);
    });
  });
}

function runVercelCaptureStdout(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const child = spawn('npx', ['vercel', ...args], {
      stdio: ['ignore', 'pipe', 'inherit'],
      cwd: process.cwd(),
      shell: SHELL,
    });
    child.stdout?.on('data', (d: Buffer) => chunks.push(d));
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (signal) reject(new Error(`vercel terminato con signal ${signal}`));
      if (code !== 0) {
        reject(new Error(`vercel ${args.join(' ')} è uscito con codice ${code}`));
        return;
      }
      resolve(Buffer.concat(chunks).toString('utf8').trim());
    });
  });
}

/** Rimuove la variabile se esiste; ignora errori (es. variabile assente). */
export async function vercelEnvRemoveBestEffort(name: string, target: string): Promise<void> {
  await runVercel(['env', 'rm', name, target, '--yes']);
}

export async function vercelEnvAddStdin(
  name: string,
  target: string,
  value: string,
  options: { sensitive?: boolean } = {},
): Promise<void> {
  const sensitive = options.sensitive !== false;
  const args = ['env', 'add', name, target, '--yes'];
  if (sensitive) args.push('--sensitive');
  const code = await runVercel(args, value);
  if (code !== 0) {
    throw new Error(`vercel env add ${name} (${target}) è uscito con codice ${code}`);
  }
}

/**
 * Aggiorna su Vercel `ACI_SESSION_JSON` e, se presente nello snapshot, `ACI_COSTIKM_KEYCLOAK_TOKEN`.
 * Richiede `vercel link` nella root del repo e login CLI (`vercel login`).
 */
export async function pushAciSecretsToVercel(
  snapshot: AciSavedSession,
  targets: string[],
): Promise<void> {
  const sessionLine = JSON.stringify(snapshot);
  const jwt = keycloakJwtFromSession(snapshot);

  for (const target of targets) {
    console.log(`\n→ Vercel [${target}]: aggiorno ACI_SESSION_JSON…`);
    await vercelEnvRemoveBestEffort('ACI_SESSION_JSON', target);
    await vercelEnvAddStdin('ACI_SESSION_JSON', target, sessionLine, { sensitive: true });
  }

  if (jwt) {
    for (const target of targets) {
      console.log(`\n→ Vercel [${target}]: aggiorno ACI_COSTIKM_KEYCLOAK_TOKEN…`);
      await vercelEnvRemoveBestEffort('ACI_COSTIKM_KEYCLOAK_TOKEN', target);
      await vercelEnvAddStdin('ACI_COSTIKM_KEYCLOAK_TOKEN', target, jwt, { sensitive: true });
    }
  } else {
    console.warn(
      '\n⚠ JWT Keycloak non trovato nello snapshot: ACI_COSTIKM_KEYCLOAK_TOKEN non è stato aggiornato. Se il proxy lo richiede, controlla localStorage dopo login o impostalo a mano su Vercel.\n',
    );
  }

  console.log(
    '\n✅ Variabili Vercel aggiornate.\n',
  );
}

const VERCEL_DEPLOY_TARGETS = new Set(['production', 'preview', 'development']);

/**
 * `vercel list --format json` poi `vercel redeploy` sull’ultimo deployment (preferenza `READY`)
 * per ogni ambiente richiesto. Richiede CLI autenticata e progetto collegato.
 */
export async function vercelRedeployLatestForTargets(
  targets: string[],
  options: { noWait?: boolean } = {},
): Promise<void> {
  for (const target of targets) {
    if (!VERCEL_DEPLOY_TARGETS.has(target)) {
      console.warn(`\n⚠ Redeploy: ambiente "${target}" non supportato (solo production | preview | development), salto.`);
      continue;
    }

    console.log(`\n→ Ultimo deployment [${target}]: leggo elenco da Vercel…`);
    const stdout = await runVercelCaptureStdout([
      'list',
      '--environment',
      target,
      '--format',
      'json',
      '--yes',
    ]);
    const data = JSON.parse(stdout) as { deployments?: Array<{ url: string; state: string }> };
    const list = data.deployments ?? [];
    const ready = list.find((d) => d.state === 'READY');
    const pick = ready ?? list[0];
    if (!pick?.url) {
      console.warn(`Nessun deployment trovato per [${target}], salto redeploy.`);
      continue;
    }

    const args = ['redeploy', pick.url, '--yes'];
    if (target !== 'production') {
      args.push('--target', target);
    }
    if (options.noWait) args.push('--no-wait');

    console.log(`\n→ Redeploy: ${pick.url} (${pick.state})…`);
    const code = await runVercel(args);
    if (code !== 0) {
      throw new Error(`vercel redeploy [${target}] è uscito con codice ${code}`);
    }
  }

  console.log('\n✅ Redeploy richiesto per gli ambienti indicati.\n');
}
