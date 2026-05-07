// src/lib/lcu.ts
import fs from 'node:fs';
import path from 'node:path';

// Ruta por defecto en Windows. Ajusta si tienes el juego en otro disco.
const LOCKFILE_PATH = 'C:\\Riot Games\\League of Legends\\lockfile';

export interface LCUData {
  port: string;
  token: string;
  protocol: string;
}

export function getLockfileData(): LCUData | null {
  try {
    if (!fs.existsSync(LOCKFILE_PATH)) {
      console.log("El cliente de LoL no parece estar abierto (lockfile no encontrado).");
      return null;
    }

    const lockfileContent = fs.readFileSync(LOCKFILE_PATH, 'utf8');
    const [name, pid, port, token, protocol] = lockfileContent.split(':');

    return { port, token, protocol };
  } catch (error) {
    console.error("Error leyendo el lockfile:", error);
    return null;
  }
}