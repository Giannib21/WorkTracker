import { addMonths, startOfMonth } from 'date-fns';
import { useCallback, useEffect, useState } from 'react';
import { Alert, LayoutChangeEvent, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, IconButton, Text } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MonthCalendarGrid } from '../../../components/MonthCalendarGrid';
import { useAppLocale } from '../../../context/AppLocaleContext';
import { useWebMonthOptional } from '../../../context/WebMonthContext';
import {
  deleteGiorniInMonth,
  deleteSpeseInMonth,
  getImpostazioniAll,
} from '../../../db/database';
import { disabledHomeMonthPlaceholder, useHomeMonthData } from '../../../hooks/useHomeMonthData';
import { ensureDefaultLavoroDaysForMonth, oreSettingsFromImpostazioni } from '../../../utils/giorniMeseReport';
import { monthKeyFromDate } from '../../../utils/homeMonthCalendar';
import { screenHeaderPaddingTop } from '../../../utils/screenHeaderPadding';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { messages, formatD } = useAppLocale();
  const wm = useWebMonthOptional();
  const isWebShell = Platform.OS === 'web' && wm != null;

  const [localMonth, setLocalMonth] = useState<Date>(() => startOfMonth(new Date()));
  const nativeData = useHomeMonthData(isWebShell ? disabledHomeMonthPlaceholder() : localMonth, !isWebShell);

  const currentMonth = isWebShell ? wm.currentMonth : localMonth;
  const setCurrentMonth = isWebShell ? wm.setCurrentMonth : setLocalMonth;
  const giorniByData = isWebShell ? wm.giorniByData : nativeData.giorniByData;
  const speseCountByData = isWebShell ? wm.speseCountByData : nativeData.speseCountByData;
  const monthStats = isWebShell ? wm.monthStats : nativeData.monthStats;
  const oreCalSettings = isWebShell ? wm.oreCalSettings : nativeData.oreCalSettings;
  const reload = isWebShell ? wm.reload : nativeData.reload;

  const [dayRowHeight, setDayRowHeight] = useState(52);
  const onCalendarGridLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w <= 0) return;
    setDayRowHeight(Math.max(44, Math.floor(w / 7)));
  }, []);

  useEffect(() => {
    if (!isWebShell) reload();
  }, [reload, isWebShell]);

  useFocusEffect(
    useCallback(() => {
      if (isWebShell) wm?.reload();
      else reload();
    }, [isWebShell, wm, reload])
  );

  const openResetMese = useCallback(() => {
    const key = monthKeyFromDate(currentMonth);
    const monthTitle = formatD(currentMonth, 'LLLL yyyy');
    Alert.alert(messages.resetMonthTitle, messages.resetMonthMessage(monthTitle), [
      { text: messages.resetCancel, style: 'cancel' },
      {
        text: messages.resetSoloPresenze,
        onPress: async () => {
          try {
            await deleteGiorniInMonth(key);
            const settings = await getImpostazioniAll();
            await ensureDefaultLavoroDaysForMonth(key, oreSettingsFromImpostazioni(settings));
            reload();
          } catch {
            Alert.alert(messages.errorTitle, messages.resetErrPresenze);
          }
        },
      },
      {
        text: messages.resetSoloSpese,
        onPress: async () => {
          try {
            await deleteSpeseInMonth(key);
            reload();
          } catch {
            Alert.alert(messages.errorTitle, messages.resetErrSpese);
          }
        },
      },
      {
        text: messages.resetPresenzeESpese,
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteGiorniInMonth(key);
            await deleteSpeseInMonth(key);
            const settings = await getImpostazioniAll();
            await ensureDefaultLavoroDaysForMonth(key, oreSettingsFromImpostazioni(settings));
            reload();
          } catch {
            Alert.alert(messages.errorTitle, messages.resetErr);
          }
        },
      },
    ]);
  }, [currentMonth, reload, messages, formatD]);

  return (
    <View style={styles.screenRoot}>
      {!isWebShell ? (
        <View
          style={[styles.stickyHeader, { paddingTop: screenHeaderPaddingTop(insets.top) }]}
          accessibilityRole="header"
        >
          <View style={styles.navRow}>
            <IconButton
              icon="chevron-left"
              mode="outlined"
              size={22}
              onPress={() => setCurrentMonth((m) => startOfMonth(addMonths(m, -1)))}
              accessibilityLabel={messages.homeAccPrevMonth}
            />
            <View style={styles.titleBlock}>
              <Text variant="titleMedium" style={styles.titleMonth} numberOfLines={1}>
                {formatD(currentMonth, 'LLLL')}
              </Text>
              <Text variant="headlineSmall" style={styles.titleYear} numberOfLines={1}>
                {formatD(currentMonth, 'yyyy')}
              </Text>
            </View>
            <IconButton
              icon="chevron-right"
              mode="outlined"
              size={22}
              onPress={() => setCurrentMonth((m) => startOfMonth(addMonths(m, 1)))}
              accessibilityLabel={messages.homeAccNextMonth}
            />
          </View>
        </View>
      ) : (
        <View style={styles.webTopPad} />
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.pageScroll}
        keyboardShouldPersistTaps="handled"
      >
        {!isWebShell ? (
          <Card style={styles.card}>
            <Card.Content style={styles.calendarCardContent}>
              <MonthCalendarGrid
                currentMonth={currentMonth}
                giorniByData={giorniByData}
                speseCountByData={speseCountByData}
                oreCalSettings={oreCalSettings}
                dayRowHeight={dayRowHeight}
                onCalendarGridLayout={onCalendarGridLayout}
              />
            </Card.Content>
          </Card>
        ) : null}

        <Card style={styles.summaryCard}>
          <Card.Content style={{ gap: 8 }}>
            <Text variant="titleMedium">{messages.homeSummaryTitle}</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{messages.homeSummaryDays}</Text>
              <Text style={styles.summaryValue}>{monthStats.giorniDb}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{messages.homeSummaryHours}</Text>
              <Text style={styles.summaryValue}>{monthStats.oreLav.toFixed(1)} h</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{messages.homeSummaryTravel}</Text>
              <Text style={styles.summaryValue}>{monthStats.oreTrasf.toFixed(1)} h</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{messages.homeSummaryLeave}</Text>
              <Text style={styles.summaryValue}>{monthStats.oreFeriePermessi.toFixed(1)} h</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{messages.homeSummarySick}</Text>
              <Text style={styles.summaryValue}>{monthStats.oreMalattia.toFixed(1)} h</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{messages.homeSummaryExpenses}</Text>
              <Text style={styles.summaryValue}>€ {monthStats.speseTot.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{messages.homeSummaryExpenseCount}</Text>
              <Text style={styles.summaryValue}>{monthStats.speseN}</Text>
            </View>
          </Card.Content>
        </Card>

        <Button mode="outlined" icon="backup-restore" onPress={openResetMese} style={styles.resetFooter}>
          {messages.reset}
        </Button>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
  },
  webTopPad: {
    paddingTop: 16,
  },
  stickyHeader: {
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  scroll: {
    flex: 1,
  },
  pageScroll: {
    padding: 12,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 12,
  },
  resetFooter: {
    alignSelf: 'center',
    marginTop: 4,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  titleBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    minWidth: 0,
    paddingHorizontal: 4,
  },
  titleMonth: {
    textAlign: 'center',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  titleYear: {
    textAlign: 'center',
    fontWeight: '700',
    marginTop: -2,
  },
  card: {
    alignSelf: 'stretch',
  },
  calendarCardContent: {
    paddingTop: 10,
    paddingBottom: 12,
    paddingHorizontal: 14,
  },
  summaryCard: {
    alignSelf: 'stretch',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  summaryLabel: {
    flex: 1,
    opacity: 0.75,
  },
  summaryValue: {
    fontWeight: '700',
  },
});
