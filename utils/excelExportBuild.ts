import { eachDayOfInterval, endOfMonth, format, parseISO, startOfMonth } from 'date-fns';
import { enUS, it } from 'date-fns/locale';
import ExcelJS from 'exceljs';

import type { GiornoRow, SpesaRow } from '../db/database';
import type { AppLanguage } from '../i18n/messages';
import { getAppReleaseVersion } from './appVersion';
import { companyLegalLines } from './companyInfo';
import { CATEGORIE_SPESE_ORDER, labelCategoriaSpesa } from './expenseCategories';
import { computePresenzeOreBreakdown } from './giorniMeseReport';

export type ExcelLogoSource = { base64: string; extension: 'png' };

export type ExcelExportInput = {
  meseKey: string;
  nomeUtente: string;
  matricola: string;
  ufficio: string;
  giorni: GiornoRow[];
  spese: SpesaRow[];
  language?: AppLanguage;
  eur_per_km_default?: number | null;
};

type L = ReturnType<typeof excelLabels>;

const EURO_FMT = '€ #,##0.00';
const FONT = 'Calibri';

/** Proporzioni logo `assets/logo-riello.png` (1024×350 px). */
const LOGO_NATURAL_W = 1024;
const LOGO_NATURAL_H = 350;
const LOGO_DISPLAY_W = 176;
const LOGO_DISPLAY_H = Math.round((LOGO_DISPLAY_W * LOGO_NATURAL_H) / LOGO_NATURAL_W);

/** Larghezza uniforme colonne giorno nel foglio Presenze (unità carattere Excel ≈ 4,33 / ~46 px). */
const PRESENZE_DAY_COL_WIDTH = 4.33;

/** Riepilogo ore: etichette A:B, valori D:E (colonne disgiunte). */
const PRESENZE_RECAP_ORE_LABEL_COL = 1; // A
const PRESENZE_RECAP_ORE_LABEL_COL_END = 2; // B
const PRESENZE_RECAP_ORE_VALUE_COL = 4; // D
const PRESENZE_RECAP_ORE_VALUE_COL_END = 5; // E

/** Riepilogo giorni: etichette I:L, valori O:P (colonne Excel fisse). */
const PRESENZE_RECAP_GIORNI_LABEL_COL = 9; // I
const PRESENZE_RECAP_GIORNI_LABEL_COL_END = 12; // L
const PRESENZE_RECAP_GIORNI_VALUE_COL = 15; // O
const PRESENZE_RECAP_GIORNI_VALUE_COL_END = 16; // P

function dfLocale(lang: AppLanguage) {
  return lang === 'en' ? enUS : it;
}

function euro(n: number): number {
  const x = Number.isFinite(n) ? n : 0;
  return Math.round(x * 100) / 100;
}

function spesaDettaglio(s: SpesaRow): string {
  if (s.tipo === 'km' && (s.percorso_da?.trim() || s.percorso_a?.trim())) {
    const route = `${(s.percorso_da ?? '').trim()} → ${(s.percorso_a ?? '').trim()}`.trim();
    const desc = (s.descrizione ?? '').trim();
    return desc ? `${route} · ${desc}` : route;
  }
  return (s.descrizione ?? '').trim();
}

