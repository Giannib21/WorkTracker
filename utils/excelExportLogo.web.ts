import { Asset } from 'expo-asset';

import type { ExcelLogoSource } from './excelExportBuild';

const LOGO_PNG = require('../assets/logo-riello.png');

function uint8ToBase64(bytes: Uint8Array): string {
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    const sub = bytes.subarray(i, Math.min(i + chunk, bytes.length));
    for (let j = 0; j < sub.length; j++) binary += String.fromCharCode(sub[j]!);
  }
  return btoa(binary);
}

export async function loadExcelLogoSource(): Promise<ExcelLogoSource | null> {
  try {
    const asset = Asset.fromModule(LOGO_PNG);
    await asset.downloadAsync();
    const uri = asset.localUri ?? asset.uri;
    if (!uri) return null;
    const res = await fetch(uri);
    const buf = await res.arrayBuffer();
    return { base64: uint8ToBase64(new Uint8Array(buf)), extension: 'png' };
  } catch {
    return null;
  }
}
