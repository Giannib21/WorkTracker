import { format } from 'date-fns';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Card,
  Checkbox,
  Dialog,
  Divider,
  List,
  Portal,
  Switch,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';

import { HapticButton } from './HapticButton';

import { useAppLocale } from '../context/AppLocaleContext';
import {
  fetchAciBrands,
  fetchAciCostsViaProxyCalculate,
  fetchAciFuels,
  fetchAciModels,
  isKeycloakTokenRequiredError,
  isSessionExpiredError,
  type AciBrand,
  type AciFuel,
  type AciModel,
} from '../utils/aciCostikmClient';
import {
  extractCostKmBands,
  extractEurPerKmBandOptions,
  extractSuggestedEurPerKmFromCosts,
  parseKmAnnual,
  suggestCostKmBandForAnnualKm,
} from '../utils/aciCostikmCostsParse';
import { aciModelsListTimestampMs } from '../utils/aciCostikmTimestamp';
import { sanitizeDecimalTyping } from '../utils/decimalInput';
import { hapticSelection } from '../utils/haptics';

const COST_FETCH_COUNTDOWN_START = 90;

type PickerKind = 'brand' | 'fuel' | 'model' | null;

type Props = {
  disabled?: boolean;
  onApplyEurPerKm: (sanitizedDecimal: string) => void;
  /** Sincronizza il campo «Modello auto» in Profilo con la selezione ACI (marca · modello · carburante). */
  onApplyCarModel: (vehicleDescription: string) => void;
};

