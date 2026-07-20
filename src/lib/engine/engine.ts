import { DATA_BY_LANE, ENRICHED_DB, normalizeKey, initializeEngineData, type EnrichedChampion } from './dataProvider.js';
import { NAME_TO_ID } from './constants.js';
import { hydrateAsset } from './hydrator.js';
import { getAdaptedBuild } from './itemEngine.js';
import { analyzeComposition, detectEnemyArchetype, detectAllyArchetype, type EnemyArchetype, type AllyArchetype, type ArchetypeReading } from './compositionAnalyzer.js';

// Importación y re-exportación del submódulo de recomendaciones de bans
import { isFlexChampion } from './bansEngine.js';
export { getProcessedBans, getBanRecommendations } from './bansEngine.js';
export type { BansRecommendation } from './bansEngine.js';

export let engineWeights = {
  meta_base: 0.4,
  synergy: 0.8,
  matchup: 0.45,
  counter: 0.35,
  composition: 0.8,
  utility: 0.5,
  scaling: 1.0,
  tactic_role_bonus: 1.2,
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

// Inicializamos la DB al cargar el módulo
initializeEngineData();

/**
 * Procesa y retorna las recomendaciones de campeones para el draft ordenadas por score de mayor a menor.
 * Esta función es un **entrypoint principal** invocado desde la UI (a través de `/api/draft-recommendations` y `DraftPage.tsx`).
 * 
 * @param myTeamIds - IDs de los campeones aliados actualmente seleccionados.
 * @param theirTeamIds - IDs de los campeones enemigos actualmente seleccionados.
 * @param bannedIds - IDs de los campeones que están baneados en el draft.
 * @param myRole - El carril/rol para el cual se solicita la recomendación (ej: "top", "jungle", "mid", "adc", "support").
 * @param myPickId - ID opcional del pick del usuario si ya está seleccionado, para filtrarlo del equipo.
 * @param singleChampId - ID opcional de un campeón en específico para evaluar individualmente (para previsualizaciones o comparaciones).
 * @returns Lista de hasta 30 recomendaciones ordenadas por puntuación descendente, conteniendo id, nombre, score, razones estructuradas y build predeterminada.
 * 
 * @modifica Para ajustar los pesos aplicados a este scoring, modificar el objeto `engineWeights` en {@link file:///d:/Documentos/HexDraft/src/lib/engine/engine.ts#L7-L19}.
 */
export function getProcessedRecommendations(
    myTeamIds: number[],
    theirTeamIds: number[],
    bannedIds: number[],
    myRole: string,
    myPickId?: number,
    singleChampId?: number
): Recommendation[] {
    console.log("🔍 [ENGINE] Datos recibidos:", { allies: myTeamIds, enemies: theirTeamIds, bans: bannedIds, role: myRole , pickId: myPickId, singleChampId });

    const cleanMyTeamIds = myPickId 
        ? myTeamIds.filter(id => id !== myPickId) 
        : myTeamIds;
    const unavailableIds = [...cleanMyTeamIds, ...theirTeamIds, ...bannedIds];

    const results: Recommendation[] = [];

    const posMap: Record<string, string> = {
        "top": "TOP",
        "jng": "JUNGLE",
        "jungle": "JUNGLE",
        "mid": "MIDDLE",
        "middle": "MIDDLE",
        "bot": "BOTTOM",
        "adc": "BOTTOM",
        "bottom": "BOTTOM",
        "sup": "UTILITY",
        "support": "UTILITY",
        "utility": "UTILITY"
    };

    const targetLane = posMap[myRole.toLowerCase()] || (DATA_BY_LANE[myRole.toUpperCase()] ? myRole.toUpperCase() : "JUNGLE");

    const allies = myTeamIds.map(id => getNameFromId(id)).filter(Boolean) as string[];
    const enemies = theirTeamIds.map(id => getNameFromId(id)).filter(Boolean) as string[];

    // Iteramos únicamente sobre el pool del carril seleccionado para optimizar búsquedas
    let pool = DATA_BY_LANE[targetLane] || [];
    if (singleChampId) {
        const targetChamp = pool.find(c => c.id === singleChampId) || Object.values(ENRICHED_DB).find(c => c.id === singleChampId);
        pool = targetChamp ? [targetChamp] : [];
    }

    for (const c of pool) {
        if (!singleChampId && unavailableIds.includes(c.id)) continue;
        const { score, reasons } = calculateScore(c, allies, enemies, unavailableIds);
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





const COUNTER_MAP: Record<Exclude<EnemyArchetype, 'mixed'>, {
  roles: string[],
  tags: string[],
  bonus: number
}> = {
  siege:       { roles: ['siege','utility'], tags: ['ZoneControl','Disengage'], bonus: 1.5 },
  engage_heavy:{ roles: ['poke','disengage'], tags: ['Poke','Disengage','Shield','Shielding'], bonus: 1.3 },
  poke:        { roles: ['dive','engage'], tags: ['Dive','Gap Close','Tank','Frontline'], bonus: 1.2 },
  pick_comp:   { roles: ['peel','teamfight'], tags: ['Peel','Grouping','Frontline'], bonus: 1.0 },
  scaling:     { roles: ['skirmish','dive'], tags: ['EarlyPressure','Pick','Dive'], bonus: 1.2 },
  split_push:  { roles: ['teamfight','utility'], tags: ['Global','Teleport','Engage'], bonus: 1.0 },
  teamfight:   { roles: ['poke','burst'], tags: ['Poke','Burst','Disengage','Kite'], bonus: 1.1 }
};

/**
 * Capa de Scoring 2.5: Calcula la bonificación o penalización estructural del campeón candidato vs el arquetipo del equipo enemigo y aliado.
 * Se ejecuta en la Capa 2.5 de `calculateScore`.
 * 
 * @param candidate - Datos enriquecidos del campeón candidato a evaluar.
 * @param reading - Estructura de lectura de arquetipos detectados en ambos equipos y el nivel de confianza.
 * @param weights - Pesos de configuración actuales del motor de recomendación.
 * @param phaseMultiplier - Multiplicador de fase de composición (depende de cuántos picks aliados se han realizado).
 * @returns Estructura con el score calculado (`bonus`) y una lista de razones explicativas (`details`).
 * 
 * @modifica Para ajustar la tabla de efectividad de roles y tags contra cada arquetipo, editar la constante `COUNTER_MAP` en {@link file:///d:/Documentos/HexDraft/src/lib/engine/engine.ts#L477-L489}.
 */
function calcArchetypeCounterBonus(
  candidate: EnrichedChampion,
  reading: ArchetypeReading,
  weights: typeof engineWeights,
  phaseMultiplier: number
): { bonus: number; details: string[] } {
  const details: string[] = [];
  if (reading.enemyArchetype === 'mixed') {
    return { bonus: 0, details };
  }

  const confidenceMultiplier = 
    reading.confidence === 'high'   ? 1.0 :
    reading.confidence === 'medium' ? 0.6 :
    0.2;

  const counter = COUNTER_MAP[reading.enemyArchetype];
  if (!counter) return { bonus: 0, details };

  let rawBonus = 0;
  const candidateRole = candidate.tacticRole || candidate.tactic_role || 'teamfight';
  
  if (counter.roles.includes(candidateRole)) {
    rawBonus += counter.bonus;
  }

  const candidateTags = candidate.tags || [];
  const matchingTags = candidateTags.filter(t => counter.tags.includes(t));
  rawBonus += matchingTags.length * 0.4;

  const poorResponses: Record<Exclude<EnemyArchetype, 'mixed'>, string[]> = {
    siege:        ['burst', 'dive', 'assassin', 'skirmish'],
    engage_heavy: ['splitpush', 'burst'],
    scaling:      ['siege'],
    poke:         ['splitpush'],
    pick_comp:    [],
    split_push:   [],
    teamfight:    []
  };

  const isPoorResponse = 
    poorResponses[reading.enemyArchetype]?.includes(candidateRole) ||
    (poorResponses[reading.enemyArchetype]?.includes('assassin') && (candidate.tags.includes('Assassin') || candidate.class === 'Assassin'));

  if (isPoorResponse) {
    rawBonus -= 1.8;
  }

  // Penalización por ausencia de respuesta estructural
  const hasAnyCounterTag = candidateTags.some(t => counter.tags.includes(t));
  const hasAnyCounterRole = counter.roles.includes(candidateRole);

  if (!hasAnyCounterTag && !hasAnyCounterRole) {
    rawBonus -= 1.2;
  }

  // --- DOBLE ANÁLISIS: Intersección con Arquetipo Aliado ---
  let intersectionBonus = 0;
  if (reading.allyArchetype !== 'incomplete') {
    if (reading.allyArchetype === 'poke' && (reading.enemyArchetype === 'siege' || reading.enemyArchetype === 'scaling')) {
      if (candidateTags.includes('ZoneControl') || candidateTags.includes('Disengage')) {
        intersectionBonus += 0.8;
      }
    }
    if (reading.allyArchetype === 'engage' && reading.enemyArchetype === 'poke') {
      if (candidateTags.includes('Gap Close') || candidateTags.includes('Dive') || candidate.isFrontline) {
        intersectionBonus += 0.6;
      }
    }
    if (reading.allyArchetype === 'protect_the_carry' && (reading.enemyArchetype === 'engage_heavy' || reading.enemyArchetype === 'pick_comp')) {
      if (candidateTags.includes('Peel') || candidateTags.includes('Disengage') || candidateTags.includes('Shield') || candidateTags.includes('Shielding')) {
        intersectionBonus += 0.7;
      }
    }
  }

  const finalBonus = (rawBonus + intersectionBonus) * confidenceMultiplier * phaseMultiplier * (weights.composition ?? 0.8);

  if (finalBonus !== 0) {
    const direction = finalBonus > 0 ? 'Counter estructural / Sinergia' : 'Peligro estructural';
    details.push(`Respuesta: ${direction} vs comp enemiga de ${reading.enemyArchetype.toUpperCase()} (${finalBonus > 0 ? '+' : ''}${finalBonus.toFixed(2)})`);
  }

  return { bonus: finalBonus, details };
}

/**
 * Capa de Scoring Principal: Evalúa de forma exhaustiva a un campeón candidato asignándole una puntuación del 0.1 al 10.0.
 * Esta función corre un algoritmo de evaluación multi-capa en el siguiente orden de ejecución:
 * 
 * - **Capa 0.5: Flex Pick Bonus** - Bonifica en fase 1 de picks a campeones flexibles para ocultar composición.
 * - **Capa 0.7: Maestría Personal** - Bonifica o penaliza basado en el rendimiento histórico personal del usuario (`PERSONAL_STATS`).
 * - **Capa 0.9: Rol Táctico faltante / Saturación** - Bonifica si cubre un rol que el equipo aliado no tiene.
 * - **Capa 1: Fortaleza Individual & Win Rate** - Otorga base según meta tier global y win rate. Penaliza 50% si el arquetipo enemigo no es 'mixed' y el candidato no tiene tags de contramedida.
 * - **Capa 2: Sinergias (Estadísticas e Intersección de Clases)** - Suma sinergias cruzadas con campeones aliados. Multiplicador de proximidad física (ej: BOTTOM + UTILITY) y de combo de clase (engage + follow up, adc + peel).
 * - **Capa 2.5: Respuesta de Arquetipo** - Evalúa efectividad contra el arquetipo enemigo vía `calcArchetypeCounterBonus`.
 * - **Capa 3: God Matchups** - Bonifica si el candidato tiene matchups muy favorables conocidos contra campeones enemigos seleccionados.
 * - **Capa 3.5: Negación de Win Condition Enemiga** - Evalúa si el candidato rompe o anula la sinergia de victoria enemiga (ej. ZoneControl vs Hypercarry de escalado tardío).
 * - **Capa 4: Counters** - Penaliza según la dominancia histórica de los campeones enemigos contra el candidato. Aplica multiplicador 1.4 si es fase de líneas crítica ("Bad Lane").
 * - **Capa 5: Balance de Equipo (Utilidad, Frontline, CC, Sustain)** - Bonifica si el equipo carece de control de masas, curación, iniciación o tanque.
 * - **Capa 5.5: Saturación de Rol Táctico Dedicada** - Aplica penalizaciones graduales si hay exceso de campeones aliados con el mismo rol táctico.
 * - **Capa 6: Balance de Daño** - Incentiva que el equipo tenga daño mixto AP/AD y castiga sobrecargas de un solo tipo de daño.
 * - **Capa 7: Escalado Ponderado por Rol** - Evalúa la superioridad o debilidad del escalado tardío comparado con los enemigos, ponderando el peso de los hypercarries enemigos.
 * - **Capa 8: Variabilidad** - Introduce un factor de entropía aleatoria pequeña para evitar recomendaciones tunelizadas idénticas.
 * - **Capa 9: Flexibilidad Post-Pick** - Evalúa cuántos campeones del pool que satisfacen los requerimientos del candidato quedan libres para el resto del draft.
 * - **Ajuste Final**: Aplica un soft-cap para suavizar puntuaciones mayores a 8.0.
 * 
 * @param target - Datos enriquecidos del campeón candidato.
 * @param allies - Nombres de los campeones aliados ya pickeados.
 * @param enemies - Nombres de los campeones enemigos ya pickeados.
 * @param unavailableIds - IDs de campeones bloqueados o baneados para evitar repetirlos.
 * @returns Objeto con la puntuación final redondeada a dos decimales y las razones textuales de la puntuación.
 * 
 * @modifica Para reequilibrar la importancia de las capas según la fase del draft (pick 1, pick 3, pick 5), ajustar el objeto interno `PHASE_WEIGHTS`.
 */
function calculateScore(target: EnrichedChampion, allies: string[], enemies: string[], unavailableIds: number[] = []): { score: number; reasons: string[] } {
    // 1. CONSTANTES DE PESO REEQUILIBRADAS POR FASE
    const pickedCount = allies.length;
    let phaseKey: 'pick1' | 'pick3' | 'pick5' = 'pick3';
    if (pickedCount <= 1) phaseKey = 'pick1';
    else if (pickedCount >= 4) phaseKey = 'pick5';

    const PHASE_WEIGHTS = {
      pick1: {
        meta_base: 1.5,
        synergy: 0.5,
        counter: 0.5,
        composition: 0.5,
        flex_bonus: 1.0
      },
      pick3: {
        meta_base: 1.0,
        synergy: 1.0,
        counter: 1.0,
        composition: 1.2,
        flex_bonus: 0.2
      },
      pick5: {
        meta_base: 0.8,
        synergy: 1.5,
        counter: 2.0,
        composition: 1.8,
        flex_bonus: 0.0
      }
    };

    const phase = PHASE_WEIGHTS[phaseKey];

    const WEIGHTS = {
        META_BASE: (engineWeights.meta_base ?? 0.4) * phase.meta_base,
        SYNERGY: (engineWeights.synergy ?? 0.8) * phase.synergy,
        MATCHUP: engineWeights.matchup ?? 0.45,
        COUNTER: (engineWeights.counter ?? 0.35) * phase.counter,
        COMPOSITION: (engineWeights.composition ?? 0.8) * phase.composition,
        UTILITY: engineWeights.utility ?? 0.5,
        SCALING: engineWeights.scaling ?? 1.0,
        tactic_role_bonus: engineWeights.tactic_role_bonus ?? 1.2,
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

    // --- CAPA 0.9: ROL TÁCTICO FALTANTE / SATURACIÓN ---
    const allyComp = analyzeComposition(allies);
    const gaps = allyComp.gaps;
    const tacticRole = target.tacticRole || target.tactic_role || 'teamfight';
    
    // Contar cuántos aliados tienen el mismo rol táctico
    let sameRoleAlliesCount = 0;
    allies.forEach(allyName => {
      const allyData = ENRICHED_DB[allyName];
      if (allyData) {
        const allyRole = allyData.tacticRole || allyData.tactic_role || 'teamfight';
        if (allyRole === tacticRole) {
          sameRoleAlliesCount++;
        }
      }
    });

    if (allies.length >= 1) {
      if (gaps.includes(tacticRole as any)) {
        score += WEIGHTS.tactic_role_bonus;
        reasons.push(`Balance: Aporta el rol táctico faltante (${tacticRole.toUpperCase()})`);
      }
    }

    // --- CAPA 1: FORTALEZA INDIVIDUAL (SUAVIZADA) Y CAP DE CONTEXTO ---
    const rank = target.meta.tier || 50;
    let metaBonus = 0.0;
    if (rank === 1) {
        metaBonus = 3.5;
        reasons.push("Meta: Prioridad Máxima (Top 1 Global)");
    } else if (rank <= 3) {
        metaBonus = 2.8;
        reasons.push("Meta: Selección muy fuerte (Top 3 Global)");
    } else if (rank <= 6) {
        metaBonus = 2.0;
        reasons.push("Meta: Selección Top Tier sólida");
    } else if (rank <= 12) {
        metaBonus = 1.2;
        reasons.push("Meta: Pick estable de la Tierlist");
    } else if (rank <= 20) {
        metaBonus = 0.6;
        reasons.push("Análisis: Pick situacional viable");
    } else if (rank <= 30) {
        // Neutro: no bonus ni penalización
    } else if (rank > 30) {
        metaBonus = -1.5;
        reasons.push("Nota: Fuera del meta prioritario");
    }

    if (enemies.length >= 2 && metaBonus > 0) {
      const enemyEnrichedForMeta = enemies
        .map(name => ENRICHED_DB[name])
        .filter(Boolean) as EnrichedChampion[];
      
      const detectedArch = detectEnemyArchetype(enemyEnrichedForMeta);
      
      if (detectedArch !== 'mixed') {
        const counterMapCheck = COUNTER_MAP[detectedArch];
        const candidateRole = target.tacticRole || target.tactic_role || 'teamfight';
        const hasResponse = 
          counterMapCheck.roles.includes(candidateRole) ||
          (target.tags || []).some(t => counterMapCheck.tags.includes(t));
        
        if (!hasResponse) {
          metaBonus *= 0.5; // Reducir a la mitad si no tiene respuesta
        }
      }
    }

    score += metaBonus * WEIGHTS.META_BASE;
    
    // Impacto directo del Win Rate global
    score += (target.meta.winRate - 50) * WEIGHTS.META_BASE;

    // Modificador adaptativo por estado de Blind Pick (Solo si el campeón es genuinamente Top Tier)
    if (pickedCount === 0 && enemies.length <= 1 && rank <= 6 && target.meta.winRate >= 51.5) {
        score += 0.8;
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

    // --- CAPA 2.5: RESPUESTA AL ARQUETIPO ENEMIGO Y DOBLE ANÁLISIS ---
    let collectiveArchetypeBonus = 0.0;
    if (enemies.length >= 1) {
      const enemyEnrichedPicks = enemies
        .map(name => ENRICHED_DB[name])
        .filter(Boolean) as EnrichedChampion[];

      const allyEnrichedPicks = allies
        .map(name => ENRICHED_DB[name])
        .filter(Boolean) as EnrichedChampion[];

      const enemyArch = detectEnemyArchetype(enemyEnrichedPicks);
      const allyArch = detectAllyArchetype(allyEnrichedPicks);
      const confidence = enemies.length >= 3 ? 'high' 
        : enemies.length === 2 ? 'medium' 
        : 'low';

      const reading: ArchetypeReading = {
        enemyArchetype: enemyArch,
        allyArchetype: allyArch,
        confidence,
        enemyPicksAnalyzed: enemies.length
      };

      const result = calcArchetypeCounterBonus(target, reading, engineWeights, phase.composition);
      collectiveArchetypeBonus = result.bonus;
      reasons.push(...result.details);
    }
    score += collectiveArchetypeBonus;

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

    // --- CAPA 3.5: NEGACIÓN DE WIN CONDITION ENEMIGA ---
    let winCondNegationBonus = 0.0;
    if (enemies.length >= 1) {
      enemies.forEach(enemyName => {
        const enemyData = ENRICHED_DB[enemyName];
        if (!enemyData) return;

        // A. Hypercarry Late vs ZoneControl
        const isLateHypercarry = enemyData.isHypercarry && (enemyData.scalingType === 'Late' || enemyData.scaling_type === 'Late');
        const hasZoneControl = target.tags.includes('ZoneControl') || target.tags.includes('Zone Control');
        if (isLateHypercarry && hasZoneControl) {
          winCondNegationBonus += 0.8;
          reasons.push(`Negación: ZoneControl dificulta el escalado del carry enemigo ${enemyName}`);
        }

        // B. Cruzar teamNeeds enemigo con tacticRole del candidato
        const enemyNeeds = enemyData.teamNeeds || [];
        if (enemyNeeds.includes('peel') && (tacticRole === 'dive' || tacticRole === 'burst')) {
          winCondNegationBonus += 0.6;
          reasons.push(`Castigo: Explota la falta de peel enemigo (${enemyName})`);
        }
        if (enemyNeeds.includes('engage') && (tacticRole === 'poke' || tacticRole === 'siege' || tacticRole === 'splitpush')) {
          winCondNegationBonus += 0.6;
          reasons.push(`Castigo: Explota la falta de iniciación enemiga (${enemyName})`);
        }
      });
      
      if (winCondNegationBonus > 0) {
        const finalWinCondBonus = Math.min(winCondNegationBonus, 1.5) * phase.counter;
        score += finalWinCondBonus;
      }
    }

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
    const alliesProvides = new Set<string>();
    let alliesTankCount = 0;
    allies.forEach(allyName => {
      const allyData = ENRICHED_DB[allyName];
      if (!allyData) return;
      if (allyData.tags.includes("Tank") || allyData.isFrontline) {
        alliesTankCount++;
      }
      if (allyData.teamProvides) {
        allyData.teamProvides.forEach((p: string) => alliesProvides.add(p));
      }
      if (allyData.tags.includes("Support") || allyData.class === "Support") {
        alliesProvides.add("peel");
      }
      if (allyData.hasHardCC) {
        alliesProvides.add("cc");
      }
    });

    const isTankRole = ["TOP", "JUNGLE", "UTILITY"].includes(targetLane);
    const targetProvides = target.teamProvides || [];

    if (allies.length >= 2 && isTankRole && alliesTankCount === 0 && (target.tags.includes("Tank") || target.isFrontline)) {
        score += WEIGHTS.UTILITY * 1.5; 
        reasons.push("Balance: Necesidad de Frontline (Falta Tanque en el equipo)");
    }

    if (allies.length >= 2) {
      const candidateProvidesCc = targetProvides.includes("cc") || target.hasHardCC;
      const candidateProvidesPeel = targetProvides.includes("peel") || target.tags.includes("Support");
      const candidateProvidesHealing = targetProvides.includes("healing") || targetProvides.includes("shielding") || target.hasShield || target.hasSustain;

      let addedUtility = false;
      if (candidateProvidesCc && !alliesProvides.has("cc")) {
        score += WEIGHTS.UTILITY;
        reasons.push("Balance: Aporta Control de Masas (CC) faltante");
        addedUtility = true;
      }
      if (candidateProvidesPeel && !alliesProvides.has("peel") && !addedUtility) {
        score += WEIGHTS.UTILITY * 0.8;
        reasons.push("Balance: Aporta Protección (Peel) faltante");
        addedUtility = true;
      }
      if (candidateProvidesHealing && !alliesProvides.has("healing") && !alliesProvides.has("shielding") && !addedUtility) {
        score += WEIGHTS.UTILITY * 0.8;
        reasons.push("Balance: Aporta Sustento/Escudos faltantes");
        addedUtility = true;
      }
    }

    // --- CAPA 5.5: SATURACIÓN DE ROL TÁCTICO (DEDICADA) ---
    if (allies.length >= 1 && sameRoleAlliesCount >= 2) {
      let penaltyBase = 0.5;
      if (tacticRole === 'poke' || tacticRole === 'burst' || tacticRole === 'splitpush') {
        penaltyBase = 1.2;
      } else if (tacticRole === 'teamfight' || tacticRole === 'utility') {
        penaltyBase = 0.3;
      }
      const scaledPenalty = (sameRoleAlliesCount - 1) * penaltyBase * phase.composition;
      score -= scaledPenalty;
      reasons.push(`Saturación Táctica: Exceso de campeones de tipo ${tacticRole.toUpperCase()} (-${scaledPenalty.toFixed(1)})`);
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

    // --- CAPA 7: ESCALADO (winrateCurve) PONDERADO POR ROL ---
    const getScalingMetrics = (champ: any) => {
        const curve = champ.combat.winrateCurve;
        const midGame = curve.find((p: any) => p.time === 1500)?.value || 50;
        const lateGame = curve.find((p: any) => p.time === 2700)?.value || 50;
        return { midGame, lateGame };
    };

    let totalWeight = 0;
    let weightedLateSum = 0;
    
    enemies.forEach(enemyName => {
      const enemyData = ENRICHED_DB[enemyName];
      if (!enemyData) return;

      const metrics = getScalingMetrics(enemyData);
      let weight = 1.0;
      if (enemyData.isHypercarry) {
        weight = 2.5; // El hypercarry pesa más en el promedio de escalado tardío
      } else if (enemyData.class === 'Support' || enemyData.lane === 'UTILITY') {
        weight = 0.5; // El support pesa menos
      }

      weightedLateSum += metrics.lateGame * weight;
      totalWeight += weight;
    });

    const enemyLateAvg = totalWeight > 0 ? (weightedLateSum / totalWeight) : 50;
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

    // --- CAPA 9: FLEXIBILIDAD POST-PICK ---
    const candidateNeeds = target.teamNeeds?.filter((n: string) => n !== 'none') || [];
    if (candidateNeeds.length > 0) {
      const allChamps = Object.values(ENRICHED_DB) as EnrichedChampion[];
      const availableChamps = allChamps.filter(c => !unavailableIds.includes(c.id));

      let minProvidersCount = 999;
      candidateNeeds.forEach(need => {
        const count = availableChamps.filter(c => c.teamProvides?.includes(need as any)).length;
        if (count < minProvidersCount) {
          minProvidersCount = count;
        }
      });

      if (minProvidersCount !== 999) {
        let flexBonusOrPenalty = 0.0;
        if (minProvidersCount < 4) {
          flexBonusOrPenalty = -1.2;
          reasons.push(`Draft Cerrado: Menos de 4 opciones disponibles para cubrir ${candidateNeeds.join('/')} (-${(Math.abs(flexBonusOrPenalty) * phase.flex_bonus).toFixed(1)})`);
        } else if (minProvidersCount >= 8) {
          flexBonusOrPenalty = 0.8;
          reasons.push(`Flexibilidad: Quedan ${minProvidersCount} opciones para cubrir ${candidateNeeds.join('/')} (+${(flexBonusOrPenalty * phase.flex_bonus).toFixed(1)})`);
        }

        const finalFlexValue = flexBonusOrPenalty * phase.flex_bonus;
        score += finalFlexValue;
      }
    }

    // --- CAPA 8: VARIABILIDAD (ANTITUNNELING) ---
    const entropy = Math.random() * 0.3;
    score += entropy;

    // --- AJUSTE FINAL (SOFT CAP) ---
    if (score > 8.0) {
        score = 8.0 + (score - 8.0) * 0.12;
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
    return name;
}
