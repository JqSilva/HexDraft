import fs from 'node:fs';
import path from 'node:path';

const LOGS_DIR = path.resolve(process.cwd(), 'logs');
const LOG_FILE = path.join(LOGS_DIR, 'opgg-scraper.log');

export function logOpgg(category: string, message: string, data?: unknown): void {
  const timestamp = new Date().toISOString();
  let formattedData = '';

  if (data !== undefined) {
    try {
      formattedData = typeof data === 'string' ? ` | Data: ${data}` : ` | Data: ${JSON.stringify(data)}`;
    } catch {
      formattedData = ' | Data: [Error al serializar]';
    }
  }

  const logLine = `[${timestamp}] [${category.toUpperCase()}] ${message}${formattedData}`;

  // 1. Mostrar en consola del servidor
  console.log(logLine);

  // 2. Guardar persistentemente en logs/opgg-scraper.log
  try {
    if (!fs.existsSync(LOGS_DIR)) {
      fs.mkdirSync(LOGS_DIR, { recursive: true });
    }
    fs.appendFileSync(LOG_FILE, `${logLine}\n`, 'utf-8');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[LOGGER-WARN] No se pudo escribir en log file: ${msg}`);
  }
}
