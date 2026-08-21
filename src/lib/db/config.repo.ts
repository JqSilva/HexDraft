// src/lib/db/config.repo.ts
import fs from 'node:fs';
import path from 'node:path';
import { db } from './sqlite.js';

const isDev = fs.existsSync(path.join(process.cwd(), 'tsconfig.json'));
let CONFIG_FILE: string;

if (isDev) {
  CONFIG_FILE = path.join(process.cwd(), 'hexdraft-config.json');
} else {
  const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Local');
  CONFIG_FILE = path.join(localAppData, 'HexDraft', 'hexdraft-config.json');
}

let memoryCache: Record<string, string> | null = null;

function loadConfigFile(): Record<string, string> {
  if (memoryCache) return memoryCache;

  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      memoryCache = {};
      for (const [k, v] of Object.entries(parsed)) {
        memoryCache[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
      }
      // Asegurar sincronización de lol_path y lolPath
      if (parsed.lolPath && !memoryCache.lol_path) {
        memoryCache.lol_path = parsed.lolPath;
      }
      return memoryCache;
    }
  } catch (e) {
    console.error('[Config Repo] Error leyendo archivo hexdraft-config.json:', e);
  }

  // Si no existe el archivo JSON, intentar migrar las configuraciones existentes de SQLite por unica vez
  memoryCache = {};
  try {
    const stmt = db.prepare('SELECT key, value FROM config');
    const rows = stmt.all() as { key: string; value: string }[];
    rows.forEach(r => {
      memoryCache![r.key] = r.value;
    });
    if (rows.length > 0) {
      console.log(`[Config Repo] Migradas ${rows.length} configuraciones de SQLite hacia hexdraft-config.json.`);
      saveConfigFile(memoryCache);
    }
  } catch (_e) {
    // Si la tabla config de SQLite no existe o falla, continuar con defaults
  }

  return memoryCache;
}

function saveConfigFile(cache: Record<string, string>): void {
  try {
    fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
    
    // Preparar objeto limpio para guardar en disco
    const output: Record<string, any> = { ...cache };
    
    // Mantener lolPath para el lanzador de Python
    if (cache.lol_path) {
      let cleanPath = cache.lol_path.trim();
      if (cleanPath && !cleanPath.toLowerCase().endsWith('lockfile')) {
        cleanPath = path.join(cleanPath, 'lockfile');
      }
      output.lolPath = cleanPath;
    }

    fs.writeFileSync(CONFIG_FILE, JSON.stringify(output, null, 2), 'utf-8');
  } catch (e) {
    console.error('[Config Repo] Error guardando archivo hexdraft-config.json:', e);
  }
}

export const configRepo = {
  // Obtener un valor de configuración individual desde el archivo local
  getConfig(key: string): string | null {
    const cache = loadConfigFile();
    return cache[key] !== undefined ? cache[key] : null;
  },

  // Obtener un valor parseado como objeto JSON
  getConfigObject<T = any>(key: string): T | null {
    const val = this.getConfig(key);
    if (!val) return null;
    try {
      return JSON.parse(val) as T;
    } catch (e) {
      console.error(`[Config Repo] Error parseando JSON de configuración para key "${key}":`, e);
      return null;
    }
  },

  // Guardar un valor individual en el archivo local
  setConfig(key: string, value: string): void {
    const cache = loadConfigFile();
    cache[key] = value;
    saveConfigFile(cache);
  },

  // Obtener todas las configuraciones del usuario
  getAllConfigs(): Record<string, string> {
    const cache = loadConfigFile();
    return { ...cache };
  },

  // Guardar múltiples configuraciones en lote en el archivo local
  saveAllConfigs(configs: Record<string, string>): void {
    const cache = loadConfigFile();
    for (const [key, value] of Object.entries(configs)) {
      cache[key] = value;
    }
    saveConfigFile(cache);
    console.log('[Config Repo] Configuraciones locales guardadas exitosamente en hexdraft-config.json.');
  },

  // Sincronizar ruta a disco para compatibilidad con el lanzador de Python
  syncLolPathToDisk(lolPath: string): void {
    this.setConfig('lol_path', lolPath);
  }
};
