import { addDays, format, isAfter, isBefore, isValid, parseISO } from 'date-fns';

import type { GiornoInsert, GiornoTipo } from '../db/database';
import { getDefaultGiornata, getOreDefaultForDate, type OreDefaultsSettings } from './defaults';

export type DayExtendKind = 'trasferta_full' | 'trasferta_8h' | 'ferie' | 'malattia';

export type DayExtendTemplate = {
  kind: DayExtendKind;
  luogo: string | null;
  progetto: string | null;
};

const HOURS_EPS = 0.02;

export function isWorkingDay(date: Date, settings?: OreDefaultsSettings): boolean {
  return getDefaultGiornata(date, settings).tipo === 'lavoro';
}

export function getNextWorkingDay(date: Date, settings?: OreDefaultsSettings): Date {
  let d = addDays(date, 1);
  for (let i = 0; i < 366; i++) {
    if (isWorkingDay(d, settings)) return d;
    d = addDays(d, 1);
  }
  return d;
}

export function getPreviousWorkingDay(date: Date, settings?: OreDefaultsSettings): Date {
  let d = addDays(date, -1);
  for (let i = 0; i < 366; i++) {
    if (isWorkingDay(d, settings)) return d;
    d = addDays(d, -1);
  }
  return d;
}

export function clampEndDate(
  candidate: Date,
  minEnd: Date,
  maxEnd: Date,
): Date {
  if (isBefore(candidate, minEnd)) return minEnd;
  if (isAfter(candidate, maxEnd)) return maxEnd;
  return candidate;
}

export function parseYmdOrNull(raw: string): Date | null {
  const s = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = parseISO(s);
  return isValid(d) ? d : null;
}

export function detectDayExtendKind(
  tipo: GiornoTipo,
  oreTrasfN: number,
): DayExtendKind | null {
  if (tipo === 'ferie') return 'ferie';
  if (tipo === 'malattia') return 'malattia';
  if (tipo === 'trasferta') return 'trasferta_full';
  if (tipo === 'lavoro' && oreTrasfN >= 8 - HOURS_EPS) return 'trasferta_8h';
  return null;
}

/** Giorni lavorativi da startYmd a endYmd inclusi. */
export function countWorkingDaysInclusive(
  startYmd: string,
  endYmd: string,
  settings?: OreDefaultsSettings,
): number {
  const start = parseISO(startYmd);
  const end = parseISO(endYmd);
  if (isAfter(start, end)) return 0;
  let count = 0;
  let d = start;
  while (!isAfter(d, end)) {
    if (isWorkingDay(d, settings)) count++;
    d = addDays(d, 1);
  }
  return count;
}

/** Giorni lavorativi dopo startYmd fino a endYmd inclusi (esclude start). */
export function listWorkingDaysToExtend(
  startYmd: string,
  endYmd: string,
  settings?: OreDefaultsSettings,
): string[] {
  const start = parseISO(startYmd);
  const end = parseISO(endYmd);
  if (isAfter(start, end)) return [];
  const out: string[] = [];
  let d = addDays(start, 1);
  while (!isAfter(d, end)) {
    if (isWorkingDay(d, settings)) {
      out.push(format(d, 'yyyy-MM-dd'));
    }
    d = addDays(d, 1);
  }
  return out;
}

export function buildExtendedGiornoInsert(
  ymd: string,
  template: DayExtendTemplate,
  settings?: OreDefaultsSettings,
): GiornoInsert {
  const d = parseISO(ymd);
  const H = getOreDefaultForDate(d, settings);

  switch (template.kind) {
    case 'ferie':
      return {
        data: ymd,
        tipo: 'ferie',
        ore: 0,
        trasferta: 0,
        ore_trasferta: 0,
        ore_permesso: 0,
        luogo: null,
        progetto: null,
        note: null,
      };
    case 'malattia':
      return {
        data: ymd,
        tipo: 'malattia',
        ore: 0,
        trasferta: 0,
        ore_trasferta: 0,
        ore_permesso: 0,
        luogo: null,
        progetto: null,
        note: null,
      };
    case 'trasferta_full':
      return {
        data: ymd,
        tipo: 'trasferta',
        ore: 0,
        trasferta: 1,
        ore_trasferta: H,
        ore_permesso: 0,
        luogo: template.luogo,
        progetto: template.progetto,
        note: null,
      };
    case 'trasferta_8h':
      return {
        data: ymd,
        tipo: 'lavoro',
        ore: Math.max(0, H - 8),
        trasferta: 1,
        ore_trasferta: 8,
        ore_permesso: 0,
        luogo: template.luogo,
        progetto: template.progetto,
        note: null,
      };
  }
}
