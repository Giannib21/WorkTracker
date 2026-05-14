import * as Location from 'expo-location';
import type { LocationGeocodedAddress } from 'expo-location';
import { Platform } from 'react-native';

function coordsFallback(coords: { latitude: number; longitude: number }): string {
  return `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;
}

function formatFromExpoAddress(first: LocationGeocodedAddress | undefined): string | null {
  if (!first) return null;
  const streetLine = [first.streetNumber, first.street].filter(Boolean).join(' ').trim();
  const locality = first.city || first.district || first.subregion || first.name;
  const parts: string[] = [];
  if (streetLine) parts.push(streetLine);
  if (locality) parts.push(locality);
  if (first.region && first.region !== locality) parts.push(first.region);
  if (first.postalCode) parts.push(first.postalCode);
  if (first.country) parts.push(first.country);
  const joined = parts.filter(Boolean).join(', ');
  if (joined) return joined;
  if (first.city || first.subregion || first.region) {
    return [first.city, first.subregion, first.region].filter(Boolean).join(', ');
  }
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
      const road = a.road || a.pedestrian || a.path || a.residential;
      const house = a.house_number;
      const streetPart = [house, road].filter(Boolean).join(' ').trim();
      const place =
        a.city ||
        a.town ||
        a.village ||
        a.municipality ||
        a.hamlet ||
        a.suburb ||
        a.city_district;
      const region = a.state || a.region || a.county;
      const zip = a.postcode;
      const country = a.country;
      const segments: string[] = [];
      if (streetPart) segments.push(streetPart);
      if (place) segments.push(place);
      if (region && region !== place) segments.push(region);
      if (zip) segments.push(zip);
      if (country) segments.push(country);
      const compact = segments.filter(Boolean).join(', ');
      if (compact) return compact;
    }
    const dn = data.display_name?.trim();
    return dn || null;
  } catch {
    return null;
  }
}

/**
 * Etichetta leggibile (indirizzo / città) dalle coordinate.
 * Su web Expo non supporta il reverse geocoding: si usa OpenStreetMap Nominatim come fallback.
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