function excelLabels(lang: AppLanguage) {
  if (lang === 'en') {
    return {
      notaSheet: 'Expense report',
      kmSheet: 'Mileage reimbursements',
      presSheet: 'Attendance',
      notaTitle: 'Expense report',
      dipLabel: 'Employee / contractor',
      matricolaLabel: 'Employee ID',
      ufficioLabel: 'Office',
      ragSocLabel: 'Company legal name & address',
      meseRifLabel: 'Reference month',
      dataDocLabel: 'Document date',
      docNumLabel: 'n.',
      descrSpeseTitle: 'Expense description',
      category: 'Category',
      amount: 'Amount',
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
      date: 'Date',
      presMatrix: 'Attendance',
      reportMonthly: 'Monthly report',
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
      recapOreTitle: 'Hours summary',
      recapGiorniTitle: 'Days summary',
      oreLavorateRecap: 'Worked hours (office)',
      oreTrasfertaRecap: 'Travel hours',
      oreFeriePermessiRecap: 'Leave / holiday hours',
      oreMalattiaRecap: 'Sick leave hours',
      workedDays: 'Worked days',
      travelDays: 'Travel days',
      leaveDays: 'Leave / permission days',
      sickDays: 'Sick days',
      exportFooter: (ver: string) => `WorkTracker export — app version ${ver}`,
    };
  }
  return {
    notaSheet: 'Nota spese',
    kmSheet: 'Rimborsi km',
    presSheet: 'Presenze',
    notaTitle: 'Nota Spese',
    dipLabel: 'Dipendente / collaboratore',
    matricolaLabel: 'Matricola',
    ufficioLabel: 'Ufficio',
    ragSocLabel: "Ragione sociale dell'azienda",
    meseRifLabel: 'Mese di riferimento',
    dataDocLabel: 'Data del documento',
    docNumLabel: 'n.',
    descrSpeseTitle: 'Descrizione delle spese',
    category: 'Categoria',
    amount: 'Importo',
    subtotEsclusoKm: 'Subtotale Spese',
    rimborsoKmTitle: 'Rimborsi chilometrici (km)',
    totaleComplessivo: 'TOTALE',
    firmaLabel: 'Firma del dipendente / collaboratore',
    noneCat: 'Nessun importo in questa sezione.',
    kmLetterCity: 'Milano',
    kmLetterTitle: 'Rimborso Chilometrico — Lettera di incarico',
    kmLetterTitle2: 'Rimborsi Chilometrici',
    kmLetterSignCompany: "Timbro e firma dell'azienda",
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
    kmModelUnknown: "[modello dell'auto]",
    date: 'Data',
    presMatrix: 'Presenze',
    reportMonthly: 'Report mensile',
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
    recapOreTitle: 'Riepilogo ore',
    recapGiorniTitle: 'Riepilogo giorni',
    oreLavorateRecap: 'Ore lavorate',
    oreTrasfertaRecap: 'Ore trasferta',
    oreFeriePermessiRecap: 'Ore ferie / permessi',
    oreMalattiaRecap: 'Ore malattia',
    workedDays: 'Giorni lavorati',
    travelDays: 'Giorni trasferta',
    leaveDays: 'Giorni ferie/permesso',
    sickDays: 'Giorni malattia',
    exportFooter: (ver: string) => `Export WorkTracker — versione app ${ver}`,
  };
}

function meseLabels(input: ExcelExportInput, lang: AppLanguage): { meseLabel: string; dataDoc: string } {
  const loc = dfLocale(lang);
  const meseLabel = (() => {
    try {
      return format(parseISO(`${input.meseKey}-01`), 'LLLL yyyy', { locale: loc });
    } catch {
      return input.meseKey;
    }
  })();
  const dataDoc = format(new Date(), 'dd/MM/yyyy', { locale: loc });
  return { meseLabel, dataDoc };
}

function interpolateKmTpl(tpl: string, name: string, matricola: string): string {
  return tpl.replace(/\{\{name\}\}/g, name || '—').replace(/\{\{id\}\}/g, matricola || '—');
}

