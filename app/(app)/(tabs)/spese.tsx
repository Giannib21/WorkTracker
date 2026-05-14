import { addMonths, endOfMonth, format, parseISO, startOfMonth } from 'date-fns';
import { Link } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Badge, Button, Card, Divider, IconButton, Text } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppLocale } from '../../../context/AppLocaleContext';
import { useWebMonthOptional } from '../../../context/WebMonthContext';
import type { SpesaRow } from '../../../db/database';
import { CATEGORIE_SPESE_ORDER, emptyTotalsByCategoria, labelCategoriaSpesa } from '../../../utils/expenseCategories';
import {
  deleteGiorniInMonth,
  deleteSpeseInMonth,
  getImpostazioniAll,
  listSpeseByMonth,
} from '../../../db/database';
import { ensureDefaultLavoroDaysForMonth, oreSettingsFromImpostazioni } from '../../../utils/giorniMeseReport';
import { screenHeaderPaddingTop } from '../../../utils/screenHeaderPadding';
import { appAlert } from '../../../utils/appAlert';

type Group = { data: string; items: SpesaRow[]; total: number };

function monthKey(d: Date): string {
  return format(d, 'yyyy-MM');
}

function sum(rows: SpesaRow[]): number {
  return rows.reduce((acc, r) => acc + (Number.isFinite(r.importo) ? r.importo : 0), 0);
}

function spesaSubtitle(s: SpesaRow): string {
  if (s.tipo === 'km' && (s.percorso_da?.trim() || s.percorso_a?.trim())) {
    return `${s.percorso_da?.trim() ?? ''} → ${s.percorso_a?.trim() ?? ''}`.trim();
  }
  return (s.descrizione ?? '').trim();
}

