import { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, StyleSheet } from 'react-native';
import { Button, Card, Divider, Text, TextInput, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyboardSafeScroll } from '../../../components/KeyboardSafeScroll';
import { AciCostikmProfileSection } from '../../../components/AciCostikmProfileSection';
import { useAppLocale } from '../../../context/AppLocaleContext';
import { getImpostazioniAll, setImpostazione } from '../../../db/database';
import { COMPANY_LOCKED } from '../../../utils/companyInfo';
import { finalizeDecimalForDb, sanitizeDecimalTyping } from '../../../utils/decimalInput';
import { numericKeyboardDismissProps } from '../../../utils/numericKeyboardProps';
import { screenHeaderPaddingTop } from '../../../utils/screenHeaderPadding';

const ACI_COSTI_KM_URL = 'https://costikm.aci.it/home';

export default function ProfiloTab() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { messages } = useAppLocale();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [nomeUtente, setNomeUtente] = useState('');
  const [matricola, setMatricola] = useState('');
  const [ufficio, setUfficio] = useState('');
  const [emailOfficeManager, setEmailOfficeManager] = useState('');
  const [modelloAuto, setModelloAuto] = useState('');
  const [eurPerKm, setEurPerKm] = useState('0');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      const all = await getImpostazioniAll();
      if (!alive) return;
      setNomeUtente(all.nome_utente ?? '');
      setMatricola(all.matricola ?? '');
      setUfficio(all.ufficio ?? '');
      setEmailOfficeManager(all.email_office_manager ?? '');
      setModelloAuto(all.modello_auto ?? '');
      setEurPerKm(all.eur_per_km ?? '0');
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

  const canSave = useMemo(() => !loading && !saving, [loading, saving]);

  async function onSave() {
    setSaving(true);
    try {
      await Promise.all([
        setImpostazione('nome_utente', nomeUtente.trim()),
        setImpostazione('matricola', matricola.trim()),
        setImpostazione('ufficio', ufficio.trim()),
        setImpostazione('azienda', COMPANY_LOCKED.name),
        setImpostazione('indirizzo_azienda', COMPANY_LOCKED.address),
        setImpostazione('cf_piva', COMPANY_LOCKED.cfPiva),
        setImpostazione('email_office_manager', emailOfficeManager.trim()),
        setImpostazione('modello_auto', modelloAuto.trim()),
        setImpostazione('eur_per_km', finalizeDecimalForDb(eurPerKm)),
      ]);
      Alert.alert(messages.profileSavedTitle, messages.profileSavedBody);
    } catch {
      Alert.alert(messages.errorTitle, messages.profileSaveErr);
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardSafeScroll
      contentContainerStyle={[styles.page, { paddingTop: screenHeaderPaddingTop(insets.top) }]}
    >
      <Text variant="titleLarge">{messages.profileScreenTitle}</Text>

      <Card>
        <Card.Content style={{ gap: 12 }}>
          <Text variant="titleMedium">{messages.settingsProfileTitle}</Text>
          <TextInput
            label={messages.settingsEmployeeName}
            value={nomeUtente}
            onChangeText={setNomeUtente}
            disabled={loading || saving}
          />
          <TextInput
            label={messages.settingsMatricola}
            value={matricola}
            onChangeText={setMatricola}
            disabled={loading || saving}
          />
          <TextInput label={messages.settingsUfficio} value={ufficio} onChangeText={setUfficio} disabled={loading || saving} />
          <Text style={styles.lockedLabel}>{messages.settingsCompanyLocked}</Text>
          <Text style={styles.lockedValue}>{COMPANY_LOCKED.name}</Text>
          <Text style={styles.lockedLabel}>{messages.settingsCompanyAddress}</Text>
          <Text style={styles.lockedValue}>{COMPANY_LOCKED.address}</Text>
          <Text style={styles.lockedLabel}>{messages.settingsCfPiva}</Text>
          <Text style={styles.lockedValue}>{COMPANY_LOCKED.cfPiva}</Text>
          <TextInput
            label={messages.settingsEmailManager}
            keyboardType="email-address"
            autoCapitalize="none"
            value={emailOfficeManager}
            onChangeText={setEmailOfficeManager}
            disabled={loading || saving}
          />
        </Card.Content>
      </Card>

      <Card>
        <Card.Content style={{ gap: 12 }}>
          <Text variant="titleMedium">{messages.settingsCarTitle}</Text>
          <TextInput
            label={messages.settingsCarModel}
            value={modelloAuto}
            onChangeText={setModelloAuto}
            disabled={loading || saving}
          />
          <TextInput
            label={messages.settingsEurPerKm}
            {...numericKeyboardDismissProps()}
            keyboardType="decimal-pad"
            value={eurPerKm}
            onChangeText={(t) => setEurPerKm(sanitizeDecimalTyping(t))}
            disabled={loading || saving}
          />
          <Text style={styles.aciLinkLine} variant="bodySmall">
            {messages.profileAciKmSourceIntro}{' '}
            <Text
              onPress={() => void Linking.openURL(ACI_COSTI_KM_URL)}
              style={[styles.aciLinkUrl, { color: theme.colors.primary }]}
              accessibilityRole="link"
              accessibilityLabel={ACI_COSTI_KM_URL}
            >
              {ACI_COSTI_KM_URL}
            </Text>
          </Text>
          <Text style={{ opacity: 0.65, fontSize: 13 }}>{messages.settingsDecimalHint}</Text>
          <Divider />
          <Text style={{ opacity: 0.7 }}>{messages.settingsAciPhase2Hint}</Text>
        </Card.Content>
      </Card>

      <AciCostikmProfileSection
        disabled={loading || saving}
        onApplyEurPerKm={(v) => setEurPerKm(v)}
      />

      <Button mode="contained" onPress={onSave} loading={saving} disabled={!canSave}>
        {messages.profileSaveButton}
      </Button>
    </KeyboardSafeScroll>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: 12,
    paddingBottom: 28,
    gap: 12,
  },
  lockedLabel: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.55,
    marginTop: 4,
  },
  lockedValue: {
    fontSize: 15,
    lineHeight: 22,
    opacity: 0.9,
  },
  aciLinkLine: {
    opacity: 0.82,
    lineHeight: 20,
  },
  aciLinkUrl: {
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
