import { eachDayOfInterval, endOfMonth, format, parseISO, startOfMonth } from 'date-fns';
import { enUS, it } from 'date-fns/locale';
import { Asset } from 'expo-asset';
import { PDFDocument } from 'pdf-lib';

import type { GiornoRow, SpesaRow } from '../db/database';
import type { AppLanguage } from '../i18n/messages';
import { getAppReleaseVersion } from './appVersion';
import { companyLegalLines } from './companyInfo';
import { computePresenzeOreBreakdown } from './giorniMeseReport';
import { CATEGORIE_SPESE_ORDER, labelCategoriaSpesa } from './expenseCategories';
import { mimeKind } from './webAttachmentBlob';
import {
  isWebAttachmentRef,
  readWebAttachmentAsDataUrl,
  readWebAttachmentEntry,
  resolveWebAttachmentPreview,
} from './webAttachmentStore';

const LOGO_PNG = require('../assets/logo-riello.png');

/** html2pdf usa `self`: import statico rompe SSR Expo web. Carichiamo solo in browser al bisogno. */
let html2pdfLoader: Promise<(typeof import('html2pdf.js'))['default']> | null = null;
function loadHtml2Pdf() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('PDF web: esecuzione solo nel browser'));
  }
  if (!html2pdfLoader) {
    html2pdfLoader = import('html2pdf.js').then((m) => m.default);
  }
  return html2pdfLoader;
}

/** Margini pagina (jsPDF pt). ~34pt ≈ 12mm per lato. */
const PDF_PAGE_MARGIN_PT = 34;
const A4_WIDTH_PT = 595.28;
const A4_HEIGHT_PT = 841.89;

/** Larghezza contenuto in px CSS (96dpi) = inner width html2pdf dopo margini simmetrici. */
function pdfHostContentWidthPx(landscape: boolean): number {
  const pageWidthPt = landscape ? A4_HEIGHT_PT : A4_WIDTH_PT;
  const innerWPt = pageWidthPt - 2 * PDF_PAGE_MARGIN_PT;
  return Math.round((innerWPt * 96) / 72);
}

export type ReportMeseData = {
  meseKey: string;
  nomeUtente: string;
  /** legacy; i PDF usano i dati aziendali fissi dalla società */
  azienda: string;
  matricola: string;
  ufficio: string;
  giorni: GiornoRow[];
  spese: SpesaRow[];
  language?: AppLanguage;
  /** €/km dalle Impostazioni (lettera PDF rimborsi km) */
  eur_per_km_default?: number | null;
};

export type PdfExportScope = 'presenze' | 'spese' | 'completo';

export type GeneratePdfOptions = {
  scope: PdfExportScope;
  /** Immagini nel corpo + PDF in coda alla sezione allegati. Solo se la nota è inclusa nello scope. */
  includeAttachments: boolean;
};

function euro(n: number): string {
  const x = Number.isFinite(n) ? n : 0;
  return `€ ${x.toFixed(2)}`;
}

function safeText(s: string | null | undefined): string {
  const v = (s ?? '').trim();
  return v.replace(/[<>&"]/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case '"':
        return '&quot;';
      default:
        return c;
    }
  });
}

function spesaDettaglioPdf(s: SpesaRow): string {
  if (s.tipo === 'km' && (s.percorso_da?.trim() || s.percorso_a?.trim())) {
    const route = `${(s.percorso_da ?? '').trim()} → ${(s.percorso_a ?? '').trim()}`.trim();
    const desc = (s.descrizione ?? '').trim();
    return desc ? `${route} · ${desc}` : route;
  }
  return (s.descrizione ?? '').trim();
}

function base64ToUint8Array(base64: string): Uint8Array {
  const bin = atob(base64);
  const len = bin.length;
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    const sub = bytes.subarray(i, Math.min(i + chunk, bytes.length));
    for (let j = 0; j < sub.length; j++) binary += String.fromCharCode(sub[j]!);
  }
  return btoa(binary);
}

async function resolveAttachmentUriForWeb(uri: string): Promise<string> {
  if (isWebAttachmentRef(uri) || uri.startsWith('data:')) {
    const info = await resolveWebAttachmentPreview(uri);
    if (info.kind === 'image' || info.kind === 'pdf') {
      const dataUrl = await readWebAttachmentAsDataUrl(uri);
      if (dataUrl) return dataUrl;
    }
    return info.openUri;
  }
  return uri;
}

async function readFileUriAsUint8Array(uri: string): Promise<Uint8Array> {
  const resolved = await resolveAttachmentUriForWeb(uri);
  if (resolved.startsWith('data:')) {
    const i = resolved.indexOf(',');
    if (i < 0) return new Uint8Array();
    const meta = resolved.slice(0, i);
    const payload = resolved.slice(i + 1);
    if (meta.includes(';base64')) return base64ToUint8Array(payload);
    return new TextEncoder().encode(decodeURIComponent(payload));
  }
  const res = await fetch(resolved);
  return new Uint8Array(await res.arrayBuffer());
}

function sortedSpeseWithFoto(spese: SpesaRow[]): SpesaRow[] {
  return spese
    .filter((s) => (s.foto_path ?? '').trim())
    .slice()
    .sort((a, b) => (a.data > b.data ? -1 : a.data < b.data ? 1 : b.id - a.id));
}

async function isPdfAttachmentPath(fotoPath: string): Promise<boolean> {
  if (/^data:application\/pdf/i.test(fotoPath)) return true;
  if (isWebAttachmentRef(fotoPath)) {
    const entry = await readWebAttachmentEntry(fotoPath);
    if (entry?.mime) return mimeKind(entry.mime) === 'pdf';
    return false;
  }
  const ext = fotoPath.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
  return ext === 'pdf';
}

async function resolveLogoDataUri(): Promise<string | null> {
  try {
    const asset = Asset.fromModule(LOGO_PNG);
    await asset.downloadAsync();
    const uri = asset.localUri ?? asset.uri;
    if (!uri) return null;
    const res = await fetch(uri);
    const buf = await res.arrayBuffer();
    return `data:image/png;base64,${uint8ArrayToBase64(new Uint8Array(buf))}`;
  } catch {
    return null;
  }
}

function logoHeaderBlock(logoDataUri: string | null, extraClass = ''): string {
  if (!logoDataUri) return `<div class="logoRow ${extraClass}"><div class="logoSpacer"></div></div>`;
  return `
    <div class="logoRow ${extraClass}">
      <img class="logoImg" src="${logoDataUri}" alt="" />
      <div class="logoSpacer"></div>
    </div>`;
}

function dfLocale(lang: AppLanguage) {
  return lang === 'en' ? enUS : it;
}

function fmtHoursCell(n: number): string {
  const x = Number(n);
  if (!Number.isFinite(x) || x === 0) return '—';
  return x.toFixed(1);
}

