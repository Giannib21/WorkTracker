/**
 * Timestamp in millisecondi per il parametro `date` di `GET /vehicles/models`.
 *
 * L'API costikm si aspetta un valore coerente con il client web: **istante di mezzanotte
 * locale (timezone del dispositivo)** del giorno di riferimento, non l'ora corrente.
 * Usa la stessa convenzione quando chiami i modelli da script (Playwright) o dall'app.
 */
export function aciModelsListTimestampMs(d: Date = new Date()): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}
