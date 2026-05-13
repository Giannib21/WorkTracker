import * as SQLite from 'expo-sqlite';

import { normalizeCategoriaSpesa, type CategoriaSpesa } from '../utils/expenseCategories';

export type { CategoriaSpesa };

export type GiornoTipo = 'lavoro' | 'malattia' | 'ferie' | 'permesso' | 'festivita' | 'trasferta' | 'weekend';

export type GiornoRow = {
  id: number;
  data: string;
  tipo: GiornoTipo;
  ore: number;
  trasferta: number; // SQLite usa 0 o 1
  ore_trasferta: number;
  /** Ore permesso (parziale su giorno lavoro o giornata solo permesso), non sostituiscono le ore in sede in `ore`. */
  ore_permesso: number;
  luogo: string | null;
  progetto: string | null;
  note: string | null;
};

export type GiornoInsert = Omit<GiornoRow, 'id'>;
export type GiornoUpdate = Partial<Omit<GiornoRow, 'id' | 'data'>> & { data: string };

export type SpesaRow = {
  id: number;
  data: string;
  tipo: CategoriaSpesa;
  importo: number;
  valuta: string;
  descrizione: string | null;
  fornitore: string | null;
  foto_path: string | null;
  km: number | null;
  eur_per_km: number | null;
  modello_auto: string | null;
  percorso_da: string | null;
  percorso_a: string | null;
  /** Località della spesa (obbligatoria in UI). */
  localita: string | null;
  /** Progetto / contesto (obbligatorio in UI). */
  progetto: string | null;
};

export type SpesaInsert = Omit<SpesaRow, 'id'>;
export type SpesaUpdate = Partial<Omit<SpesaRow, 'id'>> & { id: number };

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('worktracker.db');
  }
  return dbPromise;
}

// Normalizza i dati da SQLite (converte stringhe a numeri)
function normalizeGiornoRow(row: any): GiornoRow {
  return {
    id: Number(row.id ?? 0),
    data: row.data ?? '',
    tipo: row.tipo ?? 'lavoro',
    ore: Number(row.ore ?? 0),
    trasferta: Number(row.trasferta ?? 0),
    ore_trasferta: Number(row.ore_trasferta ?? 0),
    ore_permesso: Number(row.ore_permesso ?? 0),
    luogo: row.luogo ?? null,
    progetto: row.progetto ?? null,
    note: row.note ?? null,
  };
}

function normalizeSpesaRow(row: any): SpesaRow {
  return {
    id: Number(row.id ?? 0),
    data: row.data ?? '',
    tipo: normalizeCategoriaSpesa(String(row.tipo ?? 'varie')),
    importo: Number(row.importo ?? 0),
    valuta: row.valuta ?? 'EUR',
    descrizione: row.descrizione ?? null,
    fornitore: row.fornitore ?? null,
    foto_path: row.foto_path ?? null,
    km: row.km ? Number(row.km) : null,
    eur_per_km: row.eur_per_km ? Number(row.eur_per_km) : null,
    modello_auto: row.modello_auto ?? null,
    percorso_da: row.percorso_da ?? null,
    percorso_a: row.percorso_a ?? null,
    localita: row.localita ?? null,
    progetto: row.progetto ?? null,
  };
}

export async function initDb(): Promise<void> {
  const db = await getDb();
  await db.execAsync(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS giorni (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      data TEXT NOT NULL UNIQUE,
      tipo TEXT NOT NULL,
      ore REAL DEFAULT 0,
      trasferta INTEGER DEFAULT 0,
      ore_trasferta REAL DEFAULT 0,
      ore_permesso REAL DEFAULT 0,
      luogo TEXT,
      progetto TEXT,
      note TEXT
    );
    CREATE TABLE IF NOT EXISTS spese (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      data TEXT NOT NULL,
      tipo TEXT NOT NULL,
      importo REAL NOT NULL,
      valuta TEXT DEFAULT 'EUR',
      descrizione TEXT,
      fornitore TEXT,
      foto_path TEXT,
      km REAL,
      eur_per_km REAL,
      modello_auto TEXT
    );
    CREATE TABLE IF NOT EXISTS impostazioni (
      chiave TEXT PRIMARY KEY,
      valore TEXT
    );
  `);

  try {
    await db.execAsync(`ALTER TABLE spese ADD COLUMN percorso_da TEXT;`);
  } catch {
    /* colonna già presente */
  }
  try {
    await db.execAsync(`ALTER TABLE spese ADD COLUMN percorso_a TEXT;`);
  } catch {
    /* colonna già presente */
  }
  try {
    await db.execAsync(`ALTER TABLE giorni ADD COLUMN ore_permesso REAL DEFAULT 0;`);
  } catch {
    /* colonna già presente */
  }

  try {
    await db.execAsync(`UPDATE spese SET tipo = 'viaggio_autoservizi' WHERE tipo = 'trasporti';`);
  } catch {
    /* noop */
  }
  try {
    await db.execAsync(`UPDATE spese SET tipo = 'rist_hotel_vitto_bar' WHERE tipo = 'ristoranti';`);
  } catch {
    /* noop */
  }
  try {
    await db.execAsync(`UPDATE spese SET tipo = 'rist_hotel_pernottamenti' WHERE tipo = 'hotel';`);
  } catch {
    /* noop */
  }
  try {
    await db.execAsync(`ALTER TABLE spese ADD COLUMN localita TEXT;`);
  } catch {
    /* noop */
  }
  try {
    await db.execAsync(`ALTER TABLE spese ADD COLUMN progetto TEXT;`);
  } catch {
    /* noop */
  }
}

export async function upsertGiorno(input: GiornoInsert): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO giorni (data, tipo, ore, trasferta, ore_trasferta, ore_permesso, luogo, progetto, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(data) DO UPDATE SET
     tipo=excluded.tipo, ore=excluded.ore, trasferta=excluded.trasferta,
     ore_trasferta=excluded.ore_trasferta, ore_permesso=excluded.ore_permesso, luogo=excluded.luogo,
     progetto=excluded.progetto, note=excluded.note`,
    [
      input.data,
      input.tipo,
      input.ore,
      input.trasferta,
      input.ore_trasferta,
      input.ore_permesso,
      input.luogo,
      input.progetto,
      input.note,
    ]
  );
}

