import { eachDayOfInterval, endOfMonth, format, parseISO, startOfMonth } from 'date-fns';

import type { GiornoRow } from '../db/database';
import { listGiorniByMonth, upsertGiorno } from '../db/database';
import { getDefaultGiornata, type OreDefaultsSettings } from './defaults';
import { buildFestivitaLocaliRuntime } from './festivita';

/** Ore nel mese come nel riepilogo presenze PDF (stesso algoritmo). */
export function computePresenzeOreBreakdown(giorni: GiornoRow[]) {
  let oreLavorateSede = 0;
  let oreTrasferta = 0;
  let oreFeriePermessi = 0;
  let oreMalattia = 0;

  for (const g of giorni) {
    oreTrasferta += Number(g.ore_trasferta ?? 0);

    if (g.tipo === 'lavoro' || g.tipo === 'trasferta') {
      oreLavorateSede += Number(g.ore ?? 0);
    }

    oreFeriePermessi += Number(g.ore_permesso ?? 0);
    if (g.tipo === 'ferie') {
      oreFeriePermessi += Number(g.ore ?? 0);
    }
    if (g.tipo === 'permesso') {
      const p = Number(g.ore_permesso ?? 0);
      if (p === 0) oreFeriePermessi += Number(g.ore ?? 0);
    }

    if (g.tipo === 'malattia') {
      oreMalattia += Number(g.ore ?? 0);
    }
  }

  return { oreLavorateSede, oreTrasferta, oreFeriePermessi, oreMalattia };
}

export function oreSettingsFromImpostazioni(all: Record<string, unknown>): OreDefaultsSettings {
  const ore_default_lun_gio = all.ore_default_lun_gio ? Number(all.ore_default_lun_gio) : undefined;
  const ore_default_ven = all.ore_default_ven ? Number(all.ore_default_ven) : undefined;
  return {
    ore_default_lun_gio: Number.isFinite(ore_default_lun_gio as number) ? ore_default_lun_gio : undefined,
    ore_default_ven: Number.isFinite(ore_default_ven as number) ? ore_default_ven : undefined,
    festivita_locali: buildFestivitaLocaliRuntime(all),
  };
}

/** Giorni del mese per report/PDF: unisce DB + default per ogni data di calendario (weekend, festività, lavoro 8/5h). */
export function expandGiorniMeseConDefaults(
  yyyyMm: string,
  saved: GiornoRow[],
  oreSettings?: OreDefaultsSettings
): GiornoRow[] {
  const byData = new Map(saved.map((g) => [g.data, g]));
  const anchor = parseISO(`${yyyyMm}-01`);
  const days = eachDayOfInterval({ start: startOfMonth(anchor), end: endOfMonth(anchor) });

  return days.map((d) => {
    const data = format(d, 'yyyy-MM-dd');
    const existing = byData.get(data);
    if (existing) return existing;

    const def = getDefaultGiornata(d, oreSettings);
    if (def.tipo === 'festivita') {
      return {
        id: 0,
        data,
        tipo: 'festivita',
        ore: 0,
        trasferta: 0,
        ore_trasferta: 0,
        ore_permesso: 0,
        luogo: null,
        progetto: null,
        note: def.nomeFestivita ? `Festività: ${def.nomeFestivita}` : null,
      };
    }
    if (def.tipo === 'weekend') {
      return {
        id: 0,
        data,
        tipo: 'weekend',
        ore: 0,
        trasferta: 0,
        ore_trasferta: 0,
        ore_permesso: 0,
        luogo: null,
        progetto: null,
        note: null,
      };
    }

    return {
      id: 0,
      data,
      tipo: 'lavoro',
      ore: def.ore,
      trasferta: 0,
      ore_trasferta: 0,
      ore_permesso: 0,
      luogo: null,
      progetto: null,
      note: null,
    };
  });
}

/** Inserisce in DB i giorni lavorativi del mese ancora assenti, con ore contrattuali di default (senza toccare righe già salvate). */
export async function ensureDefaultLavoroDaysForMonth(
  yyyyMm: string,
  oreSettings?: OreDefaultsSettings
): Promise<void> {
  const existing = await listGiorniByMonth(yyyyMm);
  const set = new Set(existing.map((g) => g.data));
  const anchor = parseISO(`${yyyyMm}-01`);
  const days = eachDayOfInterval({ start: startOfMonth(anchor), end: endOfMonth(anchor) });

  for (const d of days) {
    const data = format(d, 'yyyy-MM-dd');
    if (set.has(data)) continue;
    const def = getDefaultGiornata(d, oreSettings);
    if (def.tipo !== 'lavoro') continue;

    await upsertGiorno({
      data,
      tipo: 'lavoro',
      ore: def.ore,
      trasferta: 0,
      ore_trasferta: 0,
      ore_permesso: 0,
      luogo: null,
      progetto: null,
      note: null,
    });
    set.add(data);
  }
}
