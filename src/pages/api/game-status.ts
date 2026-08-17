import type { APIRoute } from 'astro';
import fs from 'node:fs';
import path from 'node:path';
import { getLockfileData } from '../../lib/services/lcu.service.js';
import { resetLastExecutedChampionId } from './execute-action.js';
import { logRawPoll } from '../../lib/services/game-status-raw-debug.js';

import { resetLiveMatchFlag } from '../../lib/services/liveMatchCache.service.js';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// TODO DEBUG: remover este logging una vez diagnosticado el bug de loading screen
const LOG_PATH = path.resolve(process.cwd(), 'logs', 'loading-screen-debug.log');

function ensureLogDir() {
  const dir = path.dirname(LOG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function logPoll(entry: Record<string, any>) {
  try {
    ensureLogDir();
    const line = JSON.stringify({ ts: new Date().toISOString(), ...entry });
    fs.appendFileSync(LOG_PATH, line + '\n');
    console.log('[GAME-STATUS-DEBUG]', line);
  } catch (err) {
    console.error('[GAME-STATUS-DEBUG-ERROR]', err);
  }
}

export const GET: APIRoute = async () => {
  const lcu = getLockfileData();
  if (!lcu) {
    resetLiveMatchFlag();
    return new Response(JSON.stringify({ phase: 'Offline' }), { status: 200 });
  }

  const auth = btoa(`riot:${lcu.token}`);

  try {
    const response = await fetch(`https://127.0.0.1:${lcu.port}/lol-gameflow/v1/session`, {
      headers: { 'Authorization': `Basic ${auth}` }
    });
    
    if (!response.ok) {
      resetLiveMatchFlag();
      return new Response(JSON.stringify({ phase: 'None' }), { status: 200 });
    }
    
    const data = await response.json();
    const phase = data.phase;
    
    if (phase === 'Matchmaking' || phase === 'InProgress') {
      resetLastExecutedChampionId();
    }

    if (phase !== 'InProgress' && phase !== 'ChampSelect') {
      resetLiveMatchFlag();
    }

    let isGameReady = false;
    let isLoadingScreen = false;

    if (phase === 'InProgress') {
      // TODO DEBUG: remover este logging raw una vez identificado el campo correcto de "juego realmente iniciado"
      fetch('https://127.0.0.1:2999/liveclientdata/allgamedata', {
        signal: AbortSignal.timeout(1500)
      })
        .then(async (res) => {
          if (res.ok) {
            const rawData = await res.json();
            logRawPoll('allgamedata', rawData);
          } else {
            logRawPoll('allgamedata', { error: true, httpStatus: res.status, statusText: res.statusText });
          }
        })
        .catch((err: any) => {
          logRawPoll('allgamedata', { error: true, errorName: err?.name, errorMessage: err?.message });
        });

      const attemptStart = Date.now();
      try {
        const activePlayerRes = await fetch('https://127.0.0.1:2999/liveclientdata/activeplayer', {
          signal: AbortSignal.timeout(1500)
        });
        const elapsedMs = Date.now() - attemptStart;

        isGameReady = activePlayerRes.ok;
        isLoadingScreen = !activePlayerRes.ok;

        logPoll({
          phase,
          outcome: 'response_received',
          httpStatus: activePlayerRes.status,
          ok: activePlayerRes.ok,
          elapsedMs,
          resultIsLoadingScreen: isLoadingScreen,
          resultIsGameReady: isGameReady
        });
      } catch (e: any) {
        const elapsedMs = Date.now() - attemptStart;
        isGameReady = false;
        isLoadingScreen = true;

        logPoll({
          phase,
          outcome: 'fetch_failed',
          errorName: e?.name,
          errorMessage: e?.message,
          elapsedMs,
          resultIsLoadingScreen: isLoadingScreen,
          resultIsGameReady: isGameReady
        });
      }
    } else {
      logPoll({ phase, outcome: 'phase_not_in_progress' });
    }
    
    return new Response(JSON.stringify({ phase, isLoadingScreen, isGameReady }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ phase: 'None', isLoadingScreen: false, isGameReady: false }), { status: 200 });
  }
};