export async function getGiornoByData(data: string): Promise<GiornoRow | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>(`SELECT * FROM giorni WHERE data = ?`, [data]);
  return row ? normalizeGiornoRow(row) : null;
}

export async function listGiorniByMonth(yyyyMm: string): Promise<GiornoRow[]> {
  const db = await getDb();
  const [y, m] = yyyyMm.split('-');
  const start = `${yyyyMm}-01`;
  const end = `${y}-${String(Number(m) + 1).padStart(2, '0')}-01`;
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM giorni WHERE data >= ? AND data < ? ORDER BY data ASC`,
    [start, end]
  );
  return rows.map(normalizeGiornoRow);
}

export async function listSpeseByMonth(yyyyMm: string): Promise<SpesaRow[]> {
  const db = await getDb();
  const [y, m] = yyyyMm.split('-');
  const start = `${yyyyMm}-01`;
  const end = `${y}-${String(Number(m) + 1).padStart(2, '0')}-01`;
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM spese WHERE data >= ? AND data < ? ORDER BY data DESC`,
    [start, end]
  );
  return rows.map(normalizeSpesaRow);
}

export async function listSpeseByDate(data: string): Promise<SpesaRow[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM spese WHERE data = ? ORDER BY id DESC`,
    [data]
  );
  return rows.map(normalizeSpesaRow);
}

export async function getSpesaById(id: number): Promise<SpesaRow | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>(`SELECT * FROM spese WHERE id = ?`, [id]);
  return row ? normalizeSpesaRow(row) : null;
}

export async function createSpesa(input: SpesaInsert): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO spese (data, tipo, importo, valuta, descrizione, fornitore, foto_path, km, eur_per_km, modello_auto, percorso_da, percorso_a, localita, progetto)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.data,
      input.tipo,
      input.importo,
      input.valuta,
      input.descrizione,
      input.fornitore,
      input.foto_path,
      input.km,
      input.eur_per_km,
      input.modello_auto,
      input.percorso_da,
      input.percorso_a,
      input.localita,
      input.progetto,
    ]
  );
}

export async function updateSpesa(input: SpesaUpdate): Promise<void> {
  const db = await getDb();
  const { id, ...updates } = input;
  
  // Costruisci esplicitamente la query per evitare mismatch tra colonne e valori
  const entries = Object.entries(updates);
  if (entries.length === 0) return; // Niente da aggiornare
  
  const setClauses = entries.map(([k]) => `${k}=?`).join(', ');
  const values = entries.map(([, v]) => v);
  values.push(id);
  
  await db.runAsync(`UPDATE spese SET ${setClauses} WHERE id = ?`, values);
}

export async function deleteSpesaById(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM spese WHERE id = ?`, [id]);
}

function monthDateRange(yyyyMm: string): [string, string] {
  const [yStr, mStr] = yyyyMm.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const start = `${yyyyMm}-01`;
  const nextM = m === 12 ? 1 : m + 1;
  const nextY = m === 12 ? y + 1 : y;
  const end = `${nextY}-${String(nextM).padStart(2, '0')}-01`;
  return [start, end];
}

export async function deleteGiorniInMonth(yyyyMm: string): Promise<void> {
  const db = await getDb();
  const [start, end] = monthDateRange(yyyyMm);
  await db.runAsync(`DELETE FROM giorni WHERE data >= ? AND data < ?`, [start, end]);
}

export async function deleteSpeseInMonth(yyyyMm: string): Promise<void> {
  const db = await getDb();
  const [start, end] = monthDateRange(yyyyMm);
  await db.runAsync(`DELETE FROM spese WHERE data >= ? AND data < ?`, [start, end]);
}

export async function deleteGiornoByData(data: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM giorni WHERE data = ?`, [data]);
}

export async function deleteSpeseByDate(data: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM spese WHERE data = ?`, [data]);
}

export async function getImpostazioniAll(): Promise<Record<string, any>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ chiave: string; valore: string }>(
    `SELECT chiave, valore FROM impostazioni`
  );
  const result: Record<string, any> = {};
  for (const row of rows) {
    result[row.chiave] = row.valore;
  }
  return result;
}

export async function setImpostazione(chiave: string, valore: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO impostazioni (chiave, valore) VALUES (?, ?)
     ON CONFLICT(chiave) DO UPDATE SET valore=excluded.valore`,
    [chiave, valore]
  );
}