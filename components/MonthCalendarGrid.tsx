import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import {
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text as RNText,
  View,
} from 'react-native';
import { Badge, Text, useTheme } from 'react-native-paper';

import { useAppLocale } from '../context/AppLocaleContext';
import type { GiornoRow } from '../db/database';
import type { OreDefaultsSettings } from '../utils/defaults';
import {
  buildCalendarCells,
  calendarCellBackground,
  splitCalendarRows,
  tipoToCalendarColor,
  ymdFromDate,
} from '../utils/homeMonthCalendar';
import { hapticSelection } from '../utils/haptics';

const GRID_BORDER_OUTER = 'rgba(99, 102, 241, 0.24)';
const GRID_BORDER_INNER = 'rgba(99, 102, 241, 0.14)';
const SPESA_BADGE_BG = 'rgba(99, 102, 241, 0.78)';
const COLUMN_SHELL_PAD_V = 2;

type Props = {
  currentMonth: Date;
  giorniByData: Record<string, GiornoRow>;
  speseCountByData: Record<string, number>;
  oreCalSettings: OreDefaultsSettings;
  dayRowHeight: number;
  onCalendarGridLayout: (e: LayoutChangeEvent) => void;
  /** Calendario stretto (rail web): celle più compatte */
  compact?: boolean;
};

