import Constants from 'expo-constants';

/** Versione mostrata in export (PDF/Excel) e schermate info. */
export function getAppReleaseVersion(): string {
  const v = Constants.expoConfig?.version;
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : '2.3.3';
}
