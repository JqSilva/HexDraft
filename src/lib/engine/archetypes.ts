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

const ALL_ROLES = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'] as const;
type LaneRole = typeof ALL_ROLES[number];

const CHAMPION_ROLE_AFFINITIES: Record<string, Partial<Record<LaneRole, number>>> = {
  // Supports & Mage Supports
  lux: { UTILITY: 0.95, MIDDLE: 0.20 },
  seraphine: { UTILITY: 0.85, BOTTOM: 0.70, MIDDLE: 0.20 },
  karma: { UTILITY: 0.90, MIDDLE: 0.35, TOP: 0.20 },
  morgana: { UTILITY: 0.88, JUNGLE: 0.55, MIDDLE: 0.20 },
  zyra: { UTILITY: 0.88, JUNGLE: 0.60, MIDDLE: 0.15 },
  brand: { JUNGLE: 0.75, UTILITY: 0.75, MIDDLE: 0.25 },
  xerath: { UTILITY: 0.80, MIDDLE: 0.40 },
  velkoz: { UTILITY: 0.75, MIDDLE: 0.45 },
  swain: { UTILITY: 0.65, MIDDLE: 0.55, BOTTOM: 0.35, TOP: 0.25 },
  pantheon: { UTILITY: 0.65, MIDDLE: 0.60, TOP: 0.45, JUNGLE: 0.25 },
  senna: { UTILITY: 0.85, BOTTOM: 0.55 },
  pyke: { UTILITY: 0.95, MIDDLE: 0.15 },
  thresh: { UTILITY: 0.99 },
  nautilus: { UTILITY: 0.98, JUNGLE: 0.10, TOP: 0.10 },
  leona: { UTILITY: 0.99 },
  blitzcrank: { UTILITY: 0.99 },
  lulu: { UTILITY: 0.99 },
  nami: { UTILITY: 0.99 },
  janna: { UTILITY: 0.99 },
  soraka: { UTILITY: 0.99 },
  braum: { UTILITY: 0.99 },
  alistar: { UTILITY: 0.99 },
  milio: { UTILITY: 0.99 },
  yuumi: { UTILITY: 0.99 },

  // Mid / Top flexes & Solo Laners
  irelia: { MIDDLE: 0.88, TOP: 0.82 },
  yasuo: { MIDDLE: 0.92, TOP: 0.40, BOTTOM: 0.40 },
  yone: { MIDDLE: 0.90, TOP: 0.75 },
  jayce: { TOP: 0.80, MIDDLE: 0.75 },
  akali: { MIDDLE: 0.92, TOP: 0.60 },
  sylas: { MIDDLE: 0.88, JUNGLE: 0.60, TOP: 0.40 },
  zed: { MIDDLE: 0.98, JUNGLE: 0.15 },
  fizz: { MIDDLE: 0.98 },
  katarina: { MIDDLE: 0.98 },
  talon: { MIDDLE: 0.90, JUNGLE: 0.70 },
  qiyana: { MIDDLE: 0.95, JUNGLE: 0.40 },
  kassadin: { MIDDLE: 0.98 },
  leblanc: { MIDDLE: 0.98 },
  syndra: { MIDDLE: 0.95, BOTTOM: 0.20 },
  ahri: { MIDDLE: 0.98 },
  vex: { MIDDLE: 0.98 },
  viktor: { MIDDLE: 0.98 },
  oriana: { MIDDLE: 0.98 },
  orianna: { MIDDLE: 0.98 },
  anivia: { MIDDLE: 0.95, UTILITY: 0.20 },
  malzahar: { MIDDLE: 0.98 },
  veigar: { MIDDLE: 0.80, BOTTOM: 0.50, UTILITY: 0.30 },
  hwei: { MIDDLE: 0.85, UTILITY: 0.55 },
  aurora: { MIDDLE: 0.80, TOP: 0.65 },
  cassiopeia: { MIDDLE: 0.85, BOTTOM: 0.40, TOP: 0.35 },
  vladimir: { MIDDLE: 0.75, TOP: 0.75 },
  gragas: { TOP: 0.75, JUNGLE: 0.70, MIDDLE: 0.50, UTILITY: 0.30 },
  galio: { MIDDLE: 0.85, UTILITY: 0.60 },
  twistedfate: { MIDDLE: 0.90, BOTTOM: 0.40, TOP: 0.30 },
  zoe: { MIDDLE: 0.95, UTILITY: 0.30 },
  lissandra: { MIDDLE: 0.98 },
  naafiri: { MIDDLE: 0.95, JUNGLE: 0.30 },
  locke: { MIDDLE: 0.98 },

  // Top Laners
  aatrox: { TOP: 0.98 },
  darius: { TOP: 0.98 },
  fiora: { TOP: 0.98 },
  jax: { TOP: 0.90, JUNGLE: 0.40 },
  camille: { TOP: 0.85, UTILITY: 0.50 },
  gwen: { TOP: 0.90, JUNGLE: 0.35 },
  mordekaiser: { TOP: 0.90, JUNGLE: 0.40 },
  garen: { TOP: 0.95, MIDDLE: 0.25 },
  renekton: { TOP: 0.95, MIDDLE: 0.25 },
  sett: { TOP: 0.85, MIDDLE: 0.40, UTILITY: 0.35 },
  illaoi: { TOP: 0.98 },
  kennen: { TOP: 0.90, MIDDLE: 0.30 },
  nasus: { TOP: 0.95, MIDDLE: 0.20 },
  yorick: { TOP: 0.95 },
  riven: { TOP: 0.95, MIDDLE: 0.20 },
  shen: { TOP: 0.85, UTILITY: 0.55 },
  sion: { TOP: 0.90, MIDDLE: 0.30 },
  ornn: { TOP: 0.95, UTILITY: 0.20 },
  malphite: { TOP: 0.80, MIDDLE: 0.50, UTILITY: 0.35 },
  teemo: { TOP: 0.80, UTILITY: 0.35, JUNGLE: 0.25 },
  urgot: { TOP: 0.95 },
  volibear: { TOP: 0.75, JUNGLE: 0.75 },
  chogath: { TOP: 0.80, MIDDLE: 0.45 },
  trundle: { TOP: 0.75, JUNGLE: 0.75 },
  singed: { TOP: 0.95, MIDDLE: 0.20 },
  drmundo: { TOP: 0.90, JUNGLE: 0.30 },
  ksante: { TOP: 0.95, MIDDLE: 0.20 },
  ambessa: { TOP: 0.80, JUNGLE: 0.60 },

  // Junglers
  leesin: { JUNGLE: 0.99 },
  elise: { JUNGLE: 0.99 },
  belveth: { JUNGLE: 0.99 },
  khazix: { JUNGLE: 0.99 },
  graves: { JUNGLE: 0.95, TOP: 0.20 },
  viego: { JUNGLE: 0.95, MIDDLE: 0.30 },
  kayn: { JUNGLE: 0.99 },
  hecarim: { JUNGLE: 0.99 },
  kindred: { JUNGLE: 0.98 },
  evelynn: { JUNGLE: 0.99 },
  nidalee: { JUNGLE: 0.98 },
  jarvaniv: { JUNGLE: 0.95, TOP: 0.20 },
  shaco: { JUNGLE: 0.85, UTILITY: 0.50 },
  nocturne: { JUNGLE: 0.95, MIDDLE: 0.20 },
  rengar: { JUNGLE: 0.85, TOP: 0.45 },
  diana: { JUNGLE: 0.80, MIDDLE: 0.60 },
  ekko: { JUNGLE: 0.75, MIDDLE: 0.65 },
  sejuani: { JUNGLE: 0.90, TOP: 0.30 },
  zac: { JUNGLE: 0.85, TOP: 0.50, UTILITY: 0.25 },
  amumu: { JUNGLE: 0.85, UTILITY: 0.50 },
  rammus: { JUNGLE: 0.98 },
  warwick: { JUNGLE: 0.75, TOP: 0.65 },
  masteryi: { JUNGLE: 0.98 },
  xinzhao: { JUNGLE: 0.95 },
  fiddlesticks: { JUNGLE: 0.90, UTILITY: 0.30 },
  poppy: { JUNGLE: 0.60, UTILITY: 0.60, TOP: 0.50 },
  lillia: { JUNGLE: 0.95, TOP: 0.20 },
  briar: { JUNGLE: 0.98 },
  ivern: { JUNGLE: 0.98 },

  // ADCs / Bot Laners
  jinx: { BOTTOM: 0.99 },
  kaisa: { BOTTOM: 0.98, MIDDLE: 0.15 },
  caitlyn: { BOTTOM: 0.98 },
  jhin: { BOTTOM: 0.98 },
  ezreal: { BOTTOM: 0.95, MIDDLE: 0.20 },
  vayne: { BOTTOM: 0.80, TOP: 0.65 },
  lucian: { BOTTOM: 0.90, MIDDLE: 0.40 },
  samira: { BOTTOM: 0.98 },
  draven: { BOTTOM: 0.98 },
  zeri: { BOTTOM: 0.98 },
  aphelios: { BOTTOM: 0.98 },
  tristana: { BOTTOM: 0.80, MIDDLE: 0.70 },
  varus: { BOTTOM: 0.90, MIDDLE: 0.35, TOP: 0.20 },
  ashe: { BOTTOM: 0.85, UTILITY: 0.65 },
  sivir: { BOTTOM: 0.98 },
  missfortune: { BOTTOM: 0.95, UTILITY: 0.25 },
  kalista: { BOTTOM: 0.95, TOP: 0.20 },
  kogmaw: { BOTTOM: 0.90, MIDDLE: 0.25 },
  twitch: { BOTTOM: 0.90, UTILITY: 0.40, JUNGLE: 0.20 },
  xayah: { BOTTOM: 0.98 },
  smolder: { BOTTOM: 0.80, MIDDLE: 0.60, TOP: 0.40 },
  nilah: { BOTTOM: 0.98 },
  mel: { BOTTOM: 0.95, UTILITY: 0.30 }
};

