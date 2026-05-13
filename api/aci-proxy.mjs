// api/aci-proxy.mjs
import { text } from 'node:stream/consumers';

const ACI_API = 'https://costikm-api-v2.services.aci.it';
const ACI_WEB = 'https://costikm.aci.it';

/** Richieste senza UA “browser” a volte ricevono 403 pur con cookie/token validi. */
const ACI_BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/** Come l’interceptor Angular costikm (`main.*.js`): gateway/API spesso si aspettano questa chiave. */
const ACI_APP_KEY = 'costikm';

/**
 * Token Keycloak opzionale (stesso `localStorage.token` dopo login CIE sul sito).
 * Senza login sul portale l’interceptor non invia Bearer; alcuni ambienti richiedono comunque sessione OIDC per `/costs`.
 * Imposta su Vercel es. `ACI_COSTIKM_KEYCLOAK_TOKEN` (JWT) da rinnovare periodicamente (`npm run aci:capture`).
 */
function optionalKeycloakBearer() {
  const t =
    process.env.ACI_COSTIKM_KEYCLOAK_TOKEN ||
    process.env.ACI_KEYCLOAK_ACCESS_TOKEN ||
    process.env.ACI_COSTIKM_BEARER;
  if (typeof t !== 'string') return null;
  const s = t.trim();
  return s.length > 40 ? s : null;
}

/** Header comuni alle chiamate verso `costikm-api-v2` (allineati al client web). */
function aciApiBaseHeaders(extra = {}) {
  return {
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
    Origin: ACI_WEB,
    Referer: `${ACI_WEB}/home`,
    'User-Agent': ACI_BROWSER_UA,
    'X-Application-Key': ACI_APP_KEY,
    'Sec-Fetch-Site': 'same-site',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Dest': 'empty',
    ...extra,
  };
}

const TWO_CAPTCHA_API_KEY = process.env.TWO_CAPTCHA_API_KEY;
const RECAPTCHA_SITE_KEY =
  process.env.RECAPTCHA_SITE_KEY || '6LeJn3kpAAAAANAvxYqVDgtnWSQsm0amZlnvIBCv';

// ==================== FUNZIONI HELPER (corrette per 2Captcha) ====================
/** Job id da in.php: JSON oppure testo `OK|id`; errori ERROR_* espliciti. */
function extract2CaptchaInJobId(data) {
  if (typeof data === 'string') {
    const t = data.trim();
    const ok = /^OK\|([\s\S]+)$/.exec(t);
    if (ok) return ok[1].trim();
    if (/^ERROR_/i.test(t)) throw new Error(`2Captcha (in.php): ${t}`);
    throw new Error(
      `getAsyncResponse: risposta POST testuale non riconosciuta (${t.slice(0, 160).replace(/\s+/g, ' ')})`,
    );
  }
  if (!data || typeof data !== 'object') {
    throw new Error('getAsyncResponse: risposta POST non è JSON né testo OK|…');
  }
  if (data.status === 0 && typeof data.request === 'string' && data.request.startsWith('ERROR_')) {
    throw new Error(
      `2Captcha (in.php): ${data.request}${data.error_text ? ` — ${data.error_text}` : ''}`,
    );
  }
  const req = data.request;
  if (typeof req === 'string' && req.length > 0) return req;
  if (typeof req === 'number' && Number.isFinite(req)) return String(req);
  const alt = data.id ?? data.taskId;
  if (typeof alt === 'string' && alt.length > 0) return alt;
  if (typeof alt === 'number' && Number.isFinite(alt)) return String(alt);
  throw new Error(
    `getAsyncResponse: nessun job id (request/id). Chiavi: ${Object.keys(data).join(', ')}`,
  );
}

function coerceNumericStatus(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return NaN;
}

/** Risultato res.php: JSON o testo OK|token / CAPCHA_NOT_READY / ERROR_*. */
function parse2CaptchaPollResult(data) {
  if (typeof data === 'string') {
    const t = data.trim();
    if (/^OK\|/.test(t)) return { ready: true, token: t.slice(3).trim() };
    if (/^ERROR_/i.test(t)) throw new Error(`2Captcha (res.php): ${t}`);
    return { ready: false };
  }
  if (!data || typeof data !== 'object') {
    throw new Error('getAsyncResponse: risposta status non è JSON né testo');
  }
  const st = coerceNumericStatus(data.status);
  if (!Number.isFinite(st)) {
    throw new Error('getAsyncResponse: campo `status` mancante o non numerico');
  }
  if (st === 1) {
    const r = data.request;
    if (typeof r === 'string') return { ready: true, token: r };
    if (r != null && r !== '') return { ready: true, token: String(r) };
    throw new Error('getAsyncResponse: status=1 ma `request` mancante');
  }
  return { ready: false };
}

