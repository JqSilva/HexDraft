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

export function getLolPath(): string {
  const dbPath = configRepo.getConfig('lol_path');
  if (dbPath && dbPath.trim() !== '') return dbPath;

  if (fs.existsSync(DEFAULT_PATH)) {
    saveLolPath(DEFAULT_PATH);
    return DEFAULT_PATH;
  }

  // Buscar en otras unidades (D:, E:, F:, G:, H:, B:)
  for (const drive of ['D', 'E', 'F', 'G', 'H', 'B']) {
    const altPath = `${drive}:\\Riot Games\\League of Legends\\lockfile`;
    if (fs.existsSync(altPath)) {
      saveLolPath(altPath);
      return altPath;
    }
  }

  return DEFAULT_PATH;
}

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

export function writeLcuCredentialsCache(data: LCUData) {
  try {
    fs.mkdirSync(path.dirname(CACHE_FILE_PATH), { recursive: true });
    let existing: any = {};
    if (fs.existsSync(CACHE_FILE_PATH)) {
      try {
        existing = JSON.parse(fs.readFileSync(CACHE_FILE_PATH, 'utf8'));
      } catch (e) {}
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
  try {
    if (fs.existsSync(CACHE_FILE_PATH)) {
      const data = JSON.parse(fs.readFileSync(CACHE_FILE_PATH, 'utf8'));
      if (data.port && data.token && data.protocol) {
        return { port: data.port, token: data.token, protocol: data.protocol };
      }
    }
  } catch (e) {}
  return null;
}

export function writeLcuProfileCache(profile: any) {
  try {
    fs.mkdirSync(path.dirname(CACHE_FILE_PATH), { recursive: true });
    let existing: any = {};
    if (fs.existsSync(CACHE_FILE_PATH)) {
      try {
        existing = JSON.parse(fs.readFileSync(CACHE_FILE_PATH, 'utf8'));
      } catch (e) {}
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
  } catch (e) {}
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

    // Fallback a las credenciales en caché si el cliente de LoL está cerrado
    const cached = readLcuCredentialsCache();
    if (cached) {
      return cached;
    }

    return null;
  } catch (error) {
    console.error("Error leyendo el lockfile de LoL:", error);
    return null;
  }
}
