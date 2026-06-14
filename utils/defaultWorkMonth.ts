import { addMonths, format, isValid, parseISO, startOfMonth } from 'date-fns';

/**
 * Mese di lavoro predefinito all'apertura app:
 * fino al giorno 10 del mese corrente → mese precedente; dal giorno 11 → mese corrente.
 */
export function defaultWorkMonth(now: Date = new Date()): Date {
  const anchor = startOfMonth(now);
  return now.getDate() <= 10 ? startOfMonth(addMonths(anchor, -1)) : anchor;
}

export function workMonthKey(d: Date): string {
  return format(d, 'yyyy-MM');
}

export function workMonthFromKey(raw: string | undefined | null): Date | null {
  const s = (raw ?? '').trim();
  if (!/^\d{4}-\d{2}$/.test(s)) return null;
  const d = parseISO(`${s}-01`);
  return isValid(d) ? startOfMonth(d) : null;
}