function computePresenzeTotals(giorni: GiornoRow[]) {
  let giorniLavorati = 0;
  let oreTot = 0;
  let giorniTrasferta = 0;
  let giorniMalattia = 0;
  let giorniFeriePermesso = 0;

  for (const g of giorni) {
    if (g.tipo === 'lavoro' || g.tipo === 'permesso' || g.tipo === 'trasferta') {
      giorniLavorati += 1;
      oreTot += Number(g.ore ?? 0) + Number(g.ore_trasferta ?? 0) + Number(g.ore_permesso ?? 0);
    }
    if (g.tipo === 'trasferta' || g.trasferta === 1) giorniTrasferta += 1;
    if (g.tipo === 'malattia') giorniMalattia += 1;
    if (g.tipo === 'ferie' || g.tipo === 'permesso') giorniFeriePermesso += 1;
  }

  return { giorniLavorati, oreTot, giorniTrasferta, giorniMalattia, giorniFeriePermesso };
}

function formatRecapOrePdf(n: number): string {
  const x = Number(n);
  if (!Number.isFinite(x) || Math.abs(x) < 0.01) return '—';
  return `${x.toFixed(1)} h`;
}

function buildPresenzeRecapLandscapeHtml(
  ore: ReturnType<typeof computePresenzeOreBreakdown>,
  giorni: ReturnType<typeof computePresenzeTotals>,
  S: ReturnType<typeof pdfStrings>
): string {
  const o1 = safeText(formatRecapOrePdf(ore.oreLavorateSede));
  const o2 = safeText(formatRecapOrePdf(ore.oreTrasferta));
  const o3 = safeText(formatRecapOrePdf(ore.oreFeriePermessi));
  const o4 = safeText(formatRecapOrePdf(ore.oreMalattia));
  return `
    <div class="recapWrap">
      <div class="recapBlock">
        <div class="recapBlockTitle">${safeText(S.recapOreTitle)}</div>
        <table class="recap">
          <tbody>
            <tr><td>${safeText(S.oreLavorateRecap)}</td><td class="recapVal">${o1}</td></tr>
            <tr><td>${safeText(S.oreTrasfertaRecap)}</td><td class="recapVal">${o2}</td></tr>
            <tr><td>${safeText(S.oreFeriePermessiRecap)}</td><td class="recapVal">${o3}</td></tr>
            <tr><td>${safeText(S.oreMalattiaRecap)}</td><td class="recapVal">${o4}</td></tr>
          </tbody>
        </table>
      </div>
      <div class="recapBlock">
        <div class="recapBlockTitle">${safeText(S.recapGiorniTitle)}</div>
        <table class="recap">
          <tbody>
            <tr><td>${safeText(S.workedDays)}</td><td class="recapVal">${giorni.giorniLavorati}</td></tr>
            <tr><td>${safeText(S.travelDays)}</td><td class="recapVal">${giorni.giorniTrasferta}</td></tr>
            <tr><td>${safeText(S.leaveDays)}</td><td class="recapVal">${giorni.giorniFeriePermesso}</td></tr>
            <tr><td>${safeText(S.sickDays)}</td><td class="recapVal">${giorni.giorniMalattia}</td></tr>
          </tbody>
        </table>
      </div>
    </div>`;
}

function pdfStrings(lang: AppLanguage) {
  if (lang === 'en') {
    return {
      reportMonthly: 'Monthly report',
      presMatrix: 'Attendance',
      travelDetailTitle: 'Travel details',
      travelColDate: 'Date',
      travelColHours: 'Travel h',
      travelColPlace: 'Location',
      travelColProject: 'Project',
      travelNone: 'No travel entries this month.',
      rowLavorate: 'Worked',
      rowTrasferta: 'Travel',
      rowPermFerie: 'Leave / holiday',
      rowMalattia: 'Sick leave',
      rowTotale: 'Daily total',
      expenses: 'Expense report',
      category: 'Category',
      detail: 'Detail',
      amount: 'Amount',
      date: 'Date',
      attachmentsTitle: 'Receipts & attachments',
      attachmentMissing: 'Attached file was not found on this device.',
      attachmentPdfLine: 'The PDF follows in this document (following pages).',
      attachmentDocLine: 'Document',
      attachmentFormatUnsupported: 'This format cannot be embedded in the PDF; the file remains saved in the app.',
      workedDays: 'Worked days',
      totalHours: 'Total hours',
      travelDays: 'Travel days',
      sickDays: 'Sick days',
      leaveDays: 'Leave / permission days',
      recapOreTitle: 'Hours summary',
      recapGiorniTitle: 'Days summary',
      oreLavorateRecap: 'Worked hours (office)',
      oreTrasfertaRecap: 'Travel hours',
      oreFeriePermessiRecap: 'Leave / holiday hours',
      oreMalattiaRecap: 'Sick leave hours',
      nonePres: 'No attendance data.',
      notaTitle: 'Expense report',
      dipLabel: 'Employee / contractor',
      matricolaLabel: 'Employee ID',
      ufficioLabel: 'Office',
      ragSocLabel: 'Company legal name & address',
      meseRifLabel: 'Reference month',
      dataDocLabel: 'Document date',
      descrSpeseTitle: 'Expense description',
      subtotEsclusoKm: 'Expense subtotal',
      rimborsoKmTitle: 'Mileage reimbursements (km)',
      totaleComplessivo: 'TOTAL',
      firmaLabel: 'Employee / contractor signature',
      noneCat: 'No amounts in this section.',
      kmLetterCity: 'Milan',
      kmLetterTitle: 'Mileage reimbursement — Appointment letter',
      kmLetterTitle2: 'Mileage reimbursements',
      kmLetterSignCompany: 'Company stamp & signature',
      kmTableDescrizione: 'Description',
      kmTableProgetto: 'Project',
      kmTableKm: 'Km',
      kmTableRimb: 'Mileage (€)',
      kmTableTot: 'Total for mileage reimbursements',
      kmBox1Lead:
        'The undersigned hereby appoints employee Mr/Ms {{name}}, employee no. {{id}}, to carry out on our behalf the following assignment: portfolio company management/support activities and analysis of potential new investments.',
      kmBox1Period: 'Reference period:',
      kmBox1Itinerary: 'Planned itinerary: As detailed below.',
      kmBox2Lead:
        'The undersigned hereby appoints employee Mr/Ms {{name}}, employee no. {{id}}, to use their own motor vehicle for the routes necessary for the assignment described above.',
      kmKmPlannedLabel: 'Planned kilometres:',
      kmAmtPerKmLabel: 'Allowance per km',
      kmModelUnknown: '[vehicle model]',
      exportFooter: (ver: string) => `WorkTracker export — app version ${safeText(ver)}`,
    };
  }
  return {
    reportMonthly: 'Report mensile',
    presMatrix: 'Presenze',
    travelDetailTitle: 'Dettaglio trasferte',
    travelColDate: 'Data',
    travelColHours: 'Ore trasferta',
    travelColPlace: 'Luogo',
    travelColProject: 'Progetto',
    travelNone: 'Nessuna trasferta registrata nel mese.',
    rowLavorate: 'Lavorate',
    rowTrasferta: 'Trasferta',
    rowPermFerie: 'Permessi / ferie',
    rowMalattia: 'Malattia',
    rowTotale: 'Totale giorno',
    expenses: 'Nota spese',
    category: 'Categoria',
    detail: 'Dettaglio',
    amount: 'Importo',
    date: 'Data',
    attachmentsTitle: 'Allegati documenti',
    attachmentMissing: 'File allegato non trovato sul dispositivo.',
    attachmentPdfLine: 'Il PDF è riportato nelle pagine successive di questa sezione.',
    attachmentDocLine: 'Documento',
    attachmentFormatUnsupported: "Formato non incorporabile nel PDF; il file resta salvato nell'app.",
    workedDays: 'Giorni lavorati',
    totalHours: 'Ore totali',
    travelDays: 'Giorni trasferta',
      sickDays: 'Giorni malattia',
      leaveDays: 'Giorni ferie/permesso',
      recapOreTitle: 'Riepilogo ore',
      recapGiorniTitle: 'Riepilogo giorni',
      oreLavorateRecap: 'Ore lavorate',
      oreTrasfertaRecap: 'Ore trasferta',
      oreFeriePermessiRecap: 'Ore ferie / permessi',
      oreMalattiaRecap: 'Ore malattia',
      nonePres: 'Nessun dato presenze.',
    notaTitle: 'Nota Spese',
    dipLabel: 'Dipendente / collaboratore',
    matricolaLabel: 'Matricola',
    ufficioLabel: 'Ufficio',
    ragSocLabel: 'Ragione sociale dell\'azienda',
    meseRifLabel: 'Mese di riferimento',
    dataDocLabel: 'Data del documento',
    descrSpeseTitle: 'Descrizione delle spese',
    subtotEsclusoKm: 'Subtotale Spese',
    rimborsoKmTitle: 'Rimborsi chilometrici (km)',
    totaleComplessivo: 'TOTALE',
    firmaLabel: 'Firma del dipendente / collaboratore',
    noneCat: 'Nessun importo in questa sezione.',
    kmLetterCity: 'Milano',
    kmLetterTitle: 'Rimborso Chilometrico — Lettera di incarico',
    kmLetterTitle2: 'Rimborsi Chilometrici',
    kmLetterSignCompany: 'Timbro e firma dell\'azienda',
    kmTableDescrizione: 'Descrizione',
    kmTableProgetto: 'Progetto',
    kmTableKm: 'Km',
    kmTableRimb: 'Rimb. Km (€)',
    kmTableTot: 'Totale per rimborsi km',
    kmBox1Lead:
      'Si incarica il ns. dipendente Sig. {{name}}, matr. {{id}}, a svolgere per ns. conto la seguente missione: attività di gestione e supporto presso aziende in portafoglio e analisi di potenziali nuovi investimenti.',
    kmBox1Period: 'Periodo di riferimento:',
    kmBox1Itinerary: 'Itinerario previsto: Come da dettaglio in basso.',
    kmBox2Lead:
      'Si incarica il ns. dipendente Sig. {{name}}, matr. {{id}}, ad usare il proprio automezzo per effettuare i percorsi necessari a svolgere la missione sopradescritta.',
    kmKmPlannedLabel: 'Km previsti:',
    kmAmtPerKmLabel: 'Importo al km',
    kmModelUnknown: '[modello dell\'auto]',
    exportFooter: (ver: string) => `Export WorkTracker — versione app ${safeText(ver)}`,
  };
}

