import { addDays, endOfMonth, format, isAfter, isBefore, parseISO, startOfMonth, subDays } from 'date-fns';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Dimensions, Easing, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { Badge, Button, Card, Divider, IconButton, Switch, Text, TextInput } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyboardSafeScroll } from '../../../components/KeyboardSafeScroll';
import { useAppLocale } from '../../../context/AppLocaleContext';
import type { GiornoInsert, GiornoTipo, SpesaRow } from '../../../db/database';
import {
  deleteGiornoByData,
  deleteSpeseByDate,
  getGiornoByData,
  getImpostazioniAll,
  listSpeseByDate,
  upsertGiorno,
} from '../../../db/database';
import {
  getDefaultGiornata,
  getExpectedWorkHours,
  getOreDefaultForDate,
  isWeekend,
  type OreDefaultsSettings,
} from '../../../utils/defaults';
import { mergeLuogoProgettoFromGiornoESpese } from '../../../utils/dayPlaceDefaults';
import { ensureDefaultLavoroDaysForMonth, oreSettingsFromImpostazioni } from '../../../utils/giorniMeseReport';
import { labelCategoriaSpesa } from '../../../utils/expenseCategories';
import { hoursFromNumber, parseHoursStateString, processHoursInput } from '../../../utils/halfHourHours';
import { numericKeyboardDismissProps } from '../../../utils/numericKeyboardProps';
import { screenHeaderPaddingTop } from '../../../utils/screenHeaderPadding';

/**
 * Sopravvive a un remount dopo `replace`: il ref del componente può azzerarsi prima del layout
 * del nuovo giorno, perdendo `enterFrom` se tenuto solo in React ref.
 */
let giornoSlidePending: { targetYmd: string; enterFromX: number } | null = null;

function spesaSubtitle(s: SpesaRow): string {
  if (s.tipo === 'km' && (s.percorso_da?.trim() || s.percorso_a?.trim())) {
    return `${s.percorso_da?.trim() ?? ''} → ${s.percorso_a?.trim() ?? ''}`.trim();
  }
  return (s.descrizione ?? '').trim();
}

