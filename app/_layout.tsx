import { Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { configureFonts, MD3LightTheme, PaperProvider, Text, type MD3Theme } from 'react-native-paper';

import { HapticButton } from '../components/HapticButton';
import { WebSqliteBlockedScreen } from '../components/WebSqliteBlockedScreen';
import { WebAlertPortal } from '../components/WebAlertPortal';
import { WebPwaBootstrap } from '../components/WebPwaBootstrap';
import { AppLocaleProvider } from '../context/AppLocaleContext';
import { FloatingNumericKeyboardProvider } from '../components/FloatingNumericKeyboardProvider';
import { initDb, resetDbConnection } from '../db/database';
import { isExpoSqliteWebStorageAvailable } from '../utils/sqliteWebSupport';

/** ~7% sopra allo typescale MD3: testi Paper (body, titoli campi, bottoni) leggermente più grandi senza cambiare layout drastico */
const APP_FONT_SCALE = 1.07;

function scaleMd3Fonts(): MD3Theme['fonts'] {
  const base = configureFonts({ isV3: true });
  return Object.fromEntries(
    Object.entries(base).map(([name, variant]) => {
      if (
        !variant ||
        typeof variant !== 'object' ||
        typeof (variant as { fontSize?: number }).fontSize !== 'number'
      ) {
        return [name, variant];
      }
      const v = variant as typeof variant & { fontSize: number; lineHeight?: number };
      return [
        name,
        {
          ...v,
          fontSize: Math.round(v.fontSize * APP_FONT_SCALE * 10) / 10,
          ...(typeof v.lineHeight === 'number'
            ? { lineHeight: Math.round(v.lineHeight * APP_FONT_SCALE * 10) / 10 }
            : {}),
        },
      ];
    })
  ) as MD3Theme['fonts'];
}

const paperTheme: MD3Theme = {
  ...MD3LightTheme,
  fonts: scaleMd3Fonts(),
};

type BootState =
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'web_sqlite' }
  | { kind: 'db_error'; message: string };

export default function RootLayout() {
  const [boot, setBoot] = useState<BootState>({ kind: 'loading' });

  const runInit = useCallback(async (opts?: { reset?: boolean }) => {
    if (Platform.OS === 'web' && !isExpoSqliteWebStorageAvailable()) {
      setBoot({ kind: 'web_sqlite' });
      return;
    }
    if (opts?.reset) {
      await resetDbConnection();
    }
    setBoot({ kind: 'loading' });
    try {
      await initDb();
      setBoot({ kind: 'ready' });
    } catch (error) {
      console.error('Database init error:', error);
      const message = error instanceof Error ? error.message : String(error);
      const maybeInvalidState =
        /InvalidStateError|invalid state/i.test(message) && Platform.OS === 'web';
      if (maybeInvalidState) {
        await resetDbConnection();
        try {
          await initDb();
          setBoot({ kind: 'ready' });
          return;
        } catch (e2) {
          console.error('Database init retry error:', e2);
          setBoot({
            kind: 'db_error',
            message: e2 instanceof Error ? e2.message : String(e2),
          });
          return;
        }
      }
      setBoot({
        kind: 'db_error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }, []);

  useEffect(() => {
    void runInit();
  }, [runInit]);

  if (boot.kind === 'loading') {
    return (
      <>
        <WebPwaBootstrap />
        <PaperProvider theme={paperTheme}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={paperTheme.colors.primary} />
          </View>
        </PaperProvider>
      </>
    );
  }

  if (boot.kind === 'web_sqlite') {
    return (
      <>
        <WebPwaBootstrap />
        <PaperProvider theme={paperTheme}>
          <View style={{ flex: 1, backgroundColor: paperTheme.colors.background }}>
            <WebSqliteBlockedScreen />
          </View>
        </PaperProvider>
      </>
    );
  }

  if (boot.kind === 'db_error') {
    return (
      <>
        <WebPwaBootstrap />
        <PaperProvider theme={paperTheme}>
          <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16 }}>
            <Text variant="titleMedium">Database</Text>
            <Text variant="bodyMedium" style={{ opacity: 0.85 }}>
              {boot.message}
            </Text>
            <HapticButton mode="contained" onPress={() => void runInit({ reset: true })}>
              Riprova
            </HapticButton>
          </View>
        </PaperProvider>
      </>
    );
  }

  return (
    <>
      <WebPwaBootstrap />
      <PaperProvider theme={paperTheme}>
        <WebAlertPortal />
        <AppLocaleProvider>
          <FloatingNumericKeyboardProvider>
            <Stack screenOptions={{ headerShown: false }} />
          </FloatingNumericKeyboardProvider>
        </AppLocaleProvider>
      </PaperProvider>
    </>
  );
}