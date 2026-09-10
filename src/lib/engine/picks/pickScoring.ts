import { getRoleProbability, evidenceDelta, damageProfile, teamDamage, scalingStrength, type DraftContext } from '../draftContext.js';
// src/lib/engine/picks/pickScoring.ts
import { ENRICHED_DB } from '../core/dataProvider.js';
import { normalizeKey, isFlexChampion, engineWeights, PERSONAL_STATS, getNameFromId } from '../core/constants.js';
import { hydrateAsset } from '../core/hydrator.js';
import { getAdaptedBuild } from '../itemEngine.js';
import type { EnrichedChampion } from '../core/types.js';
import { evidenceContextWeight, scoreEvidence100 } from '../recommendationScoring.js';
import { 
  analyzeComposition, 
  detectEnemyArchetype, 
  detectAllyArchetype, 
  type EnemyArchetype, 
  type ArchetypeReading 
} from './compositionAnalyzer.js';

const COUNTER_MAP: Record<Exclude<EnemyArchetype, 'mixed'>, {
  roles: string[];
  tags: string[];
  bonus: number;
}> = {
  siege:        { roles: ['siege', 'utility'], tags: ['ZoneControl', 'Disengage'], bonus: 1.5 },
  engage_heavy: { roles: ['peel', 'disengage'], tags: ['Peel', 'Disengage', 'Shield', 'Shielding'], bonus: 1.3 },
  poke:         { roles: ['dive', 'engage'], tags: ['Dive', 'Gap Close', 'Tank', 'Frontline'], bonus: 1.2 },
  pick_comp:    { roles: ['peel', 'teamfight'], tags: ['Peel', 'Grouping', 'Frontline'], bonus: 1.0 },
  scaling:      { roles: ['skirmish', 'dive'], tags: ['EarlyPressure', 'Pick', 'Dive'], bonus: 1.2 },
  split_push:   { roles: ['teamfight', 'utility'], tags: ['Global', 'Teleport', 'Engage'], bonus: 1.0 },
  teamfight:    { roles: ['poke', 'burst'], tags: ['Poke', 'Burst', 'Disengage', 'Kite'], bonus: 1.1 }
};

/**
 * Capa 2.5: Bonificación o penalización estructural según arquetipo enemigo y aliado.
 */
