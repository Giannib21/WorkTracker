import { format } from 'date-fns';
import { enUS, it } from 'date-fns/locale';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { getImpostazioniAll } from '../db/database';
import { normalizeAppLanguage, type AppLanguage, UI_MESSAGES } from '../i18n/messages';

type AppLocaleValue = {
  language: AppLanguage;
  messages: (typeof UI_MESSAGES)[AppLanguage];
  /** Format a date with the active UI locale (date-fns). */
  formatD: (date: Date, pattern: string) => string;
  refreshLanguage: () => Promise<void>;
};

const AppLocaleContext = createContext<AppLocaleValue | null>(null);

export function AppLocaleProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<AppLanguage>('it');

  const refreshLanguage = useCallback(async () => {
    try {
      const s = await getImpostazioniAll();
      setLanguage(normalizeAppLanguage(s.app_language));
    } catch {
      setLanguage('it');
    }
  }, []);

  useEffect(() => {
    void refreshLanguage();
  }, [refreshLanguage]);

  const value = useMemo<AppLocaleValue>(() => {
    const locale = language === 'en' ? enUS : it;
    return {
      language,
      messages: UI_MESSAGES[language],
      formatD: (date, pattern) => format(date, pattern, { locale }),
      refreshLanguage,
    };
  }, [language, refreshLanguage]);

  return <AppLocaleContext.Provider value={value}>{children}</AppLocaleContext.Provider>;
}

export function useAppLocale(): AppLocaleValue {
  const ctx = useContext(AppLocaleContext);
  if (!ctx) {
    throw new Error('useAppLocale must be used within AppLocaleProvider');
  }
  return ctx;
}
