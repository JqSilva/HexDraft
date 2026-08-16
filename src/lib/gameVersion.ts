// src/lib/gameVersion.ts
import { fetchLatestPatchVersion } from './sources/cdragon/cdragon-patch-version.source.js';

let cachedGameVersion = '16.1.1';
let isFetching = false;
let hasInitialized = false;

/**
 * Obtiene dinámicamente la versión real del juego desde LCU o DataDragon API
 * y la guarda en la variable global cachedGameVersion.
 */
export async function fetchLatestGameVersion(): Promise<string> {
  if (hasInitialized && cachedGameVersion !== '14.24.1') {
    return cachedGameVersion;
  }
  if (isFetching) return cachedGameVersion;
  isFetching = true;

  // 1. Si estamos en el navegador, intentar llamar al endpoint local /api/game-version
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/game-version');
      if (res.ok) {
        const data = await res.json();
        if (data.full) {
          cachedGameVersion = data.full;
          hasInitialized = true;
          isFetching = false;
          return cachedGameVersion;
        }
      }
    } catch (_e) {
      // Local API fallback
    }
  }

  // 2. Si estamos en el Servidor (Node/Astro), intentar consultar LCU si está corriendo
  if (typeof window === 'undefined') {
    try {
      const { getLockfileData } = await import('./services/lcu.service.js');
      const lcu = getLockfileData();
      if (lcu) {
        const auth = btoa(`riot:${lcu.token}`);
        const res = await fetch(`https://127.0.0.1:${lcu.port}/lol-patch/v1/game-version`, {
          headers: { 'Authorization': `Basic ${auth}` }
        });
        if (res.ok) {
          const rawVer = await res.json();
          const parts = String(rawVer).replace(/"/g, '').split('.');
          if (parts.length >= 2) {
            cachedGameVersion = `${parts[0]}.${parts[1]}.1`;
            hasInitialized = true;
            isFetching = false;
            return cachedGameVersion;
          }
        }
      }
    } catch (_e) {
      // LCU fallback
    }
  }

  // 3. Fallback directo a la API de DataDragon para obtener la versión oficial más reciente
  try {
    const latestVersion = await fetchLatestPatchVersion();
    if (latestVersion) {
      cachedGameVersion = latestVersion;
      hasInitialized = true;
      isFetching = false;
      return cachedGameVersion;
    }
  } catch (_e) {
    // DataDragon fallback
  }

  isFetching = false;
  return cachedGameVersion;
}

/**
 * Retorna la versión global almacenada en caché.
 */
export function getGameVersion(): string {
  if (!hasInitialized && !isFetching) {
    fetchLatestGameVersion().catch(() => {});
  }
  return cachedGameVersion;
}

/**
 * Genera la URL dinámica de DataDragon usando la versión global activa.
 */
export function getDDragonUrl(type: 'item' | 'profileicon' | 'spell' | 'champion', filename: string | number): string {
  const version = getGameVersion();
  const fileStr = String(filename).endsWith('.png') ? String(filename) : `${filename}.png`;
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/${type}/${fileStr}`;
}

if (typeof window !== 'undefined') {
  fetchLatestGameVersion().catch(() => {});
}
