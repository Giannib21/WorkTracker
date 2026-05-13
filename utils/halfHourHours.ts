/**
 * Ore in multipli di 0,5 h; in input al massimo una cifra decimale.
 */

export function roundToHalfHour(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n <= 0) return 0;
  return Math.round(n * 2) / 2;
}

/** Stato campo: interi o x.5 (una cifra decimale visualizzata solo se .5). */
export function formatHoursHalfStep(n: number): string {
  const r = roundToHalfHour(n);
  if (!Number.isFinite(r) || r < 0) return '0';
  if (r === 0) return '0';
  const twice = Math.round(r * 2);
  if (twice % 2 === 0) return String(twice / 2);
  return `${Math.floor(r)}.5`;
}

export function hoursFromNumber(n: number): string {
  return formatHoursHalfStep(roundToHalfHour(n));
}

/**
 * Solo cifre e un separatore decimale; dopo il punto una sola cifra.
 */
export function sanitizeHoursTyping(raw: string): string {
  let s = raw.trim().replace(',', '.');
  if (s === '') return '';
  s = s.replace(/[^\d.]/g, '');
  if (s === '') return '';
  const dot = s.indexOf('.');
  if (dot === -1) {
    const n = Number(s);
    return Number.isFinite(n) && n >= 0 ? String(Math.floor(n)) : '';
  }
  /** Solo il primo punto; ignora eventuali punti extra (es. 3..5 → 3.5) */
  let intPart = s.slice(0, dot);
  const frac = s
    .slice(dot + 1)
    .replace(/\./g, '')
    .replace(/\D/g, '')
    .slice(0, 1);
  if (intPart === '') intPart = '0';
  else {
    const ni = Number(intPart);
    intPart = Number.isFinite(ni) && ni >= 0 ? String(Math.floor(ni)) : '0';
  }
  if (frac === '') return `${intPart}.`;
  return `${intPart}.${frac}`;
}

export type ProcessHoursOptions = {
  /** Se true, stringa vuota resta '' (campi trasferta/permesso opzionali). */
  optional?: boolean;
};

/**
 * Durante la digitazione consente "3." ; appena il numero è completo, approssima al multiplo di 0,5.
 */
export function processHoursInput(raw: string, options: ProcessHoursOptions = {}): string {
  const { optional } = options;
  const sanitized = sanitizeHoursTyping(raw);
  if (sanitized === '') return optional ? '' : '0';
  if (/^\d+\.$/.test(sanitized)) return sanitized;
  const n = Number(sanitized);
  if (!Number.isFinite(n) || n < 0) return optional ? '' : '0';
  return formatHoursHalfStep(roundToHalfHour(n));
}

/** Legge il valore nello stato (es. dopo processHoursInput) per i calcoli. */
export function parseHoursStateString(s: string): number {
  if (!s || s.trim() === '') return 0;
  if (/^\d+\.$/.test(s.replace(',', '.'))) return roundToHalfHour(Number(s.replace(',', '.').slice(0, -1)));
  return roundToHalfHour(Number(s.replace(',', '.')));
}
