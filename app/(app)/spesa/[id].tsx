import { format, parseISO } from 'date-fns';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Card, Divider, Switch, Text, TextInput } from 'react-native-paper';

import { HapticButton } from '../../../components/HapticButton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyboardSafeScroll } from '../../../components/KeyboardSafeScroll';
import { useAppLocale } from '../../../context/AppLocaleContext';
import type { CategoriaSpesa, SpesaInsert, SpesaRow, SpesaUpdate } from '../../../db/database';
import {
  createSpesa,
  deleteSpesaById,
  getGiornoByData,
  getImpostazioniAll,
  getSpesaById,
  listSpeseByDate,
  updateSpesa,
} from '../../../db/database';
import { mergeLuogoProgettoFromGiornoESpese } from '../../../utils/dayPlaceDefaults';
import { hapticSelection } from '../../../utils/haptics';
import { parseMoneyAmount, sanitizeDecimalTyping } from '../../../utils/decimalInput';
import { numericKeyboardDismissProps } from '../../../utils/numericKeyboardProps';
import { speseUiGroups } from '../../../utils/expenseCategories';
import { useAttachmentPreviewUri } from '../../../hooks/useAttachmentPreviewUri';
import { isProbablyImagePath, persistPickedFile } from '../../../utils/spesaAttachments';
import { humanLocationLabelFromCoords } from '../../../utils/locationHumanLabel';
import { screenHeaderPaddingTop } from '../../../utils/screenHeaderPadding';
import { appAlert } from '../../../utils/appAlert';

/** Palette unica per le categorie (solo enfasi sulla selezione). */
const CAT_STYLE = {
  bg: '#fafafa',
  bgSel: '#f0f0f3',
  border: '#e0e0e6',
  borderSel: '#6366f1',
  text: '#52525b',
  textSel: '#3730a3',
} as const;

function profileHasKmCar(modello: string, eurPerKmStr: string): boolean {
  if (!(modello ?? '').trim()) return false;
  const e = parseMoneyAmount(String(eurPerKmStr ?? '0'));
  return Number.isFinite(e) && e > 0;
}

