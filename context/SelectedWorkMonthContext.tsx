import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { defaultWorkMonth } from '../utils/defaultWorkMonth';

type SelectedWorkMonthContextValue = {
  workMonth: Date;
  setWorkMonth: React.Dispatch<React.SetStateAction<Date>>;
};

const SelectedWorkMonthContext = createContext<SelectedWorkMonthContextValue | null>(null);

export function SelectedWorkMonthProvider({ children }: { children: ReactNode }) {
  const [workMonth, setWorkMonth] = useState(() => defaultWorkMonth());

  const value = useMemo(
    () => ({
      workMonth,
      setWorkMonth,
    }),
    [workMonth]
  );

  return <SelectedWorkMonthContext.Provider value={value}>{children}</SelectedWorkMonthContext.Provider>;
}

export function useSelectedWorkMonthOptional(): SelectedWorkMonthContextValue | null {
  return useContext(SelectedWorkMonthContext);
}
