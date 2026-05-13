import axios, { type AxiosInstance } from 'axios';

type PostResponseWithId = { id: string };

type StatusResponse = {
  status: number;
  request: unknown;
};

export type GetAsyncResponseOptions = {
  /** URL della POST iniziale. La risposta JSON deve contenere `id`. */
  targetUrl: string;
  /** URL (o builder) per il polling: riceve l’`id` restituito dalla POST. */
  statusUrl: string | ((id: string) => string);
  /** Corpo opzionale della POST. */
  postBody?: unknown;
  /** Header opzionali per POST (e stessi header riusati per GET se `reuseHeaders` è true). */
  headers?: Record<string, string>;
  /** Intervallo tra una richiesta di status e la successiva (default 5000 ms), inclusa la prima dopo la POST. */
  pollIntervalMs?: number;
  /** Tentativi massimi di GET allo status (default 120). */
  maxAttempts?: number;
  /** Istanza axios personalizzata (test / interceptors). */
  axios?: AxiosInstance;
  /** Se true, invia gli stessi `headers` anche alle GET di status (default true). */
  reuseHeadersForGet?: boolean;
};

function defaultExtractId(data: unknown): string {
  if (data && typeof data === 'object' && 'id' in data) {
    const id = (data as PostResponseWithId).id;
    if (typeof id === 'string' && id.length > 0) return id;
  }
  throw new Error('getAsyncResponse: la risposta POST non contiene un campo stringa `id`');
}

function resolveStatusUrl(statusUrl: string | ((id: string) => string), id: string): string {
  return typeof statusUrl === 'function' ? statusUrl(id) : statusUrl;
}

/**
 * POST su `targetUrl` (si attende un JSON con `id`), poi polling periodico sull’URL di status
 * finché `status === 1`; restituisce il campo `request` della risposta JSON.
 */
export async function getAsyncResponse<TRequest = unknown>(options: GetAsyncResponseOptions): Promise<TRequest> {
  const client = options.axios ?? axios;
  const pollIntervalMs = options.pollIntervalMs ?? 5000;
  const maxAttempts = options.maxAttempts ?? 120;
  const reuseHeaders = options.reuseHeadersForGet !== false;
  const getHeaders = reuseHeaders ? options.headers : undefined;

  const postRes = await client.post<unknown>(options.targetUrl, options.postBody ?? null, {
    headers: options.headers,
  });

  const id = defaultExtractId(postRes.data);
  const pollUrl = resolveStatusUrl(options.statusUrl, id);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await new Promise((r) => setTimeout(r, pollIntervalMs));

    const statusRes = await client.get<unknown>(pollUrl, { headers: getHeaders });
    const data = statusRes.data;

    if (!data || typeof data !== 'object') {
      throw new Error('getAsyncResponse: risposta status non è un oggetto JSON');
    }

    const { status, request } = data as StatusResponse;
    if (typeof status !== 'number') {
      throw new Error('getAsyncResponse: campo `status` mancante o non numerico');
    }

    if (status === 1) {
      return request as TRequest;
    }
  }

  throw new Error(`getAsyncResponse: timeout dopo ${maxAttempts} tentativi di polling`);
}
