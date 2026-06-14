import { addMonths, format, startOfMonth } from 'date-fns';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Card, Dialog, Divider, Portal, Text } from 'react-native-paper';

import { HapticButton } from '../../../components/HapticButton';
import { HapticIconButton } from '../../../components/HapticIconButton';
import * as MailComposer from 'expo-mail-composer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyboardSafeScroll } from '../../../components/KeyboardSafeScroll';
import { useAppLocale } from '../../../context/AppLocaleContext';
import { getImpostazioniAll, listGiorniByMonth, listSpeseByMonth } from '../../../db/database';
import {
  expandGiorniMeseConDefaults,
  ensureDefaultLavoroDaysForMonth,
  oreSettingsFromImpostazioni,
} from '../../../utils/giorniMeseReport';
import { COMPANY_LOCKED } from '../../../utils/companyInfo';
import { generateExcelForMonth } from '../../../utils/excelExport';
import { generatePdfForMonth, shareFile, type PdfExportScope } from '../../../utils/pdf';
import { screenHeaderPaddingTop } from '../../../utils/screenHeaderPadding';
import { appAlert } from '../../../utils/appAlert';
import { defaultWorkMonth, workMonthFromKey } from '../../../utils/defaultWorkMonth';

function monthKey(d: Date): string {
  return format(d, 'yyyy-MM');
}

function monthHasExpenseAttachments(spese: { foto_path?: string | null }[]): boolean {
  return spese.some((s) => (s.foto_path ?? '').trim().length > 0);
}

type WebMailFollowUp = {
  mailto: string;
  uri: string;
  filename: string;
};

function resolveMeseRouteParam(raw: string | string[] | undefined): Date | null {
  const s = Array.isArray(raw) ? raw[0] : raw;
  return workMonthFromKey(s);
}

