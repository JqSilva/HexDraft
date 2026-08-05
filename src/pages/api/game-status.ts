import type { APIRoute } from 'astro';
import { getLockfileData } from '../../lib/services/lcu.service.js';
import { resetLastExecutedChampionId } from './execute-action.js';

import { resetLiveMatchFlag } from '../../lib/services/liveMatchCache.service.js';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

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
      try {
        const activePlayerRes = await fetch('https://127.0.0.1:2999/liveclientdata/activeplayer', {
          signal: AbortSignal.timeout(1500)
        });
        isGameReady = activePlayerRes.ok;
        isLoadingScreen = !activePlayerRes.ok;
      } catch (e) {
        // Conexión rechazada o timeout en puerto 2999 -> aún en pantalla de carga
        isGameReady = false;
        isLoadingScreen = true;
      }
    }
    
    return new Response(JSON.stringify({ phase, isLoadingScreen, isGameReady }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ phase: 'None', isLoadingScreen: false, isGameReady: false }), { status: 200 });
  }
};