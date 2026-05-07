import { CHAMPIONS_DB, type ChampionData } from './data';
import { NAME_TO_ID } from './constants';

export interface Recommendation {
  id: number;
  score: number;
  name: string;
  reasons: string[];
}

/**
 * Normaliza nombres para evitar fallos por comillas o espacios
 */
const normalize = (n: string) => n.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Función principal que procesa el draft y devuelve las recomendaciones
 */
export function getProcessedRecommendations(
    myTeam: any[], 
    theirTeam: any[], 
    rawRole: string,
    metaCache: any // <--- Pasamos el meta como parámetro
): Recommendation[] {
    if (!metaCache) return [];

    // Mapeo de roles LCU -> OP.GG
    const posMap: Record<string, string> = {
        "top": "top",
        "jungle": "jungle",
        "middle": "mid",   
        "bottom": "adc", 
        "utility": "support"
    };
    const myRole = posMap[rawRole.toLowerCase()] || rawRole.toLowerCase();

    // Extraer IDs y limpiar duplicados/vacíos
    const myTeamIds = myTeam.map(p => p.championId || p.championPickIntent).filter(id => id > 0);
    const enemyTeamIds = theirTeam.map(p => p.championId || p.championPickIntent).filter(id => id > 0);
    const allPickedIds = [...myTeamIds, ...enemyTeamIds];

    // Obtener campeones del meta para el rol actual
    const currentMetaRole = metaCache.roles[myRole] || []; // Esto está bien si pasas el JSON completo
    const totalInMeta = currentMetaRole.length;

    const results = currentMetaRole.map((metaEntry: any) => {
        const champId = NAME_TO_ID[metaEntry.name];
        
        // No recomendar si ya está pickeado o no existe en DB
        if (!champId || allPickedIds.includes(champId)) return null;
        
        const baseChamp = CHAMPIONS_DB[champId as number] || (CHAMPIONS_DB as any)[champId.toString()];
        if (!baseChamp) return null;

        // Calcular Score basado en Ranking y Contexto
        const { score, reasons } = calculateScore(baseChamp, myTeamIds, enemyTeamIds, metaEntry, totalInMeta);

        return {
            id: champId,
            name: metaEntry.name,
            score: score,
            reasons: reasons
        };
    }).filter(Boolean) as Recommendation[];

    // Ordenar de mejor a peor
    return results.sort((a, b) => b.score - a.score);
}

/**
 * Calcula el puntaje individual de un campeón
 */

export function calculateScore(
  target: ChampionData, 
  myTeamIds: number[], 
  enemyTeamIds: number[],
  metaEntry: any,
  totalChampsInRole: number
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  const rank = parseInt(metaEntry.rank) || totalChampsInRole;

  // 1. BASE DE META (Igual que antes)
  let score = 3.0 + (3.0 * ((totalChampsInRole - rank + 1) / totalChampsInRole));
  if (rank > 25) score -= 2.0;

  const allies = myTeamIds.map(id => CHAMPIONS_DB[id]).filter(Boolean);
  const enemies = enemyTeamIds.map(id => CHAMPIONS_DB[id]).filter(Boolean);

  // --- 2. LÓGICA DE MULTI-COUNTER (EL "DESTRUCTOR DE COMPS") ---
  let counterCount = 0;
  enemyTeamIds.forEach(enemyId => {
    if (target.hardCounters.includes(enemyId)) counterCount++;
  });

  if (counterCount >= 2) {
    const bonus = counterCount * 1.2; // 2.4 o 3.6 puntos
    score += bonus;
    reasons.push(`Dominio: Countereas a ${counterCount} enemigos`);
  }

  // --- 3. LÓGICA DE FRONTLINE (EL MURO FALTANTE) ---
  const teamHasFrontline = allies.some(a => a.isFrontline);
  if (!teamHasFrontline && target.isFrontline) {
    score += 2.5;
    reasons.push("Necesidad: Tu equipo no tiene resistencia");
  }

  // --- 4. LÓGICA DE HYPERCARRY (EL SEGURO DE VIDA) ---
  const teamHasLateGame = allies.some(a => a.scaling === 'Late' || a.isHypercarry);
  if (!teamHasLateGame && target.isHypercarry) {
    score += 1.5;
    reasons.push("Escalado: Aportas potencia para el juego tardío");
  }

  // --- 5. EL DILEMA AD VS AP (PESO AGRESIVO) ---
  const adAllies = allies.filter(a => a.damageType === 'AD').length;
  const apAllies = allies.filter(a => a.damageType === 'AP').length;

  if (adAllies >= 3 && target.damageType === 'AD') {
    // Si ya somos Full AD, aunque sea counter, le bajamos la moral
    score -= 3.5; 
    reasons.push("RIESGO CRÍTICO: Demasiado daño físico (Full AD)");
  }
  
  if (apAllies === 0 && target.damageType === 'AP') {
    score += 3.0;
    reasons.push("Balance: Única fuente de daño mágico necesaria");
  }

  // --- 6. SINERGIA ESPECÍFICA (Ej: Yasuo + Knockup) ---
  const hasYasuo = allies.some(a => a.name === "Yasuo");
  if (hasYasuo && target.tags.includes("Knockup")) {
    score += 2.0;
    reasons.push("Sinergia: Combo de levantamiento para Yasuo");
  }

  const finalScore = parseFloat(Math.min(Math.max(score, 0.1), 10.0).toFixed(2));
  return { score: finalScore, reasons };
}