function periodRangeForMonth(meseKey: string, lang: AppLanguage): string {
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

function collectKmSpese(spese: SpesaRow[]): SpesaRow[] {
  return spese
    .filter((s) => s.tipo === 'km')
    .slice()
    .sort((a, b) => a.data.localeCompare(b.data) || a.id - b.id);
}

function resolveEurPerKmNumber(kmRows: SpesaRow[], settingsRate: number | null | undefined): number | null {
  const sr =
    settingsRate != null && Number.isFinite(Number(settingsRate)) && Number(settingsRate) > 0
      ? Number(settingsRate)
      : null;
  if (sr != null) return sr;
  const totK = kmRows.reduce((a, s) => a + Number(s.km ?? 0), 0);
  const totI = kmRows.reduce((a, s) => a + Number(s.importo ?? 0), 0);
  if (totK > 0) return totI / totK;
  const first = kmRows.find((r) => r.eur_per_km != null && Number(r.eur_per_km) > 0);
  if (first) return Number(first.eur_per_km);
  return null;
}

function modelloAutoKm(kmRows: SpesaRow[], placeholder: string): string {
  for (const r of kmRows) {
    const m = (r.modello_auto ?? '').trim();
    if (m) return m;
  }
  return placeholder;
}

function computePresenzeTotals(giorni: GiornoRow[]) {
  let giorniLavorati = 0;
  let giorniTrasferta = 0;
  let giorniMalattia = 0;
  let giorniFeriePermesso = 0;
  for (const g of giorni) {
    if (g.tipo === 'lavoro' || g.tipo === 'permesso' || g.tipo === 'trasferta') giorniLavorati += 1;
    if (g.tipo === 'trasferta' || g.trasferta === 1) giorniTrasferta += 1;
    if (g.tipo === 'malattia') giorniMalattia += 1;
    if (g.tipo === 'ferie' || g.tipo === 'permesso') giorniFeriePermesso += 1;
  }
  return { giorniLavorati, giorniTrasferta, giorniMalattia, giorniFeriePermesso };
}

function formatRecapOre(n: number): string {
  const x = Number(n);
  if (!Number.isFinite(x) || Math.abs(x) < 0.01) return '—';
  return `${x.toFixed(1)} h`;
}

function thinBorder(): Partial<ExcelJS.Borders> {
  const e = { style: 'thin' as const, color: { argb: 'FFD1D5DB' } };
  return { top: e, left: e, bottom: e, right: e };
}

function labelStyle(): Partial<ExcelJS.Style> {
  return {
    font: { name: FONT, size: 10, bold: true, color: { argb: 'FF374151' } },
    alignment: { vertical: 'middle', wrapText: false },
  };
}

function valueStyle(): Partial<ExcelJS.Style> {
  return {
    font: { name: FONT, size: 10 },
    alignment: { vertical: 'top', wrapText: true },
  };
}

function titleStyle(): Partial<ExcelJS.Style> {
  return { font: { name: FONT, size: 16, bold: true, color: { argb: 'FF111827' } } };
}

function sectionStyle(): Partial<ExcelJS.Style> {
  return { font: { name: FONT, size: 12, bold: true, color: { argb: 'FF111827' } } };
}

function tableHeaderStyle(): Partial<ExcelJS.Style> {
  return {
    font: { name: FONT, size: 10, bold: true, color: { argb: 'FF111827' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } },
    border: thinBorder(),
    alignment: { vertical: 'middle', wrapText: true },
  };
}

let logoImageId: number | null = null;

function ensureLogo(wb: ExcelJS.Workbook, logo: ExcelLogoSource | null): number | null {
  if (!logo) return null;
  if (logoImageId != null) return logoImageId;
  logoImageId = wb.addImage({ base64: logo.base64, extension: logo.extension });
  return logoImageId;
}

function placeLogo(ws: ExcelJS.Worksheet, wb: ExcelJS.Workbook, logo: ExcelLogoSource | null, startRow = 1): void {
  ws.getRow(startRow).height = 48;
  ws.getRow(startRow + 1).height = 8;
  const id = ensureLogo(wb, logo);
  if (id == null) return;
  ws.addImage(id, {
    tl: { col: 0.12, row: startRow - 0.88 },
    ext: { width: LOGO_DISPLAY_W, height: LOGO_DISPLAY_H },
  });
}

function applyPortraitHeaderColumnWidths(ws: ExcelJS.Worksheet): void {
  ws.getColumn(1).width = 28;
  ws.getColumn(2).width = 22;
  ws.getColumn(3).width = 12;
  ws.getColumn(4).width = 10;
  ws.getColumn(5).width = 6;
  ws.getColumn(6).width = 14;
}

function applyPortraitPrint(ws: ExcelJS.Worksheet, lastRow: number, lastCol: number): void {
  const colLetter = (n: number) => {
    let s = '';
    let x = n;
    while (x > 0) {
      const m = (x - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      x = Math.floor((x - 1) / 26);
    }
    return s;
  };
  ws.pageSetup = {
    paperSize: 9,
    orientation: 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
    margins: { left: 0.55, right: 0.55, top: 0.47, bottom: 0.47, header: 0.12, footer: 0.12 },
    printArea: `A1:${colLetter(lastCol)}${lastRow}`,
  };
  ws.pageSetup.showGridLines = false;
}

function applyLandscapePrint(ws: ExcelJS.Worksheet, lastRow: number, lastCol: number): void {
  const colLetter = (n: number) => {
    let s = '';
    let x = n;
    while (x > 0) {
      const m = (x - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      x = Math.floor((x - 1) / 26);
    }
    return s;
  };
  ws.pageSetup = {
    paperSize: 9,
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.4, right: 0.4, top: 0.35, bottom: 0.35, header: 0.12, footer: 0.12 },
    printArea: `A1:${colLetter(lastCol)}${lastRow}`,
  };
  ws.pageSetup.showGridLines = false;
}

function addFieldRow(
  ws: ExcelJS.Worksheet,
  row: number,
  label: string,
  value: string,
  mergeToCol = 6,
  minRowHeight = 24
): number {
  const lc = ws.getCell(row, 1);
  lc.value = label;
  lc.style = labelStyle();
  ws.mergeCells(row, 2, row, mergeToCol);
  const vc = ws.getCell(row, 2);
  vc.value = value;
  vc.style = {
    ...valueStyle(),
    alignment: { vertical: 'middle', wrapText: value.includes('\n') },
    border: { bottom: { style: 'thin', color: { argb: 'FFF3F4F6' } } },
  };
  const lines = value.split('\n').length;
  ws.getRow(row).height = Math.max(minRowHeight, lines > 1 ? 20 + lines * 14 : minRowHeight);
  return row + 1;
}

function addDataDocRow(ws: ExcelJS.Worksheet, row: number, S: L, dataDoc: string): number {
  const lc = ws.getCell(row, 1);
  lc.value = S.dataDocLabel;
  lc.style = labelStyle();
  ws.mergeCells(row, 2, row, 3);
  ws.getCell(row, 2).value = dataDoc;
  ws.getCell(row, 2).style = valueStyle();
  ws.getCell(row, 5).value = S.docNumLabel;
  ws.getCell(row, 5).style = { font: { name: FONT, size: 10, bold: true }, alignment: { horizontal: 'right' } };
  const box = ws.getCell(row, 6);
  box.value = '';
  box.style = { border: thinBorder(), fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } } };
  ws.getColumn(6).width = 14;
  ws.getRow(row).height = 28;
  return row + 1;
}

