/** Consente la digitazione di decimali (es. 0,35 o 0.) senza normalizzare troppo presto. */
export function sanitizeDecimalTyping(raw: string, maxFractionDigits?: number): string {
  let s = raw.replace(',', '.').replace(/[^0-9.]/g, '');
  const dot = s.indexOf('.');
  if (dot !== -1) {
    s = `${s.slice(0, dot + 1)}${s.slice(dot + 1).replace(/\./g, '')}`;
  }
  if (s.startsWith('.')) s = `0${s}`;
  if (maxFractionDigits !== undefined && maxFractionDigits >= 0) {
    const d = s.indexOf('.');
    if (d !== -1 && s.length - d - 1 > maxFractionDigits) {
      s = s.slice(0, d + 1 + maxFractionDigits);
    }
  }
  return s;
}

/** Parse importi/spese: arrotonda a 2 decimali; NaN se vuoto o non valido. */
export function parseMoneyAmount(raw: string): number {
  const trimmed = raw.replace(',', '.').trim();
  if (trimmed === '' || trimmed === '.') return NaN;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return NaN;
  return Math.round(n * 100) / 100;
}

/** Valore da salvare in DB / impostazioni (stringa numerica normalizzata). */
export function finalizeDecimalForDb(s: string): string {
  const trimmed = s.trim().replace(',', '.');
  if (trimmed === '') return '0';
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return '0';
  return String(n);
}