export function calcArchetypeCounterBonus(
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

  const hasAnyCounterTag = candidateTags.some(t => counter.tags.includes(t));
  const hasAnyCounterRole = counter.roles.includes(candidateRole);

  if (!hasAnyCounterTag && !hasAnyCounterRole) {
    rawBonus -= 1.2;
  }

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
 * Pipeline de Scoring Multi-Capa para Picks (Capas 0.5 a 9.0).
 */
export function calculateScore(
  target: EnrichedChampion, 
  allies: string[], 
  enemies: string[], 
  unavailableIds: number[] = [],
  context: DraftContext = {}
): { score: number; reasons: string[] } {
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

  const targetLane = target.lane;
  const sourceStats = target.buildData?.special_notes?.statsData || target.buildData?.statsData || target.statsData || {};
  const sourceHeader = sourceStats.header || {};
  const metaEvidence = {
    winrate: sourceHeader.wr !== undefined ? 50 + Number(sourceHeader.wr) - Number(sourceHeader.avgWr ?? 50) : target.meta?.winRate ?? 50,
    pickrate: sourceHeader.pickrate ?? sourceHeader.pickRate ?? sourceHeader.pr ?? (target.meta as any)?.pickRate,
    games: sourceHeader.games ?? sourceHeader.n ?? undefined
  };
  const centralPick = scoreEvidence100(metaEvidence);
  let score = 5.0 + ((centralPick.score - 50) * 0.04 * phase.meta_base);
  const reasons: string[] = [];
  if (centralPick.score >= 65) reasons.push("Meta estadístico: evidencia sólida (" + centralPick.score.toFixed(1) + "/100)");
  else if (centralPick.score <= 40) reasons.push("Riesgo estadístico: evidencia limitada (" + centralPick.score.toFixed(1) + "/100)");

  // Tendencia compacta del histórico: señal secundaria, nunca sustituye la
  // evidencia total del parche y queda limitada para no perseguir ruido diario.
  const trendDelta = Number(sourceHeader.trend?.delta);
  if (Number.isFinite(trendDelta)) {
    const phaseFactor = phaseKey === 'pick1' ? 1.0 : phaseKey === 'pick5' ? 0.5 : 0.75;
    const trendBonus = Math.max(-0.45, Math.min(0.45, trendDelta * 0.12 * phaseFactor));
    score += trendBonus;
    if (Math.abs(trendDelta) >= 0.35) {
      reasons.push(`${trendDelta >= 0 ? 'Tendencia favorable' : 'Tendencia descendente'}: ${trendDelta >= 0 ? '+' : ''}${trendDelta.toFixed(2)} pp recientes`);
    }
  }

  // Meta y tendencia forman la base; los bonos posteriores son heurísticos contextuales.
  const preContextScore = score;

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

  // Meta already contributes once above. Tier and raw WR are not independent evidence.
  if (centralPick.confidence < 0.5) reasons.push('Datos del rol: confianza limitada; valoración conservadora');

  // --- CAPA 1.1: PONDERACIÓN Y PENALIZACIÓN DE ROL SECUNDARIO / OFF-META ---
  if (target.isSecondaryLane || target.is_secondary_lane) {
    const lanePickRate = typeof target.lanePickRate === 'number' 
      ? target.lanePickRate 
      : (typeof target.lane_pick_rate === 'number' ? target.lane_pick_rate : 0);

    if (lanePickRate >= 5 && lanePickRate < 15) {
      score -= 1.8;
      reasons.push(`Pick de Nicho: Rol secundario con baja presencia (${lanePickRate.toFixed(1)}%)`);
    } else if (lanePickRate >= 15 && lanePickRate < 25) {
      score -= 1.0;
      reasons.push(`Pick Secundario: Presencia moderada en carril (${lanePickRate.toFixed(1)}%)`);
    } else if (lanePickRate >= 25 && lanePickRate < 35) {
      score -= 0.4;
    }
  }

  for (const allyName of allies) {
    const ally = ENRICHED_DB[allyName];
    if (!ally) continue;
    let expected = 0;
    for (const [lane, entries] of Object.entries(target.synergies || {})) {
      const matches = entries.filter((m: any) => m.name === allyName && (!m.sourceLane || m.sourceLane === targetLane));
      const match = [...matches].sort((a: any,b: any) => Number(b.count || 0)-Number(a.count || 0))[0] as any;
      if (match) expected += evidenceDelta(match.delta, match.count) * getRoleProbability(ally, lane, context.allyRoles);
    }
    const contribution = Math.max(-1,Math.min(1,expected * 0.22)) * WEIGHTS.SYNERGY;
    score += contribution;
    if (Math.abs(contribution) >= 0.1) reasons.push(`${contribution > 0 ? 'Sinergia' : 'Antisinergia'} con ${allyName}: ${contribution > 0 ? '+' : ''}${contribution.toFixed(2)} (muestra y rol ponderados)`);
  }

  // --- CAPA 2.5: RESPUESTA AL ARQUETIPO ENEMIGO ---
  let collectiveArchetypeBonus = 0.0;
  if (enemies.length >= 1) {
    const enemyEnrichedPicks = enemies.map(name => ENRICHED_DB[name]).filter(Boolean) as EnrichedChampion[];
    const allyEnrichedPicks = allies.map(name => ENRICHED_DB[name]).filter(Boolean) as EnrichedChampion[];

    const enemyArch = detectEnemyArchetype(enemyEnrichedPicks);
    const allyArch = detectAllyArchetype(allyEnrichedPicks);
    const confidence = enemies.length >= 3 ? 'high' : enemies.length === 2 ? 'medium' : 'low';

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

  // Lane matchup data must not be applied globally to an enemy assigned elsewhere.
  for (const enemyName of enemies) {
    const enemy = ENRICHED_DB[enemyName];
    if (!enemy) continue;
    const matches = [...(target.godMatchups || []), ...(target.counters || [])]
      .filter(m => normalizeKey(m.name) === normalizeKey(enemyName) && (!m.lane || m.lane === targetLane))
      .sort((a,b) => Number(b.count || 0)-Number(a.count || 0));
    const match = matches[0];
    if (!match) continue;
    const probability = getRoleProbability(enemy, targetLane, context.enemyRoles);
    const delta = evidenceDelta(match.dominanceScore, match.count);
    const contribution = delta * probability * (delta >= 0 ? WEIGHTS.MATCHUP : WEIGHTS.COUNTER);
    score += contribution;
    if (Math.abs(contribution) >= 0.1) reasons.push(`${contribution > 0 ? 'Ventaja' : 'Riesgo'} de línea vs ${enemyName}: ${Math.round(probability*100)}% de probabilidad de rol, ${match.count} partidas (${contribution > 0 ? '+' : ''}${contribution.toFixed(2)})`);
  }

  // --- CAPA 3.5: NEGACIÓN DE WIN CONDITION ENEMIGA ---
  let winCondNegationBonus = 0.0;
  const enemyComposition = analyzeComposition(enemies);
  if (enemies.length >= 1) {
    enemies.forEach(enemyName => {
      const enemyData = ENRICHED_DB[enemyName];
      if (!enemyData) return;

      const isLateHypercarry = enemyData.isHypercarry && (enemyData.scalingType === 'Late' || enemyData.scaling_type === 'Late');
      const hasZoneControl = target.tags.includes('ZoneControl') || target.tags.includes('Zone Control');
      if (isLateHypercarry && hasZoneControl) {
        winCondNegationBonus += 0.8;
        reasons.push(`Negación: ZoneControl dificulta el escalado del carry enemigo ${enemyName}`);
      }

      const enemyNeeds = enemyData.teamNeeds || [];
      if (enemyNeeds.includes('peel') && !enemyComposition.hasPeelForCarry && (tacticRole === 'dive' || tacticRole === 'burst')) {
        winCondNegationBonus += 0.6;
        reasons.push(`Castigo: Explota la falta de peel enemigo (${enemyName})`);
      }
      if (enemyNeeds.includes('engage') && !enemyComposition.hasEngageInitiator && (tacticRole === 'poke' || tacticRole === 'siege' || tacticRole === 'splitpush')) {
        winCondNegationBonus += 0.6;
        reasons.push(`Castigo: Explota la falta de iniciación enemiga (${enemyName})`);
      }
    });
    
    if (winCondNegationBonus > 0) {
      const finalWinCondBonus = Math.min(winCondNegationBonus, 1.5) * phase.counter;
      score += finalWinCondBonus;
    }
  }

  // --- CAPA 5: BALANCE DE EQUIPO (Utilidad/CC/Frontline) ---
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

  // Repeating poke/teamfight is a plan, not automatically a defect. Penalize only unmet needs.
  if (allies.length >= 2 && sameRoleAlliesCount >= 2 && tacticRole === 'splitpush' && !allyComp.hasEngageInitiator) {
    score -= 0.4 * phase.composition;
    reasons.push('Plan dividido: falta una forma de forzar objetivos con el equipo');
  }

  const alliedChampions = allies.map(a => ENRICHED_DB[a]).filter(Boolean);
  const team = teamDamage(alliedChampions, context.allyRoles);
  const damage = damageProfile(target, targetLane);
  if (allies.length >= 2) {
    const dominant = Math.max(team.physical, team.magic);
    if (dominant >= 0.7) {
      const suppliesMissing = team.physical > team.magic ? damage.magic : damage.physical;
      const contribution = (suppliesMissing - 0.5) * 4 * damage.weight;
      score += contribution;
      reasons.push(`${contribution >= 0 ? 'Balance' : 'Sobrecarga'}: daño ponderado por carries y recursos (${contribution >= 0 ? '+' : ''}${contribution.toFixed(2)})`);
    }
  }
  if (enemies.length) {
    const targetScaling = scalingStrength(target);
    const enemyChamps = enemies.map(e => ENRICHED_DB[e]).filter(Boolean);
    const weights = enemyChamps.map(e => damageProfile(e, context.enemyRoles?.[e.id] || e.lane).weight);
    const totalWeight = weights.reduce((a,b)=>a+b,0);
    const enemyScaling = totalWeight ? enemyChamps.reduce((sum,e,i)=>sum+scalingStrength(e).strength*weights[i],0)/totalWeight : 0;
    const bonus = Math.max(-0.7,Math.min(0.7,(targetScaling.strength-enemyScaling)*0.5))*WEIGHTS.SCALING;
    score += bonus;
    if (Math.abs(bonus) >= 0.15) reasons.push(`Escalado ${bonus > 0 ? 'favorable' : 'desfavorable'}: ${targetScaling.observed ? 'curva observada con muestra' : 'estimación cualitativa, sin WR inventado'}`);
  }

  // --- CAPA 9: FLEXIBILIDAD POST-PICK ---
  const candidateNeeds = target.teamNeeds?.filter((n: string) => n !== 'none' && !alliesProvides.has(n)) || [];
  if (candidateNeeds.length > 0 && allies.length < 4 && phase.flex_bonus > 0) {
    const allChamps = Object.values(ENRICHED_DB) as EnrichedChampion[];
    const occupiedLanes = new Set([targetLane, ...allies.map(a => context.allyRoles?.[ENRICHED_DB[a]?.id]).filter(Boolean)]);
    const availableChamps = allChamps.filter(c => c.id !== target.id && !unavailableIds.includes(c.id) && [c.lane, ...(c.playLanes || [])].some(l => !occupiedLanes.has(l)));

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

  // Identical drafts must produce identical scores; ties are resolved by ID.

  // La heurística no debe rescatar una opción con evidencia de rol insuficiente.
  const contextWeight = evidenceContextWeight(centralPick.confidence);
  if (contextWeight < 1) {
    const gatedScore = preContextScore + (score - preContextScore) * contextWeight;
    if (Math.abs(gatedScore - score) >= 0.05) {
      reasons.push(`Heurística limitada por confianza del rol (${Math.round(centralPick.confidence * 100)}%)`);
    }
    score = gatedScore;
  }

  // --- AJUSTE FINAL (SOFT CAP) ---
  if (score > 8.0) {
    score = 8.0 + (score - 8.0) * 0.12;
  }

  const finalScore = parseFloat(Math.min(Math.max(score, 0.1), 10.0).toFixed(2));
  return { score: finalScore, reasons };
}

/**
 * Obtiene la build completa o adaptada para un campeón específico.
 * Prioriza siempre getAdaptedBuild para generar los clusters por consenso del meta
 * incluso si los equipos están vacíos (bots, personalizada, blind pick, fase in-game directa).
 */
export function getSingleChampionBuild(
  championId: number,
  myTeamIds: number[] = [],
  theirTeamIds: number[] = [],
  myRole: string = 'jungle',
  context: DraftContext = {}
): any {
  const adapted = getAdaptedBuild(championId, myTeamIds, theirTeamIds, myRole, context);
  if (adapted) return adapted;

  const name = getNameFromId(championId);
  if (!name) return null;

  const champ = ENRICHED_DB[name];
  if (!champ || !champ.buildData) return null;

  const b = champ.buildData;
  const skills = b.skills;

  const fullOrder = skills
    ? [
        { key: "Q", pos: skills.skillLevelUp1 },
        { key: "W", pos: skills.skillLevelUp2 },
        { key: "E", pos: skills.skillLevelUp3 }
      ]
      .sort((a, b) => a.pos - b.pos)
      .map(s => s.key)
      .join(" > ")
    : "Q > W > E";

  const paths = b.items?.paths || {
    snowball: [],
    neutral: [],
    behind: []
  };

  return {
    id: championId,
    name: champ.name,
    build: {
      summoners: (b.summoners || []).map((id: number) => hydrateAsset('summoners', id)),
      runes: {
        primaryStyle: b.runes?.primaryStyleId,
        secondaryStyle: b.runes?.subStyleId,
        keystone: hydrateAsset('runes', b.runes?.selections?.[0]),
        shards: (b.runes?.shards || []).map((id: number) => hydrateAsset('shards', id)),
        selections: (b.runes?.selections || []).map((id: number) => hydrateAsset('runes', id))
      },
      items: {
        boots: hydrateAsset('items', b.items?.boots?.id || b.items?.boots),
        core: (b.items?.coreSlots || b.items?.core || []).map((i: any) => hydrateAsset('items', i.id || i)),
        starter: (b.items?.starter || []).map((id: number) => hydrateAsset('items', id)),
        paths: paths
      },
      skillOrder: fullOrder
    }
  };
}
