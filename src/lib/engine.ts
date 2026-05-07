// src/lib/engine.ts
import { CHAMPIONS_DB, type ChampionData } from './data';

export interface Recommendation {
  id: number;
  score: number;
  name: string;
}

export function getProcessedRecommendations(
  myTeam: any[], 
  theirTeam: any[], 
  rawRole: string // El rol que viene del LCU (ej: "UTILITY"): string,
): Recommendation[] {
  
    const posMap: Record<string, string> = {
        "top": "top",
        "jungle": "jungle",
        "middle": "mid",   
        "bottom": "bottom",
        "utility": "support"
    };
  
    const myRole = posMap[rawRole.toLowerCase()] || rawRole.toLowerCase();
    // 2. Extraer IDs
    const myTeamIds = myTeam.map(p => p.championId || p.championPickIntent).filter(id => id !== 0);
    const enemyTeamIds = theirTeam.map(p => p.championId || p.championPickIntent).filter(id => id !== 0);

    // 3. Filtrar DB y calcular scores
    const results = Object.values(CHAMPIONS_DB)
        .filter(champ => 
        // Buscamos si alguno de los tags coincide con el rol normalizado
        champ.tags.some(t => t.toLowerCase() === myRole)
        )
        .map(champ => ({
        id: champ.id,
        name: champ.name,
        score: calculateScore(champ, myTeamIds, enemyTeamIds)
        }));

    return results.sort((a, b) => b.score - a.score);
}

export function calculateScore(target: ChampionData, myTeam: number[], enemyTeam: number[]): number {
  let score = target.baseScore;

  // 1. PESO DE COUNTERS (40% de importancia)
  // No solo miramos si le ganas, sino qué tan fuerte es el counter
  enemyTeam.forEach(enemyId => {
    if (target.counters.includes(enemyId)) score += 2.5; // Hard Counter
    
    const enemyData = CHAMPIONS_DB[enemyId];
    if (enemyData && enemyData.counters.includes(target.id)) score -= 3.0; // Ser countereado es más peligroso
  });

  // 2. EQUILIBRIO DE DAÑO (Fundamental en el Meta)
  // Si tu equipo es Full AD, el enemigo armará armadura y perderás.
  const damageTypeCount = { AD: 0, AP: 0 };
  myTeam.forEach(id => {
    const ally = CHAMPIONS_DB[id];
    if (ally) damageTypeCount[ally.damageType as "AD" | "AP"]++;
  });

  if (target.damageType === "AP" && damageTypeCount.AP === 0) score += 2.0; // Necesidad crítica de AP
  if (target.damageType === "AD" && damageTypeCount.AD >= 3) score -= 1.5; // Demasiado AD en el equipo

  // 3. CURVA DE PODER (Scaling)
  // Si tu equipo es todo de Early Game y no ganan en 20 min, pierden.
  const scalingCount = { Early: 0, Mid: 0, Late: 0 };
  myTeam.forEach(id => {
    const ally = CHAMPIONS_DB[id];
    if (ally) scalingCount[ally.scaling as "Early" | "Mid" | "Late"]++;
  });

  // Balancear la curva: Si todos son Early, un pick de Late (como Karthus o Master Yi) suma puntos.
  if (scalingCount.Early >= 2 && target.scaling === "Late") score += 1.0;
  if (scalingCount.Late >= 2 && target.scaling === "Early") score += 1.0;

  // 4. EL FACTOR "WOMB COMBO" (Sinergia de CC)
  // Si hay mucho CC en tu equipo, los campeones que aprovechan eso suben.
  const teamHasHardCC = myTeam.some(id => CHAMPIONS_DB[id]?.tags.includes("CC"));
  if (teamHasHardCC && target.tags.includes("FollowUp")) score += 1.2;

  // 5. PENALIZACIÓN POR "SOBREPOBLACIÓN" DE ROL
  // Si ya hay un Assassin en Mid, otro Assassin en Jungla podría ser redundante.
  const hasAssassin = myTeam.some(id => CHAMPIONS_DB[id]?.tags.includes("Assassin"));
  if (hasAssassin && target.tags.includes("Assassin")) score -= 0.8;

  // Normalización Final (0.1 a 10.0)
  return Math.min(Math.max(score, 0.1), 10.0);
}