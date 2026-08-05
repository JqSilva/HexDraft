// src/lib/engine/bansEngine.ts
import { ENRICHED_DB, normalizeKey, type EnrichedChampion } from './dataProvider.js';
import { NAME_TO_ID } from './constants.js';
import { analyzeComposition, detectEnemyArchetype, type EnemyArchetype } from './compositionAnalyzer.js';

export interface BansRecommendation {
  id: number;
  score: number;
  name: string;
  reasons?: string[];
}

export function isFlexChampion(champ: EnrichedChampion): boolean {
  const flexList = new Set([
    "Gragas", "Pantheon", "Karma", "Yasuo", "Yone", "Nautilus", "Swain", "Brand", 
    "Morgana", "Tahm Kench", "Jayce", "Twisted Fate", "Sylas", "K'Sante", "Volibear",
    "Rumble", "Maokai", "Poppy", "Graves", "Lucian", "Talon", "Quinn"
  ]);
  return flexList.has(champ.name);
}

function championMatchesArchetype(c: EnrichedChampion, archetype: EnemyArchetype): boolean {
  const tactic = c.tacticRole || c.tactic_role || 'teamfight';
  if (archetype === 'siege') {
    return c.tags.includes('Siege') || c.tags.includes('Poke') || tactic === 'siege';
  }
  if (archetype === 'engage_heavy') {
    return tactic === 'engage' || c.tags.includes('Knockup') || !!c.is_frontline || !!c.has_hard_cc;
  }
  if (archetype === 'scaling') {
    return !!c.is_hypercarry || c.scalingType === 'Late';
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

/**
 * Procesa las recomendaciones de bans devolviendo la lista de candidatos.
 */
export function getProcessedBans(
  topRecommendations: any[],
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

  const results: BansRecommendation[] = Object.entries(banScores).map(([name, data]) => ({
    id: data.id,
    name: name,
    score: parseFloat(Math.min(Math.max(data.score + (data.count * 0.5), 0.1), 10.0).toFixed(2)),
    reasons: ["Bloquea counters indirectos de tus opciones de pick"]
  }));

  results.sort((a, b) => b.score - a.score);

  if (results.length < 5) {
    const metaBans: { name: string; id: number; score: number }[] = [];
    Object.entries(ENRICHED_DB).forEach(([name, champ]: [string, any]) => {
      const champId = NAME_TO_ID[name];
      if (!champId) return;

      const tier = champ.meta?.tier || 5;
      const winRate = champ.meta?.winRate || 50.0;

      const tierFactor = Math.max(0, 6 - tier); 
      const winrateFactor = Math.max(0, winRate - 45.0); 
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
          score: metaBan.score,
          reasons: ["Sólido ban meta de alta prioridad global"]
        });
        existingNames.add(metaBan.name);
        if (results.length >= 30) break;
      }
    }
  }

  return results.slice(0, 30);
}

