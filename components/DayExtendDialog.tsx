import { addDays, format } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Button, Dialog, Portal, Text, TextInput } from 'react-native-paper';

import { HapticIconButton } from './HapticIconButton';
import type { Messages } from '../i18n/messages';
import {
  clampEndDate,
  countWorkingDaysInclusive,
  getNextWorkingDay,
  getPreviousWorkingDay,
  parseYmdOrNull,
  type DayExtendKind,
} from '../utils/giornoExtend';
import type { OreDefaultsSettings } from '../utils/defaults';

type Props = {
  visible: boolean;
  startYmd: string;
  startDate: Date;
  kind: DayExtendKind;
  oreSettings: OreDefaultsSettings;
  messages: Messages;
  formatDate: (d: Date, fmt: string) => string;
  onDismiss: () => void;
  onOnlyToday: () => void;
  onExtend: (endYmd: string) => void;
};

export function DayExtendDialog({
  visible,
  startYmd,
  startDate,
  kind,
  oreSettings,
  messages,
  formatDate,
  onDismiss,
  onOnlyToday,
  onExtend,
}: Props) {
  const minEndDate = useMemo(
    () => getNextWorkingDay(startDate, oreSettings),
    [startDate, oreSettings],
  );
  const maxEndDate = useMemo(() => addDays(startDate, 365), [startDate]);

  const [endDate, setEndDate] = useState(minEndDate);
  const [dateText, setDateText] = useState(format(minEndDate, 'yyyy-MM-dd'));

  useEffect(() => {
    if (!visible) return;
    setEndDate(minEndDate);
    setDateText(format(minEndDate, 'yyyy-MM-dd'));
  }, [visible, minEndDate]);

  const endYmd = format(endDate, 'yyyy-MM-dd');
  const dayCount = countWorkingDaysInclusive(startYmd, endYmd, oreSettings);

  const syncEndDate = (next: Date) => {
    const clamped = clampEndDate(next, minEndDate, maxEndDate);
    setEndDate(clamped);
    setDateText(format(clamped, 'yyyy-MM-dd'));
  };

  const onDateTextBlur = () => {
    const parsed = parseYmdOrNull(dateText);
    if (!parsed) {
      setDateText(format(endDate, 'yyyy-MM-dd'));
      return;
    }
    syncEndDate(parsed);
  };

  const canGoPrev = endDate.getTime() > minEndDate.getTime();
  const canGoNext = endDate.getTime() < maxEndDate.getTime();

  const bodyMessage =
    kind === 'ferie'
      ? messages.dayExtendMessageFerie
      : kind === 'malattia'
        ? messages.dayExtendMessageMalattia
        : kind === 'trasferta_full'
          ? messages.dayExtendMessageTrasfertaFull
          : messages.dayExtendMessageTrasferta8h;

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} dismissable>
        <Dialog.Title>{messages.dayExtendTitle}</Dialog.Title>
        <Dialog.Content style={styles.content}>
          <Text variant="bodyMedium" style={styles.message}>
            {bodyMessage}
          </Text>

          <Text variant="labelLarge" style={styles.dateLabel}>
            {messages.dayExtendEndDateLabel}
          </Text>

          <View style={styles.dateRow}>
            <HapticIconButton
              haptic="light"
              icon="chevron-left"
              size={22}
              disabled={!canGoPrev}
              onPress={() => syncEndDate(getPreviousWorkingDay(endDate, oreSettings))}
              accessibilityLabel={messages.dayPrevA11y}
            />
            <View style={styles.dateCenter}>
              {Platform.OS === 'web' ? (
                <input
                  type="date"
                  value={dateText}
                  min={format(minEndDate, 'yyyy-MM-dd')}
                  max={format(maxEndDate, 'yyyy-MM-dd')}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDateText(v);
                    const parsed = parseYmdOrNull(v);
                    if (parsed) syncEndDate(parsed);
                  }}
                  style={styles.webDateInput as object}
                />
              ) : (
                <TextInput
                  mode="outlined"
                  dense
                  value={dateText}
                  onChangeText={setDateText}
                  onBlur={onDateTextBlur}
                  placeholder="YYYY-MM-DD"
                  keyboardType="numbers-and-punctuation"
                  style={styles.dateInput}
                />
              )}
              <Text variant="bodySmall" style={styles.dateHint}>
                {formatDate(endDate, 'EEEE d MMMM yyyy')}
              </Text>
            </View>
            <HapticIconButton
              haptic="light"
              icon="chevron-right"
              size={22}
              disabled={!canGoNext}
              onPress={() => syncEndDate(getNextWorkingDay(endDate, oreSettings))}
              accessibilityLabel={messages.dayNextA11y}
            />
          </View>

          <Text variant="titleMedium" style={styles.counter}>
            {messages.dayExtendDayCount(dayCount)}
          </Text>
        </Dialog.Content>
        <Dialog.Actions style={styles.actions}>
          <Button onPress={onDismiss}>{messages.dayExtendCancel}</Button>
          <Button onPress={onOnlyToday}>{messages.dayExtendOnlyToday}</Button>
          <Button mode="contained" onPress={() => onExtend(endYmd)}>
            {messages.dayExtendConfirm}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12 },
  message: { opacity: 0.85 },
  dateLabel: { marginTop: 4 },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateCenter: { flex: 1, gap: 4 },
  dateInput: { backgroundColor: 'transparent' },
  dateHint: { opacity: 0.7, textAlign: 'center' },
  counter: { textAlign: 'center', marginTop: 4 },
  actions: { flexWrap: 'wrap', justifyContent: 'flex-end', gap: 4 },
  webDateInput: {},
});
