// src/lib/db/config.repo.ts
import { db } from './sqlite.js';
import fs from 'node:fs';
import path from 'node:path';

const isDev = fs.existsSync(path.join(process.cwd(), 'tsconfig.json'));
let CONFIG_FILE: string;

if (isDev) {
  CONFIG_FILE = path.join(process.cwd(), 'hexdraft-config.json');
} else {
  const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Local');
  CONFIG_FILE = path.join(localAppData, 'HexDraft', 'hexdraft-config.json');
}

export const configRepo = {
  // Obtener un valor de configuración individual
  getConfig(key: string): string | null {
    try {
      const stmt = db.prepare('SELECT value FROM config WHERE key = ? LIMIT 1');
      const row = stmt.get(key) as { value: string } | undefined;
      return row ? row.value : null;
    } catch (e) {
      console.error(`❌ Error leyendo configuración para key "${key}":`, e);
      return null;
    }
  },

  // Obtener un valor parseado como objeto JSON
  getConfigObject<T = any>(key: string): T | null {
    const val = this.getConfig(key);
    if (!val) return null;
    try {
      return JSON.parse(val) as T;
    } catch (e) {
      console.error(`❌ Error parseando JSON de configuración para key "${key}":`, e);
      return null;
    }
  },

  // Guardar un valor individual
  setConfig(key: string, value: string): void {
    try {
      const stmt = db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)');
      stmt.run(key, value);

      // Si actualizamos lol_path, debemos sincronizar con hexdraft-config.json
      if (key === 'lol_path') {
        this.syncLolPathToDisk(value);
      }
    } catch (e) {
      console.error(`❌ Error guardando configuración para key "${key}":`, e);
    }
  },

  // Obtener todas las configuraciones
  getAllConfigs(): Record<string, string> {
    try {
      const stmt = db.prepare('SELECT key, value FROM config');
      const rows = stmt.all() as { key: string; value: string }[];
      const configMap: Record<string, string> = {};
      rows.forEach(r => {
        configMap[r.key] = r.value;
      });
      return configMap;
    } catch (e) {
      console.error('❌ Error obteniendo todas las configuraciones:', e);
      return {};
    }
  },

  // Guardar múltiples configuraciones en lote
  saveAllConfigs(configs: Record<string, string>): void {
    const transaction = () => {
      const stmt = db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)');
      for (const [key, value] of Object.entries(configs)) {
        stmt.run(key, value);
        if (key === 'lol_path') {
          this.syncLolPathToDisk(value);
        }
      }
    };

    try {
      // Usar exec para iniciar transacciones en SQLite
      db.exec('BEGIN TRANSACTION;');
      transaction();
      db.exec('COMMIT;');
      console.log('✅ Configuraciones de SQLite actualizadas correctamente.');
    } catch (e) {
      db.exec('ROLLBACK;');
      console.error('❌ Error guardando configuraciones en lote:', e);
    }
  },

  // Sincronizar ruta a disco para compatibilidad con el lanzador de Python
  syncLolPathToDisk(lolPath: string): void {
    let cleanPath = lolPath.trim();
    if (cleanPath && !cleanPath.toLowerCase().endsWith('lockfile')) {
      cleanPath = path.join(cleanPath, 'lockfile');
    }
    try {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify({ lolPath: cleanPath }, null, 2), 'utf8');
      console.log(`💾 Archivo hexdraft-config.json sincronizado en disco: ${cleanPath}`);
    } catch (error) {
      console.error("❌ Error sincronizando hexdraft-config.json:", error);
    }
  }
};
