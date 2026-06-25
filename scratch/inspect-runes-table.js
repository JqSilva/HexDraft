import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('d:/Documentos/HexDraft/hexdraft.db');

// List tables
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log("Tables in database:", tables.map(t => t.name));

db.close();