function resolveStatusUrl(statusUrl, id) {
  return typeof statusUrl === 'function' ? statusUrl(id) : statusUrl;
}

async function getAsyncResponse(options) {
  const client = options.axios ?? (await import('axios')).default;
  const pollIntervalMs = options.pollIntervalMs ?? 6000;
  const maxAttempts = options.maxAttempts ?? 80;

  const postRes = await client.post(options.targetUrl, options.postBody ?? null, {
    headers: options.headers,
  });

  const id = extract2CaptchaInJobId(postRes.data);
  const pollUrl = resolveStatusUrl(options.statusUrl, id);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await new Promise(r => setTimeout(r, pollIntervalMs));

    const statusRes = await client.get(pollUrl, { headers: options.headers });
    const parsed = parse2CaptchaPollResult(statusRes.data);
    if (parsed.ready) return parsed.token;
  }

  throw new Error(`getAsyncResponse: timeout dopo ${maxAttempts} tentativi`);
}

function cookiePairFromSetCookieLine(line) {
  const pair = line.split(';')[0]?.trim();
  if (!pair || !pair.includes('=')) return null;
  const eq = pair.indexOf('=');
  const name = pair.slice(0, eq).trim();
  if (!name) return null;
  return { name, pair };
}

/** Accumula `name=value` per header `Cookie` (ultimo valore vince su stesso nome). */
class CookieJar {
  constructor() {
    this.map = new Map();
  }
  mergeFromHeaders(headers) {
    for (const line of setCookieLinesFromHeaders(headers)) {
      const p = cookiePairFromSetCookieLine(line);
      if (p) this.map.set(p.name, p.pair);
    }
  }
  toHeaderString() {
    return Array.from(this.map.values()).join('; ');
  }
}

/** Righe Set-Cookie: preferisci getSetCookie(); altrimenti splitta header unico (Node fetch). */
function setCookieLinesFromHeaders(headers) {
  if (typeof headers.getSetCookie === 'function') {
    const arr = headers.getSetCookie();
    if (arr?.length) return arr;
  }
  const raw = headers.get('set-cookie');
  if (!raw) return [];
  return raw
    .split(/,(?=\s*[A-Za-z0-9_.-]+=)/)
    .map((p) => p.trim())
    .filter(Boolean);
}

const JWT_LIKE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

/** JWT eventualmente incastonato in un cookie HttpOnly (raro ma a costo zero da provare). */
function extractJwtFromCookieHeader(cookieHeader) {
  if (!cookieHeader || typeof cookieHeader !== 'string') return null;
  for (const segment of cookieHeader.split(';')) {
    const eq = segment.indexOf('=');
    if (eq === -1) continue;
    let val = segment.slice(eq + 1).trim();
    try {
      val = decodeURIComponent(val);
    } catch {
      /* ignore */
    }
    if (val.length > 50 && JWT_LIKE.test(val)) return val;
  }
  return null;
}

function findJwtStringDeep(node, depth) {
  if (depth > 14 || node == null) return null;
  if (typeof node === 'string' && node.length > 50 && JWT_LIKE.test(node)) return node;
  if (typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const x of node) {
      const f = findJwtStringDeep(x, depth + 1);
      if (f) return f;
    }
    return null;
  }
  for (const v of Object.values(node)) {
    const f = findJwtStringDeep(v, depth + 1);
    if (f) return f;
  }
  return null;
}

/** JWT / bearer da POST /captcha/verify (chiavi note + ricerca JWT annidata). */
function extractBearerFromVerifyResponse(verifyRes, bodyText) {
  const authHdr = verifyRes.headers.get('authorization') || verifyRes.headers.get('Authorization');
  if (authHdr && /^Bearer\s+\S+/i.test(authHdr)) {
    return authHdr.replace(/^Bearer\s+/i, '').trim();
  }
  const xTok =
    verifyRes.headers.get('x-access-token') ||
    verifyRes.headers.get('X-Access-Token') ||
    verifyRes.headers.get('x-auth-token');
  if (xTok && typeof xTok === 'string' && xTok.length > 30) return xTok.trim();

  if (!bodyText || typeof bodyText !== 'string') return null;
  const trimmed = bodyText.trim();
  if (!trimmed) return null;
  let obj;
  try {
    obj = JSON.parse(trimmed);
  } catch {
    return null;
  }
  const keys = ['token', 'access_token', 'accessToken', 'id_token', 'jwt', 'accessTokenJwt', 'idToken'];
  function fromObj(o) {
    if (!o || typeof o !== 'object') return null;
    for (const k of keys) {
      const v = o[k];
      if (typeof v === 'string' && v.length > 30) return v;
    }
    return null;
  }
  let b = fromObj(obj);
  if (b) return b;
  if (obj.data != null) {
    if (typeof obj.data === 'string' && obj.data.length > 30) return obj.data;
    b = fromObj(obj.data);
    if (b) return b;
  }
  if (obj.result && typeof obj.result === 'object') {
    b = fromObj(obj.result);
    if (b) return b;
  }
  b = findJwtStringDeep(obj, 0);
  return b || null;
}
// =============================================================================