export function AciCostikmProfileSection({ disabled = false, onApplyEurPerKm, onApplyCarModel }: Props) {
  const theme = useTheme();
  const { messages } = useAppLocale();

  const proxyUrl = useMemo(() => process.env.EXPO_PUBLIC_ACI_PROXY_URL?.trim() ?? '', []);

  const [brands, setBrands] = useState<AciBrand[]>([]);
  const [fuels, setFuels] = useState<AciFuel[]>([]);
  const [models, setModels] = useState<AciModel[]>([]);
  const [brand, setBrand] = useState<AciBrand | null>(null);
  const [fuel, setFuel] = useState<AciFuel | null>(null);
  const [model, setModel] = useState<AciModel | null>(null);
  const [costDate, setCostDate] = useState(() => format(new Date(), 'dd-MM-yyyy'));
  const [vatNet, setVatNet] = useState(false);
  const [picker, setPicker] = useState<PickerKind>(null);
  const [loadingBrands, setLoadingBrands] = useState(false);
  const [loadingFuels, setLoadingFuels] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultJson, setResultJson] = useState<string | null>(null);
  const [suggestedEur, setSuggestedEur] = useState<string | null>(null);
  const [eurBands, setEurBands] = useState<{ label: string; value: string }[]>([]);
  const [annualKmInput, setAnnualKmInput] = useState('');
  const [costFetchAck, setCostFetchAck] = useState(false);
  const [costFetchCountdown, setCostFetchCountdown] = useState<number | null>(null);

  const applyEurRef = useRef(onApplyEurPerKm);
  applyEurRef.current = onApplyEurPerKm;

  const annualKmParsed = useMemo(() => parseKmAnnual(annualKmInput.trim() || null), [annualKmInput]);

  const busy = disabled || loadingBrands || loadingFuels || loadingModels || calculating;

  const annualKmSuggestion = useMemo(() => {
    if (annualKmParsed == null || !resultJson) return null;
    let data: unknown;
    try {
      data = JSON.parse(resultJson);
    } catch {
      return null;
    }
    const bands = extractCostKmBands(data);
    const band = suggestCostKmBandForAnnualKm(bands, annualKmParsed);
    if (!band) return null;
    return { band, userKm: annualKmParsed };
  }, [resultJson, annualKmParsed]);

  useEffect(() => {
    if (!resultJson || annualKmParsed == null) return;
    let data: unknown;
    try {
      data = JSON.parse(resultJson);
    } catch {
      return;
    }
    const bands = extractCostKmBands(data);
    const band = suggestCostKmBandForAnnualKm(bands, annualKmParsed);
    if (!band) return;
    applyEurRef.current(sanitizeDecimalTyping(String(band.cost).replace('.', ',')));
  }, [resultJson, annualKmParsed]);

  useEffect(() => {
    setCostFetchAck(false);
  }, [model?.id]);

  useEffect(() => {
    if (!calculating) {
      setCostFetchCountdown(null);
      return;
    }
    const id = setInterval(() => {
      setCostFetchCountdown((c) => (c == null || c <= 0 ? 0 : c - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [calculating]);

  const loadBrands = useCallback(async () => {
    setError(null);
    setLoadingBrands(true);
    try {
      const r = await fetchAciBrands('1');
      setBrands(r.brands ?? []);
      setBrand(null);
      setFuel(null);
      setModel(null);
      setFuels([]);
      setModels([]);
      setResultJson(null);
      setSuggestedEur(null);
      setEurBands([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : messages.aciWizardErrGeneric);
    } finally {
      setLoadingBrands(false);
    }
  }, [messages.aciWizardErrGeneric]);

  useEffect(() => {
    if (!brand) {
      setFuels([]);
      setFuel(null);
      setModels([]);
      setModel(null);
      return;
    }
    let cancelled = false;
    setLoadingFuels(true);
    setError(null);
    fetchAciFuels(brand.id, '1')
      .then((r) => {
        if (!cancelled) setFuels(r.fuels ?? []);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : messages.aciWizardErrGeneric);
      })
      .finally(() => {
        if (!cancelled) setLoadingFuels(false);
      });
    return () => {
      cancelled = true;
    };
  }, [brand, messages.aciWizardErrGeneric]);

  useEffect(() => {
    if (!brand || !fuel) {
      setModels([]);
      setModel(null);
      return;
    }
    let cancelled = false;
    setLoadingModels(true);
    setError(null);
    fetchAciModels(brand.id, fuel.id, aciModelsListTimestampMs(), '1')
      .then((r) => {
        if (!cancelled) setModels(r.models ?? []);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : messages.aciWizardErrGeneric);
      })
      .finally(() => {
        if (!cancelled) setLoadingModels(false);
      });
    return () => {
      cancelled = true;
    };
  }, [brand, fuel, messages.aciWizardErrGeneric]);

  function resetAll() {
    setBrands([]);
    setFuels([]);
    setModels([]);
    setBrand(null);
    setFuel(null);
    setModel(null);
    setError(null);
    setCostDate(format(new Date(), 'dd-MM-yyyy'));
    setVatNet(false);
    setPicker(null);
    setResultJson(null);
    setSuggestedEur(null);
    setEurBands([]);
    setAnnualKmInput('');
    setCostFetchAck(false);
  }

  function applyVehicleDescription(b: AciBrand, f: AciFuel, m: AciModel) {
    onApplyCarModel(`${b.name} ${m.name} (${f.name})`);
  }

  async function onFetchCostsViaProxy() {
    if (!brand || !fuel || !model) {
      setError(messages.aciWizardErrIncomplete);
      return;
    }
    if (!costFetchAck) {
      return;
    }
    if (!proxyUrl) {
      setError(messages.aciWizardCostFetchProxyRequired);
      return;
    }
    setError(null);
    setCalculating(true);
    setCostFetchCountdown(COST_FETCH_COUNTDOWN_START);
    setResultJson(null);
    setSuggestedEur(null);
    setEurBands([]);
    try {
      const data = await fetchAciCostsViaProxyCalculate({
        brandId: brand.id,
        brandName: brand.name,
        fuelId: fuel.id,
        fuelName: fuel.name,
        modelId: model.id,
        modelName: model.name,
        date: costDate.trim(),
        vat: vatNet ? 1 : 0,
        classe_euro: typeof model.classe_euro === 'string' ? model.classe_euro : undefined,
        ncap: typeof model.ncap === 'string' ? model.ncap : undefined,
      });
      setResultJson(JSON.stringify(data, null, 2));
      setEurBands(extractEurPerKmBandOptions(data));
      setSuggestedEur(extractSuggestedEurPerKmFromCosts(data));
    } catch (e) {
      const raw = e instanceof Error ? e.message : '';
      if (raw === 'MISSING_ACI_PROXY') {
        setError(messages.aciWizardCostFetchProxyRequired);
      } else if (isKeycloakTokenRequiredError(raw)) {
        setError(messages.aciWizardKeycloakTokenRequired);
      } else if (isSessionExpiredError(raw)) {
        setError(messages.aciWizardSessionExpired);
      } else {
        setError(raw || messages.aciWizardErrGeneric);
      }
    } finally {
      setCalculating(false);
    }
  }

  function renderPickerItems() {
    if (picker === 'brand') {
      return brands.map((b) => (
        <List.Item
          key={b.id}
          title={b.name}
          onPress={() => {
            hapticSelection();
            setBrand(b);
            setFuel(null);
            setModel(null);
            setPicker(null);
          }}
        />
      ));
    }
    if (picker === 'fuel') {
      return fuels.map((f) => (
        <List.Item
          key={f.id}
          title={f.name}
          onPress={() => {
            hapticSelection();
            setFuel(f);
            setModel(null);
            setPicker(null);
          }}
        />
      ));
    }
    if (picker === 'model') {
      return models.map((m) => (
        <List.Item
          key={m.id}
          title={m.name}
          description={m.classe_euro ? `Euro ${m.classe_euro}` : undefined}
          onPress={() => {
            hapticSelection();
            if (brand && fuel) {
              setModel(m);
              applyVehicleDescription(brand, fuel, m);
            }
            setPicker(null);
          }}
        />
      ));
    }
    return null;
  }

  const pickerTitle =
    picker === 'brand'
      ? messages.aciWizardSelectBrand
      : picker === 'fuel'
        ? messages.aciWizardSelectFuel
        : picker === 'model'
          ? messages.aciWizardSelectModel
          : '';

  const hasOutput =
    resultJson &&
    (eurBands.length > 0 || suggestedEur || (annualKmParsed != null && annualKmSuggestion != null));

  return (
    <Card mode="outlined">
      <Card.Content style={{ gap: 10 }}>
        <Text variant="titleMedium">{messages.aciWizardTitle}</Text>

        <Divider />

        {error ? (
          <Text variant="bodySmall" style={{ color: theme.colors.error }}>
            {error}
          </Text>
        ) : null}

        <View style={styles.row}>
          <HapticButton mode="contained-tonal" onPress={loadBrands} disabled={busy} loading={loadingBrands}>
            {messages.aciWizardLoadBrands}
          </HapticButton>
          <HapticButton mode="outlined" onPress={resetAll} disabled={busy}>
            {messages.aciWizardReset}
          </HapticButton>
        </View>

        <HapticButton
          mode="outlined"
          onPress={() => setPicker('brand')}
          disabled={busy || brands.length === 0}
          icon="chevron-down"
        >
          {messages.aciWizardSelectBrand}: {brand?.name ?? messages.aciWizardPickPlaceholder}
        </HapticButton>
        {loadingFuels ? <ActivityIndicator /> : null}
        <HapticButton
          mode="outlined"
          onPress={() => setPicker('fuel')}
          disabled={busy || !brand || fuels.length === 0}
          icon="chevron-down"
        >
          {messages.aciWizardSelectFuel}: {fuel?.name ?? messages.aciWizardPickPlaceholder}
        </HapticButton>
        {loadingModels ? <ActivityIndicator /> : null}
        <HapticButton
          mode="outlined"
          onPress={() => setPicker('model')}
          disabled={busy || !fuel || models.length === 0}
          icon="chevron-down"
        >
          {messages.aciWizardSelectModel}: {model?.name ?? messages.aciWizardPickPlaceholder}
        </HapticButton>

        <TextInput
          label={messages.aciWizardDateLabel}
          value={costDate}
          onChangeText={setCostDate}
          disabled={busy}
          autoCapitalize="none"
        />

        <View style={styles.switchRow}>
          <Text variant="bodyMedium" style={{ flex: 1 }}>
            {messages.aciWizardNetAmount}
          </Text>
          <Switch
            value={vatNet}
            onValueChange={(v) => {
              hapticSelection();
              setVatNet(v);
            }}
            disabled={busy}
          />
        </View>

        <Divider />

        <TextInput
          label={messages.aciWizardAnnualKmLabel}
          value={annualKmInput}
          onChangeText={(t) => setAnnualKmInput(t.replace(/[^\d]/g, ''))}
          disabled={busy || !model}
          keyboardType="number-pad"
        />
        <Text variant="bodySmall" style={{ opacity: 0.7 }}>
          {messages.aciWizardAnnualKmHelper}
        </Text>

        <Checkbox.Item
          mode="android"
          position="leading"
          label={messages.aciWizardPersonalUseCheckbox}
          status={costFetchAck ? 'checked' : 'unchecked'}
          onPress={() => {
            hapticSelection();
            if (!busy && model) setCostFetchAck((v) => !v);
          }}
          disabled={busy || !model}
          labelStyle={{ fontSize: 11, lineHeight: 15, opacity: 0.9 }}
        />

        <HapticButton
          mode="contained-tonal"
          icon="cloud-download-outline"
          onPress={() => void onFetchCostsViaProxy()}
          disabled={busy || !model || !costFetchAck}
          loading={calculating}
        >
          {calculating && costFetchCountdown != null
            ? `${messages.aciWizardCostFetchButton} (${costFetchCountdown}s)`
            : messages.aciWizardCostFetchButton}
        </HapticButton>
        {!proxyUrl ? (
          <Text variant="bodySmall" style={{ opacity: 0.65 }}>
            {messages.aciWizardCostFetchProxyRequired}
          </Text>
        ) : null}

        {hasOutput ? (
          <View
            style={[
              styles.outputPanel,
              {
                borderColor: theme.colors.outlineVariant,
                backgroundColor: theme.colors.surface,
              },
            ]}
          >
            <Text variant="titleMedium" style={{ color: theme.colors.primary }}>
              {messages.aciWizardResultTitle}
            </Text>

            {eurBands.length > 0 || suggestedEur ? (
              <Text variant="bodyMedium" style={{ opacity: 0.88, marginTop: 4 }}>
                {messages.aciWizardKmBandsHint}
              </Text>
            ) : null}

            {annualKmParsed != null && annualKmSuggestion ? (
              <Text variant="bodyLarge" style={{ opacity: 0.95, marginTop: 8 }}>
                {messages.aciWizardEurPerKmAutoApplied(
                  annualKmSuggestion.userKm,
                  annualKmSuggestion.band.km,
                  String(annualKmSuggestion.band.cost).replace('.', ','),
                )}
              </Text>
            ) : null}

            {annualKmParsed == null && eurBands.length > 0 ? (
              <View
                style={[
                  styles.bandsTable,
                  {
                    borderColor: theme.colors.outlineVariant,
                    backgroundColor: theme.colors.surface,
                    marginTop: 10,
                  },
                ]}
              >
                <Text variant="titleSmall" style={{ marginBottom: 6 }}>
                  {messages.aciWizardBandsTableTitle}
                </Text>
                <Text variant="bodySmall" style={{ opacity: 0.78, marginBottom: 10 }}>
                  {messages.aciWizardBandsTableHint}
                </Text>
                <View
                  style={[
                    styles.bandsHeaderRow,
                    { backgroundColor: theme.colors.surfaceVariant },
                  ]}
                >
                  <Text style={[styles.bandsColBand, { color: theme.colors.onSurfaceVariant }]}>
                    {messages.aciWizardBandsColBand}
                  </Text>
                  <Text style={[styles.bandsColRate, { color: theme.colors.onSurfaceVariant }]}>
                    {messages.aciWizardBandsColRate}
                  </Text>
                </View>
                {eurBands.map((b, i) => (
                  <Pressable
                    key={`${b.label}-${b.value}-${i}`}
                    accessibilityRole="button"
                    onPressIn={() => {
                      hapticSelection();
                    }}
                    onPress={() => onApplyEurPerKm(sanitizeDecimalTyping(b.value))}
                    disabled={busy}
                    android_ripple={{ color: theme.colors.primaryContainer }}
                    style={({ pressed }) => [
                      styles.bandsDataRow,
                      {
                        backgroundColor: pressed ? theme.colors.surfaceVariant : theme.colors.surface,
                        borderBottomColor: theme.colors.outlineVariant,
                      },
                      i === eurBands.length - 1 ? styles.bandsDataRowLast : null,
                    ]}
                  >
                    <Text style={[styles.bandsColBand, { color: theme.colors.onSurface }]}>{b.label}</Text>
                    <Text
                      style={[
                        styles.bandsColRate,
                        { color: theme.colors.primary, fontWeight: '600', fontVariant: ['tabular-nums'] },
                      ]}
                    >
                      {b.value}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {annualKmParsed == null && eurBands.length === 0 && suggestedEur ? (
              <HapticButton
                mode="contained"
                style={{ marginTop: 12 }}
                onPress={() => onApplyEurPerKm(sanitizeDecimalTyping(suggestedEur))}
                disabled={busy}
              >
                {messages.aciWizardApplyRate} ({suggestedEur})
              </HapticButton>
            ) : null}
          </View>
        ) : null}

        <Portal>
          <Dialog visible={picker !== null} onDismiss={() => setPicker(null)}>
            <Dialog.Title>{pickerTitle}</Dialog.Title>
            <Dialog.Content style={{ maxHeight: 420, paddingHorizontal: 0 }}>
              <ScrollView keyboardShouldPersistTaps="handled">{renderPickerItems()}</ScrollView>
            </Dialog.Content>
            <Dialog.Actions>
              <HapticButton onPress={() => setPicker(null)}>{messages.resetCancel}</HapticButton>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  outputPanel: {
    marginTop: 4,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 4,
  },
  bandsTable: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 0,
  },
  bandsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  bandsDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  bandsDataRowLast: { borderBottomWidth: 0 },
  bandsColBand: { flex: 1.35, fontSize: 14, lineHeight: 20 },
  bandsColRate: { flex: 0.65, fontSize: 15, lineHeight: 20, textAlign: 'right' },
});
