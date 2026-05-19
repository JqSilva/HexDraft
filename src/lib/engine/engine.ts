import { ENRICHED_DB, normalizeKey, initializeEngineData, type EnrichedChampion } from './dataProvider';
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
    myRole: string
): Recommendation[] {
    console.log("🔍 [ENGINE] Datos recibidos:", { allies: myTeamIds, enemies: theirTeamIds, role: myRole });
    const allPickedIds = [...myTeamIds, ...theirTeamIds];
    const results: Recommendation[] = [];

    const posMap: Record<string, string> = {
        "top": "TOP",
        "jungle": "JUNGLE",
        "middle": "MIDDLE",   
        "bottom": "BOTTOM", 
        "utility": "UTILITY"
    };

    const targetLane = posMap[myRole.toLowerCase()] || myRole.toUpperCase();
    console.log(`📍 [ENGINE] Buscando para la línea: ${targetLane}`);
    // Convertimos IDs a nombres para facilitar las búsquedas en la ENRICHED_DB
    const allies = myTeamIds.map(id => getNameFromId(id)).filter(Boolean) as string[];
    const enemies = theirTeamIds.map(id => getNameFromId(id)).filter(Boolean) as string[];

    let filteredCount = 0;
    // Iteramos sobre todos los campeones enriquecidos
    for (const [name, champ] of Object.entries(ENRICHED_DB)) {
        const c = champ as any;

        if (c.lane !== targetLane) {
            filteredCount++;
            continue;
        }

        if (allPickedIds.includes(c.id)) continue;
        
        const { score, reasons } = calculateScore(c, allies, enemies);

        const rawBuild = c.buildData;


        
        const hydratedBuild = {
            runes: {
                // Hidratamos los Estilos (Ramas)
                primaryStyle: hydrateAsset('runes', rawBuild.runes.primaryStyleId),
                subStyle: hydrateAsset('runes', rawBuild.runes.subStyleId),
                
                // Hidratamos las 6 selecciones (Keystone + 3 principales + 2 secundarias)
                selections: rawBuild.runes.selections.map((id: number) => hydrateAsset('runes', id)),
                
                // Hidratamos los 3 Shards
                shards: rawBuild.runes.shards.map((id: number) => hydrateAsset('shards', id))
            },

            // Obtenemos la letra de la habilidad (Q, W, E) basada en el primer maxeo
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
    console.log(`📊 [ENGINE] Procesados: ${results.length} | Omitidos por línea: ${filteredCount}`);
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
 * EL CORAZÓN DEL CÁLCULO: Aquí usamos los DELTAS
 */
function calculateScore(target: EnrichedChampion, allies: string[], enemies: string[]): { score: number; reasons: string[] } {
    // 1. CONSTANTES DE PESO (Ajuste fino de experto)
    const WEIGHTS = {
        META_BASE: 1.0,      // Peso por cada punto de WinRate sobre 50%
        SYNERGY: 2.0,       // Multiplicador de Delta de sinergia
        COUNTER: 0.8,       // Multiplicador de déficit de WR contra enemigos
        COMPOSITION: 0.6,   // Puntos por cubrir huecos (AP/AD/Tank)
        SCALING: 1.0,       // Puntos por equilibrar la curva de tiempo
        TAGS: 0.3           // Puntos por sinergias de clase genéricas
    };

    let score = 5.0; // Base neutra
    const reasons: string[] = [];
    const rank = target.meta.tier || target.meta.rank || 50;

    // --- CAPA 1: FORTALEZA INDIVIDUAL (EL "SUELO" DEL CAMPEÓN) ---
    // Un campeón S-Tier (1-5) recibe un bono, uno D-Tier (>30) una penalización severa.
    if (rank <= 10) score += 1.5;

    if (rank > 10){
      const rankPenalty = ((rank - 10) / 10) * 0.5; 
      score -= rankPenalty;
    }
    if (rank > 25) {
        score -= 2.5;
        reasons.push("Nota: Débil en el meta actual");
    }

    // Winrate puro de OPGG/Meta
    score += (target.meta.winRate - 50) * WEIGHTS.META_BASE;


    // --- CAPA 2: SINERGIAS ESPECÍFICAS (DATOS REALES) ---
    allies.forEach(allyName => {
        for (const laneSynergies of Object.values(target.synergies)) {
            const match = (laneSynergies as any[]).find(s => s.name === allyName);
            if (match) {
                const delta = parseFloat(match.delta);
                // Solo bonificamos deltas significativos para evitar ruido
                if (delta > 0.02) { 
                    const bonus = delta * 1.2 * 10; // x10 para normalizar el decimal del delta
                    score += bonus;
                    reasons.push(`Sinergia: +${(delta * 100).toFixed(1)}% con ${allyName}`);
                }
            }
        }
    });

    // --- CAPA 2: GOD MATCHUPS (DANGER ZONE) ---
    enemies.forEach(enemyName => {
        const godMatch = target.godMatchups?.find(m => normalizeKey(m.name) === normalizeKey(enemyName));

        if (godMatch) {
            const wr = parseFloat(godMatch.winrate);
            
            // --- PREDICCIÓN DE LÍNEA ---
            // Obtenemos la posición principal del enemigo según tu JSON
            const enemyMainPos = ENRICHED_DB[enemyName]?.lane || ""; 
            const isLikelySameLane = enemyMainPos === target.lane; // targetLane es JUNGLE, TOP, etc.
            if (isLikelySameLane) {
                // Caso A: Es muy probable que sea tu rival directo
                score += 1.0; 
                reasons.push(`Dominancia: Matchup directo histórico contra ${enemyName} (${wr}%)`);
            } else {
                // Caso B: Es un enemigo en otra línea (Caza)
                // Solo puntuamos si el WR es destructivo (> 55%)
                if (wr >= 55) {
                    score += 0.4;
                    reasons.push(`Caza: ${target.name} es counter natural de ${enemyName}`);
                }
            }
            
            // --- BONO POR SNOWBALL (Oro y XP) ---
            // Si el Gold Diff es > 400, el pick tiene prioridad alta
            const gDiff = parseInt(godMatch.goldDiff);
            if (gDiff > 400) {
                score += 0.3;
                reasons.push(`Snowball: Gran ventaja de oro histórica vs ${enemyName}`);
            }
        }
    });
    // --- CAPA 3: COUNTERS ESPECÍFICOS (DANGER ZONE) ---
    enemies.forEach(enemyName => {
        const normalizedEnemy = normalizeKey(enemyName);
        const match = target.counters.find(c => normalizeKey(c.name) === normalizedEnemy);
        if (match) {
            const wr = parseFloat(match.winrate.replace('%', ''));
            const deficit = 50 - wr;
            if (deficit > 0) {
                const penalty = deficit * WEIGHTS.COUNTER;
                score -= penalty;
                reasons.push(`Counter: ${enemyName} (${wr}% WR)`);
            }
        }
    });


    // --- CAPA 4: BALANCE DE DAÑO Y ADAPTABILIDAD ---
    const damage = target.combat.damageComposition;
    const totalDmg = damage.physical + damage.magic + (damage.true || 0);
    const physPct = (damage.physical / totalDmg) * 100;
    const magicPct = (damage.magic / totalDmg) * 100;
    
    // Contamos tipos de daño en el equipo
    const teamAD = allies.filter(a => (ENRICHED_DB[a]?.combat.damageComposition.physical / (ENRICHED_DB[a]?.combat.damageComposition.physical + ENRICHED_DB[a]?.combat.damageComposition.magic)) * 100 > 65).length;
    const teamAP = allies.filter(a => (ENRICHED_DB[a]?.combat.damageComposition.magic / (ENRICHED_DB[a]?.combat.damageComposition.physical + ENRICHED_DB[a]?.combat.damageComposition.magic)) * 100 > 65).length;

    // Lógica para Híbridos (Shaco, Volibear, etc.)
    const isHybrid = physPct > 35 && magicPct > 35;
    if (isHybrid && allies.length > 0) {
        if (teamAD >= 2 && teamAP === 0) {
            score += 0.7;
            reasons.push(`Adaptabilidad: El equipo necesita AP, puedes jugar ${target.name} AP`);
        }
    }

    // Penalización por redundancia (Full AD o Full AP)
    if (allies.length >= 2) {
        if (teamAD >= 3 && physPct > 70) {
            score -= 1.2;
            reasons.push("Aviso: Exceso de daño físico en el equipo");
        }
        if (teamAP >= 3 && magicPct > 70) {
            score -= 1.2;
            reasons.push("Aviso: Exceso de daño mágico en el equipo");
        }
    }

    // Bono por cubrir hueco (Solo si el campeón es viable)
    if (allies.length >= 2 && rank <= 25) {
        if (teamAD >= 2 && teamAP === 0 && magicPct > 65) {
            score += WEIGHTS.COMPOSITION;
            reasons.push("Balance: Aportas el daño mágico faltante");
        }
        if (teamAP >= 2 && teamAD === 0 && physPct > 65) {
            score += WEIGHTS.COMPOSITION;
            reasons.push("Balance: Aportas el daño físico faltante");
        }
    }


    // --- CAPA 5: EQUILIBRIO DE CURVA (SCALING) ---
    if (allies.length >= 2) {
        const earlyCount = allies.filter(a => ENRICHED_DB[a]?.scalingType === 'Early').length;
        const lateCount = allies.filter(a => ENRICHED_DB[a]?.scalingType === 'Late').length;

        if (earlyCount >= 2 && target.scalingType === 'Late') {
            score += WEIGHTS.SCALING;
            reasons.push("Escalado: Tu equipo es Early, aseguras el Late Game");
        }
        if (lateCount >= 2 && target.scalingType === 'Early') {
            score += WEIGHTS.SCALING;
            reasons.push("Presión: Equipo lento, aportas Early Game necesario");
        }
    }


    // --- CAPA 6: SINERGIAS POR TAGS (CLASES) ---

    const allyTags = allies.flatMap(name => ENRICHED_DB[name]?.tags || []);
    const hasFrontline = allyTags.includes('Tank') || allyTags.includes('Fighter');
    
    if (target.tags.includes('Assassin') && hasFrontline) {
        score += WEIGHTS.TAGS;
        reasons.push("Sinergia: Frontline detectada para entrar");
    }
    if (target.tags.includes('Marksman') && hasFrontline) {
        const tagBonus = rank > 20 ? 0.15 : WEIGHTS.TAGS;
        score += tagBonus;
        if (tagBonus >= 0.2) reasons.push("Sinergia: Composición con frontline para protegerte");
    }

    const enemyTags = enemies.flatMap(e => ENRICHED_DB[e]?.tags || []);
    const enemyTankCount = enemyTags.filter(t => t === 'Tank').length;
    const pureBurstAssassins = ["Talon", "Kha'Zix", "Rengar", "Naafiri", "Evelynn", "Zed"];
    
    if (enemyTankCount >= 2) {
        if (pureBurstAssassins.includes(target.name) && physPct > 70) {
            score -= 1.2;
            reasons.push("Aviso: Composición enemiga muy resistente para este tipo de asesino");
        }
    
        if (magicPct > 60) {
            const isTank = target.tags.includes('Tank');
            const isMage = target.tags.includes('Mage');

            if (isMage && !isTank) {
                // CASO A: Mago puro (Lillia, Karthus, etc.)
                score += 1.0; // Bono máximo
                reasons.push("Estrategia: Daño mágico constante para derretir la frontline");
            } else if (isTank) {
                // CASO B: Tanque AP (Zac, Amumu, Maokai)
                score += 0.4; // Bono menor: es bueno tener AP, pero no es tu función principal matar al tanque
                reasons.push("Balance: Aportas daño mágico híbrido y utilidad");
            } else {
                // CASO C: Otros (Asesinos AP como Evelynn o Ekko)
                score += 0.6;
                reasons.push("Estrategia: Daño mágico efectivo contra armaduras físicas");
            }
        }
        
        // Penalización real para asesinos AD
        if (target.tags.includes('Fighter') || target.name === "Master Yi") {
            score += 0.5; // Los luchadores/hipercarries están bien contra tanques
            reasons.push(`Duelo: ${target.name} tiene herramientas para pelear vs tanques`);
        }
    }

    if (score > 8.0) {
        // Los puntos por encima de 8 valen la mitad
        score = 8.0 + (score - 8.0) * 0.5;
    }

    // --- AJUSTE FINAL ---
    // Normalizamos para que el score sea difícil de llevar a 10 o a 0 a menos que sea un caso extremo
    const finalScore = parseFloat(Math.min(Math.max(score, 0.1), 10.0).toFixed(2));
    return { score: finalScore, reasons };
}

// Cambia esto dentro de getSingleChampionBuild:
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
                // USA LAS PROPIEDADES PLANAS QUE GENERA TU SCRAPER
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