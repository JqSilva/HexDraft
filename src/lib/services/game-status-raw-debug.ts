// src/lib/services/game-status-raw-debug.ts
import fs from 'node:fs';
import path from 'node:path';

// TODO DEBUG: remover este logging raw una vez identificado el campo correcto de "juego realmente iniciado"
const RAW_LOG_PATH = path.resolve(process.cwd(), 'logs', 'loading-screen-raw-debug.log');

function ensureLogDir() {
  const dir = path.dirname(RAW_LOG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function logRawPoll(source: string, payload: any): void {
  try {
    ensureLogDir();
    const entry = {
      ts: new Date().toISOString(),
      source,
      payload
    };
    const line = JSON.stringify(entry);
    fs.appendFileSync(RAW_LOG_PATH, line + '\n');
    console.log(`[RAW-DEBUG][${source}]`, line);
  } catch (err) {
    console.error('[RAW-DEBUG-ERROR]', err);
  }
}
