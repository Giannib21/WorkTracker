import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';

import type { ExcelLogoSource } from './excelExportBuild';

const LOGO_PNG = require('../assets/logo-riello.png');

export async function loadExcelLogoSource(): Promise<ExcelLogoSource | null> {
  try {
    const asset = Asset.fromModule(LOGO_PNG);
    await asset.downloadAsync();
    const uri = asset.localUri ?? asset.uri;
    if (!uri) return null;
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
    return { base64, extension: 'png' };
  } catch {
    return null;
  }
}
