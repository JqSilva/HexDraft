// src/lib/engine/streakEngine.ts
import type { MatchSummary } from '../services/riot-api.service.js';

export interface TodayRecordResult {
  wins: number;
  losses: number;
  winrate: number; // 0 - 100
  streak: {
    type: 'win' | 'loss' | null;
    count: number;
  };
}

/**
 * Calcula el récord del día (W-L + % winrate) y el estado de racha (🔥 3+ victorias seguidas o 🧊 3+ derrotas seguidas).
 * @param matches Lista de partidas jugadas HOY (filtradas previamente por startTime).
 * @param targetPuuid PUUID del jugador consultado.
 */
export function computeTodayRecord(matches: MatchSummary[]): TodayRecordResult {
  if (!matches || matches.length === 0) {
    return {
      wins: 0,
      losses: 0,
      winrate: 0,
      streak: {
        type: null,
        count: 0
      }
    };
  }

  // Ordenar de la más reciente a la más antigua
  const sorted = [...matches].sort((a, b) => b.gameCreation - a.gameCreation);

  let wins = 0;
  let losses = 0;

  for (const m of sorted) {
    if (m.win) {
      wins++;
    } else {
      losses++;
    }
  }

  const total = wins + losses;
  const winrate = total > 0 ? Math.round((wins / total) * 100) : 0;

  // Cálculo de racha consecutiva desde la partida más reciente
  const firstResult = sorted[0].win; // true para win, false para loss
  let streakCount = 0;

  for (const m of sorted) {
    if (m.win === firstResult) {
      streakCount++;
    } else {
      break; // La racha se cortó
    }
  }

  let streakType: 'win' | 'loss' | null = null;
  if (streakCount >= 1) {
    streakType = firstResult ? 'win' : 'loss';
  } else {
    streakCount = 0;
  }

  return {
    wins,
    losses,
    winrate,
    streak: {
      type: streakType,
      count: streakCount
    }
  };
}
