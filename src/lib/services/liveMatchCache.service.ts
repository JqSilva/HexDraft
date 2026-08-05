// src/lib/services/liveMatchCache.service.ts
import fs from 'node:fs';
import path from 'node:path';

const MATCH_CACHE_FILE = path.resolve(process.cwd(), 'src/lib/data/live-match-cache.json');

export interface LiveMatchCache {
  isScraped: number; // 1 = scraping completado para esta partida, 0 = inactivo / lista para sobrescribir
  matchFingerprint: string;
  gameMode: string;
  timestamp: number;
  blueTeam: any[];
  redTeam: any[];
}

export function loadLiveMatchCache(): LiveMatchCache | null {
  try {
    if (fs.existsSync(MATCH_CACHE_FILE)) {
      const raw = fs.readFileSync(MATCH_CACHE_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('[LiveMatchCache] Error al leer el archivo JSON de partida:', e);
  }
  return null;
}

export function saveLiveMatchCache(data: Omit<LiveMatchCache, 'timestamp'>): void {
  try {
    const fullData: LiveMatchCache = {
      ...data,
      timestamp: Date.now()
    };
    fs.mkdirSync(path.dirname(MATCH_CACHE_FILE), { recursive: true });
    fs.writeFileSync(MATCH_CACHE_FILE, JSON.stringify(fullData, null, 2), 'utf-8');
    console.log(`[LiveMatchCache] Caché de partida sobrescrita en JSON. Flag isScraped = ${data.isScraped}`);
  } catch (e) {
    console.error('[LiveMatchCache] Error al guardar el archivo JSON de partida:', e);
  }
}

export function resetLiveMatchFlag(): void {
  try {
    const current = loadLiveMatchCache();
    if (current && current.isScraped !== 0) {
      current.isScraped = 0;
      fs.writeFileSync(MATCH_CACHE_FILE, JSON.stringify(current, null, 2), 'utf-8');
      console.log('[LiveMatchCache] Fin de partida detectado. Flag isScraped cambiado a 0 (JSON conservado).');
    }
  } catch (e) {
    console.error('[LiveMatchCache] Error al reiniciar flag isScraped:', e);
  }
}