export function MonthCalendarGrid({
  currentMonth,
  giorniByData,
  speseCountByData,
  oreCalSettings,
  dayRowHeight,
  onCalendarGridLayout,
  compact,
}: Props) {
  const router = useRouter();
  const theme = useTheme();
  const { messages } = useAppLocale();

  const cells = useMemo(
    () => buildCalendarCells(currentMonth, giorniByData, speseCountByData, oreCalSettings),
    [currentMonth, giorniByData, speseCountByData, oreCalSettings]
  );

  const calendarRows = useMemo(() => splitCalendarRows(cells), [cells]);
  const todayYmd = ymdFromDate(new Date());

  return (
    <View style={styles.calendar}>
      <View style={styles.gridFrame} onLayout={onCalendarGridLayout}>
        <View style={[styles.weekRow, styles.weekRowHeader]}>
          {messages.weekInitials.map((d, idx) => (
            <View key={`${d}-${idx}`} style={[styles.columnShell, idx === 6 ? styles.columnShellLast : null]}>
              <View style={[styles.weekHeaderCellWrap, compact && styles.weekHeaderCellWrapCompact]}>
                <Text style={[styles.weekHeaderCell, compact && styles.weekHeaderCellCompact]}>{d}</Text>
              </View>
            </View>
          ))}
        </View>

        {calendarRows.map((row, rowIdx) => {
          const cellInnerH = Math.max(1, dayRowHeight - COLUMN_SHELL_PAD_V * 2);
          return (
            <View
              key={`row-${rowIdx}`}
              style={[
                styles.weekRow,
                styles.weekRowBody,
                {
                  height: dayRowHeight,
                  minHeight: dayRowHeight,
                },
                rowIdx === calendarRows.length - 1 ? styles.weekRowLast : null,
              ]}
            >
              {row.map((c, colIdx) => {
                const isBlank = c.ymd.startsWith('blank-');
                if (isBlank) {
                  return (
                    <View key={c.ymd} style={[styles.columnShell, colIdx === 6 ? styles.columnShellLast : null]}>
                      <View style={[styles.cellShell, { height: cellInnerH }]}>
                        <View style={[styles.cell, styles.blankCell]} />
                      </View>
                    </View>
                  );
                }

                const fsRaw = Number(theme.fonts.titleMedium.fontSize);
                const fsBase = Number.isFinite(fsRaw) && fsRaw > 0 ? fsRaw : 16;
                const fs = compact ? Math.max(12, Math.round(fsBase * 0.88)) : fsBase;
                const dayLineHeight = Math.round(fs * (Platform.OS === 'android' ? 1.02 : 1.08));
                const isToday = c.ymd === todayYmd;

                return (
                  <View key={c.ymd} style={[styles.columnShell, colIdx === 6 ? styles.columnShellLast : null]}>
                    <View style={[styles.cellShell, { height: cellInnerH }]}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={
                          isToday
                            ? `${c.dayNumber}, ${c.ymd}, ${messages.homeTodayA11ySuffix}`
                            : `${c.dayNumber}, ${c.ymd}`
                        }
                        onPressIn={() => {
                          hapticSelection();
                        }}
                        onPress={() => router.push({ pathname: '/giorno/[data]', params: { data: c.ymd } })}
                        style={[
                          styles.cell,
                          {
                            backgroundColor: calendarCellBackground(
                              c,
                              theme.colors.primaryContainer,
                              tipoToCalendarColor
                            ),
                            height: cellInnerH,
                            borderColor: isToday ? theme.colors.primary : 'rgba(99, 102, 241, 0.1)',
                            borderWidth: isToday ? 2.5 : StyleSheet.hairlineWidth,
                          },
                        ]}
                      >
                        <View style={styles.cellCenterLayer} pointerEvents="box-none">
                          <View style={[styles.glyphSlot, compact && styles.glyphSlotCompact]}>
                            <RNText
                              style={[
                                styles.dayNumberNative,
                                Platform.OS === 'android'
                                  ? ({
                                      includeFontPadding: false,
                                      textAlignVertical: 'center',
                                    } as const)
                                  : null,
                                {
                                  fontSize: fs,
                                  lineHeight: dayLineHeight,
                                  color: theme.colors.onSurface,
                                  ...(Platform.OS === 'android' ? { transform: [{ translateX: 0.5 }] } : null),
                                },
                              ]}
                              maxFontSizeMultiplier={1.35}
                            >
                              {c.dayNumber}
                            </RNText>
                          </View>
                        </View>
                        {c.speseCount > 0 ? (
                          <Badge
                            size={compact ? 16 : 18}
                            style={[
                              styles.speseBadge,
                              compact && styles.speseBadgeCompact,
                              {
                                backgroundColor: SPESA_BADGE_BG,
                                color: theme.colors.onPrimary,
                              },
                            ]}
                          >
                            {String(c.speseCount)}
                          </Badge>
                        ) : null}
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  calendar: {
    width: '100%',
    alignSelf: 'stretch',
  },
  gridFrame: {
    marginTop: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GRID_BORDER_OUTER,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(250, 250, 252, 0.6)',
  },
  weekHeaderCellWrap: {
    flex: 1,
    width: '100%',
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  weekHeaderCellWrapCompact: {
    minHeight: 28,
  },
  weekHeaderCell: {
    textAlign: 'center',
    opacity: 0.78,
    fontWeight: '700',
    fontSize: 12,
  },
  weekHeaderCellCompact: {
    fontSize: 10,
  },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '100%',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: GRID_BORDER_INNER,
  },
  weekRowHeader: {
    backgroundColor: 'rgba(99, 102, 241, 0.06)',
  },
  weekRowBody: {
    alignItems: 'stretch',
  },
  weekRowLast: {
    borderBottomWidth: 0,
  },
  columnShell: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    alignSelf: 'stretch',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: GRID_BORDER_INNER,
    padding: 2,
  },
  columnShellLast: {
    borderRightWidth: 0,
  },
  cellShell: {
    width: '100%',
    alignSelf: 'stretch',
  },
  cell: {
    width: '100%',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(99, 102, 241, 0.1)',
    position: 'relative',
    overflow: 'visible',
  },
  cellCenterLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  glyphSlot: {
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  glyphSlotCompact: {
    width: 30,
    height: 30,
  },
  blankCell: {
    height: '100%',
    width: '100%',
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    borderWidth: 0,
  },
  dayNumberNative: {
    fontWeight: '700',
    textAlign: 'center',
    width: '100%',
    zIndex: 1,
  },
  speseBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    zIndex: 3,
  },
  speseBadgeCompact: {
    bottom: -4,
    right: -4,
  },
});
