import { format } from 'date-fns';
import { useCallback, useEffect, useState } from 'react';
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
import { fetchAciBrands, fetchAciFuels, fetchAciModels, type AciBrand, type AciFuel, type AciModel } from '../utils/aciCostikmClient';
import { aciModelsListTimestampMs } from '../utils/aciCostikmTimestamp';

type PickerKind = 'brand' | 'fuel' | 'model' | null;

const ACI_OFFICIAL_CALC_URL = 'https://costikm.aci.it/home';

type Props = {
  disabled?: boolean;
};

export function AciCostikmProfileSection({ disabled = false }: Props) {
  const theme = useTheme();
  const { messages } = useAppLocale();

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
  const [error, setError] = useState<string | null>(null);

  const busy = disabled || loadingBrands || loadingFuels || loadingModels;

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
});
