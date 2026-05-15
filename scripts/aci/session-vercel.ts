import type { AciSavedSession } from './session-types';
import { extractBearerFromStorage } from './session-util';

/** JWT Keycloak per `ACI_COSTIKM_KEYCLOAK_TOKEN` (stessa logica di `print-vercel-env.ts`). */
export function keycloakJwtFromSession(s: AciSavedSession): string | null {
  const direct = typeof s.bearerToken === 'string' ? s.bearerToken.trim() : '';
  if (direct.length > 40) return direct;
  const ik = s.importantKeys;
  if (ik && typeof ik === 'object') {
    for (const k of ['token', 'access_token', 'accessToken', 'id_token'] as const) {
      const v = ik[k];
      if (typeof v === 'string' && v.trim().length > 40) return v.trim();
    }
  }
  return extractBearerFromStorage(s.localStorage ?? {});
}
