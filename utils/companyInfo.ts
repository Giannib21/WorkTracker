/** Dati aziendali fissi (build interno Riello). In futuro si potrà rendere configurabile. */
export const COMPANY_LOCKED = {
  name: 'Riello Investimenti SGR S.p.A.',
  address: 'Via Melone, 2 20121 Milano MI',
  cfPiva: '04129580280',
} as const;

export function companyLegalBlock(): string {
  return `${COMPANY_LOCKED.name} — ${COMPANY_LOCKED.address} — C.F./P.IVA ${COMPANY_LOCKED.cfPiva}`;
}

/** Tre righe (per PDF / layout): ragione sociale, indirizzo, C.F./P.IVA */
export function companyLegalLines(): [string, string, string] {
  return [
    COMPANY_LOCKED.name,
    COMPANY_LOCKED.address,
    `C.F./P.IVA ${COMPANY_LOCKED.cfPiva}`,
  ];
}
