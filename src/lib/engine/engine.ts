import { DATA_BY_LANE, ENRICHED_DB, normalizeKey, initializeEngineData, type EnrichedChampion } from './dataProvider.js';
import { NAME_TO_ID } from './constants.js';
import { hydrateAsset } from './hydrator.js';
import { getAdaptedBuild } from './itemEngine.js';
import { analyzeComposition } from './compositionAnalyzer.js';

export let engineWeights = {
  meta_base: 0.4,
  synergy: 2.2,
  matchup: 0.45,
  counter: 0.35,
  composition: 0.8,
  utility: 0.5,
  scaling: 1.0,
  tactic_role_bonus: 1.5,
  personal_mastery: 0.8,
  flex_value: 0.6,
  phase_multiplier_pick5: 1.4
};

export function setEngineWeights(weights: any) {
  if (weights) {
    engineWeights = { ...engineWeights, ...weights };
  }
}

export const PERSONAL_STATS: Record<number, { gamesPlayed: number; winRate: number }> = {};

export function initializePersonalStats(stats: any[]) {
  Object.keys(PERSONAL_STATS).forEach(k => delete PERSONAL_STATS[Number(k)]);
  if (stats && Array.isArray(stats)) {
    stats.forEach(s => {
      PERSONAL_STATS[s.championId] = {
        gamesPlayed: s.gamesPlayed,
        winRate: s.winRate
      };
    });
    console.log(`✅ PersonalStats listo: ${Object.keys(PERSONAL_STATS).length} campeones con historial.`);
  }
}

function isFlexChampion(champ: EnrichedChampion): boolean {
  const flexList = new Set([
    "Gragas", "Pantheon", "Karma", "Yasuo", "Yone", "Nautilus", "Swain", "Brand", 
    "Morgana", "Tahm Kench", "Jayce", "Twisted Fate", "Sylas", "K'Sante", "Volibear",
    "Rumble", "Maokai", "Poppy", "Graves", "Lucian", "Talon", "Quinn"
  ]);
  return flexList.has(champ.name);
}


export interface Recommendation {
  id: number;
  score: number;
  name: string;
  reasons: string[];
  build: {
    runes: {
      primaryStyle: any;
      subStyle: any;
      selections: any;
      shards: any[];
    };
    //items: any[]; // Objetos con {id, name, icon}
    skillMax: string;
  };
}


export interface BansRecommendation {
  id: number;
  score: number;
  name: string;
}

// Inicializamos la DB al cargar el módulo
initializeEngineData();

/**
 * Procesa y retorna las recomendaciones de campeones ordenadas según sinergias, counters y el carril asignado.
 */
export function getProcessedRecommendations(
    myTeamIds: number[],
    theirTeamIds: number[],
    bannedIds: number[],
    myRole: string,
    myPickId?: number
): Recommendation[] {
    console.log("🔍 [ENGINE] Datos recibidos:", { allies: myTeamIds, enemies: theirTeamIds, bans: bannedIds, role: myRole , pickId: myPickId});

    const cleanMyTeamIds = myPickId 
        ? myTeamIds.filter(id => id !== myPickId) 
        : myTeamIds;
    const unavailableIds = [...cleanMyTeamIds, ...theirTeamIds, ...bannedIds];

    const results: Recommendation[] = [];

    const posMap: Record<string, string> = {
        "top": "TOP",
        "jungle": "JUNGLE",
        "middle": "MIDDLE",
        "bottom": "BOTTOM",
        "utility": "UTILITY"
    };

    const targetLane = posMap[myRole.toLowerCase()] || myRole.toUpperCase();

    const allies = myTeamIds.map(id => getNameFromId(id)).filter(Boolean) as string[];
    const enemies = theirTeamIds.map(id => getNameFromId(id)).filter(Boolean) as string[];

    // Iteramos únicamente sobre el pool del carril seleccionado para optimizar búsquedas
    const pool = DATA_BY_LANE[targetLane] || [];

    for (const c of pool) {
        if (unavailableIds.includes(c.id)) continue;
        const { score, reasons } = calculateScore(c, allies, enemies);
        const rawBuild = c.buildData;

        const hydratedBuild = {
            runes: {
                primaryStyle: hydrateAsset('runes', rawBuild.runes.primaryStyleId),
                subStyle: hydrateAsset('runes', rawBuild.runes.subStyleId),
                selections: rawBuild.runes.selections.map((id: number) => hydrateAsset('runes', id)),
                shards: rawBuild.runes.shards.map((id: number) => hydrateAsset('shards', id))
            },
            skillMax: rawBuild.skills ? ["Q", "W", "E"][rawBuild.skills.skillLevelUp1 - 1] : "Q"
        };

        results.push({
            id: c.id,
            name: c.name,
            score: score,
            reasons: reasons,
            build: hydratedBuild
        });
    }

    //console.log(`📊 [ENGINE] Recomendaciones generadas: ${results.length}`);

    return results.sort((a, b) => b.score - a.score).slice(0, 30);
}


