/**
 * Prende gli header Set-Cookie e li trasforma in una stringa valida per l'header Cookie
 */
export function cookieHeaderFromSetCookieLines(setCookieLines) {
  const parts = [];
  
  for (const line of setCookieLines) {
    const pair = line.split(';')[0]?.trim();
    if (pair && pair.includes('=')) {
      parts.push(pair);
    }
  }
  
  return parts.join('; ');
}