function addFooter(ws: ExcelJS.Worksheet, row: number, lang: AppLanguage, colSpan = 6): number {
  const S = excelLabels(lang);
  ws.mergeCells(row, 1, row, colSpan);
  const c = ws.getCell(row, 1);
  c.value = S.exportFooter(getAppReleaseVersion());
  c.style = {
    font: { name: FONT, size: 9, color: { argb: 'FF9CA3AF' } },
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
  };
  ws.getRow(row).height = 18;
  return row + 1;
}

function buildNotaHeaderBlock(
  ws: ExcelJS.Worksheet,
  wb: ExcelJS.Workbook,
  input: ExcelExportInput,
  lang: AppLanguage,
  logo: ExcelLogoSource | null,
  startRow: number
): number {
  const S = excelLabels(lang);
  const { meseLabel, dataDoc } = meseLabels(input, lang);
  placeLogo(ws, wb, logo, startRow);
  let r = startRow + 2;
  ws.mergeCells(r, 1, r, 6);
  ws.getCell(r, 1).value = S.notaTitle;
  ws.getCell(r, 1).style = titleStyle();
  ws.getRow(r).height = 24;
  r += 1;
  r = addFieldRow(ws, r, S.dipLabel, input.nomeUtente || '—', 6, 28);
  r = addFieldRow(ws, r, S.matricolaLabel, input.matricola || '—');
  r = addFieldRow(ws, r, S.ufficioLabel, input.ufficio || '—');
  r = addFieldRow(ws, r, S.ragSocLabel, companyLegalLines().join('\n'), 6, 42);
  r = addFieldRow(ws, r, S.meseRifLabel, meseLabel, 6, 28);
  r = addDataDocRow(ws, r, S, dataDoc);
  return r;
}

function buildNotaSpeseSheet(
  wb: ExcelJS.Workbook,
  input: ExcelExportInput,
  lang: AppLanguage,
  logo: ExcelLogoSource | null
): void {
  const S = excelLabels(lang);
  const ws = wb.addWorksheet(S.notaSheet.slice(0, 31), { views: [{ showGridLines: false }] });
  applyPortraitHeaderColumnWidths(ws);

  let r = buildNotaHeaderBlock(ws, wb, input, lang, logo, 1);
  r += 1;
  ws.mergeCells(r, 1, r, 6);
  ws.getCell(r, 1).value = S.descrSpeseTitle;
  ws.getCell(r, 1).style = sectionStyle();
  r += 1;

  const acc = new Map<string, number>();
  for (const s of input.spese) {
    if (s.tipo === 'km') continue;
    acc.set(s.tipo, (acc.get(s.tipo) ?? 0) + (s.importo ?? 0));
  }
  const catRows = CATEGORIE_SPESE_ORDER.filter((k) => k !== 'km')
    .map((k) => ({ k, v: acc.get(k) ?? 0 }))
    .filter((x) => x.v > 0);

  ws.getCell(r, 1).value = S.category;
  ws.getCell(r, 1).style = tableHeaderStyle();
  ws.getCell(r, 2).value = S.amount;
  ws.getCell(r, 2).style = { ...tableHeaderStyle(), alignment: { horizontal: 'right', vertical: 'middle' } };
  ws.mergeCells(r, 2, r, 6);
  r += 1;

  if (catRows.length === 0) {
    ws.mergeCells(r, 1, r, 6);
    ws.getCell(r, 1).value = S.noneCat;
    ws.getCell(r, 1).style = { font: { name: FONT, size: 10, italic: true, color: { argb: 'FF6B7280' } } };
    r += 1;
  } else {
    for (const x of catRows) {
      ws.getCell(r, 1).value = labelCategoriaSpesa(x.k, lang);
      ws.getCell(r, 1).style = { ...valueStyle(), border: thinBorder() };
      ws.getCell(r, 2).value = euro(x.v);
      ws.getCell(r, 2).numFmt = EURO_FMT;
      ws.getCell(r, 2).style = { ...valueStyle(), border: thinBorder(), alignment: { horizontal: 'right' } };
      ws.mergeCells(r, 2, r, 6);
      r += 1;
    }
  }

  const subNoKm = input.spese.filter((s) => s.tipo !== 'km').reduce((a, s) => a + (s.importo ?? 0), 0);
  const kmTot = input.spese.filter((s) => s.tipo === 'km').reduce((a, s) => a + (s.importo ?? 0), 0);
  const granTot = input.spese.reduce((a, s) => a + (s.importo ?? 0), 0);

  const subRow = (label: string, amount: number, bold = false) => {
    ws.getCell(r, 1).value = label;
    ws.getCell(r, 1).style = {
      font: { name: FONT, size: 10, bold },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } },
      border: thinBorder(),
    };
    ws.getCell(r, 2).value = euro(amount);
    ws.getCell(r, 2).numFmt = EURO_FMT;
    ws.getCell(r, 2).style = {
      font: { name: FONT, size: 10, bold },
      alignment: { horizontal: 'right' },
      border: thinBorder(),
    };
    ws.mergeCells(r, 2, r, 6);
    r += 1;
  };

  subRow(S.subtotEsclusoKm, subNoKm, true);
  if (kmTot > 0) subRow(S.rimborsoKmTitle, kmTot, false);
  subRow(S.totaleComplessivo, granTot, true);

  r += 1;
  ws.mergeCells(r, 1, r + 3, 6);
  const sign = ws.getCell(r, 1);
  sign.value = S.firmaLabel;
  sign.style = {
    font: { name: FONT, size: 10, bold: true, color: { argb: 'FF374151' } },
    border: thinBorder(),
    alignment: { vertical: 'top', wrapText: true },
  };
  ws.getRow(r).height = 56;
  r += 5;

  r = addFooter(ws, r, lang, 6);
  applyPortraitPrint(ws, r, 6);
}