function exportFooterDiv(lang: AppLanguage): string {
  const S = pdfStrings(lang);
  return `<div class="exportAppFooter">${S.exportFooter(getAppReleaseVersion())}</div>`;
}

function interpolateKmTpl(tpl: string, name: string, matricola: string): string {
  return tpl
    .replace(/\{\{name\}\}/g, safeText(name) || '—')
    .replace(/\{\{id\}\}/g, safeText(matricola) || '—');
}

function notaPortraitMeseDataDoc(input: ReportMeseData, lang: AppLanguage): { meseLabel: string; dataDoc: string } {
  const loc = dfLocale(lang);
  const meseLabel = (() => {
    try {
      const d = parseISO(`${input.meseKey}-01`);
      return format(d, 'LLLL yyyy', { locale: loc });
    } catch {
      return input.meseKey;
    }
  })();
  const dataDoc = format(new Date(), 'dd/MM/yyyy', { locale: loc });
  return { meseLabel, dataDoc };
}

function buildNotaPortraitHeaderHtml(
  input: ReportMeseData,
  lang: AppLanguage,
  logoDataUri: string | null,
  meseLabel: string,
  dataDoc: string
): string {
  const S = pdfStrings(lang);
  const ragSocCellHtml = companyLegalLines()
    .map((line) => safeText(line))
    .join('<br />');
  return `
    ${logoHeaderBlock(logoDataUri)}
    <h1>${safeText(S.notaTitle)}</h1>
    <table class="fieldTable">
      <tr><th>${safeText(S.dipLabel)}</th><td>${safeText(input.nomeUtente || '—')}</td></tr>
      <tr><th>${safeText(S.matricolaLabel)}</th><td>${safeText(input.matricola || '—')}</td></tr>
      <tr><th>${safeText(S.ufficioLabel)}</th><td>${safeText(input.ufficio || '—')}</td></tr>
      <tr><th>${safeText(S.ragSocLabel)}</th><td>${ragSocCellHtml}</td></tr>
      <tr><th>${safeText(S.meseRifLabel)}</th><td>${safeText(meseLabel)}</td></tr>
      <tr><th>${safeText(S.dataDocLabel)}</th><td>${safeText(dataDoc)}</td></tr>
    </table>`;
}

function collectKmSpese(spese: SpesaRow[]): SpesaRow[] {
  return spese
    .filter((s) => s.tipo === 'km')
    .slice()
    .sort((a, b) => a.data.localeCompare(b.data) || a.id - b.id);
}

function periodRangeForMonthPdf(meseKey: string, lang: AppLanguage): string {
  const loc = dfLocale(lang);
  try {
    const anchor = parseISO(`${meseKey}-01`);
    const start = startOfMonth(anchor);
    const end = endOfMonth(anchor);
    const d1 = format(start, 'd', { locale: loc });
    const d2 = format(end, 'd MMMM yyyy', { locale: loc });
    return lang === 'en' ? `From ${d1} to ${d2}` : `dal ${d1} al ${d2}`;
  } catch {
    return meseKey;
  }
}

function resolveEurPerKmLetter(kmRows: SpesaRow[], settingsRate: number | null | undefined): string {
  const sr = settingsRate != null && Number.isFinite(Number(settingsRate)) && Number(settingsRate) > 0 ? Number(settingsRate) : null;
  if (sr != null) return euro(sr);
  const totK = kmRows.reduce((a, s) => a + Number(s.km ?? 0), 0);
  const totI = kmRows.reduce((a, s) => a + Number(s.importo ?? 0), 0);
  if (totK > 0) return euro(totI / totK);
  const first = kmRows.find((r) => r.eur_per_km != null && Number(r.eur_per_km) > 0);
  if (first) return euro(Number(first.eur_per_km));
  return '—';
}

