import { format } from 'date-fns';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Card,
  Dialog,
  Divider,
  List,
  Portal,
  Switch,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';

import * as Clipboard from 'expo-clipboard';

import { useAppLocale } from '../context/AppLocaleContext';
import {
  fetchAciBrands,
  fetchAciCostsViaProxyCalculate,
  fetchAciFuels,
  fetchAciModels,
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

type PickerKind = 'brand' | 'fuel' | 'model' | null;

const ACI_OFFICIAL_CALC_URL = 'https://costikm.aci.it/home';

type Props = {
  disabled?: boolean;
  onApplyEurPerKm: (sanitizedDecimal: string) => void;
};

export function AciCostikmProfileSection({ disabled = false, onApplyEurPerKm }: Props) {
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

  const busy = disabled || loadingBrands || loadingFuels || loadingModels || calculating;

  const annualKmSuggestion = useMemo(() => {
    const u = parseKmAnnual(annualKmInput.trim() || null);
    if (u == null || !resultJson) return null;
    let data: unknown;
    try {
      data = JSON.parse(resultJson);
    } catch {
      return null;
    }
    const bands = extractCostKmBands(data);
    const band = suggestCostKmBandForAnnualKm(bands, u);
    if (!band) return null;
    return { band, userKm: u };
  }, [resultJson, annualKmInput]);

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
  }

  async function onCopySelectionSummary(): Promise<void> {
    if (!brand || !fuel || !model) {
      setError(messages.aciWizardCopySelectionNeedSelection);
      return;
    }
    setError(null);
    const vatLabel = vatNet ? messages.aciWizardCopyLabelVatNet : messages.aciWizardCopyLabelVatGross;
    const lines = [
      `${messages.aciWizardCopyLabelBrand}: ${brand.name}`,
      `${messages.aciWizardCopyLabelFuel}: ${fuel.name}`,
      `${messages.aciWizardCopyLabelModel}: ${model.name}`,
      `${messages.aciWizardCopyLabelDate}: ${costDate.trim()}`,
      `${vatLabel}`,
    ];
    await Clipboard.setStringAsync(lines.join('\n'));
    Alert.alert(messages.alertSaved, messages.aciWizardCopySelectionDone);
  }

  async function onFetchCostsViaProxy() {
    if (!brand || !fuel || !model) {
      setError(messages.aciWizardErrIncomplete);
      return;
    }
    if (!proxyUrl) {
      setError(messages.aciWizardCostFetchProxyRequired);
      return;
    }
    setError(null);
    setCalculating(true);
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
            setModel(m);
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

  return (
    <Card mode="outlined">
      <Card.Content style={{ gap: 10 }}>
        <Text variant="titleMedium">{messages.aciWizardTitle}</Text>
        <Text variant="bodySmall" style={{ opacity: 0.78 }}>
          {messages.aciWizardIntro}
        </Text>
        {Platform.OS === 'web' ? (
          <Text variant="bodySmall" style={{ opacity: 0.72 }}>
            {messages.aciWizardWebCorsHint}
          </Text>
        ) : null}

        <Divider />

        {error ? (
          <Text variant="bodySmall" style={{ color: theme.colors.error }}>
            {error}
          </Text>
        ) : null}

        <View style={styles.row}>
          <Button mode="contained-tonal" onPress={loadBrands} disabled={busy} loading={loadingBrands}>
            {messages.aciWizardLoadBrands}
          </Button>
          <Button mode="outlined" onPress={resetAll} disabled={busy}>
            {messages.aciWizardReset}
          </Button>
        </View>

        <Button
          mode="outlined"
          onPress={() => setPicker('brand')}
          disabled={busy || brands.length === 0}
          icon="chevron-down"
        >
          {messages.aciWizardSelectBrand}: {brand?.name ?? messages.aciWizardPickPlaceholder}
        </Button>
        {loadingFuels ? <ActivityIndicator /> : null}
        <Button
          mode="outlined"
          onPress={() => setPicker('fuel')}
          disabled={busy || !brand || fuels.length === 0}
          icon="chevron-down"
        >
          {messages.aciWizardSelectFuel}: {fuel?.name ?? messages.aciWizardPickPlaceholder}
        </Button>
        {loadingModels ? <ActivityIndicator /> : null}
        <Button
          mode="outlined"
          onPress={() => setPicker('model')}
          disabled={busy || !fuel || models.length === 0}
          icon="chevron-down"
        >
          {messages.aciWizardSelectModel}: {model?.name ?? messages.aciWizardPickPlaceholder}
        </Button>

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
          <Switch value={vatNet} onValueChange={setVatNet} disabled={busy} />
        </View>

        <Divider />

        <Text variant="titleSmall" style={{ opacity: 0.92 }}>
          {messages.aciWizardCostFetchTitle}
        </Text>
        <Text variant="bodySmall" style={{ opacity: 0.76 }}>
          {messages.aciWizardCostFetchBody}
        </Text>
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
        <Button
          mode="contained-tonal"
          icon="cloud-download-outline"
          onPress={() => void onFetchCostsViaProxy()}
          disabled={busy || !model}
          loading={calculating}
        >
          {messages.aciWizardCostFetchButton}
        </Button>
        {!proxyUrl ? (
          <Text variant="bodySmall" style={{ opacity: 0.65 }}>
            {messages.aciWizardCostFetchProxyRequired}
          </Text>
        ) : null}

        <Divider />

        <Button
          mode="contained"
          icon="open-in-new"
          onPress={() => void Linking.openURL(ACI_OFFICIAL_CALC_URL)}
          disabled={busy || !model}
        >
          {messages.aciWizardOpenOfficialCalculator}
        </Button>
        <Button mode="outlined" icon="content-copy" onPress={() => void onCopySelectionSummary()} disabled={busy || !model}>
          {messages.aciWizardCopySelectionSummary}
        </Button>

        {resultJson ? (
          <View style={{ gap: 8 }}>
            <Text variant="labelLarge">{messages.aciWizardResultTitle}</Text>
            <ScrollView style={styles.jsonScroll} nestedScrollEnabled>
              <Text selectable variant="bodySmall" style={styles.jsonText}>
                {resultJson.length > 4000 ? `${resultJson.slice(0, 4000)}…` : resultJson}
              </Text>
            </ScrollView>
            {eurBands.length > 0 || suggestedEur ? (
              <Text variant="bodySmall" style={{ opacity: 0.78 }}>
                {messages.aciWizardKmBandsHint}
              </Text>
            ) : null}
            {annualKmSuggestion ? (
              <View style={{ gap: 6 }}>
                <Text variant="bodyMedium" style={{ opacity: 0.9 }}>
                  {messages.aciWizardSuggestedBandLine(
                    annualKmSuggestion.userKm,
                    annualKmSuggestion.band.km,
                    String(annualKmSuggestion.band.cost).replace('.', ','),
                  )}
                </Text>
                <Button
                  mode="contained"
                  onPress={() =>
                    onApplyEurPerKm(
                      sanitizeDecimalTyping(String(annualKmSuggestion.band.cost).replace('.', ',')),
                    )
                  }
                  disabled={busy}
                >
                  {messages.aciWizardApplySuggestedBand}
                </Button>
              </View>
            ) : null}
            {eurBands.length > 0
              ? eurBands.map((b, i) => (
                  <Button
                    key={`${b.label}-${b.value}-${i}`}
                    mode="contained-tonal"
                    onPress={() => onApplyEurPerKm(sanitizeDecimalTyping(b.value))}
                    disabled={busy}
                  >
                    {messages.aciWizardApplyRate}: {b.value} — {b.label}
                  </Button>
                ))
              : suggestedEur ? (
                  <Button
                    mode="contained-tonal"
                    onPress={() => onApplyEurPerKm(sanitizeDecimalTyping(suggestedEur))}
                    disabled={busy}
                  >
                    {messages.aciWizardApplyRate} ({suggestedEur})
                  </Button>
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
              <Button onPress={() => setPicker(null)}>{messages.resetCancel}</Button>
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
  jsonScroll: { maxHeight: 220, borderWidth: StyleSheet.hairlineWidth, borderColor: '#ccc', borderRadius: 8 },
  jsonText: { fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }), padding: 8 },
});