function addKmSignatureBlock(ws: ExcelJS.Worksheet, r: number, S: L, dataDoc: string): number {
  ws.getCell(r, 1).value = `${S.kmLetterCity}, ${dataDoc}`;
  ws.getCell(r, 1).style = { font: { name: FONT, size: 10, bold: true } };
  ws.mergeCells(r, 4, r, 6);
  const line = ws.getCell(r, 4);
  line.border = { bottom: { style: 'thin', color: { argb: 'FF374151' } } };
  r += 1;
  ws.mergeCells(r, 4, r, 6);
  ws.getCell(r, 4).value = S.kmLetterSignCompany;
  ws.getCell(r, 4).style = { font: { name: FONT, size: 8, color: { argb: 'FF6B7280' } } };
  return r + 2;
}

function buildKmSheet(
  wb: ExcelJS.Workbook,
  input: ExcelExportInput,
  lang: AppLanguage,
  logo: ExcelLogoSource | null,
  kmRows: SpesaRow[]
): void {
  const S = excelLabels(lang);
  const loc = dfLocale(lang);
  const ws = wb.addWorksheet(S.kmSheet.slice(0, 31), { views: [{ showGridLines: false }] });
  applyPortraitHeaderColumnWidths(ws);
  ws.getColumn(2).width = 32;

  const { dataDoc } = meseLabels(input, lang);
  let r = buildNotaHeaderBlock(ws, wb, input, lang, logo, 1);
  r += 1;

  const box = (title: string, lines: string[]) => {
    ws.mergeCells(r, 1, r, 6);
    ws.getCell(r, 1).value = title;
    ws.getCell(r, 1).style = sectionStyle();
    r += 1;
    for (const line of lines) {
      ws.mergeCells(r, 1, r, 6);
      ws.getCell(r, 1).value = line;
      ws.getCell(r, 1).style = { ...valueStyle(), alignment: { wrapText: true } };
      ws.getRow(r).height = Math.min(72, 14 + Math.ceil(line.length / 90) * 12);
      r += 1;
    }
    r = addKmSignatureBlock(ws, r, S, dataDoc);
    r += 1;
  };

  const periodo = periodRangeForMonth(input.meseKey, lang);
  const p1 = interpolateKmTpl(S.kmBox1Lead, input.nomeUtente, input.matricola);
  box(S.kmLetterTitle, [p1, `${S.kmBox1Period} ${periodo}`, S.kmBox1Itinerary]);

  const totKmRaw = kmRows.reduce((a, s) => a + Number(s.km ?? 0), 0);
  const totKmFmt = Number.isFinite(totKmRaw) ? (totKmRaw % 1 === 0 ? String(totKmRaw) : totKmRaw.toFixed(1)) : '—';
  const eurKm = resolveEurPerKmNumber(kmRows, input.eur_per_km_default);
  const eurKmStr = eurKm != null ? euro(eurKm) : '—';
  const p2 = interpolateKmTpl(S.kmBox2Lead, input.nomeUtente, input.matricola);
  box(S.kmLetterTitle2, [
    p2,
    modelloAutoKm(kmRows, S.kmModelUnknown),
    `${S.kmKmPlannedLabel} ${totKmFmt}`,
    `${S.kmAmtPerKmLabel}: ${eurKmStr}`,
  ]);

  const headers = [S.date, S.kmTableDescrizione, S.kmTableProgetto, S.kmTableKm, S.kmTableRimb];
  headers.forEach((h, i) => {
    const cell = ws.getCell(r, i + 1);
    cell.value = h;
    cell.style = tableHeaderStyle();
  });
  r += 1;

  const fmtData = (ymd: string) => {
    try {
      return format(parseISO(ymd), 'dd/MM/yyyy', { locale: loc });
    } catch {
      return ymd;
    }
  };

  for (const s of kmRows) {
    const kmCell = Number(s.km ?? 0);
    const kmS = Number.isFinite(kmCell) ? (kmCell % 1 === 0 ? kmCell : kmCell) : '';
    ws.getCell(r, 1).value = fmtData(s.data);
    ws.getCell(r, 2).value = spesaDettaglio(s) || '—';
    ws.getCell(r, 3).value = (s.progetto ?? '').trim() || '—';
    ws.getCell(r, 4).value = kmS;
    ws.getCell(r, 5).value = euro(s.importo ?? 0);
    ws.getCell(r, 5).numFmt = EURO_FMT;
    for (let c = 1; c <= 5; c++) ws.getCell(r, c).style = { ...valueStyle(), border: thinBorder() };
    ws.getRow(r).height = 18;
    r += 1;
  }

  const rimTot = kmRows.reduce((a, s) => a + Number(s.importo ?? 0), 0);
  ws.getCell(r, 1).value = S.kmTableTot;
  ws.mergeCells(r, 1, r, 3);
  ws.getCell(r, 1).style = { font: { name: FONT, size: 10, bold: true }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAFA' } }, border: thinBorder() };
  ws.getCell(r, 4).value = totKmFmt;
  ws.getCell(r, 5).value = euro(rimTot);
  ws.getCell(r, 5).numFmt = EURO_FMT;
  [4, 5].forEach((c) => {
    ws.getCell(r, c).style = { font: { name: FONT, size: 10, bold: true }, alignment: { horizontal: 'right' }, border: thinBorder() };
  });
  r += 2;

  r = addFooter(ws, r, lang, 6);
  applyPortraitPrint(ws, r, 6);
}

function fmtHoursCell(n: number): string | number {
  const x = Number(n);
  if (!Number.isFinite(x) || x === 0) return '—';
  return x;
}

function orePermessoCell(g: GiornoRow): number {
  return Number(g.ore_permesso ?? 0);
}

/** Riepilogo ore/giorni con intervalli colonne espliciti (etichette | valori separati). */
function addPresenzeRecapBlock(
  ws: ExcelJS.Worksheet,
  startRow: number,
  labelColStart: number,
  labelColEnd: number,
  valueColStart: number,
  valueColEnd: number,
  title: string,
  rows: [string, string | number][],
  widenColumns = true
): number {
  if (labelColEnd >= valueColStart) {
    throw new Error(
      `Recap Excel: le colonne etichetta (${labelColStart}-${labelColEnd}) non possono sovrapporsi ai valori (${valueColStart}-${valueColEnd})`
    );
  }

  if (widenColumns) {
    ws.getColumn(labelColStart).width = 28;
    ws.getColumn(valueColStart).width = 12;
    if (valueColEnd > valueColStart) ws.getColumn(valueColEnd).width = 6;
  }

  let rr = startRow;
  ws.mergeCells(rr, labelColStart, rr, valueColEnd);
  ws.getCell(rr, labelColStart).value = title;
  ws.getCell(rr, labelColStart).style = {
    font: { name: FONT, size: 11, bold: true, color: { argb: 'FF111827' } },
    alignment: { vertical: 'middle', wrapText: false },
  };
  ws.getRow(rr).height = 20;
  rr += 1;

  for (const [lab, val] of rows) {
    ws.mergeCells(rr, labelColStart, rr, labelColEnd);
    ws.getCell(rr, labelColStart).value = lab;
    ws.getCell(rr, labelColStart).style = {
      ...valueStyle(),
      font: { name: FONT, size: 10 },
      alignment: { vertical: 'middle', wrapText: false },
    };
    ws.mergeCells(rr, valueColStart, rr, valueColEnd);
    ws.getCell(rr, valueColStart).value = val;
    ws.getCell(rr, valueColStart).style = {
      ...valueStyle(),
      font: { name: FONT, size: 10, bold: true },
      alignment: { horizontal: 'right', vertical: 'middle', wrapText: false },
    };
    ws.getRow(rr).height = 18;
    rr += 1;
  }
  return rr;
}

function buildPresenzeSheet(
  wb: ExcelJS.Workbook,
  input: ExcelExportInput,
  lang: AppLanguage,
  logo: ExcelLogoSource | null
): void {
  const S = excelLabels(lang);
  const loc = dfLocale(lang);
  const { meseLabel } = meseLabels(input, lang);
  const ws = wb.addWorksheet(S.presSheet.slice(0, 31), { views: [{ showGridLines: false }] });

  placeLogo(ws, wb, logo, 1);
  ws.mergeCells(1, 28, 2, 34);
  const head = ws.getCell(1, 28);
  head.value = `${input.nomeUtente || '—'}\n${S.reportMonthly} — ${meseLabel}`;
  head.style = {
    font: { name: FONT, size: 12, bold: true },
    alignment: { horizontal: 'right', vertical: 'top', wrapText: true },
  };
  ws.getRow(1).height = 48;

  let r = 4;
  ws.mergeCells(r, 1, r, 34);
  ws.getCell(r, 1).value = S.presMatrix;
  ws.getCell(r, 1).style = sectionStyle();
  r += 1;

  const anchor = parseISO(`${input.meseKey}-01`);
  const days = eachDayOfInterval({ start: startOfMonth(anchor), end: endOfMonth(anchor) });
  const byData = new Map(input.giorni.map((g) => [g.data, g]));

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
    return { g, gray, dayNum: format(d, 'd'), wShort: format(d, 'EEEEE', { locale: loc }) };
  });

  const dayColStart = 2;
  const dayColEnd = dayColStart + cols.length - 1;

  ws.getColumn(1).width = 14;
  for (let c = dayColStart; c <= dayColEnd; c++) {
    ws.getColumn(c).width = PRESENZE_DAY_COL_WIDTH;
  }

  const grayFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFCFD4DC' } };
  const cellStyle = (gray: boolean): Partial<ExcelJS.Style> => ({
    font: { name: FONT, size: 9, bold: gray },
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: thinBorder(),
    fill: gray ? grayFill : undefined,
  });
  const labelCellStyle: Partial<ExcelJS.Style> = {
    font: { name: FONT, size: 9.5, bold: true },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } },
    border: thinBorder(),
    alignment: { vertical: 'middle' },
  };

  ws.getCell(r, 1).value = '';
  cols.forEach((c, i) => {
    const cell = ws.getCell(r, i + 2);
    cell.value = c.dayNum;
    cell.style = cellStyle(c.gray);
  });
  ws.getRow(r).height = 16;
  r += 1;
  ws.getCell(r, 1).value = '';
  cols.forEach((c, i) => {
    const cell = ws.getCell(r, i + 2);
    cell.value = c.wShort;
    cell.style = { ...cellStyle(c.gray), font: { name: FONT, size: 9.5, bold: true } };
  });
  ws.getRow(r).height = 16;
  r += 1;

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

  const matrixRows: [string, (g: GiornoRow) => string | number][] = [
    [S.rowLavorate, cellLavorate],
    [S.rowTrasferta, cellTrasferta],
    [S.rowPermFerie, cellPermFerie],
    [S.rowMalattia, cellMalattia],
    [S.rowTotale, cellTotale],
  ];

  for (const [label, fn] of matrixRows) {
    ws.getCell(r, 1).value = label;
    ws.getCell(r, 1).style = labelCellStyle;
    cols.forEach((c, i) => {
      const cell = ws.getCell(r, i + 2);
      cell.value = fn(c.g);
      cell.style = cellStyle(c.gray);
    });
    ws.getRow(r).height = 18;
    r += 1;
  }

  r += 1;
  ws.mergeCells(r, 1, r, 34);
  ws.getCell(r, 1).value = S.travelDetailTitle;
  ws.getCell(r, 1).style = sectionStyle();
  r += 1;

  const travelRows = input.giorni
    .filter((g) => Number(g.ore_trasferta ?? 0) > 0 || g.tipo === 'trasferta' || g.trasferta === 1)
    .sort((a, b) => a.data.localeCompare(b.data));

  if (travelRows.length === 0) {
    ws.mergeCells(r, 1, r, 34);
    ws.getCell(r, 1).value = S.travelNone;
    ws.getCell(r, 1).style = { font: { name: FONT, size: 10, color: { argb: 'FF6B7280' } } };
    r += 1;
  } else {
    const th = [S.travelColDate, S.travelColHours, S.travelColPlace, S.travelColProject];
    th.forEach((h, i) => {
      const col = 1 + i * 8;
      ws.mergeCells(r, col, r, col + 7);
      ws.getCell(r, col).value = h;
      ws.getCell(r, col).style = {
        ...tableHeaderStyle(),
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } },
        font: { name: FONT, size: 10, bold: true, color: { argb: 'FF1E3A8A' } },
      };
    });
    r += 1;
    for (const g of travelRows) {
      const h = Number(g.ore_trasferta ?? 0);
      const hours = Number.isFinite(h) && h > 0 ? `${h.toFixed(1)} h` : '—';
      let dateLabel = g.data;
      try {
        dateLabel = format(parseISO(g.data), 'EEE d MMM yyyy', { locale: loc });
      } catch {
        /* noop */
      }
      const vals = [dateLabel, hours, g.luogo ?? '—', g.progetto ?? '—'];
      vals.forEach((v, i) => {
        const col = 1 + i * 8;
        ws.mergeCells(r, col, r, col + 7);
        const cell = ws.getCell(r, col);
        cell.value = v;
        cell.style = { ...valueStyle(), border: thinBorder(), font: { name: FONT, size: 10 } };
      });
      ws.getRow(r).height = 20;
      r += 1;
    }
  }

  r += 1;
  const ore = computePresenzeOreBreakdown(input.giorni);
  const giorniTot = computePresenzeTotals(input.giorni);

  const oreRows: [string, string][] = [
    [S.oreLavorateRecap, formatRecapOre(ore.oreLavorateSede)],
    [S.oreTrasfertaRecap, formatRecapOre(ore.oreTrasferta)],
    [S.oreFeriePermessiRecap, formatRecapOre(ore.oreFeriePermessi)],
    [S.oreMalattiaRecap, formatRecapOre(ore.oreMalattia)],
  ];
  const giorniRows: [string, string | number][] = [
    [S.workedDays, giorniTot.giorniLavorati],
    [S.travelDays, giorniTot.giorniTrasferta],
    [S.leaveDays, giorniTot.giorniFeriePermesso],
    [S.sickDays, giorniTot.giorniMalattia],
  ];
  const rEnd = Math.max(
    addPresenzeRecapBlock(
      ws,
      r,
      PRESENZE_RECAP_ORE_LABEL_COL,
      PRESENZE_RECAP_ORE_LABEL_COL_END,
      PRESENZE_RECAP_ORE_VALUE_COL,
      PRESENZE_RECAP_ORE_VALUE_COL_END,
      S.recapOreTitle,
      oreRows
    ),
    addPresenzeRecapBlock(
      ws,
      r,
      PRESENZE_RECAP_GIORNI_LABEL_COL,
      PRESENZE_RECAP_GIORNI_LABEL_COL_END,
      PRESENZE_RECAP_GIORNI_VALUE_COL,
      PRESENZE_RECAP_GIORNI_VALUE_COL_END,
      S.recapGiorniTitle,
      giorniRows,
      false
    )
  );
  r = rEnd + 1;

  r = addFooter(ws, r, lang, 34);
  applyLandscapePrint(ws, r, 34);
}

