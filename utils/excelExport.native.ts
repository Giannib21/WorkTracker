import * as FileSystem from 'expo-file-system/legacy';

import { buildExcelWorkbook, workbookToBase64, type ExcelExportInput } from './excelExportBuild';
import { loadExcelLogoSource } from './excelExportLogo.native';

export type { ExcelExportInput } from './excelExportBuild';

export async function generateExcelForMonth(input: ExcelExportInput): Promise<{ uri: string; filename: string }> {
  const logo = await loadExcelLogoSource();
  const wb = await buildExcelWorkbook(input, logo);
  const b64 = await workbookToBase64(wb);
  const filenameSafe = input.meseKey.replace(/[^0-9-]/g, '');
  const filename = `WorkTracker_Report_${filenameSafe}.xlsx`;
  const baseDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? '';
  const dest = `${baseDir}${filename}`;
  await FileSystem.writeAsStringAsync(dest, b64, { encoding: 'base64' });
  return { uri: dest, filename };
}