function isAllowedPath(pathname) {
  return pathname.startsWith('/vehicles/');
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Max-Age': '86400',
  };
}

export default async function handler(req, res) {
  const origin = req.headers.origin || '';

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(origin));
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { ...corsHeaders(origin), 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Use POST with JSON body' }));
    return;
  }

  let payload;
  try {
    const raw = await text(req);
    payload = JSON.parse(raw || '{}');
  } catch {
    res.writeHead(400, { ...corsHeaders(origin), 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON body' }));
    return;
  }

  if (payload.mode === 'calculateCosts') {
    return await handleCalculateCosts(req, res, payload, origin);
  }

  // === CODICE VECCHIO (catalogo veicoli) ===
  const rawPath = typeof payload.path === 'string' ? payload.path : '';
  let pathname, search = '';
  try {
    const u = new URL(rawPath, 'http://local');
    pathname = u.pathname;
    search = u.search ? u.search.slice(1) : '';
  } catch {
    res.writeHead(400, { ...corsHeaders(origin), 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid path' }));
    return;
  }

  if (!isAllowedPath(pathname)) {
    res.writeHead(403, { ...corsHeaders(origin), 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Path not allowed (only /vehicles/*)' }));
    return;
  }

  const method = payload.method === 'POST' ? 'POST' : 'GET';
  const upstreamUrl = `${ACI_API}${pathname}${search ? `?${search}` : ''}`;

  const headers = {
    Accept: 'application/json, text/plain, */*',
    Origin: ACI_WEB,
    Referer: `${ACI_WEB}/`,
  };

  if (method === 'POST' && typeof payload.body === 'string') {
    headers['Content-Type'] = 'application/json';
  }

  let upstream;
  try {
    upstream = await fetch(upstreamUrl, {
      method,
      headers,
      body: method === 'POST' ? payload.body : undefined,
    });
  } catch (e) {
    res.writeHead(502, { ...corsHeaders(origin), 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Upstream fetch failed', detail: String(e?.message || e) }));
    return;
  }

  const ct = upstream.headers.get('content-type') || 'application/octet-stream';
  const body = new Uint8Array(await upstream.arrayBuffer());

  res.writeHead(upstream.status, { ...corsHeaders(origin), 'Content-Type': ct });
  res.end(body);
}

// ======================== CALCOLO COSTI ========================
async function handleCalculateCosts(req, res, payload, requestOrigin) {
  const {
    brandId,
    brandName,
    fuelId,
    fuelName,
    modelId,
    modelName,
    date,
    vat: vatRaw,
    classe_euro,
    ncap,
  } = payload;

  if (!brandId || !fuelId || !modelId || !date) {
    res.writeHead(400, { ...corsHeaders(requestOrigin), 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Parametri veicolo mancanti' }));
    return;
  }

  try {
    if (!TWO_CAPTCHA_API_KEY) throw new Error('TWO_CAPTCHA_API_KEY non configurata');

    const envBearer = optionalKeycloakBearer();

    const jar = new CookieJar();
    const warmRes = await fetch(`${ACI_WEB}/`, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
        'User-Agent': ACI_BROWSER_UA,
        Referer: `${ACI_WEB}/`,
      },
    });
    jar.mergeFromHeaders(warmRes.headers);
    const warmHome = await fetch(`${ACI_WEB}/home`, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
        'User-Agent': ACI_BROWSER_UA,
        Referer: `${ACI_WEB}/`,
        ...(jar.toHeaderString() ? { Cookie: jar.toHeaderString() } : {}),
      },
    });
    jar.mergeFromHeaders(warmHome.headers);

    const captchaToken = await getAsyncResponse({
      targetUrl: `https://2captcha.com/in.php?key=${TWO_CAPTCHA_API_KEY}&method=userrecaptcha&googlekey=${encodeURIComponent(
        RECAPTCHA_SITE_KEY,
      )}&pageurl=${encodeURIComponent('https://costikm.aci.it/')}&json=1`,
      statusUrl: (id) => `https://2captcha.com/res.php?key=${TWO_CAPTCHA_API_KEY}&action=get&id=${id}&json=1`,
      pollIntervalMs: 6000,
      maxAttempts: 80
    });

    const preVerifyCookie = jar.toHeaderString();
    const verifyRes = await fetch(`${ACI_API}/captcha/verify`, {
      method: 'POST',
      headers: aciApiBaseHeaders({
        'Content-Type': 'application/json',
        ...(preVerifyCookie ? { Cookie: preVerifyCookie } : {}),
        ...(envBearer ? { Authorization: `Bearer ${envBearer}` } : {}),
      }),
      body: JSON.stringify({ data: captchaToken }),
    });

    if (!verifyRes.ok) {
      const errTxt = await verifyRes.text().catch(() => '');
      throw new Error(`Verify fallita: ${verifyRes.status} ${errTxt.slice(0, 240)}`);
    }

    jar.mergeFromHeaders(verifyRes.headers);
    const verifyBodyText = await verifyRes.text();
    const bearerFromVerify = extractBearerFromVerifyResponse(verifyRes, verifyBodyText);
    const cookieHeader = jar.toHeaderString();
    const bearerFromCookies = extractJwtFromCookieHeader(cookieHeader);
    const bearerForCosts = bearerFromVerify || envBearer || bearerFromCookies;

    const vat =
      vatRaw === 1 || vatRaw === '1' || vatRaw === true ? 1 : 0;

    const costsUrl = new URL(`${ACI_API}/costs`);
    costsUrl.searchParams.set('date', String(date));
    costsUrl.searchParams.set('brandId', String(brandId));
    costsUrl.searchParams.set('brand', String(brandName ?? ''));
    costsUrl.searchParams.set('fuelId', String(fuelId));
    costsUrl.searchParams.set('fuel', String(fuelName ?? ''));
    costsUrl.searchParams.set('modelId', String(modelId));
    costsUrl.searchParams.set('model', String(modelName ?? ''));
    costsUrl.searchParams.set('categoryId', '1');
    costsUrl.searchParams.set('type', 'vehicle');
    costsUrl.searchParams.set('vat', String(vat));
    if (typeof classe_euro === 'string' && classe_euro.trim()) {
      costsUrl.searchParams.set('classe_euro', classe_euro.trim());
    }
    if (typeof ncap === 'string' && ncap.trim()) {
      costsUrl.searchParams.set('ncap', ncap.trim());
    }

    const costsHeaders = aciApiBaseHeaders({
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      ...(bearerForCosts ? { Authorization: `Bearer ${bearerForCosts}` } : {}),
    });

    const costsRes = await fetch(costsUrl.toString(), {
      headers: costsHeaders,
    });

    if (!costsRes.ok) {
      if ([401, 403].includes(costsRes.status)) {
        const costsErrText = await costsRes.text().catch(() => '');
        let verifyKeys = null;
        try {
          const j = JSON.parse(verifyBodyText);
          if (j && typeof j === 'object' && !Array.isArray(j)) verifyKeys = Object.keys(j);
        } catch {
          /* ignore */
        }
        const cookieNames = cookieHeader
          .split(';')
          .map((p) => p.split('=')[0]?.trim())
          .filter(Boolean);
        console.error('aci-proxy /costs rejected', {
          status: costsRes.status,
          hasBearer: Boolean(bearerForCosts),
          bearerSource: bearerFromVerify ? 'verify' : envBearer ? 'env' : bearerFromCookies ? 'cookie' : 'none',
          hasXApplicationKey: true,
          cookieHeaderLen: cookieHeader.length,
          cookieNames,
          verifyBodyLen: verifyBodyText.length,
          verifyKeys,
          costsBodyPreview: costsErrText.slice(0, 400),
        });
        res.writeHead(401, { ...corsHeaders(requestOrigin), 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'SESSION_EXPIRED' }));
        return;
      }
      throw new Error(`Costs error: ${costsRes.status}`);
    }

    const data = await costsRes.json();

    res.writeHead(200, { ...corsHeaders(requestOrigin), 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, raw: data }));

  } catch (error) {
    console.error(error);
    res.writeHead(500, { ...corsHeaders(requestOrigin), 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message || 'Errore interno' }));
  }
}