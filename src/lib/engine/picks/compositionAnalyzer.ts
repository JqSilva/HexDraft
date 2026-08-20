// src/lib/engine/picks/compositionAnalyzer.ts
import { ENRICHED_DB } from '../core/dataProvider.js';
import type { EnrichedChampion } from '../core/types.js';

export type EnemyArchetype = 
  | 'siege'
  | 'engage_heavy'
  | 'poke'
  | 'pick_comp'
  | 'scaling'
  | 'split_push'
  | 'teamfight'
  | 'mixed';

export type AllyArchetype =
  | 'poke'
  | 'engage'
  | 'teamfight'
  | 'protect_the_carry'
  | 'dive'
  | 'incomplete';

export interface ArchetypeReading {
  enemyArchetype: EnemyArchetype;
  allyArchetype: AllyArchetype;
  confidence: 'low' | 'medium' | 'high';
  enemyPicksAnalyzed: number;
}

export interface CompositionAnalysis {
  tankCount: number;
  healerCount: number;
  apCount: number;
  adCount: number;
  ccCount: number;
  assassinCount: number;
  
  primaryTacticRole: 'engage' | 'poke' | 'teamfight' | 'splitpush' | 'mixed';
  hasEngageInitiator: boolean;
  hasPeelForCarry: boolean;
  hasFrontline: boolean;
  hasHypercarry: boolean;
  
  damageProfile: {
    physicalPct: number;
    magicPct: number;
    isBalanced: boolean;
  };
  
  teamScaling: 'early' | 'mid' | 'late';
  gaps: ('engage' | 'peel' | 'frontline' | 'hypercarry' | 'cc' | 'healing' | 'splitpush')[];
  primaryThreats: string[];
  winCondition: 'early_pressure' | 'teamfight' | 'splitpush' | 'poke_siege' | 'dive_backline' | 'scaling';
}

export function detectEnemyArchetype(enemies: EnrichedChampion[]): EnemyArchetype {
  if (enemies.length < 2) {
    return 'mixed';
  }

  const signals = {
    siege: enemies.filter(e => 
      e.tags.includes('Siege') || e.tags.includes('Poke') || (e.tacticRole || e.tactic_role) === 'siege'
    ).length,

    engage_heavy: enemies.filter(e => 
      (e.tacticRole || e.tactic_role) === 'engage' || e.tags.includes('Knockup') || e.hasHardCC
    ).length,

    scaling: enemies.filter(e => 
      e.isHypercarry || e.scalingType === 'Late'
    ).length,

    poke: enemies.filter(e => 
      (e.tacticRole || e.tactic_role) === 'poke' || e.tags.includes('Poke')
    ).length,

    pick_comp: enemies.filter(e => 
      (e.tacticRole || e.tactic_role) === 'burst' || (e.tacticRole || e.tactic_role) === 'dive' || e.tags.includes('Pick') || e.tags.includes('Isolation')
    ).length,

    split_push: enemies.filter(e => 
      e.tags.includes('SplitPush') || e.tags.includes('Splitpush') || (e.tacticRole || e.tactic_role) === 'splitpush'
    ).length,

    teamfight: enemies.filter(e => 
      (e.tacticRole || e.tactic_role) === 'teamfight'
    ).length,
  };

  const priorityOrder: (keyof typeof signals)[] = [
    'siege', 'engage_heavy', 'scaling', 'poke', 'pick_comp', 'split_push', 'teamfight'
  ];

  const sorted = Object.entries(signals)
    .sort((a, b) => {
      if (b[1] !== a[1]) {
        return b[1] - a[1];
      }
      return priorityOrder.indexOf(a[0] as any) - priorityOrder.indexOf(b[0] as any);
    });

  const dominant = sorted[0];

  return dominant[1] >= 2 ? (dominant[0] as EnemyArchetype) : 'mixed';
}

export function detectAllyArchetype(allies: EnrichedChampion[]): AllyArchetype {
  if (allies.length < 2) {
    return 'incomplete';
  }

  const signals = {
    poke: allies.filter(a => 
      (a.tacticRole || a.tactic_role) === 'poke' || a.tags.includes('Poke') || a.tags.includes('Kite')
    ).length,

    engage: allies.filter(a => 
      (a.tacticRole || a.tactic_role) === 'engage' || a.tags.includes('Engage') || a.tags.includes('Knockup')
    ).length,

    teamfight: allies.filter(a => 
      (a.tacticRole || a.tactic_role) === 'teamfight'
    ).length,

    protect_the_carry: allies.filter(a => 
      a.isHypercarry || a.tags.includes('HyperCarry') || a.tags.includes('Shielding') || (a.tacticRole || a.tactic_role) === 'peel' || a.teamProvides?.includes('peel')
    ).length,

    dive: allies.filter(a => 
      (a.tacticRole || a.tactic_role) === 'dive' || a.tags.includes('Dive')
    ).length,
  };

  const priorityOrder: (keyof typeof signals)[] = [
    'poke', 'engage', 'teamfight', 'protect_the_carry', 'dive'
  ];

  const sorted = Object.entries(signals)
    .sort((a, b) => {
      if (b[1] !== a[1]) {
        return b[1] - a[1];
      }
      return priorityOrder.indexOf(a[0] as any) - priorityOrder.indexOf(b[0] as any);
    });

  const dominant = sorted[0];

  return dominant[1] >= 2 ? (dominant[0] as AllyArchetype) : 'incomplete';
}

