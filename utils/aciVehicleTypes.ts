/** ID categoria veicolo usati da `GET /vehicles/*` (allineati al portale costikm.aci.it). */
export type AciVehicleCategoryId = '1' | '5' | '8';

export const ACI_VEHICLE_CATEGORY = {
  car: '1',
  suv: '5',
  moto: '8',
} as const satisfies Record<string, AciVehicleCategoryId>;

/** Normalizza valori salvati (incl. mapping errato 2→SUV, 3→moto delle build precedenti). */
export function normalizeAciVehicleCategoryId(raw: string): AciVehicleCategoryId {
  const t = raw.trim();
  if (t === '2' || t === '5') return ACI_VEHICLE_CATEGORY.suv;
  if (t === '3' || t === '8') return ACI_VEHICLE_CATEGORY.moto;
  return ACI_VEHICLE_CATEGORY.car;
}