export function getProcessedBans(
    topRecommendations: Recommendation[],
    myChampion: string | null = null,
    myRole: string = 'jungle',
    alliedPicks: string[] = [],
    enemyPicks: string[] = [],
    bannedChamps: string[] = [],
    allAvailableChamps: string[] = []
): BansRecommendation[] {
    if (alliedPicks.length > 0 || enemyPicks.length > 0 || bannedChamps.length > 0) {
        return getBanRecommendations(myChampion, myRole, alliedPicks, enemyPicks, bannedChamps, allAvailableChamps);
    }

    const banScores: Record<string, { id: number; score: number; count: number }> = {};
    const targetPicks = topRecommendations.slice(0, 10);

    targetPicks.forEach(pick => {
        const champData = ENRICHED_DB[pick.name];
        if (!champData || !champData.counters) return;

        champData.counters.forEach((counter: any) => {
            const counterName = counter.name;
            const counterId = NAME_TO_ID[counterName];
            if (!counterId) return;

            const wr = parseFloat(counter.winrate.replace('%', ''));
            const dangerWeight = wr > 50 ? (wr - 50) * 2 : 0.5;

            if (!banScores[counterName]) {
                banScores[counterName] = {
                    id: counterId,
                    score: dangerWeight * (pick.score / 10),
                    count: 1
                };
            } else {
                banScores[counterName].score += dangerWeight * (pick.score / 10);
                banScores[counterName].count += 1;
            }
        });
    });

    const results: BansRecommendation[] = Object.entries(banScores).map(([name, data]) => ({
        id: data.id,
        name: name,
        score: parseFloat(Math.min(Math.max(data.score + (data.count * 0.5), 0.1), 10.0).toFixed(2))
    }));

    return results.sort((a, b) => b.score - a.score).slice(0, 30);
}

export function getBanRecommendations(
  myChampion: string | null,
  myRole: string,
  alliedPicks: string[],
  enemyPicks: string[],
  bannedChamps: string[],
  allAvailableChamps: string[]
): BansRecommendation[] {
  const normBanned = bannedChamps.map(normalizeKey);
  const normAllies = alliedPicks.map(normalizeKey);
  const normEnemies = enemyPicks.map(normalizeKey);

  const results = allAvailableChamps
    .filter(name => {
      const normName = normalizeKey(name);
      return !normBanned.includes(normName) && !normAllies.includes(normName) && !normEnemies.includes(normName);
    })
    .map(name => {
      let banScore = 1.0;
      const reasons: string[] = [];
      const champData = ENRICHED_DB[name];
      const champId = NAME_TO_ID[name];

      if (!champData || !champId) return { id: 0, name, score: -99, reasons: [] };

      // 1. ¿Counterea a mi campeón?
      if (myChampion) {
        const myData = ENRICHED_DB[myChampion];
        const isCounter = myData?.counters?.some((ct: any) => normalizeKey(ct.name) === normalizeKey(name));
        if (isCounter) {
          banScore += 4.0;
          reasons.push(`Counter directo de tu pick (${myChampion})`);
        }
      }

      // 2. ¿Es Tier S en el meta actual?
      if (champData.meta) {
        const tier = champData.meta.tier || 5;
        const winRate = champData.meta.winRate || 50.0;
        if (tier <= 2 && winRate > 51.5) {
          banScore += 2.5;
          reasons.push(`Tier meta alto con ${winRate.toFixed(1)}% WR`);
        }
      }

      // 3. ¿Deshace la táctica emergente de nuestro equipo?
      if (alliedPicks.length >= 2) {
        const alliedComp = analyzeComposition(alliedPicks);
        const myTeamTactic = alliedComp.primaryTacticRole;
        const role = champData.tacticRole || champData.tactic_role || 'teamfight';
        
        if (myTeamTactic === 'engage' && (role === 'peel' || name === 'Poppy' || name === 'Janna')) {
          banScore += 3.0;
          reasons.push(`Deshace nuestra iniciación (peel/anti-dash)`);
        } else if (myTeamTactic === 'poke' && (role === 'dive' || role === 'burst')) {
          banScore += 3.0;
          reasons.push(`Excelente para divear nuestra composición de poke`);
        }
      }

      return {
        id: champId,
        name,
        score: parseFloat(Math.min(Math.max(banScore, 0.1), 10.0).toFixed(2)),
        reasons
      };
    })
    .filter(r => r.id > 0 && r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 15);

  return results;
}