export default function GiornoDettaglio() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ data?: string }>();
  const router = useRouter();
  const { formatD, messages, language } = useAppLocale();
  const data = params.data ?? '';

  const dateObj = useMemo(() => {
    try {
      return data ? parseISO(data) : null;
    } catch {
      return null;
    }
  }, [data]);

  const dayLabel = useMemo(
    () => (dateObj ? formatD(dateObj, 'EEEE d MMMM yyyy') : ''),
    [dateObj, formatD]
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [tipo, setTipo] = useState<GiornoTipo>('lavoro');
  const [ore, setOre] = useState<string>('0');
  const [oreTrasferta, setOreTrasferta] = useState<string>('0');
  const [orePermesso, setOrePermesso] = useState<string>('0');
  const [luogo, setLuogo] = useState<string>('');
  const [progetto, setProgetto] = useState<string>('');
  const [note, setNote] = useState<string>('');

  const [spese, setSpese] = useState<SpesaRow[]>([]);
  const [oreSettings, setOreSettings] = useState<OreDefaultsSettings>({});

  const oreManuallyAdjustedRef = useRef(false);
  const daySlideX = useRef(new Animated.Value(0)).current;
  /** Idle solo dopo ingresso giorno completato (evita reset translateX mentre entra una slide). */
  const daySlideIdleRef = useRef(true);
  /** Invalida timing di uscita sostituiti da swipe/tap più rapidi. */
  const exitSlideGenRef = useRef(0);
  /** Invalida timing di ingresso sostituiti da nuova navigazione sulla stessa istanza. */
  const enterSlideGenRef = useRef(0);

  const prevDayYmd = useMemo(() => {
    if (!dateObj) return null;
    const prev = subDays(dateObj, 1);
    if (isBefore(prev, startOfMonth(dateObj))) return null;
    return format(prev, 'yyyy-MM-dd');
  }, [dateObj]);

  const nextDayYmd = useMemo(() => {
    if (!dateObj) return null;
    const next = addDays(dateObj, 1);
    if (isAfter(next, endOfMonth(dateObj))) return null;
    return format(next, 'yyyy-MM-dd');
  }, [dateObj]);

  const meseKeyGiorno = useMemo(() => (dateObj ? format(dateObj, 'yyyy-MM') : ''), [dateObj]);

  const goToDay = useCallback(
    (ymd: string | null, direction: 'prev' | 'next') => {
      if (!ymd || saving) return;
      exitSlideGenRef.current += 1;
      enterSlideGenRef.current += 1;
      const exitGen = exitSlideGenRef.current;

      /** Swipe ravvicinati: interrompi slide precedente e riparti da centro (nessun mutex che esclude il secondo gesto). */
      daySlideX.stopAnimation();
      giornoSlidePending = null;
      daySlideX.setValue(0);
      daySlideIdleRef.current = false;

      const w = Dimensions.get('window').width;
      const slide = Math.min(280, Math.max(52, Math.round(w * 0.22)));
      /** Next: esce verso −X e il nuovo entra da +X. Prev: esce verso +X e il nuovo entra da −X. */
      const exitTo = direction === 'next' ? -slide : slide;
      const enterFrom = direction === 'next' ? slide : -slide;

      const EXIT_MS = 68;
      const easingOut = Easing.bezier(0.33, 0, 0.2, 1);

      Animated.timing(daySlideX, {
        toValue: exitTo,
        duration: EXIT_MS,
        easing: easingOut,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished || exitGen !== exitSlideGenRef.current) return;
        giornoSlidePending = { targetYmd: ymd, enterFromX: enterFrom };
        router.replace({ pathname: '/giorno/[data]', params: { data: ymd } });
      });
    },
    [router, saving, daySlideX]
  );

  useLayoutEffect(() => {
    const pend = giornoSlidePending;
    if (pend !== null && pend.targetYmd === data) {
      giornoSlidePending = null;
      daySlideX.stopAnimation();
      enterSlideGenRef.current += 1;
      const enterGen = enterSlideGenRef.current;
      daySlideIdleRef.current = false;
      daySlideX.setValue(pend.enterFromX);

      const ENTER_MS = 86;
      const easingOut = Easing.bezier(0.33, 0, 0.2, 1);

      Animated.timing(daySlideX, {
        toValue: 0,
        duration: ENTER_MS,
        easing: easingOut,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && enterGen === enterSlideGenRef.current) daySlideIdleRef.current = true;
      });
      return;
    }
    if (daySlideIdleRef.current) daySlideX.setValue(0);
  }, [data, daySlideX]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 1.22,
        onPanResponderRelease: (_, g) => {
          const quickPrev = g.vx != null && g.vx > 0.52;
          const quickNext = g.vx != null && g.vx < -0.52;
          if ((g.dx > 44 || quickPrev) && prevDayYmd) goToDay(prevDayYmd, 'prev');
          else if ((g.dx < -44 || quickNext) && nextDayYmd) goToDay(nextDayYmd, 'next');
        },
      }),
    [goToDay, nextDayYmd, prevDayYmd]
  );

  const readonlyReason = useMemo(() => {
    if (!dateObj) return messages.dayInvalidDateReason;
    const fest = getDefaultGiornata(dateObj, oreSettings);
    if (fest.tipo === 'festivita') return messages.dayHolidayReadonly(fest.nomeFestivita ?? '');
    if (isWeekend(dateObj)) return messages.dayWeekendReadonly;
    return null;
  }, [dateObj, messages, oreSettings]);

  const trasfertaSectionVisible = useMemo(() => {
    if (readonlyReason) return false;
    const t = parseHoursStateString(oreTrasferta);
    return (tipo === 'lavoro' || tipo === 'trasferta') && t > 0;
  }, [tipo, oreTrasferta, readonlyReason]);

  const trasfertaDetailsRequired = useMemo(() => {
    if (!trasfertaSectionVisible) return false;
    return parseHoursStateString(oreTrasferta) >= 1;
  }, [oreTrasferta, trasfertaSectionVisible]);

  const reload = useCallback(() => {
    if (!data || !dateObj) return () => {};
    let alive = true;
    setLoading(true);
    oreManuallyAdjustedRef.current = false;

    (async () => {
      const [g, sp, settings] = await Promise.all([
        getGiornoByData(data),
        listSpeseByDate(data),
        getImpostazioniAll(),
      ]);
      if (!alive) return;

      const oreSt = oreSettingsFromImpostazioni(settings);
      setOreSettings(oreSt);

      const def = getDefaultGiornata(dateObj, oreSt);
      const Hdef = getOreDefaultForDate(dateObj, oreSt);
      let tipoLoad: GiornoTipo = g?.tipo ?? (def.tipo === 'festivita' ? 'festivita' : def.tipo);
      let oreLoad = g ? String(g.ore) : String(def.ore);
      let orePermessoLoad = g ? String(g.ore_permesso ?? 0) : '0';

      if (g?.tipo === 'permesso') {
        const pCol = Number(g.ore_permesso ?? 0);
        if (pCol > 0) {
          tipoLoad = 'permesso';
          orePermessoLoad = String(pCol);
          oreLoad = String(g.ore ?? 0);
        } else {
          const legacyP = Number(g.ore ?? 0);
          if (legacyP > 0 && Hdef > 0 && legacyP < Hdef) {
            tipoLoad = 'lavoro';
            orePermessoLoad = String(legacyP);
            oreLoad = String(Math.max(0, Hdef - legacyP));
          } else if (legacyP >= Hdef && Hdef > 0) {
            tipoLoad = 'permesso';
            orePermessoLoad = String(legacyP);
            oreLoad = '0';
          } else {
            tipoLoad = 'permesso';
            orePermessoLoad = legacyP > 0 ? String(legacyP) : '0';
            oreLoad = '0';
          }
        }
      }

      setTipo(tipoLoad);
      setOre(hoursFromNumber(Number(oreLoad)));
      setOreTrasferta(hoursFromNumber(Number(g?.ore_trasferta ?? 0)));
      setOrePermesso(hoursFromNumber(Number(orePermessoLoad)));
      const { luogo: luogoMerged, progetto: progettoMerged } = mergeLuogoProgettoFromGiornoESpese(g ?? null, sp);
      setLuogo(luogoMerged);
      setProgetto(progettoMerged);
      setNote(g?.note ?? '');
      setSpese(sp);
    })()
      .catch(() => { /* noop */ })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [data, dateObj]);

  useFocusEffect(
    useCallback(() => {
      if (!data || !dateObj) return undefined;
      return reload();
    }, [data, dateObj, reload])
  );

  const openResetGiorno = useCallback(() => {
    if (!data || !dateObj || !meseKeyGiorno) return;
    Alert.alert(messages.resetDayTitle, messages.resetDayMessage, [
      { text: messages.resetCancel, style: 'cancel' },
      {
        text: messages.resetSoloPresenze,
        onPress: async () => {
          try {
            await deleteGiornoByData(data);
            const settings = await getImpostazioniAll();
            await ensureDefaultLavoroDaysForMonth(meseKeyGiorno, oreSettingsFromImpostazioni(settings));
            reload();
          } catch {
            Alert.alert(messages.errorTitle, messages.resetDayErrPresenze);
          }
        },
      },
      {
        text: messages.resetSoloSpese,
        onPress: async () => {
          try {
            await deleteSpeseByDate(data);
            reload();
          } catch {
            Alert.alert(messages.errorTitle, messages.resetDayErrSpese);
          }
        },
      },
      {
        text: messages.resetPresenzeESpese,
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteGiornoByData(data);
            await deleteSpeseByDate(data);
            const settings = await getImpostazioniAll();
            await ensureDefaultLavoroDaysForMonth(meseKeyGiorno, oreSettingsFromImpostazioni(settings));
            reload();
          } catch {
            Alert.alert(messages.errorTitle, messages.resetDayErr);
          }
        },
      },
    ]);
  }, [data, dateObj, meseKeyGiorno, reload, messages]);

  async function useCurrentLocation() {
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert(messages.permDeniedTitle, messages.permLocationBody);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`;

      try {
        const items = await Location.reverseGeocodeAsync(pos.coords);
        const first = items[0];
        const nice =
          first && (first.city || first.subregion || first.region)
            ? [first.city, first.subregion, first.region].filter(Boolean).join(', ')
            : coords;
        setLuogo(nice);
      } catch {
        setLuogo(coords);
      }
    } catch {
      Alert.alert(messages.errorTitle, messages.gpsFailedBody);
    }
  }

  function applyTipo(next: GiornoTipo) {
    setTipo(next);
    if (!dateObj) return;

    if (next === 'malattia' || next === 'ferie' || next === 'festivita' || next === 'weekend') {
      setOre('0');
      setOreTrasferta('0');
      setOrePermesso('0');
      setLuogo('');
      setProgetto('');
      return;
    }

    if (next === 'permesso') {
      setOre('0');
      setOreTrasferta('0');
      setLuogo('');
      setProgetto('');
      setOrePermesso((prev) =>
        parseHoursStateString(prev) === 0 ? hoursFromNumber(2) : hoursFromNumber(parseHoursStateString(prev))
      );
      return;
    }

    if (next === 'trasferta') {
      setOrePermesso('0');
      const H = getOreDefaultForDate(dateObj, oreSettings);
      const tStr = hoursFromNumber(H);
      setOreTrasferta(tStr);
      const T = parseHoursStateString(tStr);
      setOre(hoursFromNumber(Math.max(0, H - T)));
      oreManuallyAdjustedRef.current = false;
      return;
    }

    setOre(hoursFromNumber(getOreDefaultForDate(dateObj, oreSettings)));
    if (next === 'lavoro') {
      setOrePermesso('0');
      oreManuallyAdjustedRef.current = false;
    }
  }

  function onOrePermessoChange(t: string) {
    const nt = processHoursInput(t, { optional: true });
    if (!dateObj || readonlyReason) return;
    setOrePermesso(nt);

    if (parseHoursStateString(nt) === 0) {
      if (tipo === 'permesso') {
        setTipo('lavoro');
      }
      const H = getOreDefaultForDate(dateObj, oreSettings);
      const T = parseHoursStateString(oreTrasferta);
      const tasf = tipo === 'trasferta' || (tipo === 'lavoro' && T > 0) ? T : 0;
      oreManuallyAdjustedRef.current = false;
      setOre(hoursFromNumber(Math.max(0, H - tasf)));
      return;
    }

    const P = parseHoursStateString(nt);
    const H = getOreDefaultForDate(dateObj, oreSettings);
    const T = parseHoursStateString(oreTrasferta);
    const tasf = tipo === 'trasferta' || (tipo === 'lavoro' && T > 0) ? T : 0;

    if (tipo === 'permesso') {
      if (H > 0 && P < H) {
        setTipo('lavoro');
        oreManuallyAdjustedRef.current = false;
        setOre(hoursFromNumber(Math.max(0, H - tasf - P)));
      } else {
        setOre('0');
      }
      return;
    }

    if (tipo === 'lavoro' || tipo === 'trasferta') {
      setTipo('lavoro');
      if (!oreManuallyAdjustedRef.current) {
        setOre(hoursFromNumber(Math.max(0, H - tasf - P)));
      }
    }
  }

  function onFerieToggle(value: boolean) {
    if (!dateObj || readonlyReason) return;
    if (value) {
      applyTipo('ferie');
    } else {
      applyTipo('lavoro');
    }
  }

  function onMalattiaToggle(value: boolean) {
    if (!dateObj || readonlyReason) return;
    if (value) {
      applyTipo('malattia');
    } else {
      applyTipo('lavoro');
    }
  }

  function onWorkdayKindChange(v: 'lavoro' | 'trasferta') {
    if (!dateObj || readonlyReason) return;
    if (v === 'trasferta') {
      applyTipo('trasferta');
      return;
    }
    if (tipo === 'trasferta') {
      setTipo('lavoro');
      setOreTrasferta('0');
      setOrePermesso('0');
      setLuogo('');
      setProgetto('');
      setOre(hoursFromNumber(getOreDefaultForDate(dateObj, oreSettings)));
      oreManuallyAdjustedRef.current = false;
    }
  }

  function onOreTrasfertaChange(t: string) {
    const nt = processHoursInput(t, { optional: true });
    setOreTrasferta(nt);
    if (!dateObj || readonlyReason) return;
    const visible = tipo === 'trasferta' || tipo === 'lavoro';
    if (!visible || oreManuallyAdjustedRef.current) return;
    const H = getOreDefaultForDate(dateObj, oreSettings);
    const T = parseHoursStateString(nt);
    const P = parseHoursStateString(orePermesso);
    setOre(hoursFromNumber(Math.max(0, H - T - P)));
  }

  function collectOreWarnings(): string[] {
    if (!dateObj || readonlyReason) return [];
    if (tipo !== 'lavoro' && tipo !== 'trasferta') return [];
    const oreTrasfN = parseHoursStateString(oreTrasferta);
    const orePermN = parseHoursStateString(orePermesso);
    const trasfertaAttiva = tipo === 'trasferta' || (tipo === 'lavoro' && oreTrasfN > 0);
    const baseline = getExpectedWorkHours(dateObj, oreTrasfN, trasfertaAttiva, oreSettings, orePermN);
    const oreN = parseHoursStateString(ore);
    const H = getOreDefaultForDate(dateObj, oreSettings);
    const eps = 0.02;
    const msgs: string[] = [];
    const trasfertaLabel = trasfertaAttiva && oreTrasfN > 0 ? messages.dayOreCtxTrasferta(oreTrasfN) : '';
    const permessoLabel = orePermN > 0 ? messages.dayOreCtxPermesso(orePermN) : '';
    const parts = {
      oreN,
      baseline,
      H,
      travelCtx: trasfertaLabel,
      permessoCtx: permessoLabel,
    };
    if (oreN > baseline + eps) {
      msgs.push(messages.dayOreWarnOvertime(parts));
    }
    if (oreN < baseline - eps) {
      msgs.push(messages.dayOreWarnUndertime(parts));
    }
    return msgs;
  }

  async function commitSave() {
    if (!data || !dateObj) return;

    const oreN = parseHoursStateString(ore);
    const oreTrasfN = parseHoursStateString(oreTrasferta);
    const orePermN = parseHoursStateString(orePermesso);
    const trasferta = tipo === 'trasferta' || (tipo === 'lavoro' && oreTrasfN > 0) ? 1 : 0;
    const oreSave = tipo === 'lavoro' || tipo === 'trasferta' ? oreN : 0;
    const ore_permesso =
      tipo === 'lavoro' || tipo === 'permesso' ? (Number.isFinite(orePermN) && orePermN > 0 ? orePermN : 0) : 0;

    const payload: GiornoInsert = {
      data,
      tipo,
      ore: oreSave,
      trasferta,
      ore_trasferta: trasferta === 1 ? oreTrasfN : 0,
      ore_permesso,
      luogo: trasferta === 1 ? luogo.trim() || null : null,
      progetto: trasferta === 1 ? progetto.trim() || null : null,
      note: note.trim() || null,
    };

    setSaving(true);
    try {
      await upsertGiorno(payload);
      Alert.alert(messages.alertSaved, messages.daySavedBody);
    } catch {
      Alert.alert(messages.errorTitle, messages.daySaveFailed);
    } finally {
      setSaving(false);
    }
  }

  async function onSave() {
    if (!data || !dateObj) return;
    if (readonlyReason) {
      Alert.alert(messages.dayNotEditableTitle, readonlyReason);
      return;
    }

    const oreN = parseHoursStateString(ore);
    const oreTrasfN = parseHoursStateString(oreTrasferta);
    const trasferta = tipo === 'trasferta' || (tipo === 'lavoro' && oreTrasfN > 0) ? 1 : 0;

    if ((tipo === 'malattia' || tipo === 'ferie') && oreN !== 0) {
      Alert.alert(messages.errorTitle, messages.dayHoursMustBeZero);
      return;
    }

    if (trasferta === 1 && oreTrasfN >= 1) {
      if (!luogo.trim() || !progetto.trim()) {
        Alert.alert(messages.errorTitle, messages.dayTrasferMissingPlaceProject);
        return;
      }
    }

    const msgs = collectOreWarnings();
    if (msgs.length > 0) {
      Alert.alert(messages.dayHoursCheckTitle, msgs.join('\n\n'), [
        { text: messages.dayEditAction, style: 'cancel' },
        { text: messages.daySaveAnywayAction, onPress: () => void commitSave() },
      ]);
      return;
    }

    await commitSave();
  }

  return (
    <View style={styles.swipeRoot} {...panResponder.panHandlers}>
      <Animated.View style={[styles.daySlideWrap, { transform: [{ translateX: daySlideX }] }]}>
        <View style={[styles.dayStickyHeader, { paddingTop: screenHeaderPaddingTop(insets.top) }]}>
          <View style={styles.header}>
            <Button mode="text" onPress={() => router.back()}>
              {messages.exportBack}
            </Button>
            <IconButton
              icon="chevron-left"
              size={22}
              disabled={!prevDayYmd || Boolean(saving)}
              onPress={() => goToDay(prevDayYmd, 'prev')}
              accessibilityLabel={messages.dayPrevA11y}
            />
            <View style={styles.headerTitles}>
              <Text variant="titleLarge">{messages.dayScreenTitle}</Text>
              <Text style={{ opacity: 0.7 }} numberOfLines={2}>
                {dayLabel || data}
              </Text>
            </View>
            <IconButton
              icon="chevron-right"
              size={22}
              disabled={!nextDayYmd || Boolean(saving)}
              onPress={() => goToDay(nextDayYmd, 'next')}
              accessibilityLabel={messages.dayNextA11y}
            />
          </View>
        </View>

        <KeyboardSafeScroll keyboardAvoidingViewStyle={{ flex: 1 }} contentContainerStyle={styles.pageBody}>
      {readonlyReason ? (
        <Card>
          <Card.Content>
            <Text variant="titleMedium">{messages.dayNonModificabileBadge}</Text>
            <Text style={{ marginTop: 6, opacity: 0.75 }}>{readonlyReason}</Text>
          </Card.Content>
        </Card>
      ) : null}

      <Card>
        <Card.Content style={{ gap: 14 }}>
          <Text variant="titleMedium">{messages.dayPresenzeTitle}</Text>

          <View style={styles.hourRow}>
            <Text style={styles.hourLabel}>{messages.dayOreLavorate}</Text>
            <TextInput
              {...numericKeyboardDismissProps()}
              mode="outlined"
              dense
              style={styles.hourInput}
              keyboardType="decimal-pad"
              value={ore}
              disabled={Boolean(
                loading ||
                  readonlyReason !== null ||
                  (tipo !== 'lavoro' && tipo !== 'trasferta')
              )}
              onChangeText={(t) => {
                oreManuallyAdjustedRef.current = true;
                setOre(processHoursInput(t));
              }}
            />
          </View>

          <View style={styles.hourRow}>
            <Text style={styles.hourLabel}>{messages.dayOreTrasfertaRow}</Text>
            <View style={styles.hourInputCol}>
              <TextInput
                {...numericKeyboardDismissProps()}
                mode="outlined"
                dense
                style={styles.hourInput}
                placeholder={messages.dayOreTrasfertaPlaceholder}
                keyboardType="decimal-pad"
                value={parseHoursStateString(oreTrasferta) === 0 ? '' : oreTrasferta}
                disabled={Boolean(
                  loading ||
                    readonlyReason !== null ||
                    (tipo !== 'lavoro' && tipo !== 'trasferta')
                )}
                onChangeText={onOreTrasfertaChange}
              />
              {(tipo === 'lavoro' || tipo === 'trasferta') && !readonlyReason ? (
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>{messages.dayTipoTrasfertaFull}</Text>
                  <Switch
                    value={tipo === 'trasferta'}
                    onValueChange={(v) => onWorkdayKindChange(v ? 'trasferta' : 'lavoro')}
                    disabled={Boolean(loading)}
                  />
                </View>
              ) : null}
            </View>
          </View>

          {trasfertaSectionVisible ? (
            <View style={styles.trasfertaDetails}>
              <Text variant="titleSmall">{messages.dayTrasfertaDetailTitle}</Text>
              <View style={styles.row}>
                <TextInput
                  style={{ flex: 1 }}
                  mode="outlined"
                  dense
                  label={trasfertaDetailsRequired ? messages.dayLuogoObbligatorio : messages.dayLuogo}
                  value={luogo}
                  onChangeText={setLuogo}
                  disabled={Boolean(loading)}
                />
                <Button mode="outlined" onPress={useCurrentLocation} disabled={Boolean(loading)}>
                  {messages.dayGpsShort}
                </Button>
              </View>
              <TextInput
                mode="outlined"
                dense
                label={trasfertaDetailsRequired ? messages.dayProgettoObbligatorio : messages.dayProgetto}
                value={progetto}
                onChangeText={setProgetto}
                disabled={Boolean(loading)}
              />
            </View>
          ) : null}

          <View style={styles.hourRow}>
            <Text style={styles.hourLabel}>{messages.dayOreLeaveRow}</Text>
            <View style={styles.hourInputCol}>
              <TextInput
                {...numericKeyboardDismissProps()}
                mode="outlined"
                dense
                placeholder={messages.dayOrePermessoPlaceholder}
                keyboardType="decimal-pad"
                value={parseHoursStateString(orePermesso) === 0 ? '' : orePermesso}
                disabled={Boolean(
                  loading ||
                    readonlyReason !== null ||
                    tipo === 'ferie' ||
                    tipo === 'malattia' ||
                    tipo === 'trasferta'
                )}
                onChangeText={onOrePermessoChange}
              />
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>{messages.dayFerieInteraGiornata}</Text>
                <Switch
                  value={tipo === 'ferie'}
                  onValueChange={onFerieToggle}
                  disabled={Boolean(
                    loading ||
                      readonlyReason !== null ||
                      tipo === 'malattia' ||
                      tipo === 'trasferta'
                  )}
                />
              </View>
            </View>
          </View>

          <View style={styles.hourRow}>
            <Text style={styles.hourLabel}>{messages.dayMalattiaRow}</Text>
            <View style={[styles.hourInputCol, styles.switchRow]}>
              <Text style={styles.switchLabel}>{messages.dayMalattiaGiorno}</Text>
              <Switch
                value={tipo === 'malattia'}
                onValueChange={onMalattiaToggle}
                disabled={Boolean(
                  loading ||
                    readonlyReason !== null ||
                    tipo === 'ferie' ||
                    tipo === 'trasferta'
                )}
              />
            </View>
          </View>

          <Divider />

          <TextInput
            label={messages.dayNoteLabel}
            value={note}
            onChangeText={setNote}
            multiline
            disabled={Boolean(readonlyReason !== null || loading)}
          />

          <Button mode="contained" onPress={onSave} loading={Boolean(saving)} disabled={Boolean(loading || saving)}>
            {messages.daySalva}
          </Button>
        </Card.Content>
      </Card>

      <Card>
        <Card.Content style={{ gap: 10 }}>
          <View style={styles.row}>
            <Text variant="titleMedium" style={{ flex: 1 }}>
              {messages.daySpeseDelGiorno}
            </Text>
            <Badge>{spese.length}</Badge>
          </View>

          {spese.length === 0 ? (
            <Text style={{ opacity: 0.7 }}>{messages.dayNessunaSpesaGiorno}</Text>
          ) : (
            <View style={{ gap: 8 }}>
              {spese.map((s) => (
                <Link key={s.id} href={{ pathname: '/spesa/[id]', params: { id: String(s.id) } }} asChild>
                  <Pressable style={styles.spesaRow}>
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
          )}

          <Link href={{ pathname: '/spesa/[id]', params: { id: 'new', data } }} asChild>
            <Button mode="outlined">{messages.dayAggiungiSpesa}</Button>
          </Link>
        </Card.Content>
      </Card>

      <Button mode="outlined" onPress={openResetGiorno} disabled={Boolean(!data || !dateObj || loading)}>
        {messages.resetDayButton}
      </Button>
    </KeyboardSafeScroll>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  swipeRoot: {
    flex: 1,
    overflow: 'hidden',
  },
  daySlideWrap: {
    flex: 1,
  },
  dayStickyHeader: {
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  pageBody: { padding: 12, paddingTop: 8, paddingBottom: 28, gap: 12 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
    marginHorizontal: -4,
  },
  headerTitles: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hourRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  hourLabel: {
    width: 118,
    fontSize: 15,
    fontWeight: '600',
    opacity: 0.85,
  },
  hourInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
  },
  hourInputCol: {
    flex: 1,
    minWidth: 0,
    gap: 8,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 48,
  },
  switchLabel: { flex: 1, opacity: 0.75, fontSize: 14 },
  trasfertaDetails: {
    gap: 10,
    paddingLeft: 12,
    marginLeft: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#7c3aed',
  },
  spesaRow: {
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