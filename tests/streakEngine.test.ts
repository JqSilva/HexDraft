// tests/streakEngine.test.ts
import { computeTodayRecord } from '../src/lib/engine/streakEngine.js';
import type { MatchSummary } from '../src/lib/services/riot-api.service.js';

function assertEqual(actual: any, expected: any, message: string) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(`[FAIL] ${message}\n  Esperado: ${expectedStr}\n  Obtenido: ${actualStr}`);
  }
  console.log(`[PASS] ${message}`);
}

function makeMatch(win: boolean, timestampOffsetMs: number): MatchSummary {
  return {
    matchId: `MATCH_${Math.random()}`,
    gameCreation: Date.now() - timestampOffsetMs,
    gameDuration: 1800,
    win,
    kills: 5,
    deaths: 2,
    assists: 10,
    championId: 100
  };
}

console.log('--- Pruebas unitarias de streakEngine ---');

// Caso 1: Sin partidas hoy
{
  const res = computeTodayRecord([]);
  assertEqual(res, { wins: 0, losses: 0, winrate: 0, streak: { type: null, count: 0 } }, 'Caso 1: Sin partidas hoy');
}

// Caso 2: Racha de victorias (3 victorias seguidas)
{
  const matches = [
    makeMatch(true, 1000),  // Mas reciente
    makeMatch(true, 2000),
    makeMatch(true, 3000)   // Mas antigua
  ];
  const res = computeTodayRecord(matches);
  assertEqual(res, { wins: 3, losses: 0, winrate: 100, streak: { type: 'win', count: 3 } }, 'Caso 2: Racha de 3 victorias consecutivas');
}

// Caso 3: Racha de derrotas (4 derrotas seguidas)
{
  const matches = [
    makeMatch(false, 1000), // Mas reciente
    makeMatch(false, 2000),
    makeMatch(false, 3000),
    makeMatch(false, 4000)  // Mas antigua
  ];
  const res = computeTodayRecord(matches);
  assertEqual(res, { wins: 0, losses: 4, winrate: 0, streak: { type: 'loss', count: 4 } }, 'Caso 3: Racha de 4 derrotas consecutivas');
}

// Caso 4: Racha cortada (W, W, L, W - solo 2 victorias seguidas al inicio)
{
  const matches = [
    makeMatch(true, 1000),  // Mas reciente W
    makeMatch(true, 2000),  // W
    makeMatch(false, 3000), // L (corta la racha)
    makeMatch(true, 4000)   // W
  ];
  const res = computeTodayRecord(matches);
  assertEqual(res, { wins: 3, losses: 1, winrate: 75, streak: { type: null, count: 0 } }, 'Caso 4: Racha cortada (<3 seguidas)');
}

// Caso 5: Exactamente 3 derrotas
{
  const matches = [
    makeMatch(false, 1000),
    makeMatch(false, 2000),
    makeMatch(false, 3000)
  ];
  const res = computeTodayRecord(matches);
  assertEqual(res, { wins: 0, losses: 3, winrate: 0, streak: { type: 'loss', count: 3 } }, 'Caso 5: Exactamente 3 derrotas');
}

console.log('Todas las pruebas completadas con exito.');
