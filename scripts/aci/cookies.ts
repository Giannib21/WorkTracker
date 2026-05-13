import type { Cookie } from 'playwright';

/** Costruisce l'header `Cookie` per richieste verso l'API ACI (dominio `.aci.it`). */
export function cookieHeaderForAciApi(cookies: Cookie[]): string {
  return cookies
    .filter((c) => {
      const d = (c.domain ?? '').replace(/^\./, '');
      return d === 'aci.it' || d.endsWith('.aci.it');
    })
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
}
