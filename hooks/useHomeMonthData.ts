import { useCallback, useEffect, useState } from 'react';
import { format, startOfMonth } from 'date-fns';

import type { GiornoRow } from '../db/database';
import {
  getImpostazioniAll,
  listGiorniByMonth,
  listSpeseByMonth,
} from '../db/database';
import {
  computePresenzeOreBreakdown,
  ensureDefaultLavoroDaysForMonth,
  oreSettingsFromImpostazioni,
} from '../utils/giorniMeseReport';
import type { OreDefaultsSettings } from '../utils/defaults';

export type HomeMonthStats = {
  giorniDb: number;
  oreLav: number;
  oreTrasf: number;
  oreFeriePermessi: number;
  oreMalattia: number;
  speseTot: number;
  speseN: number;
};

const emptyStats: HomeMonthStats = {
  giorniDb: 0,
  oreLav: 0,
  oreTrasf: 0,
  oreFeriePermessi: 0,
  oreMalattia: 0,
  speseTot: 0,
  speseN: 0,
};

function monthKey(d: Date): string {
  return format(d, 'yyyy-MM');
}

export function useHomeMonthData(currentMonth: Date, enabled: boolean) {
  const [giorniByData, setGiorniByData] = useState<Record<string, GiornoRow>>({});
  const [speseCountByData, setSpeseCountByData] = useState<Record<string, number>>({});
  const [monthStats, setMonthStats] = useState<HomeMonthStats>(emptyStats);
  const [oreCalSettings, setOreCalSettings] = useState<OreDefaultsSettings>({});

  const reload = useCallback(() => {
    if (!enabled) return () => undefined;
    let alive = true;
    const key = monthKey(currentMonth);
    (async () => {
      try {
        const settings = await getImpostazioniAll();
        if (!alive) return;
        const oreSt = oreSettingsFromImpostazioni(settings);
        setOreCalSettings(oreSt);
        await ensureDefaultLavoroDaysForMonth(key, oreSt);
        if (!alive) return;
      } catch {
        // noop
      }

      const [giorni, spese] = await Promise.all([listGiorniByMonth(key), listSpeseByMonth(key)]);
      if (!alive) return;

      const gMap: Record<string, GiornoRow> = {};
      let oreLav = 0;
      let oreTrasf = 0;
      for (const g of giorni) {
        gMap[g.data] = g;
        oreLav += Number(g.ore ?? 0);
        oreTrasf += Number(g.ore_trasferta ?? 0);
      }

      const sMap: Record<string, number> = {};
      let speseTot = 0;
      for (const s of spese) {
        sMap[s.data] = (sMap[s.data] ?? 0) + 1;
        speseTot += Number.isFinite(s.importo) ? s.importo : 0;
      }

      setGiorniByData(gMap);
      setSpeseCountByData(sMap);
      const oreBreak = computePresenzeOreBreakdown(giorni);
      setMonthStats({
        giorniDb: giorni.length,
        oreLav,
        oreTrasf,
        oreFeriePermessi: oreBreak.oreFeriePermessi,
        oreMalattia: oreBreak.oreMalattia,
        speseTot,
        speseN: spese.length,
      });
    })().catch(() => {
      // noop
    });
    return () => {
      alive = false;
    };
  }, [currentMonth, enabled]);

  useEffect(() => {
    if (!enabled) return;
    return reload();
  }, [reload, enabled]);

  return {
    giorniByData,
    speseCountByData,
    monthStats,
    oreCalSettings,
    reload,
  };
}

/** Mese “sentinella” quando il hook è disattivato (solo per soddisfare le regole degli hook). */
export function disabledHomeMonthPlaceholder(): Date {
  return startOfMonth(new Date(2000, 0, 1));
}
