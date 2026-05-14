/** Normalizza €/km in stringa con virgola decimale (UI italiana). */
function normalizeEurString(v: number | string): string | null {
  if (typeof v === 'number' && Number.isFinite(v) && v > 0 && v < 5) {
    return String(v).replace('.', ',');
  }
  if (typeof v === 'string') {
    const t = v.trim().replace(',', '.');
    const n = Number(t);
    if (Number.isFinite(n) && n > 0 && n < 5) return String(n).replace('.', ',');
  }
  return null;
}

function pushBand(
  out: { label: string; value: string }[],
  seen: Set<string>,
  label: string,
  raw: unknown,
): void {
  const v = normalizeEurString(raw as number | string);
  if (!v) return;
  const key = `${label}::${v}`;
  if (seen.has(key)) return;
  seen.add(key);
  out.push({ label: label.slice(0, 120), value: v });
}

export type AciCostKmBand = { km: number; cost: number };

function parseFlexibleNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v !== 'string') return null;
  let s = v.trim().replace(/\s/g, '');
  if (!s) return null;
  if (s.includes(',') && s.includes('.')) {
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Km interi come sul sito ACI: `10000`, `10.000` (migliaia con punto), `10 000`. */
export function parseKmAnnual(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) {
    const r = Math.round(v);
    if (r >= 500 && r <= 500_000) return r;
    return null;
  }
  if (typeof v !== 'string') return null;
  let s = v.trim().replace(/\s/g, '').replace(/[^\d.,]/g, '');
  if (!s) return null;
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  else if (/^\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, '');
  const n = parseFlexibleNumber(s);
  if (n == null || !Number.isFinite(n)) return null;
  const r = Math.round(n);
  if (r >= 500 && r <= 500_000) return r;
  return null;
}

function parseEurPerKm(v: unknown): number | null {
  const n = parseFlexibleNumber(v);
  if (n == null || !Number.isFinite(n)) return null;
  if (n > 0 && n < 5) return n;
  return null;
}

export function extractCostKmBands(data: unknown): AciCostKmBand[] {
  const bands: AciCostKmBand[] = [];
  const seen = new Set<string>();

  function addBand(km: number, cost: number): void {
    const key = `${km}::${cost}`;
    if (seen.has(key)) return;
    seen.add(key);
    bands.push({ km, cost });
  }

  function considerObject(obj: Record<string, unknown>): void {
    /** Risposta API ACI: `totalcosts_km: [{ label: "10.000", value: 0.77 }, …]`. */
    if ('label' in obj && 'value' in obj) {
      const km = parseKmAnnual(obj.label);
      const cost = parseEurPerKm(obj.value);
      if (km != null && cost != null) addBand(km, cost);
    }
    const kmRaw =
      obj.km_annui ??
      obj.kmAnnui ??
      obj.km_anno ??
      obj.kmAnno ??
      obj.annual_km ??
      obj.annualKm ??
      obj.chilometri_annui ??
      obj.chilometraggio_annuo ??
      obj.percorrenza_annua ??
      obj.percorrenzaAnnua ??
      obj.soglia_km ??
      obj.sogliaKm ??
      obj.km;
    const costRaw =
      obj.eur_per_km ??
      obj.eurPerKm ??
      obj.euro_km ??
      obj.euroKm ??
      obj.cost_per_km ??
      obj.costPerKm ??
      obj.importo_eur_km ??
      obj.costo_km ??
      obj.costoKm ??
      obj.importo ??
      obj.costo;
    const km = parseKmAnnual(kmRaw);
    const cost = parseEurPerKm(costRaw);
    if (km != null && cost != null) addBand(km, cost);
  }

  function walk(node: unknown, depth: number): void {
    if (depth > 16 || bands.length >= 32) return;
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach((item) => {
        if (Array.isArray(item) && item.length >= 2) {
          const km = parseKmAnnual(item[0]);
          const cost = parseEurPerKm(item[1]);
          if (km != null && cost != null) addBand(km, cost);
        }
        if (item && typeof item === 'object' && !Array.isArray(item)) considerObject(item as Record<string, unknown>);
        walk(item, depth + 1);
      });
      return;
    }
    considerObject(node as Record<string, unknown>);
    for (const [k, val] of Object.entries(node as Record<string, unknown>)) {
      const low = k.toLowerCase();
      if (
        low.includes('fascia') ||
        low.includes('band') ||
        low.includes('scagl') ||
        low.includes('percorrenz') ||
        low.includes('complessiv') ||
        low.includes('chilometr') ||
        low.includes('tabella') ||
        low.includes('matrix') ||
        low.includes('rows') ||
        low.includes('outcome') ||
        low.includes('totalcosts') ||
        (low.includes('km') && (low.includes('ann') || low.includes('max') || low.includes('min')))
      ) {
        walk(val, depth + 1);
      } else if (
        low === 'search' ||
        low === 'vehicle' ||
        low === 'costs' ||
        low === 'data' ||
        low === 'result' ||
        low === 'raw'
      ) {
        walk(val, depth + 1);
      }
    }
  }

  walk(data, 0);
  bands.sort((a, b) => a.km - b.km);
  return bands;
}

/**
 * Sceglie la fascia €/km più coerente con i km annui dichiarati, usando le soglie da {@link extractCostKmBands}.
 */
export function suggestCostKmBandForAnnualKm(bands: AciCostKmBand[], annualKm: number): AciCostKmBand | null {
  if (!bands.length || !Number.isFinite(annualKm) || annualKm < 0) return null;
  const sorted = [...bands].sort((a, b) => a.km - b.km);
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  if (annualKm <= first.km) return first;
  const hit = sorted.find((b) => annualKm <= b.km);
  if (hit) return hit;
  return last;
}

export function extractEurPerKmBandOptions(data: unknown): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  const seen = new Set<string>();
  const fmtKm = (km: number) => new Intl.NumberFormat('it-IT').format(km);
  for (const b of extractCostKmBands(data)) {
    const val = String(b.cost).replace('.', ',');
    pushBand(out, seen, `${fmtKm(b.km)} km/anno`, val);
  }
  return out;
}

export function extractSuggestedEurPerKmFromCosts(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const tryPaths: string[][] = [
    ['search', 'eur_per_km'],
    ['search', 'vehicle', 'eur_per_km'],
    ['search', 'vehicle', 'costPerKm'],
    ['eur_per_km'],
    ['cost_per_km'],
    ['costPerKm'],
    ['search', 'cost_per_km'],
    ['data', 'eur_per_km'],
    ['totaleEurPerKm'],
    ['totale_eur_per_km'],
    ['search', 'totaleEurPerKm'],
  ];
  for (const path of tryPaths) {
    let cur: unknown = data;
    for (const key of path) {
      if (!cur || typeof cur !== 'object' || !(key in cur)) {
        cur = undefined;
        break;
      }
      cur = (cur as Record<string, unknown>)[key];
    }
    if (typeof cur === 'number' && Number.isFinite(cur)) return String(cur).replace('.', ',');
    if (typeof cur === 'string' && /^[\d]+[.,][\d]+$/.test(cur.trim())) return cur.trim().replace('.', ',');
  }
  const raw = JSON.stringify(data);
  const m = raw.match(/"eur_per_km"\s*:\s*"?([\d.,]+)"?/i);
  if (m?.[1]) return m[1].replace('.', ',');
  return null;
}
