import type { GiornoRow, SpesaRow } from '../db/database';

/**
 * Combina luogo/progetto in giornata con località/progetto delle spese dello stesso giorno:
 * valori su giornata hanno priorità, poi si integrano da qualsiasi spesa con campo valorizzato.
 */
export function mergeLuogoProgettoFromGiornoESpese(
  giorno: GiornoRow | null,
  spese: SpesaRow[]
): { luogo: string; progetto: string } {
  let luogo = giorno?.luogo?.trim() ?? '';
  let progetto = giorno?.progetto?.trim() ?? '';
  if (!luogo || !progetto) {
    for (const s of spese) {
      if (!luogo && s.localita?.trim()) luogo = s.localita.trim();
      if (!progetto && s.progetto?.trim()) progetto = s.progetto.trim();
      if (luogo && progetto) break;
    }
  }
  return { luogo, progetto };
}
