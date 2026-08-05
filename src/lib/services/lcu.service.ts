// src/lib/services/lcu.service.ts
import fs from 'node:fs';
import path from 'node:path';
import { configRepo } from '../db/config.repo.js';

const DEFAULT_PATH = 'C:\\Riot Games\\League of Legends\\lockfile';
const CACHE_FILE_PATH = path.resolve(process.cwd(), 'src/lib/data/lcu-cache.json');

export interface LCUData {
  port: string;
  token: string;
  protocol: string;
}

/**
 * Obtiene la ruta configurada o autodetectada del archivo lockfile del cliente de League of Legends.
 * 
 * @returns Ruta absoluta al archivo lockfile.
 */
export function getLolPath(): string {
  const dbPath = configRepo.getConfig('lol_path');
  if (dbPath && dbPath.trim() !== '') {
    const dir = path.dirname(dbPath);
    if (fs.existsSync(dir)) {
      return dbPath;
    }
  }

  const defaultDir = path.dirname(DEFAULT_PATH);
  if (fs.existsSync(defaultDir)) {
    saveLolPath(DEFAULT_PATH);
    return DEFAULT_PATH;
  }

  // Buscar en otras unidades (D:, E:, F:, G:, H:, B:)
  for (const drive of ['D', 'E', 'F', 'G', 'H', 'B']) {
    const altDir = `${drive}:\\Riot Games\\League of Legends`;
    if (fs.existsSync(altDir)) {
      const altPath = path.join(altDir, 'lockfile');
      saveLolPath(altPath);
      return altPath;
    }
  }

  return dbPath || DEFAULT_PATH;
}

/**
 * Normaliza y guarda la ruta personalizada del cliente de LoL en la base de datos de configuración.
 * 
 * @param inputPath - Ruta dada por el usuario (directorio o ruta directa a lockfile).
 * @returns Ruta normalizada guardada.
 */
export function saveLolPath(inputPath: string): string {
  let cleanPath = inputPath.trim();
  if (cleanPath && !cleanPath.toLowerCase().endsWith('lockfile')) {
    cleanPath = path.join(cleanPath, 'lockfile');
  }
  
  // Guardar en la base de datos (configRepo internamente sincronizará hexdraft-config.json)
  configRepo.setConfig('lol_path', cleanPath);
  return cleanPath;
}

// --- FUNCIONES DE CACHÉ DE LCU ---

let cachedInMemory: LCUData | null = null;

export function writeLcuCredentialsCache(data: LCUData) {
  if (cachedInMemory && 
      cachedInMemory.port === data.port && 
      cachedInMemory.token === data.token && 
      cachedInMemory.protocol === data.protocol) {
    return;
  }
  
  cachedInMemory = data;

  try {
    fs.mkdirSync(path.dirname(CACHE_FILE_PATH), { recursive: true });
    let existing: any = {};
    if (fs.existsSync(CACHE_FILE_PATH)) {
      try {
        existing = JSON.parse(fs.readFileSync(CACHE_FILE_PATH, 'utf8'));
      } catch (e) {
        // empty - inicializar existente como vacío si falla lectura
      }
    }
    
    if (existing.port === data.port && 
        existing.token === data.token && 
        existing.protocol === data.protocol) {
      return;
    }

    existing.port = data.port;
    existing.token = data.token;
    existing.protocol = data.protocol;
    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(existing, null, 2));
  } catch (e) {
    console.error("Error al escribir lcu credentials cache:", e);
  }
}

export function readLcuCredentialsCache(): LCUData | null {
  if (cachedInMemory) return cachedInMemory;
  try {
    if (fs.existsSync(CACHE_FILE_PATH)) {
      const data = JSON.parse(fs.readFileSync(CACHE_FILE_PATH, 'utf8'));
      if (data.port && data.token && data.protocol) {
        cachedInMemory = { port: data.port, token: data.token, protocol: data.protocol };
        return cachedInMemory;
      }
    }
  } catch (e) {
    // empty - falló lectura de caché corrupto
  }
  return null;
}

export function writeLcuProfileCache(profile: any) {
  try {
    fs.mkdirSync(path.dirname(CACHE_FILE_PATH), { recursive: true });
    let existing: any = {};
    if (fs.existsSync(CACHE_FILE_PATH)) {
      try {
        existing = JSON.parse(fs.readFileSync(CACHE_FILE_PATH, 'utf8'));
      } catch (e) {
        // empty - falló lectura de caché existente
      }
    }
    existing.summonerProfile = profile;
    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(existing, null, 2));
  } catch (e) {
    console.error("Error al escribir lcu profile cache:", e);
  }
}

export function readLcuProfileCache(): any | null {
  try {
    if (fs.existsSync(CACHE_FILE_PATH)) {
      const data = JSON.parse(fs.readFileSync(CACHE_FILE_PATH, 'utf8'));
      if (data.summonerProfile) {
        return data.summonerProfile;
      }
    }
  } catch (e) {
    // empty - caché corrupto
  }
  return null;
}

export function getLockfileData(): LCUData | null {
  try {
    const lockfilePath = getLolPath();
    if (fs.existsSync(lockfilePath)) {
      const lockfileContent = fs.readFileSync(lockfilePath, 'utf8');
      const [name, pid, port, token, protocol] = lockfileContent.split(':');
      const data = { port, token, protocol };
      
      // Guardar credenciales en caché local
      writeLcuCredentialsCache(data);
      
      return data;
    }

    // Limpiar caché en memoria si ya no se detecta ejecución física
    cachedInMemory = null;
    return null;
  } catch (error) {
    console.error("Error leyendo el lockfile de LoL:", error);
    return null;
  }
}