export function getChampionRoleAffinity(champName: string, role: LaneRole, synergiesData: Record<string, { lane?: string }> = {}): number {
  if (!champName) return 0;
  const normName = champName.toLowerCase().replace(/[^a-z0-9]/g, '');

  if (CHAMPION_ROLE_AFFINITIES[normName] && CHAMPION_ROLE_AFFINITIES[normName][role] !== undefined) {
    return CHAMPION_ROLE_AFFINITIES[normName][role]!;
  }

  // Fallback a counter-synergies
  const matchedKey = Object.keys(synergiesData).find(
    k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === normName
  );

  if (matchedKey && synergiesData[matchedKey].lane) {
    const rawLane = (synergiesData[matchedKey].lane || '').toUpperCase();
    if (rawLane === role) return 0.80;
  }

  // Fallback a CHAMPIONS_DB
  const baseChamp = Object.values(CHAMPIONS_DB).find(
    c => c.name.toLowerCase().replace(/[^a-z0-9]/g, '') === normName
  );
  if (baseChamp) {
    if (baseChamp.class === 'Marksman' && role === 'BOTTOM') return 0.80;
    if (baseChamp.class === 'Assassin' && role === 'MIDDLE') return 0.80;
    if (baseChamp.class === 'Mage' && (role === 'MIDDLE' || role === 'UTILITY')) return 0.60;
    if (baseChamp.class === 'Fighter' && (role === 'TOP' || role === 'JUNGLE')) return 0.70;
    if (baseChamp.class === 'Tank' && (role === 'TOP' || role === 'UTILITY')) return 0.60;
  }

  return 0.05;
}