function modelloAutoDisplayKm(kmRows: SpesaRow[], placeholderTpl: string): string {
  for (const r of kmRows) {
    const m = (r.modello_auto ?? '').trim();
    if (m) return safeText(m);
  }
  return safeText(placeholderTpl);
}

function kmLetterSignatureFooter(S: ReturnType<typeof pdfStrings>, dataDoc: string): string {
  return `
    <div class="kmSignRow">
      <div class="kmSignLeft">${safeText(S.kmLetterCity)}, ${safeText(dataDoc)}</div>
      <div class="kmSignRight">
        <div class="kmSignLine"></div>
        <div class="kmSignHint">${safeText(S.kmLetterSignCompany)}</div>
      </div>
    </div>`;
}

function buildRimborsoKmLetterPortraitHtml(
  input: ReportMeseData,
  lang: AppLanguage,
  logoDataUri: string | null,
  kmRows: SpesaRow[]
): string {
  const S = pdfStrings(lang);
  const loc = dfLocale(lang);
  const { meseLabel, dataDoc } = notaPortraitMeseDataDoc(input, lang);
  const header = buildNotaPortraitHeaderHtml(input, lang, logoDataUri, meseLabel, dataDoc);
  const periodo = safeText(periodRangeForMonthPdf(input.meseKey, lang));

  const p1Lead = interpolateKmTpl(S.kmBox1Lead, input.nomeUtente, input.matricola);
  const p2Lead = interpolateKmTpl(S.kmBox2Lead, input.nomeUtente, input.matricola);
  const modelloTxt = modelloAutoDisplayKm(kmRows, S.kmModelUnknown);
  const totKmRaw = kmRows.reduce((a, s) => a + Number(s.km ?? 0), 0);
  const totKmFmt = Number.isFinite(totKmRaw) ? (totKmRaw % 1 === 0 ? String(totKmRaw) : totKmRaw.toFixed(1)) : '—';
  const eurKmStr = resolveEurPerKmLetter(kmRows, input.eur_per_km_default);

  const fmtDataCell = (ymd: string) => {
    try {
      return format(parseISO(ymd), lang === 'en' ? 'dd/MM/yyyy' : 'dd/MM/yyyy', { locale: loc });
    } catch {
      return safeText(ymd);
    }
  };

  const bodyRows = kmRows
    .map((s) => {
      const desc = safeText(spesaDettaglioPdf(s)) || '—';
      const proj = safeText((s.progetto ?? '').trim()) || '—';
      const kmCell = Number(s.km ?? 0);
      const kmS = Number.isFinite(kmCell) ? (kmCell % 1 === 0 ? String(kmCell) : kmCell.toFixed(1)) : '—';
      const imp = euro(s.importo ?? 0);
      return `<tr>
        <td>${safeText(fmtDataCell(s.data))}</td>
        <td class="kmDescr">${desc}</td>
        <td>${proj}</td>
        <td class="num">${kmS}</td>
        <td class="num">${imp}</td>
      </tr>`;
    })
    .join('');

  const rimTot = kmRows.reduce((a, s) => a + Number(s.importo ?? 0), 0);

  const tableHtml = `
    <table class="kmRecap">
      <colgroup>
        <col class="kmColDate" />
        <col class="kmColDescr" />
        <col class="kmColProj" />
        <col class="kmColKm" />
        <col class="kmColEuro" />
      </colgroup>
      <thead>
        <tr>
          <th>${safeText(S.date)}</th>
          <th class="kmDescr">${safeText(S.kmTableDescrizione)}</th>
          <th>${safeText(S.kmTableProgetto)}</th>
          <th class="num">${safeText(S.kmTableKm)}</th>
          <th class="num">${safeText(S.kmTableRimb)}</th>
        </tr>
      </thead>
      <tbody>
        ${bodyRows}
        <tr>
          <td colspan="3" class="kmTotLabel" style="font-weight:700;background:#fafafa">${safeText(S.kmTableTot)}</td>
          <td class="num" style="font-weight:700;background:#fafafa">${safeText(totKmFmt)}</td>
          <td class="num" style="font-weight:700;background:#fafafa">${euro(rimTot)}</td>
        </tr>
      </tbody>
    </table>`;

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      @page { size: A4 portrait; margin: 12mm 14mm; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
        padding: 0;
        padding-top: 14px;
        margin: 0;
        color: #111827;
        font-size: 10px;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      ${sharedPortraitStyles()}
    </style>
  </head>
  <body>
    ${header}
    <div class="kmLetterBox">
      <h2>${safeText(S.kmLetterTitle)}</h2>
      <p>${p1Lead}</p>
      <p><strong>${safeText(S.kmBox1Period)}</strong> ${periodo}</p>
      <p>${safeText(S.kmBox1Itinerary)}</p>
      ${kmLetterSignatureFooter(S, dataDoc)}
    </div>

    <div class="kmLetterBox">
      <h2>${safeText(S.kmLetterTitle2)}</h2>
      <p>${p2Lead}</p>
      <p>${modelloTxt}</p>
      <p><strong>${safeText(S.kmKmPlannedLabel)}</strong> ${safeText(totKmFmt)}</p>
      <p><strong>${safeText(S.kmAmtPerKmLabel)}:</strong> ${safeText(eurKmStr)}</p>
      ${kmLetterSignatureFooter(S, dataDoc)}
    </div>

    ${tableHtml}
    ${exportFooterDiv(lang)}
  </body>
</html>`;
}

function buildPresenzeMatrixHtml(giorni: GiornoRow[], meseKey: string, lang: AppLanguage): string {
  const loc = dfLocale(lang);
  const S = pdfStrings(lang);
  const anchor = parseISO(`${meseKey}-01`);
  const days = eachDayOfInterval({ start: startOfMonth(anchor), end: endOfMonth(anchor) });
  const byData = new Map(giorni.map((g) => [g.data, g]));

  type Col = { g: GiornoRow; gray: boolean; dayNum: string; wShort: string };
  const cols: Col[] = days.map((d) => {
    const ymd = format(d, 'yyyy-MM-dd');
    const g =
      byData.get(ymd) ??
      ({
        id: 0,
        data: ymd,
        tipo: 'lavoro',
        ore: 0,
        trasferta: 0,
        ore_trasferta: 0,
        ore_permesso: 0,
        luogo: null,
        progetto: null,
        note: null,
      } as GiornoRow);
    const dow = d.getDay();
    const gray = dow === 0 || dow === 6 || g.tipo === 'festivita' || g.tipo === 'weekend';
    return {
      g,
      gray,
      dayNum: format(d, 'd'),
      wShort: format(d, 'EEEEE', { locale: loc }),
    };
  });

  const cellLavorate = (g: GiornoRow) => {
    if (g.tipo === 'malattia' || g.tipo === 'ferie' || g.tipo === 'festivita' || g.tipo === 'weekend') return '—';
    if (g.tipo === 'permesso') return '—';
    return fmtHoursCell(Number(g.ore ?? 0));
  };
  const cellTrasferta = (g: GiornoRow) => {
    const t = Number(g.ore_trasferta ?? 0);
    if (t > 0) return fmtHoursCell(t);
    return '—';
  };
  const orePermessoCell = (g: GiornoRow) => Number(g.ore_permesso ?? 0);
  const cellPermFerie = (g: GiornoRow) => {
    if (g.tipo === 'ferie') return 'F';
    if (g.tipo === 'permesso') return fmtHoursCell(orePermessoCell(g) || Number(g.ore ?? 0));
    const p = orePermessoCell(g);
    if (p > 0) return fmtHoursCell(p);
    return '—';
  };
  const cellMalattia = (g: GiornoRow) => (g.tipo === 'malattia' ? '●' : '—');
  const cellTotale = (g: GiornoRow) => {
    const n = Number(g.ore ?? 0) + Number(g.ore_trasferta ?? 0) + orePermessoCell(g);
    if (n > 0) return fmtHoursCell(n);
    return '—';
  };

  const WK_INLINE =
    'background-color:#cfd4dc;color:#374151;-webkit-print-color-adjust:exact;print-color-adjust:exact;';

  const thNums = cols
    .map((c) => `<th class="dc${c.gray ? ' wk' : ''}"${c.gray ? ` style="${WK_INLINE}"` : ''}>${c.dayNum}</th>`)
    .join('');
  const thDays = cols
    .map(
      (c) =>
        `<th class="dc dhead${c.gray ? ' wk' : ''}"${c.gray ? ` style="${WK_INLINE}"` : ''}>${safeText(c.wShort)}</th>`
    )
    .join('');

  const mkRow = (label: string, fn: (g: GiornoRow) => string) => {
    const tds = cols
      .map(
        (c) =>
          `<td class="dc num${c.gray ? ' wk' : ''}"${c.gray ? ` style="${WK_INLINE}"` : ''}>${fn(c.g)}</td>`
      )
      .join('');
    return `<tr><th class="rowlab">${safeText(label)}</th>${tds}</tr>`;
  };

  return `
    <div class="matrixWrap">
      <table class="matrix">
        <thead>
          <tr><th class="rowlab"></th>${thNums}</tr>
          <tr><th class="rowlab"></th>${thDays}</tr>
        </thead>
        <tbody>
          ${mkRow(S.rowLavorate, cellLavorate)}
          ${mkRow(S.rowTrasferta, cellTrasferta)}
          ${mkRow(S.rowPermFerie, cellPermFerie)}
          ${mkRow(S.rowMalattia, cellMalattia)}
          ${mkRow(S.rowTotale, cellTotale)}
        </tbody>
      </table>
    </div>`;
}

function buildTrasferteDetailHtml(giorni: GiornoRow[], lang: AppLanguage): string {
  const S = pdfStrings(lang);
  const loc = dfLocale(lang);
  const rows = giorni
    .filter((g) => Number(g.ore_trasferta ?? 0) > 0 || g.tipo === 'trasferta' || g.trasferta === 1)
    .sort((a, b) => a.data.localeCompare(b.data));

  if (rows.length === 0) {
    return `
    <div class="travelBlock">
      <h3 class="travelTitle">${safeText(S.travelDetailTitle)}</h3>
      <p class="travelEmpty">${safeText(S.travelNone)}</p>
    </div>`;
  }

  const fmtData = (ymd: string) => {
    try {
      return format(parseISO(ymd), 'EEE d MMM yyyy', { locale: loc });
    } catch {
      return ymd;
    }
  };

  const body = rows
    .map((g) => {
      const h = Number(g.ore_trasferta ?? 0);
      const hours = Number.isFinite(h) && h > 0 ? `${h.toFixed(1)} h` : '—';
      return `<tr>
        <td class="t-date">${safeText(fmtData(g.data))}</td>
        <td class="num t-hours">${safeText(hours)}</td>
        <td class="t-place">${safeText(g.luogo) || '—'}</td>
        <td class="t-proj">${safeText(g.progetto) || '—'}</td>
      </tr>`;
    })
    .join('');

  return `
    <div class="travelBlock">
      <h3 class="travelTitle">${safeText(S.travelDetailTitle)}</h3>
      <table class="trasf">
        <thead>
          <tr>
            <th>${safeText(S.travelColDate)}</th>
            <th class="num">${safeText(S.travelColHours)}</th>
            <th>${safeText(S.travelColPlace)}</th>
            <th>${safeText(S.travelColProject)}</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>`;
}

async function webFileExists(uri: string): Promise<boolean> {
  if (isWebAttachmentRef(uri)) {
    const dataUrl = await readWebAttachmentAsDataUrl(uri);
    return Boolean(dataUrl);
  }
  if (uri.startsWith('data:')) return true;
  try {
    const r = await fetch(uri, { method: 'HEAD' });
    return r.ok;
  } catch {
    try {
      const r = await fetch(uri);
      return r.ok;
    } catch {
      return false;
    }
  }
}

async function fileToPdfEmbedHtml(fotoPath: string, lang: AppLanguage): Promise<string> {
  const S = pdfStrings(lang);
  try {
    if (!(await webFileExists(fotoPath))) return `<p class="attNote">${safeText(S.attachmentMissing)}</p>`;
  } catch {
    return `<p class="attNote">${safeText(S.attachmentMissing)}</p>`;
  }

  const info = await resolveWebAttachmentPreview(fotoPath);

  if (info.kind === 'pdf') {
    return `<p class="attNote">${safeText(S.attachmentPdfLine)} <strong>${safeText(info.label)}</strong></p>`;
  }

  if (info.kind === 'image') {
    try {
      const resolvedPath = await resolveAttachmentUriForWeb(fotoPath);
      const mime = info.mime || 'image/jpeg';
      if (resolvedPath.startsWith('data:')) {
        return `<div class="attImgWrap"><img class="attImg" src="${resolvedPath}" alt="" /></div>`;
      }
      const b64 = uint8ArrayToBase64(await readFileUriAsUint8Array(fotoPath));
      return `<div class="attImgWrap"><img class="attImg" src="data:${mime};base64,${b64}" alt="" /></div>`;
    } catch {
      return `<p class="attNote">${safeText(S.attachmentMissing)}</p>`;
    }
  }
  if (info.mime.includes('heic') || info.mime.includes('heif')) {
    return `<p class="attNote">${safeText(S.attachmentFormatUnsupported)}</p>`;
  }

  return `<p class="attNote">${safeText(S.attachmentDocLine)}: <strong>${safeText(info.label)}</strong></p>`;
}

async function buildSpeseAttachmentsBlock(spese: SpesaRow[], lang: AppLanguage): Promise<string> {
  const S = pdfStrings(lang);
  const rows = spese.filter((s) => (s.foto_path ?? '').trim());
  if (rows.length === 0) return '';
  const chunks = await Promise.all(
    rows.map(async (s) => {
      const d = safeText(s.data);
      const cat = safeText(labelCategoriaSpesa(s.tipo, lang));
      const euroStr = euro(s.importo ?? 0);
      const body = await fileToPdfEmbedHtml(s.foto_path!.trim(), lang);
      return `<div class="attCard"><div class="attCardHead">${d} · ${cat} · ${euroStr}</div>${body}</div>`;
    })
  );
  return `
    <h3 class="attSectionTitle">${safeText(S.attachmentsTitle)}</h3>
    <div class="attSection">${chunks.join('')}</div>`;
}

function sharedPortraitStyles(): string {
  return `
      .logoRow { display: flex; align-items: flex-start; justify-content: flex-start; margin-bottom: 10px; gap: 10px; }
      .logoImg { height: 44px; width: auto; max-width: 180px; object-fit: contain; }
      .logoSpacer { flex: 1; }
      h1 { font-size: 17px; margin: 0 0 6px; font-weight: 700; }
      h2 { font-size: 12px; margin: 12px 0 6px; font-weight: 700; color: #111827; }
      h3 { font-size: 11px; margin: 0 0 6px; font-weight: 700; color: #374151; }
      .muted { color: #6b7280; font-size: 10px; }
      .fieldTable { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 6px; }
      .fieldTable th { text-align: left; width: 42%; vertical-align: top; padding: 4px 6px 4px 0; color: #374151; font-weight: 700; }
      .fieldTable td { vertical-align: top; padding: 4px 0; border-bottom: 1px solid #f3f4f6; }
      table.std { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 4px; }
      table.std th, table.std td { border-bottom: 1px solid #e5e7eb; padding: 5px 4px; vertical-align: top; }
      table.std th { text-align: left; background: #f9fafb; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-weight: 700; }
      .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
      .signBox { margin-top: 22px; border: 1px solid #d1d5db; border-radius: 8px; padding: 12px 12px 36px 12px; }
      .signHint { font-size: 10px; color: #374151; font-weight: 600; margin: 0 0 28px 0; }
      .footerNote { margin-top: 10px; font-size: 9px; color: #9ca3af; }
      .attSectionTitle { margin-top: 10px; margin-bottom: 8px; font-size: 11px; }
      .attSection { display: flex; flex-direction: column; flex-wrap: nowrap; gap: 12px; align-items: stretch; }
      .attCard { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; background: #fafafa; width: 100%; max-width: 100%; box-sizing: border-box; flex: 0 0 auto; }
      .attCardHead { font-size: 8px; font-weight: 600; margin-bottom: 8px; color: #374151; }
      .attImgWrap { text-align: center; width: 100%; }
      .attImg { max-width: 100%; width: auto; height: auto; max-height: 480px; object-fit: contain; object-position: center; display: block; margin: 0 auto; }
      .attNote { font-size: 8px; color: #6b7280; margin: 0; line-height: 1.35; }
      .kmLetterBox {
        border: 1px solid #e5e7eb;
        border-radius: 10px;
        padding: 12px 14px;
        margin-top: 12px;
        font-size: 10px;
        line-height: 1.45;
      }
      .kmLetterBox > h2 { margin: 0 0 8px; font-size: 11px; font-weight: 700; color: #111827; }
      .kmLetterBox p { margin: 6px 0 0; }
      .kmSignRow {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-top: 14px;
        gap: 16px;
        flex-wrap: wrap;
      }
      .kmSignLeft { font-size: 10px; font-weight: 600; white-space: nowrap; }
      .kmSignRight { flex: 1; min-width: 200px; max-width: 300px; }
      .kmSignLine { border-bottom: 1px solid #374151; width: 100%; margin-top: 10px; }
      .kmSignHint { font-size: 8px; color: #6b7280; margin-top: 2px; }
      table.kmRecap { width: 100%; border-collapse: collapse; font-size: 9px; margin-top: 14px; table-layout: fixed; }
      table.kmRecap col.kmColDate { width: 12%; }
      table.kmRecap col.kmColDescr { width: 42%; }
      table.kmRecap col.kmColProj { width: 20%; }
      table.kmRecap col.kmColKm { width: 11%; }
      table.kmRecap col.kmColEuro { width: 15%; }
      table.kmRecap th.kmDescr, table.kmRecap td.kmDescr {
        word-wrap: break-word;
        overflow-wrap: anywhere;
      }
      table.kmRecap td.kmTotLabel { text-align: left; vertical-align: middle; }
      table.kmRecap th, table.kmRecap td { border: 1px solid #e5e7eb; padding: 5px 4px; vertical-align: top; }
      table.kmRecap th { background: #f9fafb; font-weight: 700; text-align: left; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .exportAppFooter { margin-top: 18px; padding-top: 10px; font-size: 8.5px; color: #b0b8c4; text-align: center; line-height: 1.4; }
  `;
}

function sharedLandscapeStyles(): string {
  return `
      .logoRow { display: flex; align-items: flex-start; justify-content: flex-start; margin-bottom: 10px; gap: 10px; }
      .logoImg { height: 40px; width: auto; max-width: 170px; object-fit: contain; }
      .logoSpacer { flex: 1; }
      body {
        padding: 12px 18px 16px 18px;
        margin: 0;
        color: #111827;
        font-size: 10px;
      }
      h1.headTitle { font-size: 14px; margin: 0 0 2px; font-weight: 700; }
      .mutedLine { margin-top: 2px; font-size: 9px; color: #6b7280; }
      h2.sectionTitle { font-size: 12px; margin: 10px 0 8px; font-weight: 700; color: #111827; }
      .box { border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px 14px; margin-bottom: 10px; }
      .matrixWrap { overflow: hidden; width: 100%; margin-top: 4px; }
      table.matrix { width: 100%; border-collapse: collapse; font-size: 6.5px; table-layout: fixed; }
      table.matrix th, table.matrix td { border: 1px solid #d1d5db; padding: 2px 1px; vertical-align: middle; }
      table.matrix th.rowlab { width: 64px; text-align: left; background: #f9fafb; font-weight: 700; }
      table.matrix th.dc, table.matrix td.dc { text-align: center; overflow: hidden; }
      table.matrix th.dhead { font-weight: 800; }
      table.matrix th.wk,
      table.matrix td.wk {
        background-color: #cfd4dc !important;
        background: #cfd4dc !important;
        color: #374151 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .travelBlock { margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb; }
      .travelTitle { margin-bottom: 8px; font-size: 11px; }
      .travelEmpty { margin: 0; color: #6b7280; font-size: 9px; }
      table.trasf { width: 100%; border-collapse: collapse; font-size: 9px; margin-top: 2px; table-layout: fixed; }
      table.trasf th, table.trasf td { border: 1px solid #e5e7eb; padding: 6px 8px; vertical-align: top; width: 25%; word-wrap: break-word; overflow-wrap: anywhere; }
      table.trasf th { background: #eff6ff; text-align: left; font-weight: 700; color: #1e3a8a; }
      table.trasf tbody tr:nth-child(even) { background: #f9fafb; }
      .t-date { font-weight: 600; }
      .t-hours { white-space: nowrap; }
      .recapWrap { margin-top: 14px; padding-top: 12px; border-top: 1px solid #e5e7eb; display: flex; flex-wrap: wrap; gap: 18px 28px; align-items: flex-start; justify-content: flex-start; }
      .recapBlock { flex: 1 1 260px; min-width: 240px; max-width: 340px; }
      .recapBlockTitle { font-size: 10px; font-weight: 700; color: #111827; margin: 0 0 8px 0; letter-spacing: 0.02em; }
      table.recap { width: 100%; border-collapse: collapse; font-size: 9px; }
      table.recap td { padding: 6px 4px; border-bottom: 1px solid #f3f4f6; vertical-align: top; color: #374151; }
      table.recap td.recapVal { text-align: right; font-weight: 700; white-space: nowrap; font-variant-numeric: tabular-nums; color: #111827; }
      .num { text-align: right; font-variant-numeric: tabular-nums; }
      .exportAppFooter { margin-top: 16px; padding-top: 8px; font-size: 8.5px; color: #b0b8c4; text-align: center; line-height: 1.4; }
  `;
}

function buildNotaSpeseCoverPortraitHtml(input: ReportMeseData, lang: AppLanguage, logoDataUri: string | null): string {
  const S = pdfStrings(lang);
  const { meseLabel, dataDoc } = notaPortraitMeseDataDoc(input, lang);
  const header = buildNotaPortraitHeaderHtml(input, lang, logoDataUri, meseLabel, dataDoc);

  const acc = new Map<string, number>();
  for (const s of input.spese) {
    if (s.tipo === 'km') continue;
    acc.set(s.tipo, (acc.get(s.tipo) ?? 0) + (s.importo ?? 0));
  }

  const catRows = CATEGORIE_SPESE_ORDER.filter((k) => k !== 'km')
    .map((k) => ({ k, v: acc.get(k) ?? 0 }))
    .filter((x) => x.v > 0)
    .map(
      (x) =>
        `<tr><td>${safeText(labelCategoriaSpesa(x.k, lang))}</td><td class="num">${euro(x.v)}</td></tr>`
    )
    .join('');

  const subNoKm = input.spese.filter((s) => s.tipo !== 'km').reduce((a, s) => a + (s.importo ?? 0), 0);
  const kmTot = input.spese.filter((s) => s.tipo === 'km').reduce((a, s) => a + (s.importo ?? 0), 0);
  const granTot = input.spese.reduce((a, s) => a + (s.importo ?? 0), 0);

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      @page { size: A4 portrait; margin: 12mm 14mm; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
        padding: 0;
        padding-top: 14px;
        margin: 0;
        color: #111827;
        font-size: 10px;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      ${sharedPortraitStyles()}
    </style>
  </head>
  <body>
    ${header}

    <h2>${safeText(S.descrSpeseTitle)}</h2>
    <table class="std">
      <thead><tr><th>${safeText(S.category)}</th><th class="num">${safeText(S.amount)}</th></tr></thead>
      <tbody>
        ${catRows || `<tr><td colspan="2" class="muted">${safeText(S.noneCat)}</td></tr>`}
        <tr><th>${safeText(S.subtotEsclusoKm)}</th><th class="num">${euro(subNoKm)}</th></tr>
        ${kmTot > 0 ? `<tr><td>${safeText(S.rimborsoKmTitle)}</td><td class="num">${euro(kmTot)}</td></tr>` : ''}
        <tr><th>${safeText(S.totaleComplessivo)}</th><th class="num">${euro(granTot)}</th></tr>
      </tbody>
    </table>

    <div class="signBox">
      <p class="signHint">${safeText(S.firmaLabel)}</p>
    </div>
    ${exportFooterDiv(lang)}
  </body>
</html>`;
}

async function wrapAttachmentsPortraitDocument(
  innerBodyPromise: Promise<string>,
  logoDataUri: string | null,
  lang: AppLanguage
): Promise<string> {
  const innerBody = await innerBodyPromise;
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      @page { size: A4 portrait; margin: 12mm 14mm; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
        padding: 0;
        padding-top: 14px;
        margin: 0;
        color: #111827;
        font-size: 10px;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      ${sharedPortraitStyles()}
    </style>
  </head>
  <body>
    ${logoHeaderBlock(logoDataUri)}
    ${innerBody}
    ${exportFooterDiv(lang)}
  </body>
</html>`;
}

function buildPresenzeLandscapeDocumentHtml(input: ReportMeseData, lang: AppLanguage, logoDataUri: string | null): string {
  const S = pdfStrings(lang);
  const loc = dfLocale(lang);

  const meseLabel = (() => {
    try {
      const d = parseISO(`${input.meseKey}-01`);
      return format(d, 'LLLL yyyy', { locale: loc });
    } catch {
      return input.meseKey;
    }
  })();

  const presenzeTotals = computePresenzeTotals(input.giorni);
  const oreBreakdown = computePresenzeOreBreakdown(input.giorni);
  const matrixHtml = buildPresenzeMatrixHtml(input.giorni, input.meseKey, lang);
  const travelHtml = buildTrasferteDetailHtml(input.giorni, lang);
  const recapHtml = buildPresenzeRecapLandscapeHtml(oreBreakdown, presenzeTotals, S);

  const rightHead = `
    <div style="text-align:right;padding-top:2px;">
      <div class="headTitle" style="text-align:right;">${safeText(input.nomeUtente || '—')}</div>
      <div class="mutedLine">${safeText(S.reportMonthly)} — ${safeText(meseLabel)}</div>
    </div>`;

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      @page { size: A4 landscape; margin: 10mm; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
        margin: 0;
        color: #111827;
        font-size: 10px;
        box-sizing: border-box;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      ${sharedLandscapeStyles()}
    </style>
  </head>
  <body>
    <div class="logoRow">
      ${logoDataUri ? `<img class="logoImg" src="${logoDataUri}" alt="" />` : '<div class="logoSpacer"></div>'}
      <div class="logoSpacer"></div>
      ${rightHead}
    </div>

    <div class="box">
      <h2 class="sectionTitle">${safeText(S.presMatrix)}</h2>
      ${matrixHtml}
      ${travelHtml}
      ${recapHtml}
    </div>
    ${exportFooterDiv(lang)}
  </body>
</html>`;
}

function extractBodyAndStyles(html: string): string {
  const styleBlocks: string[] = [];
  const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let sm: RegExpExecArray | null;
  while ((sm = styleRe.exec(html)) !== null) {
    styleBlocks.push(sm[1] ?? '');
  }
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const bodyInner = bodyMatch ? bodyMatch[1] : html;
  const scoped = styleBlocks.map((s) => `<style>${s}</style>`).join('\n');
  return `${scoped}${bodyInner}`;
}

async function printHtmlToPdfBuffer(html: string, landscape: boolean): Promise<Uint8Array> {
  if (typeof document === 'undefined') {
    throw new Error('PDF su web richiede document');
  }
  const pageWidthPx = pdfHostContentWidthPx(landscape);
  const host = document.createElement('div');
  host.className = 'wt-pdf-print-root';
  // html2pdf.js clona questo nodo: stili tipo fixed + left molto negativo restano sul clone e
  // html2canvas spesso produce canvas vuoti. Tenerlo in layout reale (sotto al fold) evita flash.
  host.style.position = 'relative';
  host.style.width = `${pageWidthPx}px`;
  host.style.margin = '0';
  host.style.backgroundColor = '#ffffff';
  host.style.boxSizing = 'border-box';
  host.style.pointerEvents = 'none';

  const shell = document.createElement('div');
  shell.setAttribute('aria-hidden', 'true');
  shell.style.cssText = `position:fixed;left:0;top:100vh;width:${pageWidthPx}px;overflow:hidden;pointer-events:none;`;
  shell.appendChild(host);
  document.body.appendChild(shell);
  host.innerHTML = extractBodyAndStyles(html);

  try {
    try {
      await document.fonts?.ready;
    } catch {
      /* noop */
    }
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

    const canvasScale = Math.min(3, Math.max(2.25, (typeof window !== 'undefined' ? window.devicePixelRatio : 1) * 1.35));
    const opt = {
      margin: PDF_PAGE_MARGIN_PT,
      filename: 'page.pdf',
      image: { type: 'jpeg' as const, quality: 0.94 },
      html2canvas: {
        scale: canvasScale,
        useCORS: true,
        logging: false,
        onclone(doc: Document) {
          const overlay = doc.querySelector('.html2pdf__overlay') as HTMLElement | null;
          if (overlay) {
            overlay.style.opacity = '1';
            overlay.style.backgroundColor = 'transparent';
          }
        },
      },
      jsPDF: {
        unit: 'pt' as const,
        format: 'a4' as const,
        orientation: (landscape ? 'landscape' : 'portrait') as 'landscape' | 'portrait',
      },
      pagebreak: { mode: ['css', 'legacy'] as ('css' | 'legacy')[] },
    };
    const html2pdf = await loadHtml2Pdf();
    const buf = (await html2pdf().set(opt).from(host).outputPdf('arraybuffer')) as ArrayBuffer;
    return new Uint8Array(buf);
  } finally {
    document.body.removeChild(shell);
  }
}

async function concatPdfUint8(parts: Uint8Array[]): Promise<Uint8Array> {
  const merged = await PDFDocument.create();
  for (const buf of parts) {
    const d = await PDFDocument.load(buf, { ignoreEncryption: true });
    const pages = await merged.copyPages(d, d.getPageIndices());
    pages.forEach((p) => merged.addPage(p));
  }
  return merged.save();
}

async function appendPdfFileUris(base: Uint8Array, uris: string[]): Promise<Uint8Array> {
  if (uris.length === 0) return base;
  const chunks: Uint8Array[] = [base];
  for (const uri of uris) {
    try {
      if (!(await webFileExists(uri))) continue;
      chunks.push(await readFileUriAsUint8Array(uri));
    } catch {
      /* noop */
    }
  }
  return concatPdfUint8(chunks);
}

async function collectPdfReceiptUris(spese: SpesaRow[]): Promise<string[]> {
  const out: string[] = [];
  for (const s of sortedSpeseWithFoto(spese)) {
    const p = (s.foto_path ?? '').trim();
    if (!p) continue;
    if (await isPdfAttachmentPath(p)) out.push(p);
  }
  return out;
}

async function filterExistingUris(uris: string[]): Promise<string[]> {
  const ok: string[] = [];
  for (const uri of uris) {
    try {
      if (await webFileExists(uri)) ok.push(uri);
    } catch {
      /* noop */
    }
  }
  return ok;
}

export async function generatePdfForMonth(
  input: ReportMeseData,
  options: GeneratePdfOptions
): Promise<{ uri: string; filename: string }> {
  const lang: AppLanguage = input.language ?? 'it';
  const logo = await resolveLogoDataUri();

  const includeNota = options.scope === 'spese' || options.scope === 'completo';
  const includePresenze = options.scope === 'presenze' || options.scope === 'completo';

  let expensePdf: Uint8Array | null = null;
  if (includeNota) {
    const coverHtml = buildNotaSpeseCoverPortraitHtml(input, lang, logo);
    let doc = await printHtmlToPdfBuffer(coverHtml, false);

    const kmRows = collectKmSpese(input.spese);
    if (kmRows.length > 0) {
      const kmHtml = buildRimborsoKmLetterPortraitHtml(input, lang, logo, kmRows);
      doc = await concatPdfUint8([doc, await printHtmlToPdfBuffer(kmHtml, false)]);
    }

    const allegatiRows = sortedSpeseWithFoto(input.spese);
    if (options.includeAttachments && allegatiRows.length > 0) {
      const inner = await buildSpeseAttachmentsBlock(input.spese, lang);
      if (inner.trim().length > 0) {
        const attHtml = await wrapAttachmentsPortraitDocument(Promise.resolve(inner), logo, lang);
        doc = await concatPdfUint8([doc, await printHtmlToPdfBuffer(attHtml, false)]);
      }
      const pdfUris = await filterExistingUris(await collectPdfReceiptUris(input.spese));
      if (pdfUris.length > 0) {
        doc = await appendPdfFileUris(doc, pdfUris);
      }
    }

    expensePdf = doc;
  }

  let presenzaBuf: Uint8Array | null = null;
  if (includePresenze) {
    presenzaBuf = await printHtmlToPdfBuffer(buildPresenzeLandscapeDocumentHtml(input, lang, logo), true);
  }

  let outBytes: Uint8Array;
  if (expensePdf && presenzaBuf) {
    outBytes = await concatPdfUint8([expensePdf, presenzaBuf]);
  } else if (expensePdf) {
    outBytes = expensePdf;
  } else if (presenzaBuf) {
    outBytes = presenzaBuf;
  } else {
    outBytes = await printHtmlToPdfBuffer(
      `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;font-size:11px;padding:16px}.exportAppFooter{margin-top:20px;font-size:8.5px;color:#b0b8c4;text-align:center}</style></head><body><p>${safeText(pdfStrings(lang).nonePres)}</p>${exportFooterDiv(lang)}</body></html>`,
      false
    );
  }

  const filenameSafe = input.meseKey.replace(/[^0-9-]/g, '');
  const filename = `WorkTracker_Report_${filenameSafe}.pdf`;
  const ab = outBytes.buffer.slice(outBytes.byteOffset, outBytes.byteOffset + outBytes.byteLength) as ArrayBuffer;
  const uri = URL.createObjectURL(new Blob([ab], { type: 'application/pdf' }));
  return { uri, filename };
}

export async function shareFile(uri: string, downloadName?: string): Promise<void> {
  if (typeof document === 'undefined') return;
  const a = document.createElement('a');
  a.href = uri;
  a.download = downloadName ?? 'WorkTracker_export.pdf';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  if (uri.startsWith('blob:')) {
    setTimeout(() => URL.revokeObjectURL(uri), 60_000);
  }
}