export function analyzeComposition(champNames: string[]): CompositionAnalysis {
  let tankCount = 0;
  let healerCount = 0;
  let apCount = 0;
  let adCount = 0;
  let ccCount = 0;
  let assassinCount = 0;
  
  let hasEngageInitiator = false;
  let hasPeelForCarry = false;
  let hasFrontline = false;
  let hasHypercarry = false;
  
  let totalPhysical = 0;
  let totalMagic = 0;
  let totalScalingValue = 0; // 1 = early, 2 = mid, 3 = late
  
  const tacticRoleCounts: Record<string, number> = {};
  
  const HEAVY_HEALERS = new Set([
    "soraka", "yuumi", "sylas", "aatrox", "briar", "vladimir", "drmundo", 
    "warwick", "swain", "nami", "sona", "seraphine", "taric", "renekton", 
    "volibear", "illaoi", "fiddlesticks", "kayn", "nilah", "samira", "olaf"
  ]);

  champNames.forEach(name => {
    const champ = ENRICHED_DB[name];
    if (!champ) return;
    
    // Classes & tags
    if (champ.class === 'Tank' || champ.isFrontline) {
      tankCount++;
      hasFrontline = true;
    }
    if (champ.class === 'Assassin') {
      assassinCount++;
    }
    if (champ.hasHardCC) {
      ccCount++;
    }
    if (champ.isHypercarry) {
      hasHypercarry = true;
    }
    
    const normName = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (HEAVY_HEALERS.has(normName) || champ.hasSustain || champ.has_sustain) {
      healerCount++;
    }
    
    // Damage type
    const dmgComp = champ.combat?.damageComposition;
    if (dmgComp && (dmgComp.physical > 0 || dmgComp.magic > 0)) {
      totalPhysical += dmgComp.physical;
      totalMagic += dmgComp.magic;
      if (dmgComp.magic > dmgComp.physical) {
        apCount++;
      } else {
        adCount++;
      }
    } else if (champ.damageType === 'AP' || champ.damage_type === 'AP') {
      apCount++;
      totalMagic += 80;
      totalPhysical += 20;
    } else if (champ.damageType === 'AD' || champ.damage_type === 'AD') {
      adCount++;
      totalPhysical += 80;
      totalMagic += 20;
    } else {
      totalPhysical += 50;
      totalMagic += 50;
    }
    
    // Scaling
    const scaling = champ.scalingType || champ.scaling_type || 'Mid';
    if (scaling === 'Early') {
      totalScalingValue += 1;
    } else if (scaling === 'Late') {
      totalScalingValue += 3;
    } else {
      totalScalingValue += 2;
    }
    
    // Tactical Roles
    const role = champ.tacticRole || champ.tactic_role || 'teamfight';
    tacticRoleCounts[role] = (tacticRoleCounts[role] || 0) + 1;
    
    if (role === 'engage') hasEngageInitiator = true;
    if (role === 'peel' || role === 'utility') hasPeelForCarry = true;
  });
  
  // Primary tactic role
  let primaryTacticRole: 'engage' | 'poke' | 'teamfight' | 'splitpush' | 'mixed' = 'mixed';
  let maxRoleCount = 0;
  for (const [role, count] of Object.entries(tacticRoleCounts)) {
    if (count > maxRoleCount && ['engage', 'poke', 'teamfight', 'splitpush'].includes(role)) {
      maxRoleCount = count;
      primaryTacticRole = role as any;
    }
  }
  
  // Scaling
  const avgScaling = champNames.length > 0 ? totalScalingValue / champNames.length : 2.0;
  let teamScaling: 'early' | 'mid' | 'late' = 'mid';
  if (avgScaling < 1.6) teamScaling = 'early';
  else if (avgScaling > 2.4) teamScaling = 'late';
  
  // Damage profile
  const totalDmgSum = totalPhysical + totalMagic || 1;
  const physicalPct = Math.round((totalPhysical / totalDmgSum) * 100);
  const magicPct = 100 - physicalPct;
  const isBalanced = physicalPct <= 65 && magicPct <= 65;
  
  // Gaps
  const gaps: ('engage' | 'peel' | 'frontline' | 'hypercarry' | 'cc' | 'healing' | 'splitpush')[] = [];
  if (!hasEngageInitiator) gaps.push('engage');
  if (!hasPeelForCarry) gaps.push('peel');
  if (!hasFrontline) gaps.push('frontline');
  if (!hasHypercarry) gaps.push('hypercarry');
  if (ccCount === 0) gaps.push('cc');
  if (healerCount === 0) gaps.push('healing');
  if (!tacticRoleCounts['splitpush']) gaps.push('splitpush');
  
  // Win condition inference
  let winCondition: 'early_pressure' | 'teamfight' | 'splitpush' | 'poke_siege' | 'dive_backline' | 'scaling' = 'teamfight';
  if (primaryTacticRole === 'splitpush') {
    winCondition = 'splitpush';
  } else if (primaryTacticRole === 'poke') {
    winCondition = 'poke_siege';
  } else if (assassinCount >= 2) {
    winCondition = 'dive_backline';
  } else if (teamScaling === 'early') {
    winCondition = 'early_pressure';
  } else if (teamScaling === 'late') {
    winCondition = 'scaling';
  }
  
  return {
    tankCount,
    healerCount,
    apCount,
    adCount,
    ccCount,
    assassinCount,
    primaryTacticRole,
    hasEngageInitiator,
    hasPeelForCarry,
    hasFrontline,
    hasHypercarry,
    damageProfile: {
      physicalPct,
      magicPct,
      isBalanced
    },
    teamScaling,
    gaps,
    primaryThreats: [],
    winCondition
  };
}
