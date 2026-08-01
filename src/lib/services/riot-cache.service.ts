// src/lib/services/riot-cache.service.ts
import fs from 'node:fs';
import path from 'node:path';

const CACHE_FILE_PATH = path.resolve(process.cwd(), 'src/lib/data/riot-live-cache.json');
const PLAYER_TTL_MS = 3 * 60 * 60 * 1000; // 3 horas
const MATCH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

interface CacheSchema {
  players: Record<string, { timestamp: number; data: any }>;
  matches: Record<string, { timestamp: number; data: any }>;
}

let inMemoryCache: CacheSchema | null = null;

function loadCache(): CacheSchema {
  if (inMemoryCache) return inMemoryCache;

  try {
    if (fs.existsSync(CACHE_FILE_PATH)) {
      const raw = fs.readFileSync(CACHE_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      inMemoryCache = {
        players: parsed.players || {},
        matches: parsed.matches || {}
      };
      return inMemoryCache;
    }
  } catch (e) {
    console.error('[RiotCache] Error al leer el archivo de caché:', e);
  }

  inMemoryCache = { players: {}, matches: {} };
  return inMemoryCache;
}

function saveCache(cache: CacheSchema): void {
  try {
    fs.mkdirSync(path.dirname(CACHE_FILE_PATH), { recursive: true });
    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(cache, null, 2), 'utf-8');
  } catch (e) {
    console.error('[RiotCache] Error al guardar el archivo de caché:', e);
  }
}

export function getCachedPlayer(puuid: string): any | null {
  const cache = loadCache();
  const entry = cache.players[puuid];
  if (!entry) return null;

  const isExpired = Date.now() - entry.timestamp > PLAYER_TTL_MS;
  if (isExpired) {
    delete cache.players[puuid];
    saveCache(cache);
    return null;
  }

  return entry.data;
}

export function setCachedPlayer(puuid: string, data: any): void {
  const cache = loadCache();
  cache.players[puuid] = {
    timestamp: Date.now(),
    data
  };
  saveCache(cache);
}

export function getCachedMatch(matchId: string): any | null {
  const cache = loadCache();
  const entry = cache.matches[matchId];
  if (!entry) return null;

  const isExpired = Date.now() - entry.timestamp > MATCH_TTL_MS;
  if (isExpired) {
    delete cache.matches[matchId];
    saveCache(cache);
    return null;
  }

  return entry.data;
}

export function setCachedMatch(matchId: string, data: any): void {
  const cache = loadCache();
  cache.matches[matchId] = {
    timestamp: Date.now(),
    data
  };
  saveCache(cache);
}
