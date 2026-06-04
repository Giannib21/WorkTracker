import { buildExcelWorkbook, workbookToBase64, type ExcelExportInput } from './excelExportBuild';
import { loadExcelLogoSource } from './excelExportLogo.web';

export type { ExcelExportInput } from './excelExportBuild';

export async function generateExcelForMonth(input: ExcelExportInput): Promise<{ uri: string; filename: string }> {
  const logo = await loadExcelLogoSource();
  const wb = await buildExcelWorkbook(input, logo);
  const b64 = await workbookToBase64(wb);
  const filenameSafe = input.meseKey.replace(/[^0-9-]/g, '');
  const filename = `WorkTracker_Report_${filenameSafe}.xlsx`;
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const uri = URL.createObjectURL(
    new Blob([ab], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  );
  return { uri, filename };
}