/**
 * CALCULAR PUNTAJE
 */
function calculateScore(target: EnrichedChampion, allies: string[], enemies: string[]): { score: number; reasons: string[] } {
    // 1. CONSTANTES DE PESO REEQUILIBRADAS POR FASE
    const pickedCount = allies.length;
    let phaseKey: 'pick1' | 'pick3' | 'pick5' = 'pick3';
    if (pickedCount <= 1) phaseKey = 'pick1';
    else if (pickedCount >= 4) phaseKey = 'pick5';

    const PHASE_WEIGHTS = {
      pick1: {
        meta_base: 1.5,
        synergy: 0.3,
        counter: 0.5,
        composition: 0.5,
        flex_bonus: 1.0
      },
      pick3: {
        meta_base: 1.0,
        synergy: 1.5,
        counter: 1.0,
        composition: 1.5,
        flex_bonus: 0.2
      },
      pick5: {
        meta_base: 0.8,
        synergy: 2.0,
        counter: 2.5,
        composition: 2.0,
        flex_bonus: 0.0
      }
    };

    const phase = PHASE_WEIGHTS[phaseKey];

    const WEIGHTS = {
        META_BASE: (engineWeights.meta_base ?? 0.4) * phase.meta_base,
        SYNERGY: (engineWeights.synergy ?? 2.2) * phase.synergy,
        MATCHUP: engineWeights.matchup ?? 0.45,
        COUNTER: (engineWeights.counter ?? 0.35) * phase.counter,
        COMPOSITION: (engineWeights.composition ?? 0.8) * phase.composition,
        UTILITY: engineWeights.utility ?? 0.5,
        SCALING: engineWeights.scaling ?? 1.0,
        tactic_role_bonus: engineWeights.tactic_role_bonus ?? 1.5,
        flex_value: engineWeights.flex_value ?? 0.6,
        personal_mastery: engineWeights.personal_mastery ?? 0.8
    };

    let score = 5.0;
    const reasons: string[] = [];
    const targetLane = target.lane;

    // --- CAPA 0.5: FLEX PICK BONUS (SÓLO FASE 1) ---
    if (phaseKey === 'pick1' && isFlexChampion(target)) {
        score += WEIGHTS.flex_value;
        reasons.push("Flex Pick: Altamente flexible para ocultar composición en early draft");
    }

    // --- CAPA 0.7: MAESTRÍA PERSONAL ---
    const stats = PERSONAL_STATS[target.id];
    if (stats && stats.gamesPlayed >= 5) {
      if (stats.gamesPlayed >= 20 && stats.winRate > 55) {
        score += WEIGHTS.personal_mastery * 1.5;
        reasons.push(`Maestría: Excelente rendimiento personal (${stats.winRate.toFixed(1)}% WR en ${stats.gamesPlayed} partidas)`);
      } else if (stats.gamesPlayed >= 10 && stats.winRate > 52) {
        score += WEIGHTS.personal_mastery;
        reasons.push(`Maestría: Buen rendimiento personal (${stats.winRate.toFixed(1)}% WR)`);
      } else if (stats.winRate < 45) {
        score -= WEIGHTS.personal_mastery * 1.2;
        reasons.push(`Riesgo: Rendimiento personal bajo (${stats.winRate.toFixed(1)}% WR)`);
      }
    }

    // --- CAPA 0.9: ROL TÁCTICO FALTANTE ---
    const allyComp = analyzeComposition(allies);
    const gaps = allyComp.gaps;
    const tacticRole = target.tacticRole || target.tactic_role || 'teamfight';
    
    if (allies.length >= 1 && gaps.includes(tacticRole as any)) {
      score += WEIGHTS.tactic_role_bonus;
      reasons.push(`Balance: Aporta el rol táctico faltante (${tacticRole.toUpperCase()})`);
    }

    // --- CAPA 1: FORTALEZA INDIVIDUAL (SUAVIZADA) ---
    const rank = target.meta.tier || 50;
    if (rank === 1) {
        score += 4.0; // Rey del Meta
        reasons.push("Meta: Prioridad Máxima (Top 1 Global)");
    } else if (rank === 2) {
        score += 3.5;
        reasons.push("Meta: Selección dominante (Top 2 Global)");
    } else if (rank === 3) {
        score += 3.0;
        reasons.push("Meta: Selección muy fuerte (Top 3 Global)");
    } else if (rank <= 6) {
        score += 2.2;
        reasons.push("Meta: Selección Top Tier sólida");
    } else if (rank <= 12) {
        score += 1.2;
        reasons.push("Meta: Pick estable de la Tierlist");
    } else if (rank <= 25) {
        score += 0.4;
        reasons.push("Análisis: Pick situacional viable");
    } else if (rank > 35) {
        score -= 2.5;
        reasons.push("Nota: Fuera del meta prioritario");
    }
    
    // Impacto directo del Win Rate global
    score += (target.meta.winRate - 50) * WEIGHTS.META_BASE;

    // Modificador adaptativo por estado de Blind Pick (Solo si el campeón es genuinamente Top Tier)
    if (allies.length <= 1 && enemies.length <= 2 && rank <= 6 && target.meta.winRate >= 51.0) {
        score += 1.0;
        reasons.push("Safe Pick: Excelente opción a ciegas para abrir el Draft");
    }

    // --- CAPA 2: SINERGIAS (MÁS IMPACTO) ---
    allies.forEach(allyName => {
        const allyData = ENRICHED_DB[allyName];
        if (!allyData) return;

        // Buscamos el Delta en todas las líneas (por si el aliado está fuera de su posición habitual)
        for (const laneSynergies of Object.values(target.synergies)) {
            const match = (laneSynergies as any[]).find(s => s.name === allyName);
            
            if (match) {
                const delta = parseFloat(match.delta);
                if (delta <= 0) continue; // Si la sinergia es negativa o neutra, no sumamos nada

                // 1. Multiplicador de Proximidad (Mapa)
                const isCloseAlly = 
                    (target.lane === 'BOTTOM' && allyData.lane === 'UTILITY') ||
                    (target.lane === 'UTILITY' && allyData.lane === 'BOTTOM') ||
                    (target.lane === 'JUNGLE' && (allyData.lane === 'TOP' || allyData.lane === 'MIDDLE'));
                
                const mapMult = isCloseAlly ? 1.4 : 1.0;

                // 2. Multiplicador de Estructura (Tags)
                // Si el Delta es positivo Y además las clases encajan, potenciamos la sinergia
                let classMult = 1.0;
                const isEngage = target.tags.includes("Tank") || target.tags.includes("Fighter");
                const isFollowUp = allyData.tags.includes("Assassin") || allyData.tags.includes("Mage");
                const isADC = allyData.tags.includes("Marksman");
                const isPeel = target.tags.includes("Support") || target.tags.includes("Tank");

                if (isEngage && isFollowUp) classMult += 0.2; // Combo de iniciación
                if (isADC && isPeel) classMult += 0.3;      // Combo de protección

                // 3. Cálculo Final de la Capa 2
                const synergyBonus = (delta / 10) * WEIGHTS.SYNERGY * mapMult * classMult;
                score += synergyBonus;

                if (delta > 1.2) {
                    reasons.push(`Sinergia: +${delta}% con ${allyName} (${classMult > 1 ? 'Combo de Clase' : 'Estadística'})`);
                }
            }
        }
    });

    // --- CAPA 3: GOD MATCHUPS ---
    enemies.forEach(enemyName => {
        const godMatch = target.godMatchups?.find(m => normalizeKey(m.name) === normalizeKey(enemyName));
        const enemyData = ENRICHED_DB[enemyName];
        if (godMatch && enemyData) {
            const isSameLane = enemyData.lane === targetLane;
            const proximityMult = isSameLane ? 2.0 : 0.7;
            const bonus = (godMatch.dominanceScore || 0) * WEIGHTS.MATCHUP * proximityMult;
            score += bonus;
            if (bonus > 0.5) {
                reasons.push(`${isSameLane ? 'Línea' : 'Global'}: Dominancia vs ${enemyName}`);
            }
        }
    });

    // --- CAPA 4: COUNTERS ---
    enemies.forEach(enemyName => {
        const match = target.counters.find(c => normalizeKey(c.name) === normalizeKey(enemyName));

        if (match) {
            const dScore = match.dominanceScore || 0;
            const isBadLane = match.laneTag === "Bad Lane";
            let penalty = Math.abs(dScore) * WEIGHTS.COUNTER;
            if (isBadLane) penalty *= 1.4;
            score -= penalty;
            reasons.push(`Peligro: ${enemyName} (${isBadLane ? 'Fase de líneas crítica' : 'Dificultad media'})`);
        }
    });

    // --- CAPA 5: BALANCE DE EQUIPO (Utilidad/CC) ---
    const teamHasTank = allies.some(a => ENRICHED_DB[a]?.tags.includes("Tank"));
    const teamHasCC = allies.some(a => ENRICHED_DB[a]?.tags.includes("Support") || ENRICHED_DB[a]?.tags.includes("Mage"));
    const teamHasUtility = allies.some(a => 
        ENRICHED_DB[a]?.tags.includes("Support") || 
        ENRICHED_DB[a]?.lane === "UTILITY"
    );

    const isTankRole = ["TOP", "JUNGLE", "UTILITY"].includes(targetLane);

    if (allies.length >= 2 && isTankRole && !teamHasTank && target.tags.includes("Tank")) {
        score += WEIGHTS.UTILITY * 1.5; 
        reasons.push("Balance: Necesidad de Frontline (Falta Tanque en el equipo)");
    }

    if (allies.length >= 2 && !teamHasUtility) {
        const providesCC = target.tags.includes("Support") || target.lane === "UTILITY" || target.tags.includes("Mage");
        if (providesCC) {
            score += WEIGHTS.UTILITY;
            reasons.push("Balance: Aporta el Control de Masas/Utilidad faltante");
        }
    }


    // --- CAPA 6: BALANCE DE DAÑO ---
    const damage = target.combat.damageComposition;
    const teamAD = allies.filter(a => (ENRICHED_DB[a]?.combat.damageComposition.physical / (ENRICHED_DB[a]?.combat.damageComposition.physical + ENRICHED_DB[a]?.combat.damageComposition.magic)) * 100 > 65).length;
    const teamAP = allies.filter(a => (ENRICHED_DB[a]?.combat.damageComposition.magic / (ENRICHED_DB[a]?.combat.damageComposition.physical + ENRICHED_DB[a]?.combat.damageComposition.magic)) * 100 > 65).length;

    // Bono por adaptabilidad híbrida
    if ((damage.physical > 35 && damage.magic > 35) && allies.length > 0) {
        if (teamAD >= 2 && teamAP === 0) {
            score += 0.8;
            reasons.push(`Adaptabilidad: Necesidad de daño AP`);
        }
    }

    // Bono por cubrir hueco (Más agresivo)
    if (allies.length >= 2) {
        if (teamAD === allies.length && teamAP === 0) {
            if(damage.magic > 65) {
                score += 2.5;
                reasons.push("Balance: Daño mágico faltante");
            } else if (damage.physical > 65) {
                score -= 3.0;
                reasons.push("Riesgo: Hay mucho daño físico");
            }
        }
        if (teamAP === allies.length && teamAD === 0) {
            if(damage.physical > 65) {
                score += 2.5;
                reasons.push("Balance: Daño físico faltante");
            } else if (damage.magic > 65) {
                score -= 3.0;
                reasons.push("Riesgo: Hay mucho daño mágico");
            }
        }
    }

    // --- CAPA 7: ESCALADO (winrateCurve) ---
    const getScalingMetrics = (champ: any) => {
        const curve = champ.combat.winrateCurve;
        // Buscamos los puntos exactos que me diste
        const midGame = curve.find((p: any) => p.time === 1500)?.value || 50;
        const lateGame = curve.find((p: any) => p.time === 2700)?.value || 50;
        
        return { midGame, lateGame };
    };

    
    const enemyMetrics = enemies.map(e => getScalingMetrics(ENRICHED_DB[e]));
    const enemyLateAvg = enemyMetrics.reduce((acc, m) => acc + m.lateGame, 0) / (enemies.length || 1);

   
    const targetMetrics = getScalingMetrics(target);

    if (targetMetrics.lateGame > 53 && enemyLateAvg < 50) {
        score += WEIGHTS.SCALING;
        reasons.push(`Escalado: Superioridad en juego tardío (${targetMetrics.lateGame.toFixed(1)}% WR)`);
    }

    if (targetMetrics.lateGame < 47 && enemyLateAvg > 52) {
        score -= WEIGHTS.SCALING * 0.7;
        reasons.push("Riesgo: El enemigo escala mejor hacia el minuto 45");
    }

    if (targetMetrics.midGame > 54) {
        score += 0.5;
        reasons.push("Timing: Powerspike agresivo al minuto 25");
    }


    // --- CAPA 8: VARIABILIDAD (ANTITUNNELING) ---
    const entropy = Math.random() * 0.3;
    score += entropy;

    // --- AJUSTE FINAL (SOFT CAP) ---
    if (score > 9.0) {
        score = 9.0 + (score - 9.0) * 0.25;
    }

    const finalScore = parseFloat(Math.min(Math.max(score, 0.1), 10.0).toFixed(2));
    return { score: finalScore, reasons };
}