export function assignEnemyTeamRoles(enemyNames: string[]): Partial<Record<LaneRole, string>> {
  const cleanEnemies = enemyNames.filter(Boolean);
  if (cleanEnemies.length === 0) return {};

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

  const assigned: Partial<Record<LaneRole, string>> = {};
  const usedChamps = new Set<string>();

  // Si son 5 o menos, resolver asignación óptima
  const rolesToAssign = [...ALL_ROLES];

  // Ordenar pares (champ, role) por afinidad decreciente
  interface AssignmentPair {
    champ: string;
    role: LaneRole;
    score: number;
  }

  const pairs: AssignmentPair[] = [];
  cleanEnemies.forEach(champ => {
    rolesToAssign.forEach(role => {
      const score = getChampionRoleAffinity(champ, role, synergiesData);
      pairs.push({ champ, role, score });
    });
  });

  pairs.sort((a, b) => b.score - a.score);

  for (const pair of pairs) {
    if (!usedChamps.has(pair.champ) && !assigned[pair.role]) {
      assigned[pair.role] = pair.champ;
      usedChamps.add(pair.champ);
    }
    if (usedChamps.size === cleanEnemies.length) break;
  }

  return assigned;
}

export function inferEnemyOpponent(myRole: string, enemyNames: string[]): string | null {
  if (!myRole || !enemyNames || enemyNames.length === 0) return null;

  const targetLane = ROLE_NORM_MAP[myRole.toLowerCase()] as LaneRole || 'MIDDLE';

  // 1. Asignación global de los 5 roles
  const assignments = assignEnemyTeamRoles(enemyNames);
  if (assignments[targetLane]) {
    return assignments[targetLane]!;
  }

  // 2. Si no fue asignado directamente, buscar el campeón con mayor afinidad para targetLane
  let bestChamp: string | null = null;
  let bestScore = 0;

  for (const champ of enemyNames) {
    if (!champ) continue;
    const score = getChampionRoleAffinity(champ, targetLane);
    if (score > bestScore && score >= 0.20) {
      bestScore = score;
      bestChamp = champ;
    }
  }

  return bestChamp;
}
