import axios from 'axios';

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

export async function getAsyncResponse(options) {
  const client = options.axios ?? axios;
  const pollIntervalMs = options.pollIntervalMs ?? 5000;
  const maxAttempts = options.maxAttempts ?? 120;
  const reuseHeaders = options.reuseHeadersForGet !== false;
  const getHeaders = reuseHeaders ? options.headers : undefined;

  const postRes = await client.post(options.targetUrl, options.postBody ?? null, {
    headers: options.headers,
  });

  const id = defaultExtractId(postRes.data);
  const pollUrl = resolveStatusUrl(options.statusUrl, id);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await new Promise((r) => setTimeout(r, pollIntervalMs));

    const statusRes = await client.get(pollUrl, { headers: getHeaders });
    const data = statusRes.data;

    if (!data || typeof data !== 'object') {
      throw new Error('getAsyncResponse: risposta status non è un oggetto JSON');
    }

    const { status, request } = data;
    if (typeof status !== 'number') {
      throw new Error('getAsyncResponse: campo `status` mancante o non numerico');
    }

    if (status === 1) {
      return request;
    }
  }

  throw new Error(`getAsyncResponse: timeout dopo ${maxAttempts} tentativi di polling`);
}