// src/lib/engine/core/constants.ts
import { normalizeChampionName } from '../../championMapper.js';
import type { EngineWeights, EnrichedChampion, PersonalStats, ChampionLane } from './types.js';

export const normalizeKey = (name: string): string => normalizeChampionName(name);

export const ROLE_TO_LANE_MAP: Record<string, ChampionLane> = {
  // TOP
  'top': 'TOP',
  'solo': 'TOP',
  
  // JUNGLE
  'jungle': 'JUNGLE',
  'jng': 'JUNGLE',
  
  // MID
  'mid': 'MIDDLE',
  'middle': 'MIDDLE',
  
  // ADC / BOT
  'adc': 'BOTTOM',
  'bot': 'BOTTOM',
  'bottom': 'BOTTOM',
  'duo_carry': 'BOTTOM',
  'carry': 'BOTTOM',
  
  // SUPPORT / UTILITY
  'support': 'UTILITY',
  'supp': 'UTILITY',
  'sup': 'UTILITY',
  'utility': 'UTILITY',
  'duo_support': 'UTILITY'
};

/**
 * Mapea cualquier variante de nombre de carril o rol a su formato canónico ('TOP' | 'JUNGLE' | 'MIDDLE' | 'BOTTOM' | 'UTILITY').
 */
export function normalizeRole(roleOrLane?: string | null, fallback: ChampionLane = 'MIDDLE'): ChampionLane {
  if (!roleOrLane || typeof roleOrLane !== 'string') return fallback;
  const clean = roleOrLane.trim().toLowerCase().replace(/[^a-z_]/g, '');
  if (ROLE_TO_LANE_MAP[clean]) {
    return ROLE_TO_LANE_MAP[clean];
  }
  const upper = roleOrLane.trim().toUpperCase() as ChampionLane;
  if (['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'].includes(upper)) {
    return upper;
  }
  return fallback;
}

export const normalizeLane = normalizeRole;

export const NAME_TO_ID: Record<string, number> = {
  "Aatrox": 266,
  "Ahri": 103,
  "Akali": 84,
  "Akshan": 166,
  "Alistar": 12,
  "Ambessa": 799,
  "Amumu": 32,
  "Anivia": 34,
  "Annie": 1,
  "Aphelios": 523,
  "Ashe": 22,
  "Aurelion Sol": 136,
  "Aurora": 893,
  "Azir": 268,
  "Bardo": 432,
  "Bel'Veth": 200,
  "Blitzcrank": 53,
  "Brand": 63,
  "Braum": 201,
  "Briar": 233,
  "Caitlyn": 51,
  "Camille": 164,
  "Cassiopeia": 69,
  "Cho'Gath": 31,
  "Corki": 42,
  "Darius": 122,
  "Diana": 131,
  "Draven": 119,
  "Dr. Mundo": 36,
  "Ekko": 245,
  "Elise": 60,
  "Evelynn": 28,
  "Ezreal": 81,
  "Fiddlesticks": 9,
  "Fiora": 114,
  "Fizz": 105,
  "Galio": 3,
  "Gangplank": 41,
  "Garen": 86,
  "Gnar": 150,
  "Gragas": 79,
  "Graves": 104,
  "Gwen": 887,
  "Hecarim": 120,
  "Heimerdinger": 74,
  "Hwei": 910,
  "Illaoi": 420,
  "Irelia": 39,
  "Ivern": 427,
  "Janna": 40,
  "Jarvan IV": 59,
  "Jax": 24,
  "Jayce": 126,
  "Jhin": 202,
  "Jinx": 222,
  "Kai'Sa": 145,
  "Kalista": 429,
  "Karma": 43,
  "Karthus": 30,
  "Kassadin": 38,
  "Katarina": 55,
  "Kayle": 10,
  "Kayn": 141,
  "Kennen": 85,
  "Kha'Zix": 121,
  "Kindred": 203,
  "Kled": 240,
  "Kog'Maw": 96,
  "K'Sante": 897,
  "LeBlanc": 7,
  "Lee Sin": 64,
  "Leona": 89,
  "Lillia": 876,
  "Lissandra": 127,
  "Lucian": 236,
  "Lulu": 117,
  "Lux": 99,
  "Malphite": 54,
  "Malzahar": 90,
  "Maokai": 57,
  "Maestro Yi": 11,
  "Milio": 902,
  "Miss Fortune": 21,
  "Mordekaiser": 82,
  "Morgana": 25,
  "Naafiri": 895,
  "Nami": 267,
  "Nasus": 75,
  "Nautilus": 111,
  "Neeko": 518,
  "Nidalee": 76,
  "Nilah": 895,
  "Nocturne": 56,
  "Nunu y Willump": 20,
  "Olaf": 2,
  "Orianna": 61,
  "Ornn": 516,
  "Pantheon": 80,
  "Poppy": 78,
  "Pyke": 555,
  "Qiyana": 246,
  "Quinn": 133,
  "Rakan": 497,
  "Rammus": 33,
  "Rek'Sai": 421,
  "Rell": 526,
  "Renata Glasc": 888,
  "Renekton": 58,
  "Rengar": 107,
  "Riven": 92,
  "Rumble": 68,
  "Ryze": 13,
  "Samira": 360,
  "Sejuani": 113,
  "Senna": 235,
  "Seraphine": 147,
  "Sett": 875,
  "Shaco": 35,
  "Shen": 98,
  "Shyvana": 102,
  "Singed": 27,
  "Sion": 14,
  "Sivir": 15,
  "Skarner": 72,
  "Smolder": 901,
  "Sona": 37,
  "Soraka": 16,
  "Swain": 50,
  "Sylas": 517,
  "Syndra": 134,
  "Tahm Kench": 223,
  "Taliyah": 163,
  "Talon": 91,
  "Taric": 44,
  "Teemo": 17,
  "Thresh": 412,
  "Tristana": 18,
  "Trundle": 48,
  "Tryndamere": 23,
  "Twisted Fate": 4,
  "Twitch": 29,
  "Udyr": 77,
  "Urgot": 6,
  "Varus": 110,
  "Vayne": 67,
  "Veigar": 45,
  "Vel'Koz": 161,
  "Vex": 711,
  "Vi": 254,
  "Viego": 234,
  "Viktor": 112,
  "Vladimir": 8,
  "Volibear": 106,
  "Warwick": 19,
  "Wukong": 62,
  "Xayah": 498,
  "Xerath": 101,
  "Xin Zhao": 5,
  "Yasuo": 157,
  "Yone": 777,
  "Yorick": 83,
  "Yunara": 804,
  "Yuumi": 350,
  "Zaahen": 904,
  "Zac": 154,
  "Zed": 238,
  "Zeri": 221,
  "Ziggs": 115,
  "Zilean": 26,
  "Zoe": 142,
  "Zyra": 143
};

