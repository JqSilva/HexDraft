// src/lib/domain/patch-version-resolver.ts
import { getLockfileData } from '../services/lcu.service.js';
import { fetchLatestPatchVersion } from '../sources/cdragon/cdragon-patch-version.source.js';

function parseShortVersion(fullVersion: string): string {
  const clean = String(fullVersion).replace(/["']/g, '').trim();
  const parts = clean.split('.');
  if (parts.length >= 2) {
    return `${parts[0]}.${parts[1]}`;
  }
  throw new Error(`Formato de versión de parche no válido: ${fullVersion}`);
}

export async function resolveCurrentPatchVersion(): Promise<{ version: string; source: 'lcu' | 'ddragon' }> {
  // 1. Intentar leer desde LCU local si está corriendo
  try {
    const lcu = getLockfileData();
    if (lcu) {
      const auth = btoa(`riot:${lcu.token}`);
      const response = await fetch(`https://127.0.0.1:${lcu.port}/lol-patch/v1/game-version`, {
        headers: { 'Authorization': `Basic ${auth}` }
      });
      if (response.ok) {
        const rawVersion = await response.json();
        const shortVersion = parseShortVersion(String(rawVersion));
        return { version: shortVersion, source: 'lcu' };
      }
    }
  } catch (_e) {
    // Fallback a DDragon
  }

  // 2. Fallback a Riot DataDragon / Community Dragon
  try {
    const latestFull = await fetchLatestPatchVersion();
    if (latestFull) {
      const shortVersion = parseShortVersion(latestFull);
      return { version: shortVersion, source: 'ddragon' };
    }
  } catch (_e) {
    // Ambos fallaron
  }

  // 3. Si ambos métodos fallan, lanzar error explícito
  throw new Error('No se pudo resolver la versión actual del parche');
}
