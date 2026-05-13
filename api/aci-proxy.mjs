// api/aci-proxy.mjs
import { text } from 'node:stream/consumers';
import { getAsyncResponse } from '../utils/getAsyncResponse.js';           // ← percorso corretto
import { cookieHeaderFromSetCookieLines } from '../utils/cookieHeaderFromSetCookieLines.js'; // ← percorso corretto

const ACI_API = 'https://costikm-api-v2.services.aci.it';
const ACI_WEB = 'https://costikm.aci.it';

const TWO_CAPTCHA_API_KEY = process.env.TWO_CAPTCHA_API_KEY;
const RECAPTCHA_SITE_KEY = 'INSERISCI_QUI_LA_SITEKEY_DI_ACI';   // ← da cambiare tra poco

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

  // ========================
  // NUOVA MODALITÀ: CALCOLO COSTI CON 2CAPTCHA
  // ========================
  if (payload.mode === 'calculateCosts') {
    return await handleCalculateCosts(req, res, payload, origin);
  }

  // ========================
  // CODICE VECCHIO (catalogo veicoli) – resta uguale
  // ========================
  const rawPath = typeof payload.path === 'string' ? payload.path : '';
  let pathname;
  let search = '';
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

// ========================
// FUNZIONE CHE FA TUTTO IL LAVORO DEI COSTI
// ========================
async function handleCalculateCosts(req, res, payload, requestOrigin) {
  const {
    brandId, brandName,
    fuelId, fuelName,
    modelId, modelName,
    date
  } = payload;

  if (!brandId || !fuelId || !modelId || !date) {
    res.writeHead(400, { ...corsHeaders(requestOrigin), 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Parametri veicolo mancanti' }));
    return;
  }

  try {
    if (!TWO_CAPTCHA_API_KEY) {
      throw new Error('TWO_CAPTCHA_API_KEY non configurata nelle variabili Vercel');
    }

    // 1. Risolvi il captcha con 2Captcha
    const captchaToken = await getAsyncResponse({
      targetUrl: `https://2captcha.com/in.php?key=${TWO_CAPTCHA_API_KEY}&method=userrecaptcha&googlekey=${RECAPTCHA_SITE_KEY}&pageurl=https://costikm.aci.it/`,
      statusUrl: (id) => `https://2captcha.com/res.php?key=${TWO_CAPTCHA_API_KEY}&action=get&id=${id}&json=1`,
      pollIntervalMs: 6000,
      maxAttempts: 80
    });

    // 2. POST /captcha/verify
    const verifyRes = await fetch(`${ACI_API}/captcha/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': ACI_WEB,
        'Referer': `${ACI_WEB}/`,
      },
      body: JSON.stringify({ data: captchaToken })
    });

    if (!verifyRes.ok) throw new Error(`Verify fallita: ${verifyRes.status}`);

    const setCookieLines = verifyRes.headers.getSetCookie?.() || [];
    const cookieHeader = cookieHeaderFromSetCookieLines(setCookieLines);

    // 3. GET /costs
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
        'Origin': ACI_WEB,
        'Referer': `${ACI_WEB}/`,
        'Cookie': cookieHeader,
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
    res.end(JSON.stringify({ error: error.message || 'Errore' }));
  }
}