export async function buildExcelWorkbook(
  input: ExcelExportInput,
  logo: ExcelLogoSource | null
): Promise<ExcelJS.Workbook> {
  logoImageId = null;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'WorkTracker';
  wb.created = new Date();

  const kmRows = collectKmSpese(input.spese);
  const hasNota = input.spese.length > 0;

  const lang: AppLanguage = input.language ?? 'it';
  if (hasNota) buildNotaSpeseSheet(wb, input, lang, logo);
  if (kmRows.length > 0) buildKmSheet(wb, input, lang, logo, kmRows);
  buildPresenzeSheet(wb, input, lang, logo);

  return wb;
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    const sub = bytes.subarray(i, Math.min(i + chunk, bytes.length));
    for (let j = 0; j < sub.length; j++) binary += String.fromCharCode(sub[j]!);
  }
  if (typeof btoa === 'function') return btoa(binary);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < binary.length; i += 3) {
    const a = binary.charCodeAt(i);
    const b = i + 1 < binary.length ? binary.charCodeAt(i + 1) : 0;
    const c = i + 2 < binary.length ? binary.charCodeAt(i + 2) : 0;
    const tri = (a << 16) | (b << 8) | c;
    out += chars[(tri >> 18) & 63] + chars[(tri >> 12) & 63] + (i + 1 < binary.length ? chars[(tri >> 6) & 63] : '=') + (i + 2 < binary.length ? chars[tri & 63] : '=');
  }
  return out;
}

export async function workbookToBase64(wb: ExcelJS.Workbook): Promise<string> {
  const buf = await wb.xlsx.writeBuffer();
  const u8 = buf instanceof ArrayBuffer ? new Uint8Array(buf) : new Uint8Array(buf as ArrayBuffer);
  return uint8ArrayToBase64(u8);
}
