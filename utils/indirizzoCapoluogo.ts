import { CAPOLUOGO_FESTIVITA, type CapoluogoFestivitaRow } from './capoluoghiFestivitaData';

function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Cerca un capoluogo di provincia (nome comune) nell'indirizzo testuale.
 * Ordine per lunghezza decrescente per evitare match parziali (es. "Reggio").
 */
export function findCapoluogoFestivitaInAddress(address: string): CapoluogoFestivitaRow | null {
  const n = normalizeForMatch(address);
  if (!n) return null;
  const sorted = [...CAPOLUOGO_FESTIVITA].sort((a, b) => b.comuneNorm.length - a.comuneNorm.length);
  for (const row of sorted) {
    const needle = row.comuneNorm;
    if (!needle) continue;
    const re = new RegExp(`(^|[^a-z0-9])${escapeRe(needle)}([^a-z0-9]|$)`, 'i');
    if (re.test(n)) return row;
  }
  return null;
}
