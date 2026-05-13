import { text } from 'node:stream/consumers';

/**
 * Vercel Serverless: `POST /api/forward-with-cookies`
 *
 * Body JSON:
 *   - `urlA` (string, https): POST con `forwardBody` (opzionale) → legge `Set-Cookie`
 *   - `urlB` (string, https): GET con header `Cookie` costruito da urlA + `Origin` / `Referer` indicati
 *   - `origin` (string): header `Origin` per entrambe le richieste
 *   - `referer` (string): header `Referer` per entrambe le richieste
 *   - `forwardBody` (opzionale): oggetto → JSON; stringa → inviata così com’è (Content-Type: text/plain)
 *
 * Risposta: stesso status / content-type / corpo della GET su urlB.
 *
 * Sicurezza: se imposti `FORWARD_WITH_COOKIES_SECRET` su Vercel, la route richiede
 * `Authorization: Bearer <FORWARD_WITH_COOKIES_SECRET>` (evita relay aperto).
 */

function corsHeaders(requestOrigin) {
  return {
    'Access-Control-Allow-Origin': requestOrigin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function cookieJoinFromSetCookie(headers) {
  if (typeof headers.getSetCookie === 'function') {
    const arr = headers.getSetCookie();
    if (arr?.length) {
      return arr
        .map((line) => line.split(';')[0].trim())
        .filter((s) => s.includes('='))
        .join('; ');
    }
  }
  const raw = headers.get('set-cookie');
  if (!raw) return '';
  return raw
    .split(/,(?=\s*[A-Za-z0-9_.-]+=)/)
    .map((p) => p.trim().split(';')[0])
    .filter((s) => s.includes('='))
    .join('; ');
}

function requireHttpsUrl(label, value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} richiesto`);
  }
  let u;
  try {
    u = new URL(value.trim());
  } catch {
    throw new Error(`${label} non è un URL valido`);
  }
  if (u.protocol !== 'https:') {
    throw new Error(`${label} deve usare https`);
  }
  return u.toString();
}

function checkAuth(req) {
  const secret = process.env.FORWARD_WITH_COOKIES_SECRET;
  if (!secret) return true;
  const auth = req.headers.authorization || '';
  const expected = `Bearer ${secret}`;
  return auth === expected;
}

export default async function handler(req, res) {
  const requestOrigin = req.headers.origin || '';

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(requestOrigin));
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { ...corsHeaders(requestOrigin), 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Use POST' }));
    return;
  }

  if (!checkAuth(req)) {
    res.writeHead(401, { ...corsHeaders(requestOrigin), 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  let payload;
  try {
    const raw = await text(req);
    payload = JSON.parse(raw || '{}');
  } catch {
    res.writeHead(400, { ...corsHeaders(requestOrigin), 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON body' }));
    return;
  }

  let urlA;
  let urlB;
  let origin;
  let referer;
  try {
    urlA = requireHttpsUrl('urlA', payload.urlA);
    urlB = requireHttpsUrl('urlB', payload.urlB);
    if (typeof payload.origin !== 'string' || !payload.origin.trim()) {
      throw new Error('origin richiesto');
    }
    if (typeof payload.referer !== 'string' || !payload.referer.trim()) {
      throw new Error('referer richiesto');
    }
    origin = payload.origin.trim();
    referer = payload.referer.trim();
  } catch (e) {
    res.writeHead(400, { ...corsHeaders(requestOrigin), 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: String(e?.message || e) }));
    return;
  }

  const forwardBody = payload.forwardBody;
  let postHeaders = {
    Accept: 'application/json, text/plain, */*',
    Origin: origin,
    Referer: referer,
  };
  let postBody;

  if (forwardBody === undefined || forwardBody === null) {
    postBody = undefined;
  } else if (typeof forwardBody === 'string') {
    postHeaders = { ...postHeaders, 'Content-Type': 'text/plain; charset=utf-8' };
    postBody = forwardBody;
  } else {
    postHeaders = { ...postHeaders, 'Content-Type': 'application/json' };
    postBody = JSON.stringify(forwardBody);
  }

  let firstRes;
  try {
    firstRes = await fetch(urlA, {
      method: 'POST',
      headers: postHeaders,
      body: postBody,
    });
  } catch (e) {
    res.writeHead(502, { ...corsHeaders(requestOrigin), 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Fetch urlA failed', detail: String(e?.message || e) }));
    return;
  }

  if (!firstRes.ok) {
    const errCt = firstRes.headers.get('content-type') || 'application/json';
    const errBuf = new Uint8Array(await firstRes.arrayBuffer());
    res.writeHead(firstRes.status, { ...corsHeaders(requestOrigin), 'Content-Type': errCt });
    res.end(errBuf);
    return;
  }

  const cookies = cookieJoinFromSetCookie(firstRes.headers);

  let secondRes;
  try {
    secondRes = await fetch(urlB, {
      method: 'GET',
      headers: {
        Accept: 'application/json, text/plain, */*',
        Origin: origin,
        Referer: referer,
        ...(cookies ? { Cookie: cookies } : {}),
      },
    });
  } catch (e) {
    res.writeHead(502, { ...corsHeaders(requestOrigin), 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Fetch urlB failed', detail: String(e?.message || e) }));
    return;
  }

  const ct = secondRes.headers.get('content-type') || 'application/octet-stream';
  const buf = new Uint8Array(await secondRes.arrayBuffer());
  res.writeHead(secondRes.status, { ...corsHeaders(requestOrigin), 'Content-Type': ct });
  res.end(buf);
}
