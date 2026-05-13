/**
 * Orchestrazione HTTP generica: polling + POST JSON + propagazione cookie verso GET.
 *
 * Usare **solo** con endpoint di cui disponi autorizzazione (es. ambienti di test tuoi).
 * Non includere qui integrazioni verso servizi di risoluzione captcha di terze parti su siti altrui.
 */

export type HttpHeadersConfig = {
  origin: string;
  referer: string;
};

const DEFAULT_POLL_INTERVAL_MS = 3000;
const DEFAULT_POLL_MAX_ATTEMPTS = 40;

/** Estrae coppie `name=value` da Set-Cookie (prima `;` di ogni cookie). */
export function cookieHeaderFromSetCookie(headers: Headers): string {
  const h = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof h.getSetCookie === 'function') {
    const list = h.getSetCookie();
    if (list?.length) {
      return list
        .map((line) => line.split(';')[0]?.trim())
        .filter((pair) => pair && pair.includes('='))
        .join('; ');
    }
  }
  const raw = headers.get('set-cookie');
  if (!raw) return '';
  return raw
    .split(/,(?=\s*[A-Za-z0-9_.-]+=)/)
    .map((p) => p.trim().split(';')[0])
    .filter((pair) => pair.includes('='))
    .join('; ');
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

/**
 * Client astratto per un servizio esterno che produce un token stringa
 * (es. in un tuo staging il token potrebbe essere emesso da un mock).
 */
export interface ExternalValidationClient {
  /** Restituisce il token finale da inviare al tuo `/captcha/verify` equivalente. */
  obtainToken(): Promise<string>;
}

/**
 * Mock per test d’integrazione: restituisce un token fisso senza rete esterna.
 */
export class MockValidationClient implements ExternalValidationClient {
  constructor(private readonly token: string = 'mock-validation-token') {}

  async obtainToken(): Promise<string> {
    return this.token;
  }
}

export type PollOptions = {
  intervalMs?: number;
  maxAttempts?: number;
};

/**
 * Polling generico: `tryOnce` restituisce il valore oppure `null` se non ancora pronto.
 */
export async function pollUntil<T>(
  tryOnce: () => Promise<T | null>,
  opts?: PollOptions,
): Promise<T> {
  const intervalMs = opts?.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const maxAttempts = opts?.maxAttempts ?? DEFAULT_POLL_MAX_ATTEMPTS;

  for (let i = 0; i < maxAttempts; i++) {
    const v = await tryOnce();
    if (v != null) return v;
    await sleep(intervalMs);
  }
  throw new Error(`pollUntil: timeout dopo ${maxAttempts} tentativi`);
}

export type VerifyAndCostsParams = {
  validation: ExternalValidationClient;
  verifyUrl: string;
  costsUrl: string;
  headers: HttpHeadersConfig;
  /** fetch globale (iniettabile nei test). */
  fetchFn?: typeof fetch;
};

export type VerifyAndCostsResult = {
  costsStatus: number;
  costsBody: string;
  verifyCookies: string;
};

/**
 * Sequenza: (1) token dal client di validazione → (2) POST verify con `{"data": token}` →
 * (3) GET costs con header Cookie dalla Set-Cookie della verify.
 */
export async function runVerifyThenCostsWithCookies(
  params: VerifyAndCostsParams,
): Promise<VerifyAndCostsResult> {
  const fetchImpl = params.fetchFn ?? fetch;
  const { origin, referer } = params.headers;

  const token = await params.validation.obtainToken();

  const verifyRes = await fetchImpl(params.verifyUrl, {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/plain, */*',
      Origin: origin,
      Referer: referer,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data: token }),
  });

  const verifyCookies = cookieHeaderFromSetCookie(verifyRes.headers);
  const verifyText = await verifyRes.text();
  if (!verifyRes.ok) {
    throw new Error(`verify HTTP ${verifyRes.status}: ${verifyText.slice(0, 300)}`);
  }

  const costsRes = await fetchImpl(params.costsUrl, {
    method: 'GET',
    headers: {
      Accept: 'application/json, text/plain, */*',
      Origin: origin,
      Referer: referer,
      ...(verifyCookies ? { Cookie: verifyCookies } : {}),
    },
  });

  const costsBody = await costsRes.text();
  return {
    costsStatus: costsRes.status,
    costsBody,
    verifyCookies,
  };
}
