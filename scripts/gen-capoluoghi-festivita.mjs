/**
 * Legge wiki_patroni.json (API Wikipedia wikitext) e genera utils/capoluoghiFestivitaData.ts
 * Esegui da root progetto: node scripts/gen-capoluoghi-festivita.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const wikiPath = path.join(root, 'wiki_patroni.json');
const outPath = path.join(root, 'utils', 'capoluoghiFestivitaData.ts');

const MONTHS = {
  gennaio: 1,
  febbraio: 2,
  marzo: 3,
  aprile: 4,
  maggio: 5,
  giugno: 6,
  luglio: 7,
  agosto: 8,
  settembre: 9,
  ottobre: 10,
  novembre: 11,
  dicembre: 12,
};

function stripWiki(s) {
  return s
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/\[\[([^\]|]+\|)?([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/'''/g, '')
    .trim();
}

function extractCity(cell) {
  const t = stripWiki(cell);
  const m = t.match(/\[\[([^\]|]+)\|([^\]]+)\]\]/);
  if (m) return m[2].trim();
  const m2 = t.match(/\[\[([^\]]+)\]\]/);
  if (m2) return m2[1].trim();
  return t.trim();
}

/** Prima data fissa giorno+mese riconosciuta nella cella; null se solo date mobili / irriconoscibili */
function parseGiornoFestivo(cell) {
  const raw = stripWiki(cell).toLowerCase();
  if (!raw) return null;
  if (/primo |terza |seconda |quarta |domenica|gioved|marted|weekend|successivo/i.test(raw)) return null;

  const firstPart = raw.split(',')[0].trim();
  const s = firstPart.replace(/1º/g, '1').replace(/º/g, '');

  const re = /(\d{1,2})\s+([a-zà]+)/gi;
  let best = null;
  let m;
  while ((m = re.exec(s)) !== null) {
    const day = Number(m[1]);
    const monName = m[2].replace(/[^a-zà]/gi, '');
    const month = MONTHS[monName];
    if (month && day >= 1 && day <= 31) {
      best = { giorno: day, mese: month };
      break;
    }
  }
  return best;
}

function extractSanto(cell) {
  return stripWiki(cell).replace(/\s+/g, ' ').trim() || 'Festività locale';
}

const j = JSON.parse(fs.readFileSync(wikiPath, 'utf8'));
const wt = j.parse.wikitext['*'];
const rows = wt.split(/\n\|-\s*\n/);

const entries = [];
for (const block of rows) {
  if (!block.includes('||')) continue;
  const parts = block.split('||').map((p) => p.trim());
  if (parts.length < 4) continue;
  const cityCell = parts[1];
  const santoCell = parts[2];
  const giornoCell = parts[3];
  const city = extractCity(cityCell);
  if (!city || city === 'Capoluogo') continue;
  const date = parseGiornoFestivo(giornoCell);
  if (!date) continue;
  const nome = extractSanto(santoCell).slice(0, 120);
  entries.push({
    comune: city,
    comuneNorm: city
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/[^a-z0-9\s']/gi, '')
      .replace(/\s+/g, ' ')
      .trim(),
    mese: date.mese,
    giorno: date.giorno,
    nome,
  });
}

// Dedup per comuneNorm (ultima vince — raro)
const byNorm = new Map();
for (const e of entries) {
  byNorm.set(e.comuneNorm, e);
}
const unique = [...byNorm.values()].sort((a, b) => a.comune.localeCompare(b.comune, 'it'));

const lines = unique.map(
  (e) =>
    `  { comune: ${JSON.stringify(e.comune)}, comuneNorm: ${JSON.stringify(e.comuneNorm)}, mese: ${e.mese}, giorno: ${e.giorno}, nome: ${JSON.stringify(e.nome)} }`
);

const file = `/** Auto-generato da scripts/gen-capoluoghi-festivita.mjs (wikitext Wikipedia). Non editare a mano. */

export type CapoluogoFestivitaRow = {
  comune: string;
  comuneNorm: string;
  mese: number;
  giorno: number;
  nome: string;
};

export const CAPOLUOGO_FESTIVITA: readonly CapoluogoFestivitaRow[] = [
${lines.join(',\n')}
];
`;

fs.writeFileSync(outPath, file, 'utf8');
console.log('Written', outPath, 'rows:', unique.length);
