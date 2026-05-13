import axios from 'axios';

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

export async function getAsyncResponse(options) {
  const client = options.axios ?? axios;
  const pollIntervalMs = options.pollIntervalMs ?? 5000;
  const maxAttempts = options.maxAttempts ?? 120;
  const reuseHeaders = options.reuseHeadersForGet !== false;
  const getHeaders = reuseHeaders ? options.headers : undefined;

  const postRes = await client.post(options.targetUrl, options.postBody ?? null, {
    headers: options.headers,
  });

  const id = extract2CaptchaInJobId(postRes.data);
  const pollUrl = resolveStatusUrl(options.statusUrl, id);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await new Promise((r) => setTimeout(r, pollIntervalMs));

    const statusRes = await client.get(pollUrl, { headers: getHeaders });
    const parsed = parse2CaptchaPollResult(statusRes.data);
    if (parsed.ready) return parsed.token;
  }

  throw new Error(`getAsyncResponse: timeout dopo ${maxAttempts} tentativi di polling`);
}
