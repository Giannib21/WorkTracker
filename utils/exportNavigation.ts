import { format } from 'date-fns';

import type { WebMonthContextValue } from '../context/WebMonthContext';
import type { SelectedWorkMonthContextValue } from '../context/SelectedWorkMonthContext';

type ExportNavSource = {
  activeTab?: string | null;
  webMonth?: WebMonthContextValue | null;
  selectedMonth?: SelectedWorkMonthContextValue | null;
};

/** Parametri route export: mese condiviso (web desktop) o mese del tab home/spese attivo. */
export function exportNavigationParams(source: ExportNavSource): { pathname: '/export'; params?: { mese: string } } {
  const tab = source.activeTab ?? null;
  const month =
    source.webMonth?.currentMonth ??
    (tab === 'index' || tab === 'spese' ? source.selectedMonth?.workMonth : undefined);

  if (!month) {
    return { pathname: '/export' };
  }
  return { pathname: '/export', params: { mese: format(month, 'yyyy-MM') } };
}
