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
 * Función principal: Ahora mucho más limpia porque la data ya viene "cocinada"
 */
export function getProcessedRecommendations(
    myTeamIds: number[], 
    theirTeamIds: number[], 
    bannedIds: number[],
    myRole: string
): Recommendation[] {
    console.log("🔍 [ENGINE] Datos recibidos:", { allies: myTeamIds, enemies: theirTeamIds, bans: bannedIds, role: myRole });

    
    const unavailableIds = [...myTeamIds, ...theirTeamIds, ...bannedIds];

    const results: Recommendation[] = [];

    const posMap: Record<string, string> = {
        "top": "TOP",
        "jungle": "JUNGLE",
        "middle": "MIDDLE",   
        "bottom": "BOTTOM", 
        "utility": "UTILITY"
    };

    const targetLane = posMap[myRole.toLowerCase()] || myRole.toUpperCase(); 
    console.log(`📍 [ENGINE] Usando pool pre-filtrado para: ${targetLane}`);

    const allies = myTeamIds.map(id => getNameFromId(id)).filter(Boolean) as string[]; 
    const enemies = theirTeamIds.map(id => getNameFromId(id)).filter(Boolean) as string[];

    // OPTIMIZACIÓN: En lugar de iterar ENRICHED_DB (160+), iteramos solo la línea específica (~30)
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

    console.log(`📊 [ENGINE] Recomendaciones generadas: ${results.length}`); 

    return results.sort((a, b) => b.score - a.score).slice(0, 30); 
}


export function getProcessedBans(
    topRecommendations: Recommendation[]
): BansRecommendation[] {
    console.log("🔍 [ENGINE] Calculando Bans basados en los mejores picks sugeridos.");
    
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
    const WEIGHTS = {
        META_BASE: 0.4,       
        SYNERGY: 2.2,       
        MATCHUP: 0.45,      
        COUNTER: 0.35,       
        COMPOSITION: 0.7,    
        SCALING: 1.0,        
    };

    let score = 5.0; 
    const reasons: string[] = [];
    const rank = target.meta.tier || 50;

    // --- CAPA 1: FORTALEZA INDIVIDUAL (SUAVIZADA) ---
    if (rank <= 3) {
        score += 1.0; 
        reasons.push("Prioridad: God Tier");
    } else if (rank <= 12) {
        score += 0.4;
        reasons.push("Análisis: Pick estable");
    } else if (rank > 25) {
        score -= 1.5; 
        reasons.push("Nota: Fuera del meta actual");
    }

    
    score += (target.meta.winRate - 50) * WEIGHTS.META_BASE;

    
    const effectivenessFactor = rank > 25 ? 0.75 : 1.0; 

    // --- CAPA 2: SINERGIAS (MÁS IMPACTO) ---
    allies.forEach(allyName => {
        for (const laneSynergies of Object.values(target.synergies)) {
            const match = (laneSynergies as any[]).find(s => s.name === allyName);
            if (match) {
                const delta = parseFloat(match.delta);
                if (delta > 1.0) { 
                    const bonus = (delta / 10) * WEIGHTS.SYNERGY * effectivenessFactor;
                    score += bonus;
                    reasons.push(`Sinergia: +${delta}% con ${allyName}`);
                }
            }
        }
    });

    // --- CAPA 3: GOD MATCHUPS ---
    enemies.forEach(enemyName => {
        const godMatch = target.godMatchups?.find(m => normalizeKey(m.name) === normalizeKey(enemyName));
        if (godMatch) {
            const dScore = godMatch.dominanceScore || 0;
            if (dScore > 1.5) {
                // Si el counter es muy fuerte, ignoramos parte de la debilidad del meta
                const metaDefense = rank > 25 ? 1.2 : 1.0; 
                const bonus = dScore * WEIGHTS.MATCHUP * effectivenessFactor * metaDefense;
                score += bonus;
                
                const isDirect = (ENRICHED_DB[enemyName]?.lane || "") === target.lane;
                reasons.push(`${isDirect ? 'Dominancia' : 'Caza'}: Hard Counter de ${enemyName}`);
            }
        }
    });

    // --- CAPA 4: COUNTERS ---
    enemies.forEach(enemyName => {
        const match = target.counters.find(c => normalizeKey(c.name) === normalizeKey(enemyName));
        if (match) {
            const dScore = match.dominanceScore || 0; 
            if (dScore < -1) {
                const penalty = Math.abs(dScore) * WEIGHTS.COUNTER;
                score -= penalty;
                reasons.push(`Peligro: ${enemyName} te neutraliza`);
            }
        }
    });

    // --- CAPA 5: BALANCE DE DAÑO ---
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
        if (teamAD >= 2 && teamAP === 0 && damage.magic > 60) {
            score += WEIGHTS.COMPOSITION;
            reasons.push("Balance: Daño mágico faltante");
        }
        if (teamAP >= 2 && teamAD === 0 && damage.physical > 60) {
            score += WEIGHTS.COMPOSITION;
            reasons.push("Balance: Daño físico faltante");
        }
    }

    // --- CAPA 6: VARIABILIDAD (ANTITUNNELING) ---
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