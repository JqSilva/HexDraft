import { DATA_BY_LANE, ENRICHED_DB, normalizeKey, initializeEngineData, type EnrichedChampion } from './dataProvider.js';
import { NAME_TO_ID } from './constants.js';
import { hydrateAsset } from './hydrator.js';
import { getAdaptedBuild } from './itemEngine.js';
import { analyzeComposition, detectEnemyArchetype, detectAllyArchetype, type EnemyArchetype, type AllyArchetype, type ArchetypeReading } from './compositionAnalyzer.js';

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

    const targetLane = posMap[myRole.toLowerCase()] || myRole.toUpperCase();

    const allies = myTeamIds.map(id => getNameFromId(id)).filter(Boolean) as string[];
    const enemies = theirTeamIds.map(id => getNameFromId(id)).filter(Boolean) as string[];

    // Iteramos únicamente sobre el pool del carril seleccionado para optimizar búsquedas
    const pool = DATA_BY_LANE[targetLane] || [];

    for (const c of pool) {
        if (unavailableIds.includes(c.id)) continue;
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

            let wr = 50.0;
            if (counter && counter.winrate) {
                if (typeof counter.winrate === 'string') {
                    wr = parseFloat(counter.winrate.replace('%', ''));
                } else if (typeof counter.winrate === 'number') {
                    wr = counter.winrate;
                }
            }
            if (isNaN(wr)) wr = 50.0;

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

    let results: BansRecommendation[] = Object.entries(banScores).map(([name, data]) => ({
        id: data.id,
        name: name,
        score: parseFloat(Math.min(Math.max(data.score + (data.count * 0.5), 0.1), 10.0).toFixed(2))
    }));

    results.sort((a, b) => b.score - a.score);

    if (results.length < 5) {
        const metaBans: { name: string; id: number; score: number }[] = [];
        Object.entries(ENRICHED_DB).forEach(([name, champ]) => {
            const champId = NAME_TO_ID[name];
            if (!champId) return;

            const tier = champ.meta?.tier || 5;
            const winRate = champ.meta?.winRate || 50.0;

            const tierFactor = Math.max(0, 6 - tier); // Tier 1 -> 5, Tier 2 -> 4, etc.
            const winrateFactor = Math.max(0, winRate - 45.0); // e.g. 52% -> 7, 49% -> 4
            const metaScore = parseFloat((tierFactor * 1.2 + winrateFactor * 0.2).toFixed(2));

            metaBans.push({
                name,
                id: champId,
                score: Math.min(Math.max(metaScore, 0.1), 10.0)
            });
        });

        metaBans.sort((a, b) => {
            const champA = ENRICHED_DB[a.name];
            const champB = ENRICHED_DB[b.name];
            const tierA = champA.meta?.tier || 5;
            const tierB = champB.meta?.tier || 5;
            if (tierA !== tierB) {
                return tierA - tierB;
            }
            const wrA = champA.meta?.winRate || 50.0;
            const wrB = champB.meta?.winRate || 50.0;
            return wrB - wrA;
        });

        const existingNames = new Set(results.map(r => r.name));
        for (const metaBan of metaBans) {
            if (!existingNames.has(metaBan.name)) {
                results.push({
                    id: metaBan.id,
                    name: metaBan.name,
                    score: metaBan.score
                });
                existingNames.add(metaBan.name);
                if (results.length >= 30) break;
            }
        }
    }

    return results.slice(0, 30);
}

