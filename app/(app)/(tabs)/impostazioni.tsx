import { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Button, Card, Divider, SegmentedButtons, Switch, Text, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyboardSafeScroll } from '../../../components/KeyboardSafeScroll';
import { useAppLocale } from '../../../context/AppLocaleContext';
import { getImpostazioniAll, setImpostazione } from '../../../db/database';
import { normalizeAppLanguage, type AppLanguage } from '../../../i18n/messages';
import { COMPANY_LOCKED } from '../../../utils/companyInfo';
import { DEFAULT_ORE_LUN_GIO, DEFAULT_ORE_VEN } from '../../../utils/defaults';
import { formatDdMmFromParts, parseFestivitaLocaliAbilitate } from '../../../utils/festivita';
import { findCapoluogoFestivitaInAddress } from '../../../utils/indirizzoCapoluogo';
import { getAppReleaseVersion } from '../../../utils/appVersion';
import { numericKeyboardDismissProps } from '../../../utils/numericKeyboardProps';
import { screenHeaderPaddingTop } from '../../../utils/screenHeaderPadding';

export default function ImpostazioniTab() {
  const insets = useSafeAreaInsets();
  const { messages, refreshLanguage } = useAppLocale();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [oreLunGio, setOreLunGio] = useState(String(DEFAULT_ORE_LUN_GIO));
  const [oreVen, setOreVen] = useState(String(DEFAULT_ORE_VEN));
  const [appLanguage, setAppLanguage] = useState<AppLanguage>('it');
  const [festivitaLocaliAbilitate, setFestivitaLocaliAbilitate] = useState(true);
  const [manualDdmm, setManualDdmm] = useState('');
  const [indirizzoAzienda, setIndirizzoAzienda] = useState<string>(COMPANY_LOCKED.address);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      const all = await getImpostazioniAll();
      if (!alive) return;
      setOreLunGio(all.ore_default_lun_gio ?? String(DEFAULT_ORE_LUN_GIO));
      setOreVen(all.ore_default_ven ?? String(DEFAULT_ORE_VEN));
      setAppLanguage(normalizeAppLanguage(all.app_language));
      const addr = String(all.indirizzo_azienda ?? '').trim() || COMPANY_LOCKED.address;
      setIndirizzoAzienda(addr);
      setFestivitaLocaliAbilitate(parseFestivitaLocaliAbilitate(all));
      setManualDdmm(String(all.festivita_locali_ddmm ?? '').trim());
    })()
      .catch(() => {
        // noop
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  function normalizeNumberString(input: string): string {
    const trimmed = input.replace(',', '.').trim();
    if (trimmed === '') return '0';
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n < 0) return '0';
    return String(n);
  }

  const appVersion = useMemo(() => getAppReleaseVersion(), []);

  const detectedCapoluogo = useMemo(
    () => findCapoluogoFestivitaInAddress(indirizzoAzienda),
    [indirizzoAzienda]
  );

  function sanitizeManualDdmmInput(t: string): string {
    const s = t.replace(/[^\d/]/g, '');
    const slash = s.indexOf('/');
    if (slash === -1) return s.slice(0, 2);
    const d = s.slice(0, slash).slice(0, 2);
    const mo = s.slice(slash + 1).replace(/\//g, '').slice(0, 2);
    return mo.length > 0 ? `${d}/${mo}` : `${d}/`;
  }

  const canSave = useMemo(() => !loading && !saving, [loading, saving]);

  async function onSave() {
    setSaving(true);
    try {
      await Promise.all([
        setImpostazione('azienda', COMPANY_LOCKED.name),
        setImpostazione('indirizzo_azienda', COMPANY_LOCKED.address),
        setImpostazione('cf_piva', COMPANY_LOCKED.cfPiva),
        setImpostazione('ore_default_lun_gio', normalizeNumberString(oreLunGio)),
        setImpostazione('ore_default_ven', normalizeNumberString(oreVen)),
        setImpostazione('app_language', appLanguage),
        setImpostazione('festivita_locali_abilitate', festivitaLocaliAbilitate ? '1' : '0'),
        setImpostazione('festivita_locali_ddmm', manualDdmm.trim()),
      ]);
      Alert.alert(messages.settingsSavedTitle, messages.settingsSavedBody);
      await refreshLanguage();
    } catch {
      Alert.alert(messages.errorTitle, messages.settingsSaveErr);
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardSafeScroll
      contentContainerStyle={[styles.page, { paddingTop: screenHeaderPaddingTop(insets.top) }]}
    >
      <Text variant="titleLarge">{messages.settingsTitle}</Text>

      <Card>
        <Card.Content style={{ gap: 12 }}>
          <Text variant="titleMedium">{messages.settingsLanguage}</Text>
          <View style={{ opacity: loading || saving ? 0.55 : 1 }} pointerEvents={loading || saving ? 'none' : 'auto'}>
            <SegmentedButtons
              value={appLanguage}
              onValueChange={(v) => setAppLanguage(v as AppLanguage)}
              buttons={[
                { value: 'it', label: messages.settingsLanguageIt },
                { value: 'en', label: messages.settingsLanguageEn },
              ]}
            />
          </View>
          <Text style={{ opacity: 0.65, fontSize: 13 }}>{messages.settingsLanguageHint}</Text>
        </Card.Content>
      </Card>

      <Card>
        <Card.Content style={{ gap: 12 }}>
          <Text variant="titleMedium">{messages.settingsDefaultHoursTitle}</Text>
          <Text style={{ opacity: 0.7 }}>{messages.settingsDefaultHoursHint}</Text>
          <View style={styles.row}>
            <TextInput
              style={{ flex: 1 }}
              label={messages.settingsOreLunGio}
              {...numericKeyboardDismissProps()}
              keyboardType="decimal-pad"
              value={oreLunGio}
              onChangeText={(t) => setOreLunGio(normalizeNumberString(t))}
              disabled={loading || saving}
            />
            <TextInput
              style={{ flex: 1 }}
              label={messages.settingsOreVen}
              {...numericKeyboardDismissProps()}
              keyboardType="decimal-pad"
              value={oreVen}
              onChangeText={(t) => setOreVen(normalizeNumberString(t))}
              disabled={loading || saving}
            />
          </View>
        </Card.Content>
      </Card>

      <Card>
        <Card.Content style={{ gap: 12 }}>
          <Text variant="titleMedium">{messages.settingsLocalHolidaysTitle}</Text>
          <Text style={{ opacity: 0.7 }}>{messages.settingsLocalHolidaysHint}</Text>
          <View style={[styles.row, { justifyContent: 'space-between', alignItems: 'center' }]}>
            <Text style={{ flex: 1, paddingRight: 12 }}>{messages.settingsLocalHolidaysSwitchLabel}</Text>
            <Switch
              value={festivitaLocaliAbilitate}
              onValueChange={setFestivitaLocaliAbilitate}
              disabled={loading || saving}
            />
          </View>
          {festivitaLocaliAbilitate && detectedCapoluogo ? (
            <Text style={{ opacity: 0.78, fontSize: 13, lineHeight: 19 }}>
              {messages.settingsLocalHolidaysAutoDetected(
                detectedCapoluogo.comune,
                detectedCapoluogo.nome,
                formatDdMmFromParts({ mese: detectedCapoluogo.mese, giorno: detectedCapoluogo.giorno })
              )}
            </Text>
          ) : null}
          {festivitaLocaliAbilitate && !detectedCapoluogo ? (
            <>
              <Text style={{ opacity: 0.72, fontSize: 13, lineHeight: 19 }}>
                {messages.settingsLocalHolidaysManualPrompt}
              </Text>
              <TextInput
                mode="outlined"
                label={messages.settingsLocalHolidaysManualLabel}
                placeholder={messages.settingsLocalHolidaysManualPlaceholder}
                value={manualDdmm}
                onChangeText={(t) => setManualDdmm(sanitizeManualDdmmInput(t))}
                {...numericKeyboardDismissProps()}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                disabled={loading || saving}
              />
            </>
          ) : null}
          <Text style={{ opacity: 0.62, fontSize: 12, lineHeight: 17 }}>{messages.settingsLocalHolidaysDisclaimer}</Text>
        </Card.Content>
      </Card>

      <Button mode="contained" onPress={onSave} loading={saving} disabled={!canSave}>
        {messages.settingsSaveButton}
      </Button>

      <Card style={styles.aboutCard}>
        <Card.Content style={{ gap: 10 }}>
          <Text variant="titleMedium">{messages.settingsAboutTitle}</Text>
          <Text style={styles.aboutMuted}>{messages.settingsAboutSubtitle}</Text>
          <Text style={styles.aboutMuted}>{messages.settingsAboutAuthor}</Text>
          <Text style={styles.aboutMuted}>{messages.settingsAboutVersion(appVersion)}</Text>
          <Text style={styles.aboutMuted}>{messages.settingsAboutRelease}</Text>
          <Text style={styles.aboutMuted}>{messages.settingsAboutChannel}</Text>
          <Divider style={{ marginVertical: 4 }} />
          <Text variant="titleSmall" style={styles.aboutPrivacyTitle}>
            {messages.settingsAboutPrivacyTitle}
          </Text>
          <Text style={styles.aboutPrivacyBody}>{messages.settingsAboutPrivacyBody}</Text>
        </Card.Content>
      </Card>
    </KeyboardSafeScroll>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: 12,
    paddingBottom: 28,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  aboutCard: {
    opacity: 0.95,
  },
  aboutMuted: {
    fontSize: 13,
    lineHeight: 19,
    opacity: 0.72,
  },
  aboutPrivacyTitle: {
    marginTop: 2,
    opacity: 0.88,
  },
  aboutPrivacyBody: {
    fontSize: 12,
    lineHeight: 18,
    opacity: 0.68,
  },
});