export default function SpeseTab() {
  const insets = useSafeAreaInsets();
  const { messages, formatD, language } = useAppLocale();
  const wm = useWebMonthOptional();
  const isWebShell = Platform.OS === 'web' && wm != null;

  const [localMonth, setLocalMonth] = useState<Date>(() => startOfMonth(new Date()));
  const currentMonth = isWebShell ? wm.currentMonth : localMonth;
  const setCurrentMonth = isWebShell ? wm.setCurrentMonth : setLocalMonth;
  const [rows, setRows] = useState<SpesaRow[]>([]);

  const reload = useCallback(() => {
    let alive = true;
    const key = monthKey(currentMonth);
    (async () => {
      const sp = await listSpeseByMonth(key);
      if (!alive) return;
      setRows(sp);
    })().catch(() => {
      // noop
    });
    return () => {
      alive = false;
    };
  }, [currentMonth]);

  useEffect(() => reload(), [reload]);
  useFocusEffect(useCallback(() => reload(), [reload]));

  const openResetMese = useCallback(() => {
    const key = monthKey(currentMonth);
    const monthTitle = formatD(currentMonth, 'LLLL yyyy');
    appAlert(messages.resetMonthTitle, messages.resetMonthMessage(monthTitle), [
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
            appAlert(messages.errorTitle, messages.resetErrPresenze);
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
            appAlert(messages.errorTitle, messages.resetErrSpese);
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
            appAlert(messages.errorTitle, messages.resetErr);
          }
        },
      },
    ]);
  }, [currentMonth, reload, messages, formatD]);

  const groups: Group[] = useMemo(() => {
    const map = new Map<string, SpesaRow[]>();
    for (const r of rows) {
      const list = map.get(r.data) ?? [];
      list.push(r);
      map.set(r.data, list);
    }
    const out: Group[] = Array.from(map.entries())
      .sort((a, b) => (a[0] > b[0] ? -1 : a[0] < b[0] ? 1 : 0))
      .map(([data, items]) => ({ data, items, total: sum(items) }));
    return out;
  }, [rows]);

  const totalsByCategoria = useMemo(() => {
    const acc = emptyTotalsByCategoria();
    for (const r of rows) acc[r.tipo] = (acc[r.tipo] ?? 0) + r.importo;
    return acc;
  }, [rows]);

  const totalMonth = useMemo(() => sum(rows), [rows]);
  const title = useMemo(() => formatD(currentMonth, 'LLLL yyyy'), [currentMonth, formatD]);
  const newDefaultDate = useMemo(() => format(startOfMonth(currentMonth), 'yyyy-MM-dd'), [currentMonth]);
  const rangeLabel = useMemo(
    () =>
      `${formatD(startOfMonth(currentMonth), 'd MMM')} — ${formatD(endOfMonth(currentMonth), 'd MMM yyyy')}`,
    [currentMonth, formatD]
  );

  return (
    <View style={[styles.screenRoot, isWebShell ? { paddingTop: 16 } : null]}>
      {!isWebShell ? (
        <View
          style={[styles.stickyHeader, { paddingTop: screenHeaderPaddingTop(insets.top) }]}
          accessibilityRole="header"
        >
          <View style={styles.headerRow}>
            <IconButton
              icon="chevron-left"
              mode="outlined"
              size={22}
              onPress={() => setCurrentMonth((m) => startOfMonth(addMonths(m, -1)))}
            />
            <View style={styles.headerCenter}>
              <Text variant="titleLarge" style={styles.headerTitle} numberOfLines={1}>
                {title}
              </Text>
              <Text style={styles.headerSub} numberOfLines={1}>
                {rangeLabel}
              </Text>
            </View>
            <IconButton
              icon="chevron-right"
              mode="outlined"
              size={22}
              onPress={() => setCurrentMonth((m) => startOfMonth(addMonths(m, 1)))}
            />
          </View>
        </View>
      ) : null}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.pageScroll}>
        {isWebShell ? (
          <View style={{ marginBottom: 4 }}>
            <Text variant="titleLarge" style={styles.headerTitle} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.headerSub} numberOfLines={1}>
              {rangeLabel}
            </Text>
          </View>
        ) : null}
      <Card>
        <Card.Content style={{ gap: 10 }}>
          <View style={styles.row}>
            <Text variant="titleMedium" style={{ flex: 1 }}>
              {messages.listSpeseTotalsMonth}
            </Text>
            <Badge>{`€ ${totalMonth.toFixed(2)}`}</Badge>
          </View>
          <Divider />
          <View style={{ gap: 6 }}>
            {CATEGORIE_SPESE_ORDER.map((k) => {
              const v = totalsByCategoria[k];
              if (v <= 0) return null;
              return (
                <View key={k} style={styles.row}>
                  <Text style={{ flex: 1, opacity: 0.8 }}>{labelCategoriaSpesa(k, language)}</Text>
                  <Text style={{ fontWeight: '600' }}>€ {v.toFixed(2)}</Text>
                </View>
              );
            })}
          </View>
        </Card.Content>
      </Card>

      <Link href={{ pathname: '/spesa/[id]', params: { id: 'new', data: newDefaultDate } }} asChild>
        <Button mode="contained">{messages.listSpeseNuova}</Button>
      </Link>

      {groups.length === 0 ? (
        <Card>
          <Card.Content>
            <Text style={{ opacity: 0.7 }}>{messages.listSpeseEmptyMonth}</Text>
          </Card.Content>
        </Card>
      ) : (
        <View style={{ gap: 10 }}>
          {groups.map((g) => (
            <Card key={g.data}>
              <Card.Content style={{ gap: 10 }}>
                <View style={styles.row}>
                  <Text variant="titleMedium" style={{ flex: 1 }} numberOfLines={1}>
                    {formatD(parseISO(g.data), 'EEE d MMM')}
                  </Text>
                  <Text style={{ fontWeight: '700' }}>€ {g.total.toFixed(2)}</Text>
                </View>
                <Divider />
                <View style={{ gap: 8 }}>
                  {g.items.map((s) => (
                    <Link key={s.id} href={{ pathname: '/spesa/[id]', params: { id: String(s.id) } }} asChild>
                      <Pressable style={styles.itemRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontWeight: '600' }}>
                            {labelCategoriaSpesa(s.tipo, language)} · € {s.importo.toFixed(2)}
                          </Text>
                          <Text style={{ opacity: 0.7 }} numberOfLines={1}>
                            {spesaSubtitle(s) || '—'}
                          </Text>
                        </View>
                        <Text style={{ opacity: 0.6 }}>→</Text>
                      </Pressable>
                    </Link>
                  ))}
                </View>
              </Card.Content>
            </Card>
          ))}
        </View>
      )}

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
    paddingBottom: 28,
    gap: 12,
  },
  resetFooter: {
    alignSelf: 'center',
    marginTop: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'space-between',
  },
  headerCenter: {
    flex: 1,
    minWidth: 160,
    alignItems: 'center',
  },
  headerTitle: {
    textAlign: 'center',
    textTransform: 'capitalize',
  },
  headerSub: {
    textAlign: 'center',
    opacity: 0.65,
    textTransform: 'capitalize',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
  },
});

