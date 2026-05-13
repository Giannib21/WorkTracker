import type { AppLanguage, Messages } from '../i18n/messages';

export type CategoriaSpesa =
  | 'parcheggi'
  | 'viaggio_treno'
  | 'viaggio_aereo'
  | 'viaggio_autoservizi'
  | 'viaggio_taxi'
  | 'viaggio_metro'
  | 'rist_hotel_pernottamenti'
  | 'rist_hotel_vitto_bar'
  | 'rappresentanza'
  | 'pedaggi'
  | 'km'
  | 'varie';

export const CATEGORIE_SPESE_ORDER: CategoriaSpesa[] = [
  'parcheggi',
  'viaggio_treno',
  'viaggio_aereo',
  'viaggio_autoservizi',
  'viaggio_taxi',
  'viaggio_metro',
  'rist_hotel_pernottamenti',
  'rist_hotel_vitto_bar',
  'rappresentanza',
  'pedaggi',
  'km',
  'varie',
];

const LABELS_IT: Record<CategoriaSpesa, string> = {
  parcheggi: 'Parcheggi',
  viaggio_treno: 'Treno',
  viaggio_aereo: 'Aereo',
  viaggio_autoservizi: 'Autoservizi',
  viaggio_taxi: 'Taxi',
  viaggio_metro: 'Metro',
  rist_hotel_pernottamenti: 'Pernottamenti',
  rist_hotel_vitto_bar: 'Vitto / Bar',
  rappresentanza: 'Spese di Rappresentanza',
  pedaggi: 'Pedaggi',
  km: 'Km (rimborsi chilometrici)',
  varie: 'Varie',
};

const LABELS_EN: Record<CategoriaSpesa, string> = {
  parcheggi: 'Parking',
  viaggio_treno: 'Train',
  viaggio_aereo: 'Flight',
  viaggio_autoservizi: 'Coach / shuttle',
  viaggio_taxi: 'Taxi',
  viaggio_metro: 'Metro',
  rist_hotel_pernottamenti: 'Accommodation',
  rist_hotel_vitto_bar: 'Meals / Bar',
  rappresentanza: 'Representation expenses',
  pedaggi: 'Tolls',
  km: 'Mileage reimbursement',
  varie: 'Misc',
};

const LEGACY_TIPO: Record<string, CategoriaSpesa> = {
  trasporti: 'viaggio_autoservizi',
  ristoranti: 'rist_hotel_vitto_bar',
  hotel: 'rist_hotel_pernottamenti',
};

export function normalizeCategoriaSpesa(raw: string): CategoriaSpesa {
  if (LEGACY_TIPO[raw]) return LEGACY_TIPO[raw]!;
  if ((CATEGORIE_SPESE_ORDER as string[]).includes(raw)) return raw as CategoriaSpesa;
  return 'varie';
}

export function labelCategoriaSpesa(t: CategoriaSpesa, lang: AppLanguage = 'it'): string {
  return lang === 'en' ? LABELS_EN[t] ?? t : LABELS_IT[t] ?? t;
}

export type SpeseUiGroup = {
  title: string;
  items: { value: CategoriaSpesa; label: string }[];
};

/** Gruppi per schermata inserimento spesa (titoli da `messages`, etichette categoria dalla lingua). */
export function speseUiGroups(lang: AppLanguage, m: Messages): SpeseUiGroup[] {
  const L = (c: CategoriaSpesa) => labelCategoriaSpesa(c, lang);
  return [
    {
      title: m.expGroupTravelTransport,
      items: [
        { value: 'viaggio_treno', label: L('viaggio_treno') },
        { value: 'viaggio_aereo', label: L('viaggio_aereo') },
        { value: 'viaggio_autoservizi', label: L('viaggio_autoservizi') },
        { value: 'viaggio_taxi', label: L('viaggio_taxi') },
        { value: 'viaggio_metro', label: L('viaggio_metro') },
      ],
    },
    {
      title: m.expGroupRestHotel,
      items: [
        { value: 'rist_hotel_pernottamenti', label: L('rist_hotel_pernottamenti') },
        { value: 'rist_hotel_vitto_bar', label: L('rist_hotel_vitto_bar') },
      ],
    },
    {
      title: m.expGroupOther,
      items: [
        { value: 'parcheggi', label: L('parcheggi') },
        { value: 'rappresentanza', label: L('rappresentanza') },
        { value: 'pedaggi', label: L('pedaggi') },
        { value: 'km', label: L('km') },
        { value: 'varie', label: L('varie') },
      ],
    },
  ];
}

export function emptyTotalsByCategoria(): Record<CategoriaSpesa, number> {
  const acc = {} as Record<CategoriaSpesa, number>;
  for (const k of CATEGORIE_SPESE_ORDER) acc[k] = 0;
  return acc;
}
