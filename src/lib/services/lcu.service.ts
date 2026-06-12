// src/lib/services/lcu.service.ts
import fs from 'node:fs';
import path from 'node:path';
import { configRepo } from '../db/config.repo.js';

const DEFAULT_PATH = 'C:\\Riot Games\\League of Legends\\lockfile';

export interface LCUData {
  port: string;
  token: string;
  protocol: string;
}

export function getLolPath(): string {
  const dbPath = configRepo.getConfig('lol_path');
  if (dbPath) return dbPath;

  if (fs.existsSync(DEFAULT_PATH)) {
    return DEFAULT_PATH;
  }

  // Buscar en otras unidades (D:, E:, F:, G:, H:, B:)
  for (const drive of ['D', 'E', 'F', 'G', 'H', 'B']) {
    const altPath = `${drive}:\\Riot Games\\League of Legends\\lockfile`;
    if (fs.existsSync(altPath)) {
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

export function getLockfileData(): LCUData | null {
  try {
    const lockfilePath = getLolPath();
    if (!fs.existsSync(lockfilePath)) {
      console.log(`[LCU] Cliente de LoL no detectado (lockfile ausente en: ${lockfilePath}).`);
      return null;
    }

    const lockfileContent = fs.readFileSync(lockfilePath, 'utf8');
    const [name, pid, port, token, protocol] = lockfileContent.split(':');

    return { port, token, protocol };
  } catch (error) {
    console.error("❌ Error leyendo el lockfile de LoL:", error);
    return null;
  }
}
