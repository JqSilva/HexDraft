// src/lib/championMapper.ts

/**
 * Normaliza nombres de campeones y resuelve casos especiales de Riot para nombres de archivos de DDragon.
 * Soporta múltiples variaciones (ej: "Nunu y Willump", "Nunu & Willump", "Nunu" -> "Nunu").
 */
export function getChampionCdnName(name: string): string {
  if (!name) return "Garen";
  const norm = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  
  const mapping: Record<string, string> = {
    "wukong": "MonkeyKing",
    "monkeyking": "MonkeyKing",
    "nunuywillump": "Nunu",
    "nunuwillump": "Nunu",
    "nunu": "Nunu",
    "maestroyi": "MasterYi",
    "masteryi": "MasterYi",
    "drmundo": "DrMundo",
    "doctormundo": "DrMundo",
    "jarvaniv": "JarvanIV",
    "jarvan": "JarvanIV",
    "leesin": "LeeSin",
    "aurelionsol": "AurelionSol",
    "ksante": "Ksante",
    "kaisa": "Kaisa",
    "khazix": "Khazix",
    "velkoz": "Velkoz",
    "belveth": "Belveth",
    "renataglasc": "Renata",
    "renata": "Renata",
    "leblanc": "Leblanc",
    "chogath": "Chogath",
    "bardo": "Bard",
    "bard": "Bard",
  };
  
  if (mapping[norm]) return mapping[norm];
  
  // Por defecto, capitalizar la primera letra y limpiar caracteres especiales
  const cleanName = name.replace(/[^a-zA-Z0-9]/g, "");
  if (cleanName.length === 0) return "Garen";
  return cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
}

/**
 * Normaliza un nombre de campeón a una clave limpia para comparaciones consistentes.
 */
export function normalizeChampionName(name: string): string {
  if (!name) return "";
  return name.toLowerCase()
    .replace(/\s+&\s+/g, ' y ')
    .replace(/\s+and\s+/g, ' y ')
    .replace(/[^a-z0-9]/g, "");
}

