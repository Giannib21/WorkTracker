import { readFile } from 'node:fs/promises';

import type { Cookie } from 'playwright';

import { cookieHeaderForAciApi } from './cookies';
import { AciApiError, SessionExpiredError } from './errors';
import type { AciSavedSession } from './session-types';

const API_ORIGIN = 'https://costikm-api-v2.services.aci.it';
const WEB_ORIGIN = 'https://costikm.aci.it';

export interface AciBrand {
  id: string;
  name: string;
}

export interface AciFuel {
  id: string;
  name: string;
}

export interface AciModel {
  id: string;
  name: string;
  categoryId?: string;
  classe_euro?: string;
  ncap?: string;
  [key: string]: unknown;
}

export interface AciCostsQuery {
  date: string;
  brandId: string;
  brand: string;
  fuelId: string;
  fuel: string;
  modelId: string;
  model: string;
  categoryId: string;
  type: string;
  /** 0 = lordo, 1 = netto (come sul portale). */
  vat: 0 | 1;
  classe_euro?: string;
  ncap?: string;
}

export type AciCostiServiceOptions =
  | { sessionFilePath: string }
  | { session: AciSavedSession };

/**
 * Ponte Node verso le API costikm: usa cookie + bearer da {@link AciSavedSession}
 * e invia sempre `Origin` / `Referer` come il sito ufficiale.
 */
export class AciCostiService {
  private session: AciSavedSession | null = null;
  private readonly loadFn: () => Promise<AciSavedSession>;

  constructor(options: AciCostiServiceOptions) {
    if ('session' in options) {
      this.session = options.session;
      this.loadFn = async () => options.session;
    } else {
      this.loadFn = async () => {
        const raw = await readFile(options.sessionFilePath, 'utf8');
        return JSON.parse(raw) as AciSavedSession;
      };
    }
  }

  async loadSession(): Promise<AciSavedSession> {
    this.session = await this.loadFn();
    return this.session;
  }

  private async getSession(): Promise<AciSavedSession> {
    if (this.session) return this.session;
    return this.loadSession();
  }

  private buildHeaders(session: AciSavedSession, extra?: Record<string, string>): HeadersInit {
    const cookie = cookieHeaderForAciApi(session.cookies as Cookie[]);
    const h: Record<string, string> = {
      Accept: 'application/json, text/plain, */*',
      Origin: WEB_ORIGIN,
      Referer: `${WEB_ORIGIN}/`,
      ...extra,
    };
    if (cookie) h.Cookie = cookie;
    if (session.bearerToken) h.Authorization = `Bearer ${session.bearerToken}`;
    return h;
  }

  private async requestJson(method: 'GET' | 'POST', pathnameWithQuery: string, body?: string): Promise<unknown> {
    const session = await this.getSession();
    const url = `${API_ORIGIN}${pathnameWithQuery}`;
    const headers = this.buildHeaders(
      session,
      method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
    );

    const res = await fetch(url, { method, headers, body: method === 'POST' ? body : undefined });

    const text = await res.text();
    if (res.status === 401 || res.status === 403) {
      throw new SessionExpiredError(
        `HTTP ${res.status} da ACI. Aggiorna session.json con npm run aci:capture (login CIE). Dettaglio: ${text.slice(0, 300)}`,
      );
    }
    if (!res.ok) throw new AciApiError(res.status, text);

    if (!text) return null;
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new AciApiError(res.status, text, 'Risposta non JSON');
    }
  }

  async getBrands(type: string = '1'): Promise<{ brands: AciBrand[]; resultcode?: number }> {
    const q = new URLSearchParams({ type });
    return this.requestJson('GET', `/vehicles/brands?${q}`) as Promise<{ brands: AciBrand[]; resultcode?: number }>;
  }

  async getFuels(brandId: string, type: string = '1'): Promise<{ fuels: AciFuel[] }> {
    const q = new URLSearchParams({ type, brandId });
    return this.requestJson('GET', `/vehicles/fuels?${q}`) as Promise<{ fuels: AciFuel[] }>;
  }

  async getModels(brandId: string, fuelId: string, dateMs: number, type: string = '1'): Promise<{ models: AciModel[] }> {
    const q = new URLSearchParams({
      type,
      brandId,
      fuelId,
      date: String(dateMs),
    });
    return this.requestJson('GET', `/vehicles/models?${q}`) as Promise<{ models: AciModel[] }>;
  }

  /**
   * Allineato al client Angular: `POST /captcha/verify` con body `{"data":"<token>"}`.
   */
  async verifyCaptcha(recaptchaResponse: string): Promise<void> {
    await this.requestJson('POST', '/captcha/verify', JSON.stringify({ data: recaptchaResponse }));
  }

  async getCosts(params: AciCostsQuery): Promise<unknown> {
    const q = new URLSearchParams({
      date: params.date,
      brandId: params.brandId,
      brand: params.brand,
      fuelId: params.fuelId,
      fuel: params.fuel,
      modelId: params.modelId,
      model: params.model,
      categoryId: params.categoryId,
      type: params.type,
      vat: String(params.vat),
    });
    if (params.classe_euro != null) q.set('classe_euro', params.classe_euro);
    if (params.ncap != null) q.set('ncap', params.ncap);
    return this.requestJson('GET', `/costs?${q}`);
  }
}