export function getSingleChampionBuild(
    championId: number,
    myTeamIds: number[] = [],
    theirTeamIds: number[] = [],
    myRole: string = 'jungle'
): any {
    // Si se pasan composiciones, calcular la build adaptada contextualmente
    if (myTeamIds.length > 0 || theirTeamIds.length > 0) {
        const adapted = getAdaptedBuild(championId, myTeamIds, theirTeamIds, myRole);
        if (adapted) return adapted;
    }

    const name = getNameFromId(championId);
    if (!name) return null;

    const champ = ENRICHED_DB[name];
    if (!champ || !champ.buildData) return null;

    const b = champ.buildData;
    const skills = b.skills;
    const skillOrder = ["Q", "W", "E"];

    const fullOrder = skills
    ? [
        { key: "Q", pos: skills.skillLevelUp1 },
        { key: "W", pos: skills.skillLevelUp2 },
        { key: "E", pos: skills.skillLevelUp3 }
      ]
      .sort((a, b) => a.pos - b.pos) // Ordenamos del 1 al 3
      .map(s => s.key)
      .join(" > ")
    : "Q > W > E";

    // Si la build guardada tiene paths pre-calculados, úsalos
    const paths = b.items.paths || {
        snowball: [],
        neutral: [],
        behind: []
    };

    return {
        name: champ.name,
        build: {
            summoners: b.summoners.map((id: number) => hydrateAsset('summoners', id)),
            runes: {
                primaryStyle: b.runes.primaryStyleId,
                secondaryStyle: b.runes.subStyleId,
                keystone: hydrateAsset('runes', b.runes.selections[0]),
                shards: b.runes.shards.map((id: number) => hydrateAsset('shards', id)),
                selections: b.runes.selections.map((id: number) => hydrateAsset('runes', id))
            },
            items: {
                boots: hydrateAsset('items', b.items.boots.id),
                core: b.items.coreSlots.map((i: any) => hydrateAsset('items', i.id)),
                starter: b.items.starter.map((id: number) => hydrateAsset('items', id)),
                paths: paths
            },
            // Corrección de undefined en skills
            skillOrder: fullOrder
        }
    };
}

// Helper para traducir
export function getNameFromId(id: number): string | undefined {
    // Buscamos la llave cuyo valor coincida con el ID
    const name = Object.keys(NAME_TO_ID).find(key => NAME_TO_ID[key] === id);
    if (!name) console.warn(`⚠️ ID ${id} no encontrado en NAME_TO_ID`);
    return name;
}
