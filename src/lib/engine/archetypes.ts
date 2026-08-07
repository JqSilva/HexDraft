import fs from 'node:fs';
import path from 'node:path';
import { CHAMPIONS_DB } from '../data/championdb';

interface ChampInfo {
  name: string;
  class?: string;
  damageType?: string;
  tacticRole?: string;
  tactic_role?: string;
  isFrontline?: boolean | number;
  is_frontline?: boolean | number;
  mobility?: string;
  tags?: string[];
  meta?: { tier?: number; winRate?: number };
  tier?: number;
}

export function getOpponentArchetype(champName: string, enrichedDb: Record<string, ChampInfo> = {}): string {
  if (!champName) return 'generalist';

  let champ: ChampInfo | undefined = enrichedDb[champName];

  if (!champ) {
    const baseChamp = Object.values(CHAMPIONS_DB).find(
      c => c.name.toLowerCase() === champName.toLowerCase()
    );
    if (baseChamp) {
      champ = baseChamp as ChampInfo;
    }
  }

  if (!champ) return 'generalist';

  const champClass = champ.class || '';
  const damageType = champ.damageType || 'Adaptive';
  const tacticRole = champ.tacticRole || champ.tactic_role || '';
  const isFrontline = Boolean(champ.isFrontline || champ.is_frontline);
  const mobility = champ.mobility || 'medium';

  // 1. assassin_ap_melee: class === Assassin AND damageType === AP
  if (champClass === 'Assassin' && damageType === 'AP') {
    return 'assassin_ap_melee';
  }

  // 2. assassin_ad_melee: class === Assassin AND damageType === AD
  if (champClass === 'Assassin' && damageType === 'AD') {
    return 'assassin_ad_melee';
  }

  // 3. mage_ranged: class === Mage AND tacticRole no es dive ni engage
  if (champClass === 'Mage' && tacticRole !== 'dive' && tacticRole !== 'engage') {
    return 'mage_ranged';
  }

  // 4. mage_melee: class === Mage AND isFrontline === false AND mobility low o medium
  if (champClass === 'Mage' && !isFrontline && (mobility === 'low' || mobility === 'medium')) {
    return 'mage_melee';
  }

  // 5. bruiser_ad: class === Fighter AND damageType === AD
  if (champClass === 'Fighter' && damageType === 'AD') {
    return 'bruiser_ad';
  }

  // 6. bruiser_ap: class === Fighter AND damageType AP o Hybrid
  if (champClass === 'Fighter' && (damageType === 'AP' || damageType === 'Hybrid')) {
    return 'bruiser_ap';
  }

  // 7. tank_engage: isFrontline === true AND tacticRole === engage
  if (isFrontline && tacticRole === 'engage') {
    return 'tank_engage';
  }

  // 8. tank_peel: isFrontline === true AND tacticRole peel o utility
  if (isFrontline && (tacticRole === 'peel' || tacticRole === 'utility')) {
    return 'tank_peel';
  }

  // 9. poke_ranged: tacticRole === poke AND isFrontline === false
  if (tacticRole === 'poke' && !isFrontline) {
    return 'poke_ranged';
  }

  // 10. marksman: class === Marksman
  if (champClass === 'Marksman') {
    return 'marksman';
  }

  // 11. generalist: cualquier caso restante
  return 'generalist';
}

export function getArchetypeMembers(archetype: string, enrichedDb: Record<string, ChampInfo> = {}): string[] {
  const allChamps: ChampInfo[] = [];

  if (Object.keys(enrichedDb).length > 0) {
    Object.values(enrichedDb).forEach(c => allChamps.push(c));
  } else {
    Object.values(CHAMPIONS_DB).forEach(c => allChamps.push(c as ChampInfo));
  }

  const matchingChamps = allChamps.filter(c => {
    return getOpponentArchetype(c.name, enrichedDb) === archetype;
  });

  matchingChamps.sort((a, b) => {
    const tierA = a.meta?.tier ?? a.tier ?? 5;
    const tierB = b.meta?.tier ?? b.tier ?? 5;
    return tierA - tierB;
  });

  return matchingChamps.slice(0, 8).map(c => c.name);
}

const ROLE_NORM_MAP: Record<string, string> = {
  top: 'TOP',
  jungle: 'JUNGLE',
  jg: 'JUNGLE',
  mid: 'MIDDLE',
  middle: 'MIDDLE',
  adc: 'BOTTOM',
  bottom: 'BOTTOM',
  bot: 'BOTTOM',
  support: 'UTILITY',
  utility: 'UTILITY',
  supp: 'UTILITY'
};

const EXCLUSIVE_MID_CHAMPS = new Set([
  'zed', 'fizz', 'katarina', 'akali', 'qiyana', 'naafiri', 'talon', 'kassadin', 'locke', 'leblanc', 'syndra', 'vex', 'lissandra'
]);

const FLEX_CHAMPS = new Set([
  'seraphine', 'gragas', 'lux', 'swain', 'karma', 'jayce', 'pantheon'
]);

export function inferEnemyOpponent(myRole: string, enemyNames: string[]): string | null {
  if (!myRole || !enemyNames || enemyNames.length === 0) return null;

  const targetLane = ROLE_NORM_MAP[myRole.toLowerCase()] || 'MIDDLE';

  interface Candidate {
    name: string;
    lane: string;
    score: number;
  }

  const candidates: Candidate[] = [];

  // Base de datos estática o búsqueda en counter-synergies
  let synergiesData: Record<string, { lane?: string }> = {};
  try {
    if (typeof window === 'undefined') {
      const jsonPath = path.resolve(process.cwd(), 'src/lib/data/counter-synergies.json');
      if (fs.existsSync(jsonPath)) {
        synergiesData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      }
    }
  } catch {
    // Browser fallback
  }

  for (const name of enemyNames) {
    if (!name) continue;
    const normName = name.toLowerCase().replace(/[^a-z0-9]/g, '');

    let champLane = '';

    // 1. Buscar en counter-synergies
    const matchedKey = Object.keys(synergiesData).find(
      k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === normName
    );

    if (matchedKey && synergiesData[matchedKey].lane) {
      champLane = (synergiesData[matchedKey].lane || '').toUpperCase();
    } else {
      // 2. Buscar en CHAMPIONS_DB fallback
      const baseChamp = Object.values(CHAMPIONS_DB).find(
        c => c.name.toLowerCase().replace(/[^a-z0-9]/g, '') === normName
      );
      if (baseChamp) {
        champLane = baseChamp.class === 'Assassin' || baseChamp.class === 'Mage' ? 'MIDDLE' : 'UNKNOWN';
      }
    }

    if (champLane === targetLane) {
      let score = 10;
      if (EXCLUSIVE_MID_CHAMPS.has(normName)) score += 5;
      if (FLEX_CHAMPS.has(normName)) score -= 3;
      candidates.push({ name, lane: champLane, score });
    }
  }

  if (candidates.length === 1) {
    return candidates[0].name;
  }

  if (candidates.length > 1) {
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0].name;
  }

  return null;
}

