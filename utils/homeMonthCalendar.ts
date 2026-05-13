import { eachDayOfInterval, endOfMonth, format, startOfMonth } from 'date-fns';

import type { GiornoRow } from '../db/database';
import { getDefaultGiornata, type OreDefaultsSettings } from './defaults';

export type CalendarCellInfo = {
  ymd: string;
  dayNumber: string;
  weekDay: number;
  tipo: GiornoRow['tipo'];
  speseCount: number;
  hasTrasfertaHours: boolean;
};

export function ymdFromDate(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

export function monthKeyFromDate(d: Date): string {
  return format(d, 'yyyy-MM');
}

export function buildCalendarCells(
  currentMonth: Date,
  giorniByData: Record<string, GiornoRow>,
  speseCountByData: Record<string, number>,
  oreCalSettings: OreDefaultsSettings
): CalendarCellInfo[] {
  const start = startOfMonth(currentMonth);
  const end = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start, end });

  const firstDayJs = start.getDay();
  const mondayFirstOffset = (firstDayJs + 6) % 7;

  const leadingBlanks: CalendarCellInfo[] = Array.from({ length: mondayFirstOffset }).map((_, idx) => ({
    ymd: `blank-${idx}`,
    dayNumber: '',
    weekDay: -1,
    tipo: 'weekend' as const,
    speseCount: 0,
    hasTrasfertaHours: false,
  }));

  const realDays: CalendarCellInfo[] = days.map((d) => {
    const ymd = ymdFromDate(d);
    const saved = giorniByData[ymd];
    const def = getDefaultGiornata(d, oreCalSettings);
    const tipo = def.tipo === 'festivita' ? 'festivita' : (saved?.tipo ?? def.tipo);
    const oreT = saved ? Number(saved.ore_trasferta ?? 0) : 0;
    const hasTrasfertaHours = Boolean(
      saved &&
        (saved.trasferta === 1 || saved.tipo === 'trasferta' || (Number.isFinite(oreT) && oreT > 0))
    );
    return {
      ymd,
      dayNumber: format(d, 'd'),
      weekDay: d.getDay(),
      tipo,
      speseCount: speseCountByData[ymd] ?? 0,
      hasTrasfertaHours,
    };
  });

  const core = [...leadingBlanks, ...realDays];
  const trailingPad = (7 - (core.length % 7)) % 7;
  const trailingBlanks: CalendarCellInfo[] = Array.from({ length: trailingPad }).map((_, idx) => ({
    ymd: `blank-trail-${idx}`,
    dayNumber: '',
    weekDay: -1,
    tipo: 'weekend' as const,
    speseCount: 0,
    hasTrasfertaHours: false,
  }));

  return [...core, ...trailingBlanks];
}

export function splitCalendarRows(cells: CalendarCellInfo[]): CalendarCellInfo[][] {
  const rows: CalendarCellInfo[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }
  return rows;
}

export function tipoToCalendarColor(tipo: GiornoRow['tipo']): string {
  switch (tipo) {
    case 'lavoro':
      return '#ffffff';
    case 'trasferta':
      return '#dbeafe';
    case 'malattia':
      return '#fee2e2';
    case 'ferie':
    case 'permesso':
      return '#dcfce7';
    case 'festivita':
      return '#fef9c3';
    case 'weekend':
      return '#e5e7eb';
    default:
      return '#ffffff';
  }
}

export function calendarCellBackground(
  c: CalendarCellInfo,
  primaryContainer: string,
  tipoToBg: (tipo: GiornoRow['tipo']) => string
): string {
  if (c.hasTrasfertaHours) return primaryContainer;
  return tipoToBg(c.tipo);
}
