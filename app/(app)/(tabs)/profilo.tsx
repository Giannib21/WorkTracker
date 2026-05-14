import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Card, SegmentedButtons, Text, TextInput } from 'react-native-paper';

import { HapticButton } from '../../../components/HapticButton';
import { hapticSelection } from '../../../utils/haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyboardSafeScroll } from '../../../components/KeyboardSafeScroll';
import { AciCostikmProfileSection } from '../../../components/AciCostikmProfileSection';
import { useAppLocale } from '../../../context/AppLocaleContext';
import { getImpostazioniAll, setImpostazione } from '../../../db/database';
import { COMPANY_LOCKED } from '../../../utils/companyInfo';
import { finalizeDecimalForDb, sanitizeDecimalTyping } from '../../../utils/decimalInput';
import { numericKeyboardDismissProps } from '../../../utils/numericKeyboardProps';
import { screenHeaderPaddingTop } from '../../../utils/screenHeaderPadding';
import { appAlert } from '../../../utils/appAlert';

const ACI_OFFICIAL_CALC_URL = 'https://costikm.aci.it/home';

type CarCostMode = 'manual' | 'auto';

export default function ProfiloTab() {
  const insets = useSafeAreaInsets();
  const { messages } = useAppLocale();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [nomeUtente, setNomeUtente] = useState('');
  const [matricola, setMatricola] = useState('');
  const [ufficio, setUfficio] = useState('');
  const [emailOfficeManager, setEmailOfficeManager] = useState('');
  const [modelloAuto, setModelloAuto] = useState('');
  const [eurPerKm, setEurPerKm] = useState('0');
  const [carCostMode, setCarCostMode] = useState<CarCostMode>('manual');
  const [aciWizardError, setAciWizardError] = useState<string | null>(null);

  const handleAciErrorChange = useCallback((msg: string | null) => {
    setAciWizardError(msg);
  }, []);

  useEffect(() => {
    if (carCostMode !== 'auto') {
      setAciWizardError(null);
    }
  }, [carCostMode]);

  const showOfficialAciCalculator =
    carCostMode === 'manual' || (carCostMode === 'auto' && Boolean(aciWizardError?.trim()));

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
      setCarCostMode(all.profilo_car_cost_mode === 'auto' ? 'auto' : 'manual');
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
        setImpostazione('profilo_car_cost_mode', carCostMode === 'auto' ? 'auto' : 'manual'),
      ]);
      appAlert(messages.profileSavedTitle, messages.profileSavedBody);
    } catch {
      appAlert(messages.errorTitle, messages.profileSaveErr);
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
          <Text variant="bodyMedium">{messages.profileCarCostModeTitle}</Text>
          <View style={{ opacity: loading || saving ? 0.55 : 1 }} pointerEvents={loading || saving ? 'none' : 'auto'}>
            <SegmentedButtons
              value={carCostMode}
              onValueChange={(v) => {
                hapticSelection();
                setCarCostMode(v as CarCostMode);
              }}
              buttons={[
                { value: 'manual', label: messages.profileCarCostModeManual },
                { value: 'auto', label: messages.profileCarCostModeAuto },
              ]}
            />
          </View>
          <TextInput
            label={messages.settingsCarModel}
            value={modelloAuto}
            onChangeText={setModelloAuto}
            disabled={loading || saving || carCostMode === 'auto'}
          />
          <TextInput
            label={messages.settingsEurPerKm}
            {...numericKeyboardDismissProps()}
            keyboardType="decimal-pad"
            value={eurPerKm}
            onChangeText={(t) => setEurPerKm(sanitizeDecimalTyping(t))}
            disabled={loading || saving || carCostMode === 'auto'}
          />
          <Text style={{ opacity: 0.65, fontSize: 13 }}>{messages.settingsDecimalHint}</Text>
          {showOfficialAciCalculator ? (
            <HapticButton
              mode="contained"
              icon="open-in-new"
              onPress={() => void Linking.openURL(ACI_OFFICIAL_CALC_URL)}
              disabled={loading || saving}
            >
              {messages.aciWizardOpenOfficialCalculator}
            </HapticButton>
          ) : null}
          {carCostMode === 'auto' ? (
            <AciCostikmProfileSection
              embedded
              disabled={loading || saving}
              onApplyEurPerKm={(v) => setEurPerKm(v)}
              onApplyCarModel={(description) => setModelloAuto(description)}
              onErrorChange={handleAciErrorChange}
            />
          ) : null}
        </Card.Content>
      </Card>

      <HapticButton mode="contained" onPress={onSave} loading={saving} disabled={!canSave}>
        {messages.profileSaveButton}
      </HapticButton>
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
});
