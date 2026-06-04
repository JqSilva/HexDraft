import { DATA_BY_LANE,ENRICHED_DB, normalizeKey, initializeEngineData, type EnrichedChampion } from './dataProvider';
import { NAME_TO_ID } from './constants';
import { hydrateAsset } from './hydrator';


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
    topRecommendations: Recommendation[]
): BansRecommendation[] {
    //console.log("🔍 [ENGINE] Calculando Bans basados en los mejores picks sugeridos.");

    const banScores: Record<string, { id: number; score: number; count: number }> = {};

    // 1. Tomamos los top 5 o 10 picks recomendados para no saturar con counters de picks malos
    const targetPicks = topRecommendations.slice(0, 10);

    targetPicks.forEach(pick => {
        const champData = ENRICHED_DB[pick.name];
        if (!champData || !champData.counters) return;

        // 2. Iteramos sobre los counters reales de nuestros mejores picks sugeridos
        champData.counters.forEach((counter: any) => {
            const counterName = counter.name;
            const counterId = NAME_TO_ID[counterName];
            if (!counterId) return;

            // Convertimos el winrate del counter a número para usarlo como métrica de peligro
            const wr = parseFloat(counter.winrate.replace('%', ''));

            // Cuanto mayor sea el WinRate del counter contra nuestro pick, mayor prioridad de ban
            const dangerWeight = wr > 50 ? (wr - 50) * 2 : 0.5;

            if (!banScores[counterName]) {
                banScores[counterName] = {
                    id: counterId,
                    score: dangerWeight * (pick.score / 10), // Ponderado por lo bueno que es nuestro pick
                    count: 1
                };
            } else {
                // Si es counter de múltiples picks recomendados, su prioridad se acumula
                banScores[counterName].score += dangerWeight * (pick.score / 10);
                banScores[counterName].count += 1;
            }
        });
    });

    // 3. Transformar el mapa en el array de salida requerido por tu interfaz
    const results: BansRecommendation[] = Object.entries(banScores).map(([name, data]) => ({
        id: data.id,
        name: name,
        // Damos un pequeño bono si es counter repetido de varios de tus campeones
        score: parseFloat(Math.min(Math.max(data.score + (data.count * 0.5), 0.1), 10.0).toFixed(2))
    }));

    // Ordenar de mayor peligro a menor
    return results.sort((a, b) => b.score - a.score).slice(0, 30);
}


/**
 * CALCULAR PUNTAJE
 */
function calculateScore(target: EnrichedChampion, allies: string[], enemies: string[]): { score: number; reasons: string[] } {
    // 1. CONSTANTES DE PESO REEQUILIBRADAS (Contexto > Meta)
    const isLatePick = enemies.length >= 4;

    const WEIGHTS = {
        META_BASE: isLatePick ? 0.2 : 0.4,
        SYNERGY: 2.2,
        MATCHUP: isLatePick ? 0.8 : 0.45,
        COUNTER: isLatePick ? 0.6 : 0.35,
        COMPOSITION: 0.8,
        UTILITY: 0.5,
        SCALING: 1.0
    };

    let score = 5.0;
    const reasons: string[] = [];
    const targetLane = target.lane; // Ej: "TOP"
    

    // --- CAPA 1: FORTALEZA INDIVIDUAL (SUAVIZADA) ---
    const rank = target.meta.tier || 50;
    if (rank === 1) {
        score += 4.0; // Rey del Meta: Bono absoluto para el Top 1
        reasons.push("Meta: Prioridad Máxima (Top 1 Global)");
    } else if (rank === 2) {
        score += 3.5; // Excelente estado: Bono fuerte para el Top 2
        reasons.push("Meta: Selección dominante (Top 2 Global)");
    } else if (rank === 3) {
        score += 3.0; // God Tier de cierre del podio
        reasons.push("Meta: Selección muy fuerte (Top 3 Global)");
    } else if (rank <= 6) {
        score += 2.2; // Bloque alto del Top Tier (Top 4, 5, 6)
        reasons.push("Meta: Selección Top Tier sólida");
    } else if (rank <= 12) {
        score += 1.2; // Bloque medio/bajo del Top Tier (Rammus cae aquí, ya no empata con el podio)
        reasons.push("Meta: Pick estable de la Tierlist");
    } else if (rank <= 25) {
        score += 0.4;
        reasons.push("Análisis: Pick situacional viable");
    } else if (rank > 35) {
        score -= 2.5; // Castigo más severo por estar completamente fuera del radar
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


export function getSingleChampionBuild(championId: number): any {
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
                starter: b.items.starter.map((id: number) => hydrateAsset('items', id))
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
