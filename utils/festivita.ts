import { COMPANY_LOCKED } from './companyInfo';
import { findCapoluogoFestivitaInAddress } from './indirizzoCapoluogo';
import { normalizeAppLanguage, type AppLanguage } from '../i18n/messages';

type FestivitaFissa = { mese: number; giorno: number; nome: string };

/** Festività locali risolte da impostazioni + indirizzo aziendale (capoluogo o GG/MM manuale). */
export type FestivitaLocaliRuntime = {
  abilitate: boolean;
  capoluogo: { mese: number; giorno: number; nome: string } | null;
  manuale: { mese: number; giorno: number } | null;
  nomeManuale: string;
};

/** DD/MM (giorno/mese), ricorrente ogni anno. */
export function parseManualDdmm(raw: string): { mese: number; giorno: number } | null {
  const s = raw.trim().replace(/\s/g, '');
  const m = /^(\d{1,2})\/(\d{1,2})$/.exec(s);
  if (!m) return null;
  const giorno = Number(m[1]);
  const mese = Number(m[2]);
  if (mese < 1 || mese > 12 || giorno < 1 || giorno > 31) return null;
  const last = new Date(2024, mese, 0).getDate();
  if (giorno > last) return null;
  return { mese, giorno };
}

export function formatDdMmFromParts(p: { mese: number; giorno: number }): string {
  return `${String(p.giorno).padStart(2, '0')}/${String(p.mese).padStart(2, '0')}`;
}

function nomeFestivitaManuale(lang: AppLanguage): string {
  return lang === 'en' ? 'Local holiday' : 'Festività locale';
}

export function parseFestivitaLocaliAbilitate(all: Record<string, unknown>): boolean {
  const v = String(all.festivita_locali_abilitate ?? '').trim().toLowerCase();
  if (v === '0' || v === 'false') return false;
  if (v === '1' || v === 'true') return true;
  const old = String(all.festivita_localita ?? '').trim().toLowerCase();
  if (old === 'none') return false;
  if (old === 'milano') return true;
  return true;
}

export function buildFestivitaLocaliRuntime(all: Record<string, unknown>): FestivitaLocaliRuntime {
  const indirizzo = String(all.indirizzo_azienda ?? '').trim() || COMPANY_LOCKED.address;
  const capRow = findCapoluogoFestivitaInAddress(indirizzo);
  const manual = parseManualDdmm(String(all.festivita_locali_ddmm ?? ''));
  const lang = normalizeAppLanguage(all.app_language);
  return {
    abilitate: parseFestivitaLocaliAbilitate(all),
    capoluogo: capRow ? { mese: capRow.mese, giorno: capRow.giorno, nome: capRow.nome } : null,
    manuale: manual,
    nomeManuale: nomeFestivitaManuale(lang),
  };
}

export const FESTIVITA_FISSE: FestivitaFissa[] = [
  { mese: 1, giorno: 1, nome: 'Capodanno' },
  { mese: 1, giorno: 6, nome: 'Epifania' },
  { mese: 4, giorno: 25, nome: 'Festa della Liberazione' },
  { mese: 5, giorno: 1, nome: 'Festa del Lavoro' },
  { mese: 6, giorno: 2, nome: 'Festa della Repubblica' },
  { mese: 8, giorno: 15, nome: 'Ferragosto' },
  { mese: 11, giorno: 1, nome: 'Ognissanti' },
  { mese: 12, giorno: 8, nome: 'Immacolata Concezione' },
  { mese: 12, giorno: 25, nome: 'Natale' },
  { mese: 12, giorno: 26, nome: 'Santo Stefano' },
];

function isSameYmd(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Gregorian Easter Sunday (Meeus/Jones/Butcher algorithm).
 * Returns a Date in local time for the given year.
 */
export function getEaster(year: number): Date {
  // Meeus/Jones/Butcher Gregorian algorithm
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=Marzo, 4=Aprile
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  // JS Date month is 0-based
  return new Date(year, month - 1, day);
}

export function isFestivita(date: Date, locali?: FestivitaLocaliRuntime | null): string | null {
  const month = date.getMonth() + 1; // 1..12
  const day = date.getDate();

  const fixed = FESTIVITA_FISSE.find((f) => f.mese === month && f.giorno === day);
  if (fixed) return fixed.nome;

  const year = date.getFullYear();
  const easter = getEaster(year);
  if (isSameYmd(date, easter)) return 'Pasqua';

  const easterMonday = new Date(easter);
  easterMonday.setDate(easterMonday.getDate() + 1);
  if (isSameYmd(date, easterMonday)) return 'Pasquetta';

  if (!locali?.abilitate) return null;

  if (locali.capoluogo && locali.capoluogo.mese === month && locali.capoluogo.giorno === day) {
    return locali.capoluogo.nome;
  }
  if (!locali.capoluogo && locali.manuale && locali.manuale.mese === month && locali.manuale.giorno === day) {
    return locali.nomeManuale;
  }

  return null;
}