export default function SpesaDettaglio() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { formatD, messages, language } = useAppLocale();
  const params = useLocalSearchParams<{ id?: string; data?: string }>();
  const idParam = params.id ?? '';
  const isNew = idParam === 'new' || idParam === '';
  const existingId = !isNew ? Number(idParam) : null;

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  const initialDate = useMemo(() => {
    if (typeof params.data === 'string' && params.data) return params.data;
    return format(new Date(), 'yyyy-MM-dd');
  }, [params.data]);

  const [data, setData] = useState<string>(initialDate);
  const [tipo, setTipo] = useState<CategoriaSpesa>('varie');
  const [localita, setLocalita] = useState('');
  const [progetto, setProgetto] = useState('');
  const [importo, setImporto] = useState<string>('0');
  const [descrizione, setDescrizione] = useState<string>('');
  const [valuta, setValuta] = useState<string>('EUR');

  const [km, setKm] = useState<string>('0');
  const [eurPerKm, setEurPerKm] = useState<string>('0');
  const [modelloAuto, setModelloAuto] = useState<string>('');
  const [percorsoDa, setPercorsoDa] = useState<string>('');
  const [percorsoA, setPercorsoA] = useState<string>('');
  const [fotoPath, setFotoPath] = useState<string | null>(null);
  const attachmentPreviewUri = useAttachmentPreviewUri(fotoPath);
  const [picking, setPicking] = useState(false);

  const [profileKmModel, setProfileKmModel] = useState('');
  const [profileKmEur, setProfileKmEur] = useState('0');
  const [useSavedProfileCar, setUseSavedProfileCar] = useState(false);
  const userToggledOffSavedCar = useRef(false);

  const profileHasSavedCar = useMemo(
    () => profileHasKmCar(profileKmModel, profileKmEur),
    [profileKmModel, profileKmEur],
  );

  const gruppiSpesa = useMemo(() => speseUiGroups(language, messages), [language, messages]);

  const headerSubtitle = useMemo(() => {
    try {
      const d = parseISO(data);
      return formatD(d, 'EEEE d MMMM yyyy');
    } catch {
      return data;
    }
  }, [data, formatD]);

  useEffect(() => {
    if (isNew || !existingId) return;
    let alive = true;
    setLoading(true);
    (async () => {
      const [row, settings] = await Promise.all([getSpesaById(existingId), getImpostazioniAll()]);
      if (!alive) return;
      if (!row) {
        appAlert(messages.expNonTrovataTitle, messages.expNonTrovataBody);
        router.back();
        return;
      }
      hydrate(row);
      const pm = (settings.modello_auto ?? '').trim();
      const pe = settings.eur_per_km ?? '0';
      setProfileKmModel(pm);
      setProfileKmEur(pe);
      const has = profileHasKmCar(pm, pe);
      if (has) {
        const rowModel = (row.modello_auto ?? '').trim();
        const rowEur = parseMoneyAmount(String(row.eur_per_km ?? 0));
        const profEur = parseMoneyAmount(pe);
        const match =
          rowModel === pm &&
          Number.isFinite(rowEur) &&
          Number.isFinite(profEur) &&
          Math.abs(rowEur - profEur) < 0.00001;
        setUseSavedProfileCar(match);
        userToggledOffSavedCar.current = !match;
      } else {
        setUseSavedProfileCar(false);
        userToggledOffSavedCar.current = false;
      }
    })()
      .catch(() => {
        appAlert(messages.errorTitle, messages.expLoadErrBody);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, existingId]);

  useEffect(() => {
    if (!isNew) return;
    let alive = true;
    (async () => {
      const settings = await getImpostazioniAll();
      if (!alive) return;
      const pm = (settings.modello_auto ?? '').trim();
      const pe = settings.eur_per_km ?? '0';
      setProfileKmModel(pm);
      setProfileKmEur(pe);
    })().catch(() => {
      // noop
    });
    return () => {
      alive = false;
    };
  }, [isNew]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void getImpostazioniAll().then((s) => {
        if (cancelled) return;
        setProfileKmModel((s.modello_auto ?? '').trim());
        setProfileKmEur(s.eur_per_km ?? '0');
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  useEffect(() => {
    if (!isNew) return;
    let alive = true;
    (async () => {
      const [giorno, speseGiorno] = await Promise.all([getGiornoByData(data), listSpeseByDate(data)]);
      if (!alive) return;
      const { luogo, progetto: prjFromDay } = mergeLuogoProgettoFromGiornoESpese(giorno, speseGiorno);
      setLocalita((prev) => (prev.trim() ? prev : luogo));
      setProgetto((prev) => (prev.trim() ? prev : prjFromDay));
    })().catch(() => {
      // noop
    });
    return () => {
      alive = false;
    };
  }, [isNew, data]);

  function hydrate(row: SpesaRow) {
    setData(row.data);
    setTipo(row.tipo);
    setImporto(String(row.importo));
    setValuta(row.valuta || 'EUR');
    setDescrizione(row.descrizione ?? '');
    setKm(String(row.km ?? 0));
    setEurPerKm(String(row.eur_per_km ?? 0));
    setModelloAuto(row.modello_auto ?? '');
    setPercorsoDa(row.percorso_da ?? '');
    setPercorsoA(row.percorso_a ?? '');
    setLocalita(row.localita ?? '');
    setProgetto(row.progetto ?? '');
    setFotoPath(row.foto_path ?? null);
  }

  async function fillFromGps() {
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        appAlert(messages.permDeniedTitle, messages.permLocationBody);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const label = await humanLocationLabelFromCoords(pos.coords);
      setLocalita(label);
    } catch {
      appAlert(messages.errorTitle, messages.gpsFailedBody);
    }
  }

  const computedImportoKm = useMemo(() => {
    if (tipo !== 'km') return null;
    const k = Number(km.replace(',', '.').trim() || 0);
    const eParsed = Number(eurPerKm.replace(',', '.').trim() || 0);
    if (!Number.isFinite(k) || !Number.isFinite(eParsed)) return null;
    return Math.round(k * eParsed * 100) / 100;
  }, [tipo, km, eurPerKm]);

  useEffect(() => {
    if (!profileHasSavedCar) {
      setUseSavedProfileCar(false);
    }
  }, [profileHasSavedCar]);

  useEffect(() => {
    if (tipo !== 'km' || !useSavedProfileCar) return;
    if (!profileHasKmCar(profileKmModel, profileKmEur)) return;
    setModelloAuto(profileKmModel);
    setEurPerKm(profileKmEur);
  }, [tipo, useSavedProfileCar, profileKmModel, profileKmEur]);

  useEffect(() => {
    if (!isNew || tipo !== 'km') return;
    if (userToggledOffSavedCar.current) return;
    if (!profileHasKmCar(profileKmModel, profileKmEur)) return;
    const emptyish =
      !modelloAuto.trim() && (eurPerKm.trim() === '' || eurPerKm.trim() === '0' || eurPerKm.trim() === '0.0');
    if (emptyish) {
      setUseSavedProfileCar(true);
      setModelloAuto(profileKmModel);
      setEurPerKm(profileKmEur);
    }
  }, [isNew, tipo, profileKmModel, profileKmEur, modelloAuto, eurPerKm]);

  function applyTipo(next: CategoriaSpesa) {
    setTipo(next);
    if (next === 'km' && profileHasKmCar(profileKmModel, profileKmEur)) {
      userToggledOffSavedCar.current = false;
      setUseSavedProfileCar(true);
      setModelloAuto(profileKmModel);
      setEurPerKm(profileKmEur);
    }
  }

  function onToggleSavedProfileCar(value: boolean) {
    hapticSelection();
    if (!profileHasSavedCar) return;
    if (!value) userToggledOffSavedCar.current = true;
    else userToggledOffSavedCar.current = false;
    setUseSavedProfileCar(value);
    if (value) {
      setModelloAuto(profileKmModel);
      setEurPerKm(profileKmEur);
    }
  }

  useEffect(() => {
    if (tipo === 'km' && computedImportoKm !== null) {
      setImporto(String(computedImportoKm));
    }
  }, [tipo, computedImportoKm]);

  async function pickFromGallery() {
    if (loading || saving || picking) return;
    setPicking(true);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        appAlert(messages.permDeniedTitle, messages.permGalleryBody);
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        quality: 0.85,
      });
      if (res.canceled || !res.assets?.[0]?.uri) return;
      const dest = await persistPickedFile(res.assets[0].uri, res.assets[0].fileName ?? null);
      setFotoPath(dest);
    } catch {
      appAlert(messages.errorTitle, messages.genericImageImportErr);
    } finally {
      setPicking(false);
    }
  }

  async function pickFromCamera() {
    if (loading || saving || picking) return;
    setPicking(true);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        appAlert(messages.permDeniedTitle, messages.permCameraBody);
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.85,
      });
      if (res.canceled || !res.assets?.[0]?.uri) return;
      const dest = await persistPickedFile(res.assets[0].uri, 'camera.jpg');
      setFotoPath(dest);
    } catch {
      appAlert(messages.errorTitle, messages.genericPhotoCaptureErr);
    } finally {
      setPicking(false);
    }
  }

  async function pickFromFiles() {
    if (loading || saving || picking) return;
    setPicking(true);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf', '*/*'],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const a = res.assets[0];
      const uri = a.uri;
      const dest = await persistPickedFile(uri, a.name ?? null);
      setFotoPath(dest);
    } catch {
      appAlert(messages.errorTitle, messages.genericDocImportErr);
    } finally {
      setPicking(false);
    }
  }

  function removeAttachment() {
    setFotoPath(null);
  }

  async function onSave() {
    const importoN = parseMoneyAmount(importo);
    if (!data.trim()) {
      appAlert(messages.errorTitle, messages.expMissingDate);
      return;
    }
    let kmN: number | null = null;
    let eurN: number | null = null;
    if (tipo === 'km') {
      if (!percorsoDa.trim() || !percorsoA.trim()) {
        appAlert(messages.errorTitle, messages.expKmMissingItinerary);
        return;
      }
      kmN = parseMoneyAmount(km);
      eurN = parseMoneyAmount(eurPerKm);
      if (!Number.isFinite(kmN) || kmN <= 0 || !Number.isFinite(eurN) || eurN <= 0) {
        appAlert(messages.expInvalidAmountTitle, messages.expInvalidAmountBody);
        return;
      }
    }
    if (!localita.trim() || !progetto.trim()) {
      appAlert(messages.errorTitle, messages.expMissingLocationProject);
      return;
    }
    if (!Number.isFinite(importoN) || importoN <= 0) {
      appAlert(messages.expInvalidAmountTitle, messages.expInvalidAmountBody);
      return;
    }

    setSaving(true);
    try {
      if (isNew) {
        const payload: SpesaInsert = {
          data: data.trim(),
          tipo,
          importo: importoN,
          valuta: valuta.trim() || 'EUR',
          descrizione: descrizione.trim() || null,
          fornitore: null,
          foto_path: fotoPath,
          km: kmN,
          eur_per_km: eurN,
          modello_auto: tipo === 'km' ? modelloAuto.trim() || null : null,
          percorso_da: tipo === 'km' ? percorsoDa.trim() || null : null,
          percorso_a: tipo === 'km' ? percorsoA.trim() || null : null,
          localita: localita.trim(),
          progetto: progetto.trim(),
        };
        await createSpesa(payload);
        appAlert(messages.expInsertedTitle, messages.expInsertedBody);
        router.back();
      } else if (existingId) {
        const payload: SpesaUpdate = {
          id: existingId,
          data: data.trim(),
          tipo,
          importo: importoN,
          valuta: valuta.trim() || 'EUR',
          descrizione: descrizione.trim() || null,
          fornitore: null,
          km: kmN,
          eur_per_km: eurN,
          modello_auto: tipo === 'km' ? modelloAuto.trim() || null : null,
          percorso_da: tipo === 'km' ? percorsoDa.trim() || null : null,
          percorso_a: tipo === 'km' ? percorsoA.trim() || null : null,
          foto_path: fotoPath,
          localita: localita.trim(),
          progetto: progetto.trim(),
        };
        await updateSpesa(payload);
        appAlert(messages.expUpdatedTitle, messages.expUpdatedBody);
        router.back();
      }
    } catch {
      appAlert(messages.errorTitle, messages.expSavedErr);
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!existingId) return;
    appAlert(messages.expEliminaDomandaTitle, messages.expEliminaDomandaBody, [
      { text: messages.resetCancel, style: 'cancel' },
      {
        text: messages.expEliminaSi,
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteSpesaById(existingId);
            router.back();
          } catch {
            appAlert(messages.errorTitle, messages.expDeleteErr);
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.screenRoot}>
      <View
        style={[styles.stickyHeader, { paddingTop: screenHeaderPaddingTop(insets.top) }]}
        accessibilityRole="header"
      >
        <View style={styles.header}>
          <HapticButton mode="text" onPress={() => router.back()}>
            {messages.exportBack}
          </HapticButton>
          <View style={{ flex: 1 }}>
            <Text variant="titleLarge">{isNew ? messages.expNewTitle : messages.expEditTitle}</Text>
            <Text style={{ opacity: 0.7 }}>{headerSubtitle}</Text>
          </View>
        </View>
      </View>

      <KeyboardSafeScroll keyboardAvoidingViewStyle={{ flex: 1 }} contentContainerStyle={styles.pageBody}>
      <Card>
        <Card.Content style={{ gap: 12 }}>
          <Text variant="titleMedium">{messages.expDettagliSection}</Text>

          <TextInput
            label={messages.expDateLabel}
            value={data}
            onChangeText={setData}
            disabled={loading || saving}
          />

          <Text variant="titleSmall" style={styles.sectionLabel}>
            {messages.expCategoriaTitolo}
          </Text>
          <View style={{ gap: 16 }}>
            {gruppiSpesa.map((group) => (
              <View key={group.title} style={{ gap: 8 }}>
                <Text style={styles.catGroupTitle}>{group.title}</Text>
                <View style={styles.catGrid}>
                  {group.items.map((c) => {
                    const sel = tipo === c.value;
                    return (
                      <Pressable
                        key={c.value}
                        onPressIn={() => {
                          hapticSelection();
                        }}
                        onPress={() => !loading && !saving && applyTipo(c.value)}
                        disabled={loading || saving}
                        style={({ pressed }) => [
                          styles.catCard,
                          {
                            justifyContent: 'center',
                            alignItems: 'center',
                            backgroundColor: sel ? CAT_STYLE.bgSel : CAT_STYLE.bg,
                            borderColor: sel ? CAT_STYLE.borderSel : CAT_STYLE.border,
                            borderWidth: sel ? 2 : 1,
                            opacity: pressed ? 0.9 : 1,
                          },
                        ]}
                      >
                        <Text style={[styles.catCardLabel, { color: sel ? CAT_STYLE.textSel : CAT_STYLE.text }]}>
                          {c.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>

          <View style={styles.row}>
            <TextInput
              style={{ flex: 1 }}
              mode="outlined"
              dense
              label={messages.expLocalitaObbl}
              value={localita}
              onChangeText={setLocalita}
              disabled={loading || saving}
            />
            <HapticButton
              mode="outlined"
              icon="map-marker"
              onPress={fillFromGps}
              disabled={loading || saving}
            >
              {messages.dayGpsShort}
            </HapticButton>
          </View>
          <TextInput
            mode="outlined"
            dense
            label={messages.expProgettoObbl}
            value={progetto}
            onChangeText={setProgetto}
            disabled={loading || saving}
          />

          <View style={styles.row}>
            <TextInput
              style={{ flex: 1 }}
              label={messages.expImporto}
              {...numericKeyboardDismissProps()}
              keyboardType="decimal-pad"
              value={importo}
              onChangeText={(t) => setImporto(sanitizeDecimalTyping(t, 2))}
              disabled={loading || saving || tipo === 'km'}
            />
            <TextInput
              style={{ width: 90 }}
              label={messages.expValuta}
              value={valuta}
              onChangeText={setValuta}
              disabled={loading || saving}
            />
          </View>

          <TextInput
            label={messages.expDescrizione}
            value={descrizione}
            onChangeText={setDescrizione}
            disabled={loading || saving}
          />

          {tipo === 'km' ? (
            <View style={{ gap: 10 }}>
              <Divider />
              <Text variant="titleSmall">{messages.expKmSectionTitle}</Text>
              <View style={styles.row}>
                <TextInput
                  style={{ flex: 1 }}
                  mode="outlined"
                  dense
                  label={messages.expKmDa}
                  value={percorsoDa}
                  onChangeText={setPercorsoDa}
                  disabled={loading || saving}
                />
                <TextInput
                  style={{ flex: 1 }}
                  mode="outlined"
                  dense
                  label={messages.expKmA}
                  value={percorsoA}
                  onChangeText={setPercorsoA}
                  disabled={loading || saving}
                />
              </View>
              <TextInput
                label={messages.expKmField}
                {...numericKeyboardDismissProps()}
                keyboardType="decimal-pad"
                value={km}
                onChangeText={(t) => setKm(sanitizeDecimalTyping(t, 2))}
                disabled={loading || saving}
              />
              <View style={styles.savedCarRow}>
                <View style={styles.savedCarTextCol}>
                  <Text variant="bodyMedium">{messages.expKmSavedCarToggle}</Text>
                  <Text style={styles.savedCarHint}>
                    {profileHasSavedCar ? messages.expKmSavedCarHint : messages.expKmSavedCarUnavailable}
                  </Text>
                </View>
                <Switch
                  value={useSavedProfileCar}
                  onValueChange={onToggleSavedProfileCar}
                  disabled={loading || saving || !profileHasSavedCar}
                />
              </View>
              <TextInput
                label={messages.expKmEurKm}
                {...numericKeyboardDismissProps()}
                keyboardType="decimal-pad"
                value={eurPerKm}
                onChangeText={(t) => setEurPerKm(sanitizeDecimalTyping(t, 2))}
                disabled={loading || saving || useSavedProfileCar}
              />
              <TextInput
                label={messages.expKmModello}
                value={modelloAuto}
                onChangeText={setModelloAuto}
                disabled={loading || saving || useSavedProfileCar}
              />
              <Text style={{ opacity: 0.75 }}>
                {messages.expKmComputed} € {(computedImportoKm ?? 0).toFixed(2)}
              </Text>
            </View>
          ) : null}

          <Divider />
          <Text variant="titleSmall" style={styles.sectionLabel}>
            {messages.expDocSection}
          </Text>
          <Text style={{ opacity: 0.65, fontSize: 13 }}>{messages.expDocHint}</Text>
          <View style={styles.rowWrap}>
            {Platform.OS !== 'web' ? (
              <HapticButton mode="outlined" icon="camera-outline" onPress={pickFromCamera} disabled={loading || saving || picking}>
                {messages.expFotocamera}
              </HapticButton>
            ) : null}
            <HapticButton mode="outlined" icon="image-outline" onPress={pickFromGallery} disabled={loading || saving || picking}>
              {messages.expGalleria}
            </HapticButton>
            <HapticButton mode="outlined" icon="file-document-outline" onPress={pickFromFiles} disabled={loading || saving || picking}>
              {messages.expFile}
            </HapticButton>
            {fotoPath ? (
              <HapticButton mode="text" onPress={removeAttachment} disabled={loading || saving || picking} textColor="#b91c1c">
                {messages.expRimuovi}
              </HapticButton>
            ) : null}
          </View>
          {fotoPath && isProbablyImagePath(fotoPath) && attachmentPreviewUri ? (
            <Image
              source={{ uri: attachmentPreviewUri }}
              style={styles.preview}
              resizeMode="contain"
            />
          ) : fotoPath ? (
            <Text style={{ opacity: 0.8 }} numberOfLines={2}>
              {messages.expAllegatoLabel} {fotoPath.split('/').pop()}
            </Text>
          ) : null}

          <HapticButton mode="contained" onPress={onSave} loading={saving} disabled={loading || saving || picking}>
            {messages.daySalva}
          </HapticButton>

          {!isNew ? (
            <HapticButton mode="outlined" onPress={onDelete} disabled={loading || saving} textColor="#b91c1c">
              {messages.expEliminaSi}
            </HapticButton>
          ) : null}
        </Card.Content>
      </Card>
    </KeyboardSafeScroll>
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
  pageBody: {
    padding: 12,
    paddingTop: 8,
    paddingBottom: 28,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionLabel: {
    marginTop: 4,
    opacity: 0.75,
    fontWeight: '600',
  },
  catGroupTitle: {
    fontSize: 13,
    fontWeight: '700',
    opacity: 0.72,
  },
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  catCard: {
    width: '47%',
    flexGrow: 1,
    minWidth: 140,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  catCardLabel: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  savedCarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 4,
  },
  savedCarTextCol: {
    flex: 1,
    paddingRight: 8,
  },
  savedCarHint: {
    opacity: 0.72,
    fontSize: 12,
    marginTop: 4,
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  preview: {
    width: '100%',
    height: 180,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
  },
});
