// src/pages/api/draft-recommendations.ts
import type { APIRoute } from 'astro';
import { getProcessedRecommendations, getBanRecommendations } from '../../lib/engine/engine.js';
import { analyzeComposition } from '../../lib/engine/compositionAnalyzer.js';
import { NAME_TO_ID } from '../../lib/engine/constants.js';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const {
      myChampion = null,
      myRole = 'jungle',
      alliedPicks = [],
      enemyPicks = [],
      bannedChamps = [],
      allAvailableChamps = Object.keys(NAME_TO_ID)
    } = body;
    
    // Convertir nombres a IDs para el motor
    const myTeamIds = alliedPicks.map((name: string) => NAME_TO_ID[name]).filter(Boolean) as number[];
    const theirTeamIds = enemyPicks.map((name: string) => NAME_TO_ID[name]).filter(Boolean) as number[];
    const bannedIds = bannedChamps.map((name: string) => NAME_TO_ID[name]).filter(Boolean) as number[];
    
    // Obtener recomendación de pick para mí/el rol
    const myChampId = myChampion ? NAME_TO_ID[myChampion] : undefined;
    const picks = getProcessedRecommendations(myTeamIds, theirTeamIds, bannedIds, myRole, myChampId);
    
    // Obtener recomendaciones de ban
    const bans = getBanRecommendations(myChampion, myRole, alliedPicks, enemyPicks, bannedChamps, allAvailableChamps);
    
    // Análisis de equipo
    const teamAnalysis = analyzeComposition(alliedPicks);
    
    return new Response(JSON.stringify({
      topPicks: picks.slice(0, 10),
      topBans: bans,
      teamAnalysis
    }), {
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
