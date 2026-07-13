import { CHAMPIONS_DB } from '../../../lib/data/championdb.js';
import type { Champion } from './types';

// Mapeos de imágenes de posición de League of Legends
export const POS_BASE = "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/";

export const posMapping: Record<string, string> = {
  "TOP": "icon-position-top.png",
  "JUNGLE": "icon-position-jungle.png",
  "JNG": "icon-position-jungle.png",
  "MIDDLE": "icon-position-middle.png",
  "MID": "icon-position-middle.png",
  "BOTTOM": "icon-position-bottom.png",
  "BOT": "icon-position-bottom.png",
  "ADC": "icon-position-bottom.png",
  "UTILITY": "icon-position-utility.png",
  "SUP": "icon-position-utility.png",
  "SUPPORT": "icon-position-utility.png"
};

// Traducciones legibles de posiciones
export const posLabels: Record<string, string> = {
  "TOP": "Top",
  "JUNGLE": "Jungla",
  "JNG": "Jungla",
  "MIDDLE": "Mid",
  "MID": "Mid",
  "BOTTOM": "ADC",
  "BOT": "ADC",
  "ADC": "ADC",
  "UTILITY": "Soporte",
  "SUP": "Soporte",
  "SUPPORT": "Soporte"
};

// Mapear rank a Tier
export const getTierInfo = (tierNum: number) => {
  if (tierNum <= 5) return { label: 'S+', color: 'text-purple-400 border-purple-500/30 bg-purple-500/10' };
  if (tierNum <= 12) return { label: 'S', color: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10' };
  if (tierNum <= 22) return { label: 'A', color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' };
  if (tierNum <= 35) return { label: 'B', color: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10' };
  if (tierNum <= 48) return { label: 'C', color: 'text-orange-400 border-orange-500/30 bg-orange-500/10' };
  return { label: 'D', color: 'text-slate-400 border-slate-500/30 bg-slate-500/10' };
};

// Mapear rol a clave interna
export const getRoleKey = (lane: string) => {
  const upper = (lane || "").toUpperCase();
  if (upper === "JNG" || upper === "JUNGLE") return "JUNGLE";
  if (upper === "MID" || upper === "MIDDLE") return "MIDDLE";
  if (upper === "BOT" || upper === "ADC" || upper === "BOTTOM") return "BOTTOM";
  if (upper === "SUP" || upper === "SUPPORT" || upper === "UTILITY") return "UTILITY";
  return upper;
};

// Mapear rol a clave del cache
export const laneToMetaKey = (lane: string): string => {
  const mapping: Record<string, string> = {
    "TOP": "top",
    "JNG": "jungle",
    "JUNGLE": "jungle",
    "MID": "mid",
    "MIDDLE": "mid",
    "BOT": "adc",
    "ADC": "adc",
    "BOTTOM": "adc",
    "SUP": "support",
    "SUPPORT": "support",
    "UTILITY": "support"
  };
  return mapping[(lane || "").toUpperCase()] || "";
};

export const formatTimeAgo = (dateStr: string): string => {
  if (!dateStr || dateStr === '-') return 'Nunca';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 'Nunca';
  
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) {
    return 'Hace unos segundos';
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `Hace ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `Hace ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
  }
  const days = Math.floor(hours / 24);
  return `Hace ${days} ${days === 1 ? 'día' : 'días'}`;
};

export const normalizeKey = (name: string) => {
  if (!name) return "";
  return name.toLowerCase()
    .replace(/\s+&\s+/g, ' y ')
    .replace(/\s+and\s+/g, ' y ')
    .replace(/[^a-z0-9]/g, "");
};

export const getEnrichedChampionsFromMeta = (metaData: any): Champion[] => {
  const tempStats: Record<string, {
    name: string;
    laneStats: Array<{
      lane: string;
      winRate: number;
      pickRate: number;
      rank: number;
      counters: string[];
    }>;
  }> = {};

  const roleToLaneMap: Record<string, string> = {
    'top': 'TOP',
    'jungle': 'JUNGLE',
    'mid': 'MIDDLE',
    'adc': 'BOTTOM',
    'support': 'UTILITY'
  };

  const lanes = ['top', 'jungle', 'mid', 'adc', 'support'];
  if (metaData) {
    lanes.forEach(laneKey => {
      const list = metaData[laneKey] || [];
      list.forEach((entry: any) => {
        const normName = normalizeKey(entry.name);
        if (!tempStats[normName]) {
          tempStats[normName] = { name: entry.name, laneStats: [] };
        }
        const wr = parseFloat(entry.winRate) || 50.0;
        const pr = parseFloat(entry.pickRate) || 0.0;
        const rank = parseInt(entry.rank) || 99;
        const dbLane = roleToLaneMap[laneKey];
        tempStats[normName].laneStats.push({
          lane: dbLane,
          winRate: wr,
          pickRate: pr,
          rank: rank,
          counters: entry.counters || []
        });
      });
    });
  }

  const getRoleKeyInternal = (lane: string) => {
    const upper = (lane || "").toUpperCase();
    if (upper === "JNG" || upper === "JUNGLE") return "JUNGLE";
    if (upper === "MID" || upper === "MIDDLE") return "MIDDLE";
    if (upper === "BOT" || upper === "ADC" || upper === "BOTTOM") return "BOTTOM";
    if (upper === "SUP" || upper === "SUPPORT" || upper === "UTILITY") return "UTILITY";
    return upper;
  };

  return Object.values(CHAMPIONS_DB).map((champ: any) => {
    const normName = normalizeKey(champ.name);
    const statsEntry = tempStats[normName];
    
    let bestLane = champ.lane || "MID";
    let wr = 50.0;
    let tierVal = 99;
    let pickrate = 1.5;
    let matches = 1000;
    const lanesStats: Record<string, any> = {};
    const lanesPickrate: Record<string, number> = {};

    if (statsEntry && statsEntry.laneStats.length > 0) {
      let maxPick = -1;
      let primaryEntry = statsEntry.laneStats[0];
      statsEntry.laneStats.forEach(le => {
        lanesStats[le.lane] = { winRate: le.winRate, tier: le.rank };
        lanesPickrate[le.lane] = le.pickRate;
        if (le.pickRate > maxPick) {
          maxPick = le.pickRate;
          primaryEntry = le;
        }
      });

      bestLane = primaryEntry.lane;
      wr = primaryEntry.winRate;
      tierVal = primaryEntry.rank;
      
      const totalPick = statsEntry.laneStats.reduce((sum, le) => sum + le.pickRate, 0);
      pickrate = parseFloat(totalPick.toFixed(1));
      matches = Math.floor(pickrate * 1420) + 1200 + (champ.id % 7) * 110;
    } else {
      const baseLane = getRoleKeyInternal(champ.lane || "MID");
      lanesStats[baseLane] = { winRate: 50.0, tier: 99 };
      lanesPickrate[baseLane] = 1.5;
    }

    return {
      id: champ.id,
      name: champ.name,
      lane: bestLane,
      damageType: champ.damageType || "Adaptive",
      class: champ.class || "Mage",
      isFrontline: champ.isFrontline || false,
      isHypercarry: champ.isHypercarry || false,
      hasHardCC: champ.hasHardCC || false,
      tags: champ.tags || [],
      scalingType: champ.scalingType || "Mid",
      pickrate,
      matches,
      lanesStats,
      lanesPickrate,
      meta: {
        winRate: wr,
        tier: tierVal
      }
    };
  });
};

export const RUNE_TREES: Record<number, {
  name: string;
  icon: string;
  rows: number[][];
}> = {
  8000: {
    name: "Precision",
    icon: "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/styles/7201_precision.png",
    rows: [
      [8005, 8008, 8021, 8010],
      [9101, 9111, 8009],
      [9104, 9103, 9105],
      [8014, 8017, 8299]
    ]
  },
  8100: {
    name: "Domination",
    icon: "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/styles/7200_domination.png",
    rows: [
      [8112, 8124, 8128, 9923],
      [8126, 8139, 8143],
      [8136, 8120, 8138],
      [8135, 8105, 8106]
    ]
  },
  8200: {
    name: "Sorcery",
    icon: "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/styles/7202_sorcery.png",
    rows: [
      [8214, 8229, 8230],
      [8224, 8226, 8275],
      [8210, 8234, 8233],
      [8237, 8232, 8236]
    ]
  },
  8400: {
    name: "Resolve",
    icon: "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/styles/7204_resolve.png",
    rows: [
      [8437, 8439, 8465],
      [8446, 8463, 8401],
      [8429, 8444, 8473],
      [8451, 8453, 8242]
    ]
  },
  8300: {
    name: "Inspiration",
    icon: "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/styles/7203_whimsy.png",
    rows: [
      [8351, 8360, 8369],
      [8306, 8304, 8321],
      [8313, 8345, 8352],
      [8347, 8410, 8316]
    ]
  }
};

export const getTreeColors = (styleId: number) => {
  const mapping: Record<number, { border: string; bg: string; shadow: string }> = {
    8000: { border: 'border-yellow-500/80', bg: 'bg-yellow-500/20', shadow: 'shadow-[0_0_12px_rgba(234,179,8,0.4)]' },
    8100: { border: 'border-red-500/80', bg: 'bg-red-500/20', shadow: 'shadow-[0_0_12px_rgba(239,68,68,0.4)]' },
    8200: { border: 'border-blue-500/80', bg: 'bg-blue-500/20', shadow: 'shadow-[0_0_12px_rgba(59,130,246,0.4)]' },
    8400: { border: 'border-emerald-500/80', bg: 'bg-emerald-500/20', shadow: 'shadow-[0_0_12px_rgba(16,185,129,0.4)]' },
    8300: { border: 'border-cyan-400/80', bg: 'bg-cyan-400/20', shadow: 'shadow-[0_0_12px_rgba(34,211,238,0.4)]' }
  };
  return mapping[styleId] || { border: 'border-purple-accent', bg: 'bg-purple-accent/20', shadow: 'shadow-[0_0_10px_rgba(144,85,255,0.3)]' };
};

export const SHARDS_ROWS = [
  [5005, 5008, 5007],
  [5008, 5010, 5011],
  [5013, 5012, 5011]
];

export const normalizeShardIdForHighlight = (selectedId: number, rowIdx: number): number => {
  if (rowIdx === 2) {
    if (selectedId === 5001 || selectedId === 5003) return 5013; // Armor/MR -> Flat Health
  }
  if (rowIdx === 1) {
    if (selectedId === 5001 || selectedId === 5003) return 5011; // Armor/MR -> Scaling Health
  }
  return selectedId;
};

export const getRuneAlias = (id: number): number[] => {
  const aliases: Record<number, number[]> = {
    8136: [8136, 8141], // Zombie Ward / Deep Ward
    8141: [8136, 8141],
    8138: [8138, 8140], // Eyeball Collection / Grisly Mementos
    8140: [8138, 8140]
  };
  return aliases[id] || [id];
};

