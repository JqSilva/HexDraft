// src/lib/lcu.ts
import fs from 'node:fs';
import path from 'node:path';

const CONFIG_FILE = path.join(process.cwd(), 'hexdraft-config.json');
const DEFAULT_PATH = 'C:\\Riot Games\\League of Legends\\lockfile';

export interface LCUData {
  port: string;
  token: string;
  protocol: string;
}

export function getLolPath(): string {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      if (data && typeof data.lolPath === 'string') {
        return data.lolPath;
      }
    }
  } catch (error) {
    console.error("Error leyendo hexdraft-config.json:", error);
  }
  return DEFAULT_PATH;
}

export function saveLolPath(inputPath: string): string {
  let cleanPath = inputPath.trim();
  if (cleanPath && !cleanPath.toLowerCase().endsWith('lockfile')) {
    cleanPath = path.join(cleanPath, 'lockfile');
  }
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({ lolPath: cleanPath }, null, 2), 'utf8');
    console.log(`✅ Configuración guardada: ${cleanPath}`);
  } catch (error) {
    console.error("Error guardando hexdraft-config.json:", error);
  }
  return cleanPath;
}

export function getLockfileData(): LCUData | null {
  try {
    const lockfilePath = getLolPath();
    if (!fs.existsSync(lockfilePath)) {
      console.log(`El cliente de LoL no parece estar abierto (lockfile no encontrado en: ${lockfilePath}).`);
      return null;
    }

    const lockfileContent = fs.readFileSync(lockfilePath, 'utf8');
    const [name, pid, port, token, protocol] = lockfileContent.split(':');

    return { port, token, protocol };
  } catch (error) {
    console.error("Error leyendo el lockfile:", error);
    return null;
  }
}