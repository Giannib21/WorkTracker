import { Stack } from 'expo-router';
import { Platform, View } from 'react-native';

import { WebDesktopRail } from '../../components/WebDesktopRail';
import { WebMonthProvider } from '../../context/WebMonthContext';
import { useWebDesktopLayout } from '../../hooks/useWebDesktopLayout';

/**
 * Gruppo `(app)`: URL invariati (`/`, `/giorno/…`, `/spesa/…`).
 * Su web desktop la sidebar resta fuori dallo Stack così resta visibile anche su giorno/spesa/export.
 */
export default function AppGroupLayout() {
  const { isDesktopSplit } = useWebDesktopLayout();

  if (Platform.OS === 'web' && isDesktopSplit) {
    return (
      <WebMonthProvider>
        <View style={{ flex: 1, flexDirection: 'row', minHeight: 0 }}>
          <WebDesktopRail />
          <View style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
            <Stack screenOptions={{ headerShown: false }} />
          </View>
        </View>
      </WebMonthProvider>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
