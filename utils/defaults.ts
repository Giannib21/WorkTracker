import { isFestivita, type FestivitaLocaliRuntime } from './festivita';

export type OreDefaultsSettings = {
  ore_default_lun_gio?: number; // default: 8
  ore_default_ven?: number; // default: 5
  /** Capoluogo da indirizzo aziendale o data manuale GG/MM, oltre alle nazionali. */
  festivita_locali?: FestivitaLocaliRuntime | null;
};

export type DefaultGiornata = {
  tipo: 'lavoro' | 'weekend' | 'festivita';
  ore: number;
  nomeFestivita?: string;
};

export const DEFAULT_ORE_LUN_GIO = 8;
export const DEFAULT_ORE_VEN = 5;

export function getOreDefaultForDate(date: Date, settings?: OreDefaultsSettings): number {
  const day = date.getDay(); // 0 dom ... 6 sab
  if (day === 0 || day === 6) return 0;

  const oreLunGio = settings?.ore_default_lun_gio ?? DEFAULT_ORE_LUN_GIO;
  const oreVen = settings?.ore_default_ven ?? DEFAULT_ORE_VEN;

  // lun=1 ... gio=4, ven=5
  return day === 5 ? oreVen : oreLunGio;
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function getDefaultGiornata(date: Date, settings?: OreDefaultsSettings): DefaultGiornata {
  const fest = isFestivita(date, settings?.festivita_locali ?? null);
  if (fest) return { tipo: 'festivita', ore: 0, nomeFestivita: fest };

  if (isWeekend(date)) return { tipo: 'weekend', ore: 0 };

  return { tipo: 'lavoro', ore: getOreDefaultForDate(date, settings) };
}

/**
 * Ore lavorate "attese" in sede: contratto meno trasferta e meno permesso parziale.
 */
export function getExpectedWorkHours(
  date: Date,
  oreTrasferta: number,
  trasfertaAttiva: boolean,
  settings?: OreDefaultsSettings,
  orePermesso = 0
): number {
  const H = getOreDefaultForDate(date, settings);
  const T = trasfertaAttiva && Number.isFinite(oreTrasferta) && oreTrasferta > 0 ? oreTrasferta : 0;
  const P = Number.isFinite(orePermesso) && orePermesso > 0 ? orePermesso : 0;
  return Math.max(0, H - T - P);
}

