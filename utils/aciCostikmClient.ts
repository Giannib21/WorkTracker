const API_ORIGIN = 'https://costikm-api-v2.services.aci.it';
const WEB_ORIGIN = 'https://costikm.aci.it';

function proxyBase(): string | undefined {
  const u = process.env.EXPO_PUBLIC_ACI_PROXY_URL;
  if (typeof u !== 'string' || !u.trim()) return undefined;
  return u.trim().replace(/\/$/, '');
}

type ProxyPayload = {
  path: string;
  method: 'GET' | 'POST';
  body?: string;
};

async function aciFetch(
  path: string,
  init: RequestInit & { search?: URLSearchParams },
): Promise<Response> {
  const { search: searchParams, ...fetchInit } = init;
  const qs = searchParams?.toString() ?? '';
  const method = (fetchInit.method as 'GET' | 'POST' | undefined) ?? 'GET';
  const body = fetchInit.body != null ? String(fetchInit.body) : undefined;

  const proxy = proxyBase();
  if (proxy) {
    const payload: ProxyPayload = {
      path: qs ? `${path}?${qs}` : path,
      method,
      ...(method === 'POST' && body != null ? { body } : {}),
    };
    return fetch(proxy, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  const url = `${API_ORIGIN}${path}${qs ? `?${qs}` : ''}`;
  const h = new Headers(fetchInit.headers);
  if (!h.has('Accept')) h.set('Accept', 'application/json, text/plain, */*');
  h.set('Origin', WEB_ORIGIN);
  h.set('Referer', `${WEB_ORIGIN}/`);
  return fetch(url, { ...fetchInit, method, headers: h, body: method === 'POST' ? body : undefined });
}

export type AciBrand = { id: string; name: string };
export type AciFuel = { id: string; name: string };
export type AciModel = { id: string; name: string; classe_euro?: string; ncap?: string; categoryId?: string };

/** Solo catalogo pubblico (`/vehicles/*`). Il proxy deve consentire solo questi path. */
export async function fetchAciBrands(type: string = '1'): Promise<{ brands: AciBrand[]; resultcode?: number }> {
  const search = new URLSearchParams({ type });
  const res = await aciFetch('/vehicles/brands', { method: 'GET', search });
  if (!res.ok) throw new Error(`brands HTTP ${res.status}`);
  return res.json() as Promise<{ brands: AciBrand[]; resultcode?: number }>;
}

export async function fetchAciFuels(brandId: string, type: string = '1'): Promise<{ fuels: AciFuel[] }> {
  const search = new URLSearchParams({ type, brandId });
  const res = await aciFetch('/vehicles/fuels', { method: 'GET', search });
  if (!res.ok) throw new Error(`fuels HTTP ${res.status}`);
  return res.json() as Promise<{ fuels: AciFuel[] }>;
}

export async function fetchAciModels(
  brandId: string,
  fuelId: string,
  dateMs: number,
  type: string = '1',
): Promise<{ models: AciModel[] }> {
  const search = new URLSearchParams({
    type,
    brandId,
    fuelId,
    date: String(dateMs),
  });
  const res = await aciFetch('/vehicles/models', { method: 'GET', search });
  if (!res.ok) throw new Error(`models HTTP ${res.status}`);
  return res.json() as Promise<{ models: AciModel[] }>;
}

export const ACI_ERROR_SESSION_EXPIRED = 'ACI_SESSION_EXPIRED';

export function isSessionExpiredError(message: string): boolean {
  return message === ACI_ERROR_SESSION_EXPIRED;
}

export type AciProxyCalculateCostsParams = {
  brandId: string;
  brandName: string;
  fuelId: string;
  fuelName: string;
  modelId: string;
  modelName: string;
  date: string;
  vat: 0 | 1;
  classe_euro?: string;
  ncap?: string;
};

/**
 * Calcolo €/km tramite proxy Vercel (`mode: 'calculateCosts'`: 2Captcha + verify + /costs).
 * Richiede `EXPO_PUBLIC_ACI_PROXY_URL`.
 */
export async function fetchAciCostsViaProxyCalculate(params: AciProxyCalculateCostsParams): Promise<unknown> {
  const proxy = proxyBase();
  if (!proxy) {
    throw new Error('MISSING_ACI_PROXY');
  }

  const body = {
    mode: 'calculateCosts' as const,
    brandId: params.brandId,
    brandName: params.brandName,
    fuelId: params.fuelId,
    fuelName: params.fuelName,
    modelId: params.modelId,
    modelName: params.modelName,
    date: params.date,
    vat: params.vat,
    ...(params.classe_euro != null && params.classe_euro !== ''
      ? { classe_euro: params.classe_euro }
      : {}),
    ...(params.ncap != null && params.ncap !== '' ? { ncap: params.ncap } : {}),
  };

  const res = await fetch(proxy, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`proxy: risposta non JSON (${res.status})`);
  }

  if (res.status === 401 && parsed && typeof parsed === 'object' && (parsed as { error?: string }).error === 'SESSION_EXPIRED') {
    throw new Error(ACI_ERROR_SESSION_EXPIRED);
  }

  if (!res.ok) {
    const msg =
      parsed && typeof parsed === 'object' && 'error' in parsed
        ? String((parsed as { error: unknown }).error)
        : text.slice(0, 240);
    throw new Error(msg || `proxy HTTP ${res.status}`);
  }

  if (
    parsed &&
    typeof parsed === 'object' &&
    (parsed as { success?: boolean }).success === true &&
    'raw' in (parsed as object)
  ) {
    return (parsed as { raw: unknown }).raw;
  }

  throw new Error('proxy: formato risposta imprevisto');
}
