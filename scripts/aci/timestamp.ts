/**
 * Timestamp in ms richiesto da `GET /vehicles/models` (parametro `date`).
 * Allineato al client web: mezzanotte locale del giorno indicato.
 */
export function aciModelsListTimestampMs(d: Date = new Date()): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}
