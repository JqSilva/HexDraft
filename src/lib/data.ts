
// src/lib/data.ts

export interface ChampionData {
  id: number;
  name: string;
  baseScore: number; 
  tags: string[];
  damageType: 'AD' | 'AP' | 'Tank';
  scaling: 'Early' | 'Mid' | 'Late';
  counters: number[]; 
}

export const CHAMPIONS_DB: Record<number, ChampionData> = {
  // --- TOP LANE ---
  58: { id: 58, name: "Renekton", baseScore: 5.2, tags: ["Top", "Fighter"], damageType: "AD", scaling: "Early", counters: [92, 39] },
  266: { id: 266, name: "Aatrox", baseScore: 5.3, tags: ["Top", "Fighter"], damageType: "AD", scaling: "Mid", counters: [41, 82] },
  54: { id: 54, name: "Malphite", baseScore: 5.1, tags: ["Top", "Tank", "CC", "FollowUp"], damageType: "Tank", scaling: "Mid", counters: [157, 126] },
  24: { id: 24, name: "Jax", baseScore: 5.4, tags: ["Top", "Fighter", "Hypercarry"], damageType: "AD", scaling: "Late", counters: [266, 58] },
  82: { id: 82, name: "Mordekaiser", baseScore: 5.0, tags: ["Top", "Mage", "Tank"], damageType: "AP", scaling: "Mid", counters: [54, 24] },
  41: { id: 41, name: "Gangplank", baseScore: 4.8, tags: ["Top", "Fighter"], damageType: "AD", scaling: "Late", counters: [82] },
  164: { id: 164, name: "Camille", baseScore: 5.2, tags: ["Top", "Fighter", "Assassin"], damageType: "AD", scaling: "Late", counters: [41, 266] },
  75: { id: 75, name: "Nasus", baseScore: 4.9, tags: ["Top", "Tank"], damageType: "AD", scaling: "Late", counters: [24] },

  // --- JUNGLE ---
  64: { id: 64, name: "Lee Sin", baseScore: 4.8, tags: ["Jungle", "Assassin"], damageType: "AD", scaling: "Early", counters: [121, 76] },
  121: { id: 121, name: "Kha'Zix", baseScore: 5.2, tags: ["Jungle", "Assassin"], damageType: "AD", scaling: "Mid", counters: [76, 103] },
  20: { id: 20, name: "Nunu", baseScore: 5.1, tags: ["Jungle", "Tank", "CC"], damageType: "AP", scaling: "Mid", counters: [64, 121] },
  30: { id: 30, name: "Karthus", baseScore: 5.3, tags: ["Jungle", "Mage"], damageType: "AP", scaling: "Late", counters: [32, 20] },
  56: { id: 56, name: "Nocturne", baseScore: 5.4, tags: ["Jungle", "Assassin"], damageType: "AD", scaling: "Mid", counters: [30, 76] },
  33: { id: 33, name: "Rammus", baseScore: 5.1, tags: ["Jungle", "Tank"], damageType: "Tank", scaling: "Mid", counters: [11, 64, 126] },
  11: { id: 11, name: "Master Yi", baseScore: 4.9, tags: ["Jungle", "Hypercarry"], damageType: "AD", scaling: "Late", counters: [350, 30] },
  254: { id: 254, name: "Vi", baseScore: 5.2, tags: ["Jungle", "Fighter", "CC"], damageType: "AD", scaling: "Mid", counters: [121, 64] },

  // --- MID LANE ---
  103: { id: 103, name: "Ahri", baseScore: 5.2, tags: ["Mid", "Mage", "Assassin"], damageType: "AP", scaling: "Mid", counters: [157, 1] },
  157: { id: 157, name: "Yasuo", baseScore: 4.9, tags: ["Mid", "Fighter", "FollowUp"], damageType: "AD", scaling: "Late", counters: [103, 127] },
  38: { id: 38, name: "Kassadin", baseScore: 5.1, tags: ["Mid", "Assassin", "Mage"], damageType: "AP", scaling: "Late", counters: [103, 30] },
  127: { id: 127, name: "Lissandra", baseScore: 5.0, tags: ["Mid", "Mage", "CC"], damageType: "AP", scaling: "Mid", counters: [157, 103] },
  1: { id: 1, name: "Annie", baseScore: 5.3, tags: ["Mid", "Mage", "Burst"], damageType: "AP", scaling: "Mid", counters: [157, 127] },
  238: { id: 238, name: "Zed", baseScore: 5.0, tags: ["Mid", "Assassin"], damageType: "AD", scaling: "Mid", counters: [103, 38] },
  4: { id: 4, name: "Twisted Fate", baseScore: 5.2, tags: ["Mid", "Mage"], damageType: "AP", scaling: "Mid", counters: [1, 38] },
  268: { id: 268, name: "Azir", baseScore: 4.7, tags: ["Mid", "Mage"], damageType: "AP", scaling: "Late", counters: [1, 157] },

  // --- ADC (BOTTOM) ---
  22: { id: 22, name: "Ashe", baseScore: 5.2, tags: ["Bottom", "Marksman", "CC"], damageType: "AD", scaling: "Mid", counters: [15, 81] },
  81: { id: 81, name: "Ezreal", baseScore: 5.0, tags: ["Bottom", "Marksman"], damageType: "AD", scaling: "Mid", counters: [236, 18] },
  15: { id: 15, name: "Sivir", baseScore: 5.1, tags: ["Bottom", "Marksman"], damageType: "AD", scaling: "Late", counters: [22, 21] },
  18: { id: 18, name: "Tristana", baseScore: 5.3, tags: ["Bottom", "Marksman", "Assassin"], damageType: "AD", scaling: "Late", counters: [81, 22] },
  236: { id: 236, name: "Lucian", baseScore: 5.2, tags: ["Bottom", "Marksman"], damageType: "AD", scaling: "Early", counters: [18, 15] },
  67: { id: 67, name: "Vayne", baseScore: 4.9, tags: ["Bottom", "Marksman", "Hypercarry"], damageType: "AD", scaling: "Late", counters: [81, 236] },
  21: { id: 21, name: "Miss Fortune", baseScore: 5.4, tags: ["Bottom", "Marksman"], damageType: "AD", scaling: "Mid", counters: [67, 18] },
  51: { id: 51, name: "Caitlyn", baseScore: 5.1, tags: ["Bottom", "Marksman"], damageType: "AD", scaling: "Early", counters: [67, 236] },

  // --- SUPPORT ---
  412: { id: 412, name: "Thresh", baseScore: 5.2, tags: ["Support", "Tank", "CC"], damageType: "Tank", scaling: "Mid", counters: [350, 12] },
  350: { id: 350, name: "Yuumi", baseScore: 4.6, tags: ["Support", "Mage"], damageType: "AP", scaling: "Late", counters: [12] },
  12: { id: 12, name: "Alistar", baseScore: 5.1, tags: ["Support", "Tank", "CC", "FollowUp"], damageType: "Tank", scaling: "Mid", counters: [412, 350] },
  89: { id: 89, name: "Leona", baseScore: 5.3, tags: ["Support", "Tank", "CC"], damageType: "Tank", scaling: "Early", counters: [350, 412] },
  53: { id: 53, name: "Blitzcrank", baseScore: 5.4, tags: ["Support", "Tank", "CC"], damageType: "Tank", scaling: "Early", counters: [350, 22] },
  432: { id: 432, name: "Bard", baseScore: 5.0, tags: ["Support", "Mage", "CC"], damageType: "AP", scaling: "Late", counters: [12, 89] },
  25: { id: 25, name: "Morgana", baseScore: 5.1, tags: ["Support", "Mage", "CC"], damageType: "AP", scaling: "Mid", counters: [89, 53, 12] },
  117: { id: 117, name: "Lulu", baseScore: 5.2, tags: ["Support", "Mage"], damageType: "AP", scaling: "Late", counters: [53, 412] }
};