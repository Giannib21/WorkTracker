import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { startOfMonth } from 'date-fns';

import type { GiornoRow } from '../db/database';
import type { HomeMonthStats } from '../hooks/useHomeMonthData';
import { useHomeMonthData } from '../hooks/useHomeMonthData';
import type { OreDefaultsSettings } from '../utils/defaults';

export type WebMonthContextValue = {
  currentMonth: Date;
  setCurrentMonth: React.Dispatch<React.SetStateAction<Date>>;
  giorniByData: Record<string, GiornoRow>;
  speseCountByData: Record<string, number>;
  monthStats: HomeMonthStats;
  oreCalSettings: OreDefaultsSettings;
  reload: () => void;
};

const WebMonthContext = createContext<WebMonthContextValue | null>(null);

export function WebMonthProvider({ children }: { children: ReactNode }) {
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const { giorniByData, speseCountByData, monthStats, oreCalSettings, reload } = useHomeMonthData(
    currentMonth,
    true
  );

  const value = useMemo(
    () => ({
      currentMonth,
      setCurrentMonth,
      giorniByData,
      speseCountByData,
      monthStats,
      oreCalSettings,
      reload,
    }),
    [currentMonth, giorniByData, speseCountByData, monthStats, oreCalSettings, reload]
  );

  return <WebMonthContext.Provider value={value}>{children}</WebMonthContext.Provider>;
}

export function useWebMonthOptional(): WebMonthContextValue | null {
  return useContext(WebMonthContext);
}
