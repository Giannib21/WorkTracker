/** Estrae un bearer JWT comune nel client Angular costikm (`localStorage.token`). */
export function extractBearerFromStorage(localStorage: Record<string, string>): string | null {
  const keys = ['token', 'access_token', 'accessToken', 'id_token'] as const;
  for (const k of keys) {
    const v = localStorage[k];
    if (typeof v === 'string' && v.length > 30) return v;
  }
  return null;
}
