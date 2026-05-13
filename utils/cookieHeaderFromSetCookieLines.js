/**
 * Da un elenco di header `Set-Cookie` (uno per elemento) costruisce il valore dell’header `Cookie`
 * per una richiesta successiva: solo la prima coppia `nome=valore` di ogni riga (prima del `;`).
 */
export function cookieHeaderFromSetCookieLines(setCookieLines: readonly string[]): string {
  const parts: string[] = [];
  for (const line of setCookieLines) {
    const pair = line.split(';')[0]?.trim();
    if (pair && pair.includes('=')) {
      parts.push(pair);
    }
  }
  return parts.join('; ');
}