const CHAMPION_ALIASES: Record<string, number> = {
  "monkeyking": 62,
  "wukong": 62,
  "kaisa": 145,
  "khazix": 121,
  "velkoz": 161,
  "chogath": 31,
  "leblanc": 7,
  "aurelionsol": 136,
  "asol": 136,
  "masteryi": 11,
  "maestroyi": 11,
  "yi": 11,
  "twistedfate": 4,
  "tf": 4,
  "tahmkench": 223,
  "xinzhao": 5,
  "missfortune": 21,
  "mf": 21,
  "leesin": 64,
  "belveth": 200,
  "ksante": 897,
  "nunu": 20,
  "nunuwillump": 20,
  "nunuywillump": 20,
  "renata": 888,
  "renataglasc": 888,
  "bard": 432,
  "bardo": 432,
  "fiddlesticks": 9,
  "drmundo": 36,
  "doctormundo": 36,
  "jarvaniv": 59,
  "jarvan": 59
};

export function getIdFromName(name: string): number {
  if (!name) return 0;
  const clean = name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  if (CHAMPION_ALIASES[clean]) {
    return CHAMPION_ALIASES[clean];
  }
  for (const [key, id] of Object.entries(NAME_TO_ID)) {
    if (key.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === clean) {
      return id;
    }
  }
  return 0;
}

export function getNameFromId(id: number | string): string {
  const numId = Number(id);
  if (isNaN(numId) || numId <= 0) return '';
  for (const [name, champId] of Object.entries(NAME_TO_ID)) {
    if (champId === numId) return name;
  }
  return '';
}

export function isFlexChampion(champ: EnrichedChampion | { name: string }): boolean {
  const flexList = new Set([
    "Gragas", "Pantheon", "Karma", "Yasuo", "Yone", "Nautilus", "Swain", "Brand", 
    "Morgana", "Tahm Kench", "Jayce", "Twisted Fate", "Sylas", "K'Sante", "Volibear",
    "Rumble", "Maokai", "Poppy", "Graves", "Lucian", "Talon", "Quinn"
  ]);
  return flexList.has(champ.name);
}

export let engineWeights: EngineWeights = {
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

export function setEngineWeights(weights: Partial<EngineWeights>) {
  if (weights) {
    engineWeights = { ...engineWeights, ...weights };
  }
}

export const PERSONAL_STATS: Record<number, PersonalStats> = {};

export function initializePersonalStats(stats: Array<{ championId: number; gamesPlayed: number; winRate: number }>) {
  Object.keys(PERSONAL_STATS).forEach(k => delete PERSONAL_STATS[Number(k)]);
  if (stats && Array.isArray(stats)) {
    stats.forEach(s => {
      PERSONAL_STATS[s.championId] = {
        gamesPlayed: s.gamesPlayed,
        winRate: s.winRate
      };
    });
    console.log(`[CORE] PersonalStats listo: ${Object.keys(PERSONAL_STATS).length} campeones con historial.`);
  }
}
