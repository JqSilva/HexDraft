// src/pages/api/draft-recommendations.ts
import type { APIRoute } from 'astro';
import { getProcessedRecommendations, analyzeComposition } from '../../lib/engine/picks/index.js';
import { getBanRecommendations } from '../../lib/engine/bans/index.js';
import { NAME_TO_ID, normalizeRole } from '../../lib/engine/core/constants.js';
import { initializeEngineData } from '../../lib/engine/core/dataProvider.js';
import { championsRepo } from '../../lib/db/champions.repo.js';

export const POST: APIRoute = async ({ request, url }) => {
  try {
    const body = await request.json();
    const phaseParam = url.searchParams.get('phase') || body.phase || 'all';

    // Las recomendaciones siempre trabajan con la misma instantánea enriquecida
    // que entrega SQLite al resto de la aplicación.
    initializeEngineData(championsRepo.getAllEnrichedChampions());
    
    // Captura tolerante de carril/rol en body o query params
    const rawLane = body.assignedLane || 
                    body.lane || 
                    body.assignedPosition || 
                    body.role || 
                    url.searchParams.get('lane') || 
                    url.searchParams.get('assignedLane') || 
                    url.searchParams.get('assignedPosition') || 
                    url.searchParams.get('role') || 
                    'MIDDLE';
    
    const normalizedLane = normalizeRole(rawLane, 'MIDDLE');

    const {
      myChampion = null,
      alliedPicks = [],
      enemyPicks = [],
      bannedChamps = [],
      allAvailableChamps = Object.keys(NAME_TO_ID)
    } = body;
    
    // Convertir nombres a IDs para el motor de picks
    const myTeamIds = alliedPicks.map((name: string) => NAME_TO_ID[name]).filter(Boolean) as number[];
    const theirTeamIds = enemyPicks.map((name: string) => NAME_TO_ID[name]).filter(Boolean) as number[];
    const bannedIds = bannedChamps.map((name: string) => NAME_TO_ID[name]).filter(Boolean) as number[];
    
    const responsePayload: Record<string, any> = {};

    // 1. Fase de PICKS (sin claves duplicadas)
    if (phaseParam === 'pick' || phaseParam === 'all') {
      const myChampId = myChampion ? NAME_TO_ID[myChampion] : undefined;
      const picks = getProcessedRecommendations(myTeamIds, theirTeamIds, bannedIds, normalizedLane, myChampId);
      responsePayload.picks = picks;
    }
    
    // 2. Fase de BANS (sin claves duplicadas)
    if (phaseParam === 'ban' || phaseParam === 'all') {
      const bans = getBanRecommendations(myChampion, normalizedLane, alliedPicks, enemyPicks, bannedChamps, allAvailableChamps);
      responsePayload.bans = bans;
    }
    
    // 3. Análisis de equipo
    responsePayload.teamAnalysis = analyzeComposition(alliedPicks);
    
    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json'
      }
    });
  } catch (error: any) {
    console.error("Error en /api/draft-recommendations:", error);
    return new Response(JSON.stringify({ error: "Error al procesar recomendaciones", details: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
