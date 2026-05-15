import * as Location from 'expo-location';
import type { LocationGeocodedAddress } from 'expo-location';
import { Platform } from 'react-native';

function coordsFallback(coords: { latitude: number; longitude: number }): string {
  return `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;
}

function sameLabel(a: string | undefined | null, b: string | undefined | null): boolean {
  return (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();
}

/** Solo comune / centro abitato + livello «provinciale» (region in Expo), senza via né CAP. */
function formatFromExpoAddress(first: LocationGeocodedAddress | undefined): string | null {
  if (!first) return null;
  const locality = first.city || first.district || first.subregion || first.name;
  const admin = first.region;
  const parts: string[] = [];
  if (locality) parts.push(locality.trim());
  if (admin && !sameLabel(admin, locality)) parts.push(admin.trim());
  if (parts.length) return parts.join(', ');
  return null;
}

type NominatimAddress = Record<string, string | undefined>;

async function reverseGeocodeNominatimWeb(lat: number, lon: number): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      format: 'jsonv2',
      lat: String(lat),
      lon: String(lon),
    });
    const url = `https://nominatim.openstreetmap.org/reverse?${params.toString()}`;
    const lang =
      typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'it';
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'Accept-Language': lang,
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      display_name?: string;
      address?: NominatimAddress;
    };
    const a = data.address;
    if (a) {
      const place =
        a.city ||
        a.town ||
        a.village ||
        a.municipality ||
        a.hamlet ||
        a.suburb ||
        a.city_district;
      // In Italia la provincia è di solito in `county` (non usiamo `state`, che è spesso la regione).
      const province = a.county;
      const parts: string[] = [];
      if (place) parts.push(place);
      if (province && !sameLabel(province, place)) parts.push(province);
      if (parts.length) return parts.join(', ');
      if (province) return province;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Etichetta leggibile dalle coordinate: comune (o equivalente) + provincia / area amministrativa,
 * senza indirizzo preciso. Su web Expo non supporta il reverse geocoding: si usa Nominatim.
 */
export async function humanLocationLabelFromCoords(coords: {
  latitude: number;
  longitude: number;
}): Promise<string> {
  const fallback = coordsFallback(coords);

  try {
    const items = await Location.reverseGeocodeAsync(coords);
    const fromExpo = formatFromExpoAddress(items[0]);
    if (fromExpo) return fromExpo;
  } catch {
    // Su web `reverseGeocodeAsync` non è implementato e lancia sempre.
  }

  if (Platform.OS === 'web') {
    const fromOsm = await reverseGeocodeNominatimWeb(coords.latitude, coords.longitude);
    if (fromOsm) return fromOsm;
  }

  return fallback;
}