/**
 * Calcula recomendaciones de bans personalizadas por línea y contexto.
 */
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
  const champs = allAvailableChamps && allAvailableChamps.length > 0 ? allAvailableChamps : Object.keys(ENRICHED_DB);
  const availableCandidates = champs.filter(name => {
    const normName = normalizeKey(name);
    return !normBanned.includes(normName) && !normAllies.includes(normName) && !normEnemies.includes(normName);
  });

  // 2. Clasificar en relevantes y no relevantes según rol y contexto
  const relevantCandidates: string[] = [];
  const nonRelevantCandidates: string[] = [];

  availableCandidates.forEach(name => {
    const champData = ENRICHED_DB[name] as EnrichedChampion | undefined;
    if (!champData) return;

    // Oponente directo en el mismo rol
    const playsSameRole = champData.lane?.toUpperCase() === targetLane;

    // Campeón flex
    const isFlex = isFlexChampion(champData);

    // Counter directo de myChampion
    let isCounterOfMyChamp = false;
    if (myChampion) {
      const myData = ENRICHED_DB[myChampion] as EnrichedChampion | undefined;
      isCounterOfMyChamp = !!myData?.counters?.some((ct) => normalizeKey(ct.name) === normalizeKey(name));
    }

    // Refuerza el arquetipo enemigo
    let reinforcesEnemyArchetype = false;
    if (enemyPicks.length >= 2 && enemyArchetype !== 'mixed') {
      reinforcesEnemyArchetype = championMatchesArchetype(champData, enemyArchetype);
    }

    // Tier <= 2 con pickrate alto (>= 5.0) en el rol del usuario
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

  // 3. Si hay menos de 15 relevantes, rellenar
  const selectedCandidates = [...relevantCandidates];
  if (selectedCandidates.length < 15) {
    const fallbackCandidates = nonRelevantCandidates.filter(name => {
      const champData = ENRICHED_DB[name] as EnrichedChampion | undefined;
      return champData?.meta ? champData.meta.tier <= 3 : false;
    });

    for (const fbName of fallbackCandidates) {
      if (selectedCandidates.length >= 15) break;
      if (!selectedCandidates.includes(fbName)) {
        selectedCandidates.push(fbName);
      }
    }
  }

  // Si aún faltan, meter los restantes ordenados por tier global
  if (selectedCandidates.length < 15) {
    const sortedRemaining = [...nonRelevantCandidates].sort((a, b) => {
      const tierA = ENRICHED_DB[a]?.meta?.tier || 5;
      const tierB = ENRICHED_DB[b]?.meta?.tier || 5;
      return tierA - tierB;
    });
    for (const name of sortedRemaining) {
      if (selectedCandidates.length >= 15) break;
      if (!selectedCandidates.includes(name)) {
        selectedCandidates.push(name);
      }
    }
  }

  // 4. Puntuación de los candidatos seleccionados
  const results = selectedCandidates
    .map(name => {
      const champData = ENRICHED_DB[name] as EnrichedChampion | undefined;
      const champId = NAME_TO_ID[name];

      if (!champData || !champId) return { id: 0, name, score: -99, reasons: [] };

      let banScore = 1.0;
      const reasons: string[] = [];

      // Aportación de Tier global (Tier 1: +2.0, Tier 2: +1.5, Tier 3: +1.0, Tier 4: +0.5)
      const globalTier = champData.meta?.tier || 5;
      const tierPoints = Math.max(0, (6 - globalTier) * 0.4);
      banScore += tierPoints;

      // Aportación de Win Rate global
      const globalWr = champData.meta?.winRate || 50.0;
      if (globalWr > 50.0) {
        banScore += (globalWr - 50.0) * 0.4;
      } else {
        banScore += (globalWr - 50.0) * 0.2;
      }

      // Aportación por Rol / Oponente en Línea
      const playsSameRole = champData.lane?.toUpperCase() === targetLane;
      if (playsSameRole) {
        banScore += 1.5;
        reasons.push(`Oponente en tu línea (${myRole.toUpperCase()})`);

        const laneStats = champData.lanesStats?.[targetLane];
        if (laneStats) {
          const laneTier = laneStats.tier || 5;
          const laneWr = laneStats.winRate || 50.0;
          
          banScore += Math.max(0, (6 - laneTier) * 0.3);
          if (laneWr > 50.0) {
            banScore += (laneWr - 50.0) * 0.3;
          }
        }
      } else {
        if (isFlexChampion(champData)) {
          banScore += 0.5;
          reasons.push("Campeón flex de alta prioridad");
        }
      }

      // Si no es oponente en línea, pero tiene un tier muy alto, añadir razón global
      if (!playsSameRole && globalTier <= 2) {
        reasons.push(`Fuerte en el meta global (Tier ${globalTier})`);
      }

      // Criterio A: Counter directo de miChampion (+3.5)
      if (myChampion) {
        const myData = ENRICHED_DB[myChampion] as EnrichedChampion | undefined;
        const isCounter = myData?.counters?.some((ct) => normalizeKey(ct.name) === normalizeKey(name));
        if (isCounter) {
          banScore += 3.5;
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

      // Criterio E: Contramedida táctica aliada (+3.0)
      if (alliedPicks.length >= 2) {
        const alliedComp = analyzeComposition(alliedPicks);
        const myTeamTactic = alliedComp.primaryTacticRole;
        const role = champData.tacticRole || champData.tactic_role || 'teamfight';

        if (myTeamTactic === 'engage' && (role === 'peel' || name === 'Poppy' || name === 'Janna')) {
          banScore += 3.0;
          reasons.push(`Deshace nuestra iniciación (anti-engage)`);
        } else if (myTeamTactic === 'poke' && (role === 'dive' || role === 'burst')) {
          banScore += 3.0;
          reasons.push(`Contramedida contra nuestra comp de poke`);
        }
      }

      if (reasons.length === 0) {
        reasons.push("Recomendación meta general");
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
    console.log(`  ${idx + 1}. ${r.name} - Score: ${r.score} - Reasons: ${r.reasons?.join(', ')}`);
  });

  return results;
}
