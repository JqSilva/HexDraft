// src/lib/domain/champion-name-resolver.ts

export const API_NAME_MAP: Record<string, string> = {
  "Wukong": "MonkeyKing",
  "Maestro Yi": "MasterYi",
  "Nunu y Willump": "Nunu",
  "Renata Glasc": "Renata",
  "Bardo": "Bard",
  "Kha'Zix": "Khazix",
  "Kai'Sa": "Kaisa",
  "Bel'Veth": "Belveth",
  "Rek'Sai": "RekSai",
  "Vel'Koz": "Velkoz",
  "Cho'Gath": "Chogath",
  "Dr. Mundo": "DrMundo",
  "K'Sante": "KSante",
  "Kog'Maw": "KogMaw",
  "Jarvan IV": "JarvanIV",
  "Lee Sin": "LeeSin",
  "Miss Fortune": "MissFortune",
  "Twisted Fate": "TwistedFate",
  "Xin Zhao": "XinZhao"
};

export const NORM_API_NAME_MAP: Record<string, string> = {
  "monkeyking": "wukong",
  "masteryi": "maestroyi",
  "nunu": "nunuywillump",
  "renata": "renataglasc",
  "bard": "bardo"
};

export const normalizeKey = (name: string): string => name.toLowerCase()
  .replace(/\s+&\s+/g, ' y ')
  .replace(/\s+and\s+/g, ' y ')
  .replace(/[^a-z0-9]/g, "");

export function resolveChampionId(name: string, nameIdMap: Record<string, number>): number | null {
  const norm = normalizeKey(name);
  if (nameIdMap[norm]) return nameIdMap[norm];
  
  const alias = NORM_API_NAME_MAP[norm];
  if (alias && nameIdMap[alias]) return nameIdMap[alias];

  for (const [key, id] of Object.entries(nameIdMap)) {
    if (key.includes(norm) || norm.includes(key)) {
      return id;
    }
  }

  return null;
}