// Función auxiliar para determinar si un campeón candidato coincide con el arquetipo del enemigo
function championMatchesArchetype(c: EnrichedChampion, archetype: EnemyArchetype): boolean {
  const tactic = c.tacticRole || c.tactic_role || 'teamfight';
  if (archetype === 'siege') {
    return c.tags.includes('Siege') || c.tags.includes('Poke') || tactic === 'siege';
  }
  if (archetype === 'engage_heavy') {
    return tactic === 'engage' || c.tags.includes('Knockup') || !!c.hasHardCC;
  }
  if (archetype === 'scaling') {
    return !!c.isHypercarry || c.scalingType === 'Late';
  }
  if (archetype === 'poke') {
    return tactic === 'poke' || c.tags.includes('Poke');
  }
  if (archetype === 'pick_comp') {
    return tactic === 'burst' || tactic === 'dive' || c.tags.includes('Pick') || c.tags.includes('Isolation');
  }
  if (archetype === 'split_push') {
    return c.tags.includes('SplitPush') || c.tags.includes('Splitpush') || tactic === 'splitpush';
  }
  if (archetype === 'teamfight') {
    return tactic === 'teamfight';
  }
  return false;
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
  const targetLane = posMap[myRole.toLowerCase()] || myRole.toUpperCase();

  // Obtener el arquetipo del equipo enemigo parcial
  const enrichedEnemies = enemyPicks.map(name => ENRICHED_DB[name]).filter(Boolean) as EnrichedChampion[];
  const enemyArchetype = detectEnemyArchetype(enrichedEnemies);

  // 1. Filtrar los candidatos que no están baneados ni seleccionados
  const availableCandidates = allAvailableChamps.filter(name => {
    const normName = normalizeKey(name);
    return !normBanned.includes(normName) && !normAllies.includes(normName) && !normEnemies.includes(normName);
  });

  // 2. Clasificar en relevantes y no relevantes según rol y contexto
  const relevantCandidates: string[] = [];
  const nonRelevantCandidates: string[] = [];

  availableCandidates.forEach(name => {
    const champData = ENRICHED_DB[name] as EnrichedChampion | undefined;
    if (!champData) return;

    // Criterio 1: Oponente directo en el mismo rol
    const playsSameRole = champData.lane?.toUpperCase() === targetLane;

    // Criterio 2: Es un campeón flex
    const isFlex = isFlexChampion(champData);

    // Criterio 3: Counter directo de myChampion
    let isCounterOfMyChamp = false;
    if (myChampion) {
      const myData = ENRICHED_DB[myChampion] as EnrichedChampion | undefined;
      isCounterOfMyChamp = !!myData?.counters?.some((ct) => normalizeKey(ct.name) === normalizeKey(name));
    }

    // Criterio 4: Refuerza el arquetipo enemigo
    let reinforcesEnemyArchetype = false;
    if (enemyPicks.length >= 2 && enemyArchetype !== 'mixed') {
      reinforcesEnemyArchetype = championMatchesArchetype(champData, enemyArchetype);
    }

    // Criterio 5: Tier <= 2 con pickrate alto (>= 5.0) en el rol del usuario
    const targetLaneStats = champData.lanesStats?.[targetLane];
    const targetLanePickRate = champData.lanesPickrate?.[targetLane];
    const hasHighPickRate = targetLanePickRate ? (parseFloat(String(targetLanePickRate)) >= 5.0) : false;
    const hasLowTier = targetLaneStats ? (targetLaneStats.tier <= 2) : false;
    const isRelevantMetaInRole = hasLowTier && hasHighPickRate;

    const isRelevant = playsSameRole || isFlex || isCounterOfMyChamp || reinforcesEnemyArchetype || isRelevantMetaInRole;

    if (isRelevant) {
      relevantCandidates.push(name);
    } else {
      nonRelevantCandidates.push(name);
    }
  });

  // 3. Fallback: si hay menos de 5 relevantes, incluir Tier 1-2 globales
  let selectedCandidates = [...relevantCandidates];
  if (selectedCandidates.length < 5) {
    const fallbackCandidates = nonRelevantCandidates.filter(name => {
      const champData = ENRICHED_DB[name] as EnrichedChampion | undefined;
      return champData?.meta ? champData.meta.tier <= 2 : false;
    });

    for (const fbName of fallbackCandidates) {
      if (selectedCandidates.length >= 5) break;
      if (!selectedCandidates.includes(fbName)) {
        selectedCandidates.push(fbName);
      }
    }
  }

  // 4. Puntuación de los candidatos seleccionados
  const results = selectedCandidates
    .map(name => {
      let banScore = 1.0;
      const reasons: string[] = [];
      const champData = ENRICHED_DB[name] as EnrichedChampion | undefined;
      const champId = NAME_TO_ID[name];

      if (!champData || !champId) return { id: 0, name, score: -99, reasons: [] };

      // Criterio A: Counter directo de myChampion (+4.0)
      if (myChampion) {
        const myData = ENRICHED_DB[myChampion] as EnrichedChampion | undefined;
        const isCounter = myData?.counters?.some((ct) => normalizeKey(ct.name) === normalizeKey(name));
        if (isCounter) {
          banScore += 4.0;
          reasons.push(`Counter directo de tu pick (${myChampion})`);
        }
      }

      // Criterio B: Refuerza el arquetipo enemigo (+2.5)
      if (enemyPicks.length >= 2 && enemyArchetype !== 'mixed') {
        if (championMatchesArchetype(champData, enemyArchetype)) {
          banScore += 2.5;
          reasons.push(`Refuerza arquetipo enemigo (${enemyArchetype})`);
        }
      }

      // Criterio C: Counter de aliado pickeado (+1.5)
      let isCounterOfAlly = false;
      const otherAllies = alliedPicks.filter(a => !myChampion || normalizeKey(a) !== normalizeKey(myChampion));
      for (const ally of otherAllies) {
        const allyData = ENRICHED_DB[ally] as EnrichedChampion | undefined;
        if (allyData?.counters?.some((ct) => normalizeKey(ct.name) === normalizeKey(name))) {
          isCounterOfAlly = true;
          reasons.push(`Counter de aliado (${ally})`);
          break;
        }
      }
      if (isCounterOfAlly) {
        banScore += 1.5;
      }

      // Criterio D: Tier meta alto (+2.5)
      if (champData.meta) {
        const tier = champData.meta.tier || 5;
        const winRate = champData.meta.winRate || 50.0;
        if (tier <= 2 && winRate > 51.5) {
          banScore += 2.5;
          reasons.push(`Tier meta alto con ${winRate.toFixed(1)}% WR`);
        }
      }

      // Criterio E: Contramedida táctica aliada (+3.0)
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

  // Registro en consola de depuración del top 5
  const top5 = results.slice(0, 5);
  console.log("📊 [BAN RECOMMENDATIONS] Top 5 Candidates:");
  top5.forEach((r, idx) => {
    console.log(`  #${idx + 1}: ${r.name} - Score: ${r.score} - Criterios: ${r.reasons.join(', ') || 'Ninguno'}`);
  });

  return results;
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
 * CALCULAR PUNTAJE
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
    if (!name) console.warn(`⚠️ ID ${id} no encontrado en NAME_TO_ID`);
    return name;
}
