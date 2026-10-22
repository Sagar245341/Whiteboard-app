import fs from 'node:fs/promises';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';

const directory = path.resolve(process.env.DATA_DIR || 'data');
let sql;
let state = { users: [], boards: [] };
let pending = Promise.resolve();
export async function initStore() {
  if (process.env.DATABASE_URL) {
    sql = neon(process.env.DATABASE_URL);
    await sql`CREATE TABLE IF NOT EXISTS canvas_records (kind text NOT NULL, id text NOT NULL, value jsonb NOT NULL, PRIMARY KEY(kind,id))`;
  } else {
    await fs.mkdir(directory, { recursive: true });
    try { state = JSON.parse(await fs.readFile(path.join(directory, 'store.json'), 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}
export async function all(kind) {
  if (sql) return (await sql`SELECT value FROM canvas_records WHERE kind=${kind}`).map(r => r.value);
  return structuredClone(state[kind]);
}
export async function get(kind, id) {
  if (sql) return (await sql`SELECT value FROM canvas_records WHERE kind=${kind} AND id=${id}`)[0]?.value;
  return structuredClone(state[kind].find(record => record.id === id));
}
export async function put(kind, record) {
  if (sql) { await sql`INSERT INTO canvas_records(kind,id,value) VALUES(${kind},${record.id},${JSON.stringify(record)}::jsonb) ON CONFLICT(kind,id) DO UPDATE SET value=EXCLUDED.value`; return record; }
  const index = state[kind].findIndex(r => r.id === record.id);
  if (index < 0) state[kind].push(structuredClone(record)); else state[kind][index] = structuredClone(record);
  const snapshot = JSON.stringify(state);
  pending = pending.catch(() => {}).then(async () => {
    await fs.writeFile(path.join(directory, 'store.tmp'), snapshot);
    await fs.rename(path.join(directory, 'store.tmp'), path.join(directory, 'store.json'));
  });
  await pending;
  return record;
}
export async function remove(kind, id) {
  if (sql) { await sql`DELETE FROM canvas_records WHERE kind=${kind} AND id=${id}`; return; }
  state[kind] = state[kind].filter(r => r.id !== id);
  const snapshot = JSON.stringify(state);
  pending = pending.catch(() => {}).then(async () => { await fs.writeFile(path.join(directory, 'store.tmp'), snapshot); await fs.rename(path.join(directory, 'store.tmp'), path.join(directory, 'store.json')); });
  await pending;
}
