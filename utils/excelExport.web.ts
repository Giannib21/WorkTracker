import { eachDayOfInterval, endOfMonth, format, parseISO, startOfMonth } from 'date-fns';
import { enUS, it } from 'date-fns/locale';
import * as XLSX from 'xlsx-js-style';

import type { GiornoRow, SpesaRow } from '../db/database';
import type { AppLanguage } from '../i18n/messages';
import { getAppReleaseVersion } from './appVersion';
import { labelCategoriaSpesa } from './expenseCategories';

type CellWithStyle = { s?: Record<string, unknown> };

export type ExcelExportInput = {
  meseKey: string;
  giorni: GiornoRow[];
  spese: SpesaRow[];
  language?: AppLanguage;
};

function dfLocale(lang: AppLanguage) {
  return lang === 'en' ? enUS : it;
}

function fmtHoursCell(n: number): string {
  const x = Number(n);
  if (!Number.isFinite(x) || x === 0) return '—';
  return String(x);
}

function orePermessoCell(g: GiornoRow): number {
  return Number(g.ore_permesso ?? 0);
}

function excelLabels(lang: AppLanguage) {
  if (lang === 'en') {
    return {
      presSheet: 'Attendance',
      speseSheet: 'Expenses',
      trasfSheet: 'Travel',
      rowLavorate: 'Worked',
      rowTrasferta: 'Travel h',
      rowPermFerie: 'Leave / holiday',
      rowMalattia: 'Sick',
      rowTotale: 'Daily total',
      speseDate: 'Date',
      speseCat: 'Category',
      speseDetail: 'Detail',
      speseAmount: 'Amount',
      speseCurrency: 'Currency',
      speseLocalita: 'Location',
      speseProgetto: 'Project',
      trDate: 'Date',
      trHours: 'Travel h',
      trPlace: 'Location',
      trProject: 'Project',
    };
  }
  return {
    presSheet: 'Presenze',
    speseSheet: 'Spese',
    trasfSheet: 'Trasferte',
    rowLavorate: 'Lavorate',
    rowTrasferta: 'Trasferta',
    rowPermFerie: 'Permessi / ferie',
    rowMalattia: 'Malattia',
    rowTotale: 'Totale giorno',
    speseDate: 'Data',
    speseCat: 'Categoria',
    speseDetail: 'Dettaglio',
    speseAmount: 'Importo',
    speseCurrency: 'Valuta',
    speseLocalita: 'Località',
    speseProgetto: 'Progetto',
    trDate: 'Data',
    trHours: 'Ore trasferta',
    trPlace: 'Luogo',
    trProject: 'Progetto',
  };
}

function spesaDettaglio(s: SpesaRow): string {
  if (s.tipo === 'km' && (s.percorso_da?.trim() || s.percorso_a?.trim())) {
    const route = `${(s.percorso_da ?? '').trim()} → ${(s.percorso_a ?? '').trim()}`.trim();
    const desc = (s.descrizione ?? '').trim();
    return desc ? `${route} · ${desc}` : route;
  }
  return (s.descrizione ?? '').trim();
}

function excelExportFooterText(lang: AppLanguage): string {
  const v = getAppReleaseVersion();
  return lang === 'en' ? `WorkTracker export — app version ${v}` : `Export WorkTracker — versione app ${v}`;
}

function blankExcelRow(cols: number): (string | number)[] {
  return Array.from({ length: cols }, () => '');
}

function appendExcelFooter(
  aoa: (string | number)[][],
  lang: AppLanguage
): { aoa: (string | number)[][]; footerRow0: number; colCount: number } {
  const colCount = Math.max(...aoa.map((r) => r.length), 1);
  const foot = blankExcelRow(colCount);
  foot[0] = excelExportFooterText(lang);
  const extended = [...aoa, blankExcelRow(colCount), foot];
  return { aoa: extended, footerRow0: extended.length - 1, colCount };
}

function styleExcelExportFooter(ws: XLSX.WorkSheet, footerRow0: number, colCount: number): void {
  const merge: XLSX.Range = { s: { r: footerRow0, c: 0 }, e: { r: footerRow0, c: colCount - 1 } };
  ws['!merges'] = [...(ws['!merges'] ?? []), merge];
  const addr = XLSX.utils.encode_cell({ r: footerRow0, c: 0 });
  const cell = ws[addr];
  if (!cell || typeof cell !== 'object') return;
  const styled = cell as CellWithStyle;
  styled.s = {
    ...(typeof styled.s === 'object' && styled.s ? styled.s : {}),
    font: { color: { rgb: '9CA3AF' }, sz: 9 },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  };
}

