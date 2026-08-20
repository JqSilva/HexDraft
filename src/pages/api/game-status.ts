import https from 'https';
import axios from 'axios';
import type { APIRoute } from 'astro';
import { getLockfileData } from '../../lib/services/lcu.service.js';
import { resetLastExecutedChampionId } from './execute-action.js';
import { resetLiveMatchFlag } from '../../lib/services/liveMatchCache.service.js';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const liveClient = axios.create({
  baseURL: 'https://127.0.0.1:2999/liveclientdata',
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
  timeout: 1500
});

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
        const activeRes = await liveClient.get('/activeplayer');
        let moveSpeed = 0;
        let currentGold = 0;

        if (activeRes.status === 200 && activeRes.data) {
          const stats = activeRes.data.championStats;
          moveSpeed = Number(stats?.moveSpeed || 0);
          currentGold = Number(activeRes.data.currentGold || 0);
        }

        let gameTime = 0;
        try {
          const gameStatsRes = await liveClient.get('/gamestats');
          if (gameStatsRes.status === 200 && gameStatsRes.data) {
            gameTime = Number(gameStatsRes.data.gameTime || 0);
          }
        } catch (_ge) {}

        // Partida real iniciada (fuera de pantalla de carga):
        // moveSpeed > 0 O gameTime > 0 O currentGold >= 500
        const isActuallyInGame = moveSpeed > 0 || gameTime > 0.1 || currentGold >= 500;

        isGameReady = isActuallyInGame;
        isLoadingScreen = !isActuallyInGame;
      } catch (_e) {
        isGameReady = false;
        isLoadingScreen = true;
      }
    }
    
    return new Response(JSON.stringify({ phase, isLoadingScreen, isGameReady }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ phase: 'None', isLoadingScreen: false, isGameReady: false }), { status: 200 });
  }
};