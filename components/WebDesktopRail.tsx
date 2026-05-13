import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { usePathname, useRouter } from 'expo-router';
import { addMonths, startOfMonth } from 'date-fns';
import { useCallback, useState } from 'react';
import {
  LayoutChangeEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Card, IconButton, useTheme, type MD3Theme } from 'react-native-paper';

import { MonthCalendarGrid } from './MonthCalendarGrid';
import { useAppLocale } from '../context/AppLocaleContext';
import { useWebMonthOptional } from '../context/WebMonthContext';
import { useWebDesktopLayout } from '../hooks/useWebDesktopLayout';

type TabKey = 'index' | 'spese' | 'profilo' | 'impostazioni';

function normalizePath(pathname: string | null): string {
  if (!pathname) return '/';
  const p = pathname.replace(/\/$/, '') || '/';
  return p;
}

/** Tab principale attivo; `null` su sottoschermate (giorno, spesa, export) per non evidenziare a caso. */
function tabFromPath(pathname: string | null): TabKey | null {
  const p = normalizePath(pathname);
  if (p.includes('/giorno')) return null;
  if (p.includes('/spesa')) return null;
  if (p.includes('/export')) return null;
  if (p === '/' || p.endsWith('/index')) return 'index';
  if (p.includes('/spese')) return 'spese';
  if (p.includes('/profilo')) return 'profilo';
  if (p.includes('/impostazioni')) return 'impostazioni';
  return null;
}

export function WebDesktopRail() {
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const { messages, formatD } = useAppLocale();
  const { railWidth } = useWebDesktopLayout();
  const wm = useWebMonthOptional();
  const active = tabFromPath(pathname);

  const [dayRowHeight, setDayRowHeight] = useState(40);
  const onCalendarGridLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w <= 0) return;
    setDayRowHeight(Math.max(34, Math.floor(w / 7)));
  }, []);

  const goTab = (key: TabKey) => {
    switch (key) {
      case 'index':
        router.replace('/');
        break;
      case 'spese':
        router.replace('/spese');
        break;
      case 'profilo':
        router.replace('/profilo');
        break;
      case 'impostazioni':
        router.replace('/impostazioni');
        break;
      default:
        router.replace('/');
    }
  };

  if (!wm || Platform.OS !== 'web') return null;

  return (
    <View
      style={[
        styles.rail,
        {
          width: railWidth,
          backgroundColor: theme.colors.surface,
          borderRightColor: 'rgba(15, 23, 42, 0.08)',
        },
      ]}
    >
      <View style={styles.tabsBlock}>
        <TabRow
          label={messages.tabHome}
          icon="calendar-month-outline"
          selected={active === 'index'}
          onPress={() => goTab('index')}
          theme={theme}
        />
        <TabRow
          label={messages.tabSpese}
          icon="cash-multiple"
          selected={active === 'spese'}
          onPress={() => goTab('spese')}
          theme={theme}
        />
        <TabRow
          label={messages.tabProfilo}
          icon="account-outline"
          selected={active === 'profilo'}
          onPress={() => goTab('profilo')}
          theme={theme}
        />
        <TabRow
          label={messages.tabImpostazioni}
          icon="cog-outline"
          selected={active === 'impostazioni'}
          onPress={() => goTab('impostazioni')}
          theme={theme}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={messages.export}
          onPress={() => router.push('/export')}
          style={({ pressed }) => [
            styles.exportRow,
            {
              backgroundColor: pressed ? theme.colors.primaryContainer : theme.colors.primary,
            },
          ]}
        >
          <MaterialCommunityIcons name="file-export-outline" size={22} color={theme.colors.onPrimary} />
          <Text style={[styles.exportLabel, { color: theme.colors.onPrimary }]} numberOfLines={1}>
            {messages.export}
          </Text>
        </Pressable>
      </View>

      <View style={styles.calendarBlock}>
        <View style={styles.monthNav}>
          <IconButton
            icon="chevron-left"
            mode="outlined"
            size={20}
            onPress={() => wm.setCurrentMonth((m) => startOfMonth(addMonths(m, -1)))}
            accessibilityLabel={messages.homeAccPrevMonth}
          />
          <View style={styles.monthTitles}>
            <Text style={[styles.monthTitle, { color: theme.colors.onSurface }]} numberOfLines={1}>
              {formatD(wm.currentMonth, 'LLLL')}
            </Text>
            <Text style={[styles.yearTitle, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
              {formatD(wm.currentMonth, 'yyyy')}
            </Text>
          </View>
          <IconButton
            icon="chevron-right"
            mode="outlined"
            size={20}
            onPress={() => wm.setCurrentMonth((m) => startOfMonth(addMonths(m, 1)))}
            accessibilityLabel={messages.homeAccNextMonth}
          />
        </View>

        <ScrollView
          style={styles.calScroll}
          contentContainerStyle={styles.calScrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
        >
          <Card style={[styles.calCard, { backgroundColor: theme.colors.elevation.level1 }]}>
            <Card.Content style={styles.calCardContent}>
              <MonthCalendarGrid
                currentMonth={wm.currentMonth}
                giorniByData={wm.giorniByData}
                speseCountByData={wm.speseCountByData}
                oreCalSettings={wm.oreCalSettings}
                dayRowHeight={dayRowHeight}
                onCalendarGridLayout={onCalendarGridLayout}
                compact
              />
            </Card.Content>
          </Card>
        </ScrollView>
      </View>
    </View>
  );
}

function TabRow({
  label,
  icon,
  selected,
  onPress,
  theme,
}: {
  label: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  selected: boolean;
  onPress: () => void;
  theme: MD3Theme;
}) {
  const color = selected ? theme.colors.primary : '#6b7280';
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tabRow,
        {
          backgroundColor: selected
            ? theme.colors.primaryContainer
            : pressed
              ? 'rgba(99, 102, 241, 0.06)'
              : 'transparent',
          borderColor: selected ? theme.colors.primary : 'transparent',
        },
      ]}
    >
      <MaterialCommunityIcons name={icon} size={22} color={color} />
      <Text style={[styles.tabRowLabel, { color }]} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rail: {
    flexShrink: 0,
    alignSelf: 'stretch',
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 10,
    flexDirection: 'column',
    ...(Platform.OS === 'web' ? ({ minHeight: '100%' } as const) : null),
  },
  tabsBlock: {
    gap: 6,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(15, 23, 42, 0.08)',
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tabRowLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  exportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  exportLabel: {
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 1,
  },
  calendarBlock: {
    flex: 1,
    minHeight: 0,
    marginTop: 12,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 2,
    marginBottom: 8,
  },
  monthTitles: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
  },
  monthTitle: {
    fontSize: 15,
    fontWeight: '700',
    textTransform: 'capitalize',
    textAlign: 'center',
  },
  yearTitle: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: -1,
  },
  calScroll: {
    flex: 1,
    minHeight: 0,
  },
  calScrollContent: {
    paddingBottom: 16,
  },
  calCard: {
    alignSelf: 'stretch',
  },
  calCardContent: {
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
});
