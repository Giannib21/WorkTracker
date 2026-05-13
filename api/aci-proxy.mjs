// api/aci-proxy.mjs
import { text } from 'node:stream/consumers';

const ACI_API = 'https://costikm-api-v2.services.aci.it';
const ACI_WEB = 'https://costikm.aci.it';

const TWO_CAPTCHA_API_KEY = process.env.TWO_CAPTCHA_API_KEY;
const RECAPTCHA_SITE_KEY = "6LeJn3kpAAAAANAvxYqVDgtnWSQsm0amZlnvIBCv";

// ==================== FUNZIONI HELPER (incollate qui dentro) ====================
function defaultExtractId(data) {
  if (data && typeof data === 'object' && 'id' in data) {
    const id = data.id;
    if (typeof id === 'string' && id.length > 0) return id;
  }
  throw new Error('getAsyncResponse: la risposta POST non contiene un campo stringa `id`');
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

  const id = defaultExtractId(postRes.data);
  const pollUrl = resolveStatusUrl(options.statusUrl, id);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await new Promise(r => setTimeout(r, pollIntervalMs));

    const statusRes = await client.get(pollUrl, { headers: options.headers });
    const data = statusRes.data;

    if (!data || typeof data !== 'object') {
      throw new Error('getAsyncResponse: risposta status non è un oggetto JSON');
    }

    const { status, request } = data;
    if (typeof status !== 'number') {
      throw new Error('getAsyncResponse: campo `status` mancante o non numerico');
    }

    if (status === 1) return request;
  }

  throw new Error(`getAsyncResponse: timeout dopo ${maxAttempts} tentativi`);
}

function cookieHeaderFromSetCookieLines(setCookieLines) {
  const parts = [];
  for (const line of setCookieLines) {
    const pair = line.split(';')[0]?.trim();
    if (pair && pair.includes('=')) {
      parts.push(pair);
    }
  }
  return parts.join('; ');
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
  const { brandId, brandName, fuelId, fuelName, modelId, modelName, date } = payload;

  if (!brandId || !fuelId || !modelId || !date) {
    res.writeHead(400, { ...corsHeaders(requestOrigin), 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Parametri veicolo mancanti' }));
    return;
  }

  try {
    if (!TWO_CAPTCHA_API_KEY) throw new Error('TWO_CAPTCHA_API_KEY non configurata');

    const captchaToken = await getAsyncResponse({
      targetUrl: `https://2captcha.com/in.php?key=${TWO_CAPTCHA_API_KEY}&method=userrecaptcha&googlekey=${RECAPTCHA_SITE_KEY}&pageurl=https://costikm.aci.it/`,
      statusUrl: (id) => `https://2captcha.com/res.php?key=${TWO_CAPTCHA_API_KEY}&action=get&id=${id}&json=1`,
      pollIntervalMs: 6000,
      maxAttempts: 80
    });

    const verifyRes = await fetch(`${ACI_API}/captcha/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: ACI_WEB,
        Referer: `${ACI_WEB}/`,
      },
      body: JSON.stringify({ data: captchaToken })
    });

    if (!verifyRes.ok) throw new Error(`Verify fallita: ${verifyRes.status}`);

    const setCookieLines = verifyRes.headers.getSetCookie?.() || [];
    const cookieHeader = cookieHeaderFromSetCookieLines(setCookieLines);

    const costsUrl = new URL(`${ACI_API}/costs`);
    costsUrl.searchParams.set('date', date);
    costsUrl.searchParams.set('brandId', brandId);
    costsUrl.searchParams.set('brand', encodeURIComponent(brandName));
    costsUrl.searchParams.set('fuelId', fuelId);
    costsUrl.searchParams.set('fuel', encodeURIComponent(fuelName));
    costsUrl.searchParams.set('modelId', modelId);
    costsUrl.searchParams.set('model', encodeURIComponent(modelName));
    costsUrl.searchParams.set('categoryId', '1');
    costsUrl.searchParams.set('type', 'vehicle');

    const costsRes = await fetch(costsUrl.toString(), {
      headers: {
        Origin: ACI_WEB,
        Referer: `${ACI_WEB}/`,
        Cookie: cookieHeader,
      }
    });

    if (!costsRes.ok) {
      if ([401, 403].includes(costsRes.status)) {
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