function buildPresenzeSheet(
  giorni: GiornoRow[],
  meseKey: string,
  lang: AppLanguage
): { aoa: (string | number)[][]; graySheetCols: number[] } {
  const loc = dfLocale(lang);
  const L = excelLabels(lang);
  const anchor = parseISO(`${meseKey}-01`);
  const days = eachDayOfInterval({ start: startOfMonth(anchor), end: endOfMonth(anchor) });
  const byData = new Map(giorni.map((g) => [g.data, g]));

  const cols = days.map((d) => {
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
    return { g, dayNum: format(d, 'd'), wShort: format(d, 'EEEEE', { locale: loc }), gray };
  });

  const graySheetCols = cols.map((c, i) => (c.gray ? i + 1 : -1)).filter((idx) => idx >= 0);

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

  const headerNums: (string | number)[] = ['', ...cols.map((c) => c.dayNum)];
  const headerDays: (string | number)[] = ['', ...cols.map((c) => c.wShort)];
  const row = (label: string, fn: (g: GiornoRow) => string) => [label, ...cols.map((c) => fn(c.g))];

  const aoa = [
    headerNums,
    headerDays,
    row(L.rowLavorate, cellLavorate),
    row(L.rowTrasferta, cellTrasferta),
    row(L.rowPermFerie, cellPermFerie),
    row(L.rowMalattia, cellMalattia),
    row(L.rowTotale, cellTotale),
  ];

  return { aoa, graySheetCols };
}

function applyPresenzeWeekendFill(ws: XLSX.WorkSheet, graySheetCols: number[], rowCount: number): void {
  const fill = { patternType: 'solid' as const, fgColor: { rgb: 'CFD4DC' } };
  for (const c of graySheetCols) {
    for (let r = 0; r < rowCount; r++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr] as CellWithStyle | undefined;
      if (!cell) continue;
      cell.s = { ...(cell.s ?? {}), fill };
    }
  }
}

function buildTrasferteAoA(giorni: GiornoRow[], lang: AppLanguage): (string | number)[][] {
  const L = excelLabels(lang);
  const rows = giorni
    .filter((g) => Number(g.ore_trasferta ?? 0) > 0 || g.tipo === 'trasferta' || g.trasferta === 1)
    .sort((a, b) => a.data.localeCompare(b.data));

  const header = [L.trDate, L.trHours, L.trPlace, L.trProject];
  if (rows.length === 0) return [header];
  const loc = dfLocale(lang);
  const body = rows.map((g) => {
    const h = Number(g.ore_trasferta ?? 0);
    const hours = Number.isFinite(h) && h > 0 ? h : '';
    let dateLabel = g.data;
    try {
      dateLabel = format(parseISO(g.data), 'yyyy-MM-dd (EEE)', { locale: loc });
    } catch {
      /* noop */
    }
    return [dateLabel, hours, g.luogo ?? '', g.progetto ?? ''];
  });
  return [header, ...body];
}

function buildSpeseAoA(spese: SpesaRow[], lang: AppLanguage): (string | number)[][] {
  const L = excelLabels(lang);
  const header = [
    L.speseDate,
    L.speseCat,
    L.speseDetail,
    L.speseAmount,
    L.speseCurrency,
    L.speseLocalita,
    L.speseProgetto,
  ];
  const sorted = spese.slice().sort((a, b) => (a.data > b.data ? -1 : a.data < b.data ? 1 : b.id - a.id));
  const body = sorted.map((s) => [
    s.data,
    labelCategoriaSpesa(s.tipo, lang),
    spesaDettaglio(s),
    s.importo ?? 0,
    s.valuta ?? 'EUR',
    s.localita ?? '',
    s.progetto ?? '',
  ]);
  return [header, ...body];
}

export async function generateExcelForMonth(input: ExcelExportInput): Promise<{ uri: string; filename: string }> {
  const lang: AppLanguage = input.language ?? 'it';
  const L = excelLabels(lang);

  const wb = XLSX.utils.book_new();
  const pres = buildPresenzeSheet(input.giorni, input.meseKey, lang);
  const presFoot = appendExcelFooter(pres.aoa, lang);
  const presWs = XLSX.utils.aoa_to_sheet(presFoot.aoa);
  if (pres.graySheetCols.length > 0) {
    applyPresenzeWeekendFill(presWs, pres.graySheetCols, pres.aoa.length);
  }
  styleExcelExportFooter(presWs, presFoot.footerRow0, presFoot.colCount);
  XLSX.utils.book_append_sheet(wb, presWs, L.presSheet.slice(0, 31));

  const speseAoA = buildSpeseAoA(input.spese, lang);
  const speseFoot = appendExcelFooter(speseAoA, lang);
  const speseWs = XLSX.utils.aoa_to_sheet(speseFoot.aoa);
  styleExcelExportFooter(speseWs, speseFoot.footerRow0, speseFoot.colCount);
  XLSX.utils.book_append_sheet(wb, speseWs, L.speseSheet.slice(0, 31));

  const trAoA = buildTrasferteAoA(input.giorni, lang);
  const trFoot = appendExcelFooter(trAoA, lang);
  const trWs = XLSX.utils.aoa_to_sheet(trFoot.aoa);
  styleExcelExportFooter(trWs, trFoot.footerRow0, trFoot.colCount);
  XLSX.utils.book_append_sheet(wb, trWs, L.trasfSheet.slice(0, 31));

  const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  const filenameSafe = input.meseKey.replace(/[^0-9-]/g, '');
  const filename = `WorkTracker_Report_${filenameSafe}.xlsx`;
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const uri = URL.createObjectURL(
    new Blob([ab], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  );
  return { uri, filename };
}
