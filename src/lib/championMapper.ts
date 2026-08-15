/**
 * Mapeo de slugs específicos requeridos por la web de OP.GG.
 */
export const OPGG_CHAMPION_SLUGS: Record<string, string> = {
  "monkeyking": "wukong",
  "wukong": "wukong",
  "nunuywillump": "nunu",
  "nunuwillump": "nunu",
  "nunu": "nunu",
  "renataglasc": "renata",
  "renata": "renata",
  "bardo": "bard",
  "bard": "bard",
  "drmundo": "dr-mundo",
  "doctormundo": "dr-mundo",
  "jarvaniv": "jarvan-iv",
  "jarvan": "jarvan-iv",
  "leesin": "lee-sin",
  "masteryi": "master-yi",
  "maestroyi": "master-yi",
  "missfortune": "miss-fortune",
  "tahmkench": "tahm-kench",
  "twistedfate": "twisted-fate",
  "xinzhao": "xin-zhao",
  "aurelionsol": "aurelion-sol",
  "kogmaw": "kog-maw",
  "reksai": "rek-sai",
  "velkoz": "vel-koz",
  "ksante": "k-sante",
  "belveth": "bel-veth",
  "chogath": "cho-gath",
  "kaisa": "kai-sa",
  "khazix": "kha-zix"
};

/**
 * Convierte cualquier nombre o alias de campeón al slug exacto que utiliza OP.GG en sus URLs.
 */
export function toOpggChampionSlug(name: string): string {
  if (!name) return "";
  const norm = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  return OPGG_CHAMPION_SLUGS[norm] || norm;
}

/**
 * Normaliza nombres de campeones y resuelve casos especiales de Riot para nombres de archivos de DDragon.
 * Soporta múltiples variaciones (ej: "Nunu y Willump", "Nunu & Willump", "Nunu" -> "Nunu", "Wukong" -> "MonkeyKing").
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
    "missfortune": "MissFortune",
    "twistedfate": "TwistedFate",
    "xinzhao": "XinZhao",
    "reksai": "RekSai",
    "kogmaw": "KogMaw"
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