export default function ExportScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { mese: meseParam } = useLocalSearchParams<{ mese?: string | string[] }>();
  const { messages, formatD, language } = useAppLocale();
  const [month, setMonth] = useState(() => resolveMeseRouteParam(meseParam) ?? defaultWorkMonth());
  const [busy, setBusy] = useState(false);
  const [scopeDialogOpen, setScopeDialogOpen] = useState(false);
  const [attachDialogOpen, setAttachDialogOpen] = useState(false);
  const [pendingScope, setPendingScope] = useState<PdfExportScope | null>(null);
  const [webMailFollowUp, setWebMailFollowUp] = useState<WebMailFollowUp | null>(null);
  const pdfIntentRef = useRef<'share' | 'email'>('share');
  /** True se nel mese corrente c’è almeno uno scontrino/allegato su una spesa (stesso caricamento del dialog scopo). */
  const pdfMonthHasAttachmentsRef = useRef(false);

  useEffect(() => {
    const parsed = resolveMeseRouteParam(meseParam);
    if (parsed) setMonth(parsed);
  }, [meseParam]);

  const meseKey = useMemo(() => monthKey(month), [month]);
  const title = useMemo(() => formatD(month, 'LLLL yyyy'), [month, formatD]);

  function parseEurPerKmDefault(raw: unknown): number | null {
    if (raw == null || raw === '') return null;
    const n = Number(String(raw).trim().replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
  }

  async function buildReportData() {
    const [settings, spese] = await Promise.all([getImpostazioniAll(), listSpeseByMonth(meseKey)]);
    const oreSt = oreSettingsFromImpostazioni(settings);
    await ensureDefaultLavoroDaysForMonth(meseKey, oreSt);
    const giorniDb = await listGiorniByMonth(meseKey);
    const giorni = expandGiorniMeseConDefaults(meseKey, giorniDb, oreSt);

    return {
      meseKey,
      nomeUtente: settings.nome_utente ?? '',
      azienda: settings.azienda ?? COMPANY_LOCKED.name,
      matricola: settings.matricola ?? '',
      ufficio: settings.ufficio ?? '',
      giorni,
      spese,
      eur_per_km_default: parseEurPerKmDefault(settings.eur_per_km),
      emailOfficeManager: settings.email_office_manager ?? '',
      language,
    };
  }

  function closePdfDialogs() {
    setScopeDialogOpen(false);
    setAttachDialogOpen(false);
    setPendingScope(null);
  }

  async function runPdfExport(scope: PdfExportScope, includeAttachments: boolean) {
    setBusy(true);
    try {
      const report = await buildReportData();
      const { uri, filename } = await generatePdfForMonth(report, { scope, includeAttachments });
      if (pdfIntentRef.current === 'email') {
        await openMailComposer(report, uri, filename);
      } else {
        await shareFile(uri, filename);
      }
    } catch {
      appAlert(messages.errorTitle, messages.exportErrPdf);
    } finally {
      setBusy(false);
      closePdfDialogs();
    }
  }

  async function openMailComposer(
    report: Awaited<ReturnType<typeof buildReportData>>,
    uri: string,
    attachmentName: string
  ): Promise<void> {
    if (Platform.OS === 'web') {
      const to = report.emailOfficeManager ? encodeURIComponent(report.emailOfficeManager) : '';
      const subject = encodeURIComponent(messages.exportMailSubject(title));
      const body = encodeURIComponent(messages.exportMailBody(title, report.nomeUtente ?? ''));
      const q = to ? `mailto:${to}?subject=${subject}&body=${body}` : `mailto:?subject=${subject}&body=${body}`;
      setWebMailFollowUp({ mailto: q, uri, filename: attachmentName });
      return;
    }

    const isAvailable = await MailComposer.isAvailableAsync();
    if (!isAvailable) {
      appAlert(messages.errorTitle, messages.exportMailUnavailable);
      return;
    }

    const recipients = report.emailOfficeManager ? [report.emailOfficeManager] : [];
    const subject = messages.exportMailSubject(title);
    const body = messages.exportMailBody(title, report.nomeUtente ?? '');

    await MailComposer.composeAsync({
      recipients,
      subject,
      body,
      attachments: [uri],
    });
  }

  async function startPdfFlow(action: 'share' | 'email') {
    pdfIntentRef.current = action;
    const report = await buildReportData();
    pdfMonthHasAttachmentsRef.current = monthHasExpenseAttachments(report.spese);

    if (report.spese.length === 0) {
      await runPdfExport('presenze', false);
      return;
    }

    setScopeDialogOpen(true);
  }

  function openAttachOrExport(scope: PdfExportScope) {
    setScopeDialogOpen(false);
    if (pdfMonthHasAttachmentsRef.current) {
      setPendingScope(scope);
      setAttachDialogOpen(true);
    } else {
      void runPdfExport(scope, false);
    }
  }

  async function onGeneratePdf() {
    await startPdfFlow('share');
  }

  async function onGenerateExcel() {
    setBusy(true);
    try {
      const report = await buildReportData();
      const { uri, filename } = await generateExcelForMonth({
        meseKey: report.meseKey,
        nomeUtente: report.nomeUtente,
        matricola: report.matricola,
        ufficio: report.ufficio,
        giorni: report.giorni,
        spese: report.spese,
        language: report.language,
        eur_per_km_default: report.eur_per_km_default,
      });
      await shareFile(uri, filename);
    } catch {
      appAlert(messages.errorTitle, messages.exportErrExcel);
    } finally {
      setBusy(false);
    }
  }

  async function onSendEmail() {
    try {
      await startPdfFlow('email');
    } catch {
      appAlert(messages.errorTitle, messages.exportErrEmail);
    }
  }

  const dismissWebMailDialog = useCallback((revokeBlob: boolean) => {
    setWebMailFollowUp((prev) => {
      if (prev && revokeBlob && prev.uri.startsWith('blob:')) {
        URL.revokeObjectURL(prev.uri);
      }
      return null;
    });
  }, []);

  const onWebSharePdf = useCallback(async () => {
    if (!webMailFollowUp || Platform.OS !== 'web') return;
    if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
      appAlert(messages.errorTitle, messages.exportWebMailShareError);
      return;
    }
    const { uri, filename } = webMailFollowUp;
    setBusy(true);
    try {
      const res = await fetch(uri);
      const blob = await res.blob();
      const file = new File([blob], filename, { type: 'application/pdf' });
      const data: ShareData = { files: [file] };
      if (typeof navigator.canShare === 'function' && !navigator.canShare(data)) {
        appAlert(messages.errorTitle, messages.exportWebMailShareError);
        return;
      }
      await navigator.share(data);
      dismissWebMailDialog(true);
    } catch (e: unknown) {
      const name = e && typeof e === 'object' && 'name' in e ? String((e as { name: string }).name) : '';
      if (name !== 'AbortError') {
        appAlert(messages.errorTitle, messages.exportWebMailShareError);
      }
    } finally {
      setBusy(false);
    }
  }, [webMailFollowUp, dismissWebMailDialog, messages]);

  const onWebOpenMailto = useCallback(() => {
    if (!webMailFollowUp || typeof window === 'undefined') return;
    window.location.href = webMailFollowUp.mailto;
    dismissWebMailDialog(false);
  }, [webMailFollowUp, dismissWebMailDialog]);

  const onWebDownloadPdf = useCallback(async () => {
    if (!webMailFollowUp) return;
    await shareFile(webMailFollowUp.uri, webMailFollowUp.filename);
    setWebMailFollowUp(null);
  }, [webMailFollowUp]);

  return (
    <KeyboardSafeScroll
      contentContainerStyle={[styles.page, { paddingTop: screenHeaderPaddingTop(insets.top) }]}
    >
      <View style={styles.topBar}>
        <HapticButton mode="text" onPress={() => router.back()}>
          {messages.exportBack}
        </HapticButton>
      </View>
      <Text variant="titleLarge">{messages.exportTitle}</Text>

      <Card>
        <Card.Content style={{ gap: 10 }}>
          <View style={styles.headerRow}>
            <HapticIconButton
              haptic="light"
              icon="chevron-left"
              mode="outlined"
              size={22}
              onPress={() => setMonth((m) => startOfMonth(addMonths(m, -1)))}
              disabled={busy}
            />
            <View style={styles.headerCenter}>
              <Text variant="titleMedium" style={styles.headerTitle} numberOfLines={1}>
                {title}
              </Text>
              <Text style={styles.headerSub} numberOfLines={1}>
                {meseKey}
              </Text>
            </View>
            <HapticIconButton
              haptic="light"
              icon="chevron-right"
              mode="outlined"
              size={22}
              onPress={() => setMonth((m) => startOfMonth(addMonths(m, 1)))}
              disabled={busy}
            />
          </View>

          <Divider />

          <HapticButton mode="contained" icon="file-pdf-box" onPress={onGeneratePdf} loading={busy} disabled={busy}>
            {messages.exportGeneratePdf}
          </HapticButton>

          <HapticButton mode="outlined" icon="file-excel" onPress={onGenerateExcel} loading={busy} disabled={busy}>
            {messages.exportGenerateExcel}
          </HapticButton>

          <HapticButton mode="outlined" icon="email-outline" onPress={onSendEmail} loading={busy} disabled={busy}>
            {messages.exportSendEmail}
          </HapticButton>
        </Card.Content>
      </Card>

      <Portal>
        <Dialog
          visible={scopeDialogOpen}
          onDismiss={() => !busy && closePdfDialogs()}
          dismissable={!busy}
        >
          <Dialog.Title>{messages.exportPdfDialogTitle}</Dialog.Title>
          <Dialog.Content style={{ gap: 4 }}>
            <Text style={{ marginBottom: 8, opacity: 0.72 }}>{messages.exportPdfDialogHint}</Text>
            <HapticButton
              mode="contained-tonal"
              onPress={() => {
                setScopeDialogOpen(false);
                void runPdfExport('presenze', false);
              }}
              disabled={busy}
            >
              {messages.exportPdfOptionPresenze}
            </HapticButton>
            <HapticButton
              mode="outlined"
              onPress={() => openAttachOrExport('spese')}
              disabled={busy}
            >
              {messages.exportPdfOptionSpese}
            </HapticButton>
            <HapticButton
              mode="outlined"
              onPress={() => openAttachOrExport('completo')}
              disabled={busy}
            >
              {messages.exportPdfOptionCompleto}
            </HapticButton>
            <HapticButton mode="text" onPress={() => closePdfDialogs()} disabled={busy}>
              {messages.resetCancel}
            </HapticButton>
          </Dialog.Content>
        </Dialog>

        <Dialog
          visible={attachDialogOpen}
          onDismiss={() => !busy && closePdfDialogs()}
          dismissable={!busy}
        >
          <Dialog.Title>{messages.exportAttachDialogTitle}</Dialog.Title>
          <Dialog.Content style={{ gap: 4 }}>
            <Text style={{ marginBottom: 8, opacity: 0.72 }}>{messages.exportAttachDialogHint}</Text>
            <HapticButton
              mode="contained-tonal"
              onPress={() => {
                const scope = pendingScope ?? 'completo';
                setAttachDialogOpen(false);
                void runPdfExport(scope, false);
              }}
              disabled={busy || !pendingScope}
            >
              {messages.exportAttachWithout}
            </HapticButton>
            <HapticButton
              mode="outlined"
              onPress={() => {
                const scope = pendingScope ?? 'completo';
                setAttachDialogOpen(false);
                void runPdfExport(scope, true);
              }}
              disabled={busy || !pendingScope}
            >
              {messages.exportAttachWith}
            </HapticButton>
            <HapticButton
              mode="text"
              onPress={() => {
                setAttachDialogOpen(false);
                setPendingScope(null);
                closePdfDialogs();
              }}
              disabled={busy}
            >
              {messages.resetCancel}
            </HapticButton>
          </Dialog.Content>
        </Dialog>

        <Dialog
          visible={Boolean(webMailFollowUp)}
          onDismiss={() => !busy && dismissWebMailDialog(true)}
          dismissable={!busy}
        >
          <Dialog.Title>{messages.exportWebMailDialogTitle}</Dialog.Title>
          <Dialog.Content style={{ gap: 10 }}>
            <Text style={{ opacity: 0.82 }}>{messages.exportWebMailDialogBody}</Text>
            <Text style={{ opacity: 0.65, fontSize: 12 }}>{messages.exportWebMailHint}</Text>
            <HapticButton mode="contained" icon="share-variant" onPress={() => void onWebSharePdf()} disabled={busy}>
              {messages.exportWebMailSharePdf}
            </HapticButton>
            <HapticButton mode="outlined" icon="email-outline" onPress={onWebOpenMailto} disabled={busy}>
              {messages.exportWebMailOpenMailApp}
            </HapticButton>
            <HapticButton mode="outlined" icon="download" onPress={() => void onWebDownloadPdf()} disabled={busy}>
              {messages.exportWebMailDownloadPdf}
            </HapticButton>
            <HapticButton mode="text" onPress={() => dismissWebMailDialog(true)} disabled={busy}>
              {messages.resetCancel}
            </HapticButton>
          </Dialog.Content>
        </Dialog>
      </Portal>
    </KeyboardSafeScroll>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 12,
  },
  topBar: {
    marginHorizontal: -4,
    alignSelf: 'flex-start',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerCenter: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
  },
  headerTitle: {
    textAlign: 'center',
    textTransform: 'capitalize',
  },
  headerSub: {
    textAlign: 'center',
    opacity: 0.65,
  },
});
