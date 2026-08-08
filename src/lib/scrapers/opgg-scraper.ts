/**
 * Scraper para OP.GG (3 Builds Diferentes: Top OTPs de EUW con detección de arquetipos y Challenger/GM)
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { getOpponentArchetype, getArchetypeMembers } from '../engine/archetypes.js';
import { CHAMPIONS_DB } from '../data/championdb.js';

export interface OpggBuildRunes {
  primaryStyleId: number;
  subStyleId: number;
  selections: number[];
  shards: number[];
}

export interface OpggProBuild {
  id: string;
  title: string;
  championName: string;
  role: string;
  patch: string;
  sampleSize: number;
  winRate: number;
  coreItems: number[];
  boots: number;
  starterItems: number[];
  summoners: number[];
  runes: OpggBuildRunes;
  source: 'otp_matchup' | 'otp_general' | 'general_pro';
  otpRank?: number;
  otpName?: string;
  executionTimeMs?: number;
}

let lastRequestTimestamp = 0;
const MIN_REQUEST_INTERVAL_MS = 800;

async function rateLimitGuard(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTimestamp;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    const delay = MIN_REQUEST_INTERVAL_MS - elapsed;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  lastRequestTimestamp = Date.now();
}

const ROLE_MAP: Record<string, string> = {
  top: 'top',
  jungle: 'jungle',
  mid: 'mid',
  middle: 'mid',
  adc: 'adc',
  bottom: 'adc',
  support: 'support',
  utility: 'support'
};

const OPGG_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.op.gg/'
};

export function getDefaultItemsForChampion(championName: string, role: string): {
  coreItems: number[];
  starterItems: number[];
  boots: number;
  runes: OpggBuildRunes;
  summoners: number[];
} {
  const normName = championName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const baseChamp = Object.values(CHAMPIONS_DB).find(
    c => c.name.toLowerCase().replace(/[^a-z0-9]/g, '') === normName
  );

  const champClass = baseChamp?.class || '';
  const damageType = baseChamp?.damageType || 'AD';

  if (champClass === 'Marksman' || role.toLowerCase() === 'adc' || role.toLowerCase() === 'bottom') {
    return {
      coreItems: [6672, 3124, 3115], // Kraken, Guinsoo, Nashor (o Terminus 3302)
      starterItems: [1055, 2003],
      boots: 3006, // Berserker's
      summoners: [4, 7], // Flash + Heal
      runes: {
        primaryStyleId: 8000,
        subStyleId: 8300,
        selections: [8005, 9101, 9103, 8014, 8304, 8313],
        shards: [5008, 5008, 5011]
      }
    };
  }

  if (champClass === 'Assassin') {
    if (damageType === 'AP') {
      return {
        coreItems: [3157, 3165, 3089],
        starterItems: [1056, 2003],
        boots: 3020,
        summoners: [4, 14],
        runes: {
          primaryStyleId: 8100,
          subStyleId: 8200,
          selections: [8112, 8139, 8138, 8135, 8210, 8226],
          shards: [5008, 5008, 5011]
        }
      };
    }
    return {
      coreItems: [3142, 6692, 3814],
      starterItems: [1055, 2003],
      boots: 3158,
      summoners: [4, 14],
      runes: {
        primaryStyleId: 8100,
        subStyleId: 8000,
        selections: [8112, 8139, 8138, 8135, 8009, 8014],
        shards: [5008, 5008, 5011]
      }
    };
  }

  if (champClass === 'Tank') {
    return {
      coreItems: [3068, 3075, 6665],
      starterItems: [1054, 2003],
      boots: 3047,
      summoners: [4, 12],
      runes: {
        primaryStyleId: 8400,
        subStyleId: 8000,
        selections: [8437, 8446, 8429, 8451, 9111, 8009],
        shards: [5007, 5002, 5011]
      }
    };
  }

  // Mage estándar
  return {
    coreItems: [3161, 6610, 3157],
    starterItems: [1056, 2003],
    boots: 3020,
    summoners: [4, 12],
    runes: {
      primaryStyleId: 8200,
      subStyleId: 8300,
      selections: [8229, 8226, 8210, 8237, 8304, 8313],
      shards: [5008, 5008, 5011]
    }
  };
}

async function fetchTopOtpSlugs(normalizedChamp: string): Promise<string[]> {
  const url = `https://www.op.gg/leaderboards/champions/${normalizedChamp}?region=euw`;
  console.log(`[OPGG] Obteniendo Top 5 OTPs desde leaderboard EUW: ${url}`);

  try {
    await rateLimitGuard();
    const res = await axios.get<string>(url, { headers: OPGG_HEADERS, timeout: 8000 });
    if (!res.data) return [];

    const $ = cheerio.load(res.data);
    const slugs: string[] = [];

    // Extraer enlaces /summoners/euw/SLUG
    $('a[href*="/summoners/euw/"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const match = href.match(/\/summoners\/euw\/([^?#/]+)/);
      if (match && match[1]) {
        const slug = decodeURIComponent(match[1]);
        if (!slugs.includes(slug)) {
          slugs.push(slug);
        }
      }
    });

    if (slugs.length < 5) {
      $('script').each((_, el) => {
        const txt = $(el).html() || '';
        if (txt.includes('self.__next_f.push')) {
          const matches = Array.from(txt.matchAll(/summoners\/euw\/([a-zA-Z0-9_\-%]+)/g));
          matches.forEach(m => {
            const slug = decodeURIComponent(m[1]);
            if (!slugs.includes(slug)) {
              slugs.push(slug);
            }
          });
        }
      });
    }

    const top5 = slugs.slice(0, 5);
    console.log(`[OPGG] Top 5 OTPs identificados en EUW para ${normalizedChamp}:`, top5);
    return top5;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[OPGG] No se pudo obtener el leaderboard de EUW: ${msg}`);
    return [];
  }
}

function extractBuildFromPayload(
  unescaped: string,
  championName: string,
  role: string,
  source: 'otp_matchup' | 'otp_general',
  otpName: string,
  otpRank: number
): OpggProBuild {
  const fallbackDefaults = getDefaultItemsForChampion(championName, role);

  const patchMatch = unescaped.match(/Patch\s*([0-9]+\.[0-9]+)/i) || unescaped.match(/lol\/([0-9]+\.[0-9]+\.[0-9]+)\/item/i);
  const patch = patchMatch ? patchMatch[1] : '16.15';

  const itemMatches = Array.from(unescaped.matchAll(/item\/([0-9]+)\.png|metaId":([0-9]+)/g)).map(m => Number(m[1] || m[2]));
  const uniqueItems = Array.from(new Set(itemMatches)).filter(id => id > 1000);

  const coreItems = uniqueItems.filter(id => id >= 3000 && id <= 7000).slice(0, 3);
  if (coreItems.length < 3) {
    fallbackDefaults.coreItems.forEach(id => {
      if (coreItems.length < 3 && !coreItems.includes(id)) {
        coreItems.push(id);
      }
    });
  }

  const boots = uniqueItems.find(id => [3047, 3006, 3009, 3020, 3111, 3117, 3158].includes(id)) || fallbackDefaults.boots;
  const starterItems = uniqueItems.filter(id => [1054, 1055, 1056, 2003, 1085, 1101, 1102, 1103, 3865, 3866, 3867].includes(id));
  if (starterItems.length === 0) starterItems.push(...fallbackDefaults.starterItems);

  const perkMatches = Array.from(unescaped.matchAll(/perk\/([0-9]+)\.png/g)).map(m => Number(m[1]));

  const runeStyleMatches = Array.from(unescaped.matchAll(/perkStyle\/([0-9]+)\.png/g)).map(m => Number(m[1]));
  const primaryStyleId = runeStyleMatches[0] || fallbackDefaults.runes.primaryStyleId;
  const subStyleId = runeStyleMatches[1] || fallbackDefaults.runes.subStyleId;

  // 6 runas principales (4 primarias + 2 secundarias)
  const allPerks = perkMatches.filter(p => p >= 8000 && p < 9900);
  const selections: number[] = Array.from(new Set(allPerks)).slice(0, 6);
  if (selections.length < 6) {
    fallbackDefaults.runes.selections.forEach(p => {
      if (selections.length < 6 && !selections.includes(p)) {
        selections.push(p);
      }
    });
  }

  // 3 fragmentos de estadísticas exactos (preservando duplicados como 5008 + 5008)
  const rawShards = perkMatches.filter(p => p >= 5000 && p < 5020);
  const shards: number[] = rawShards.slice(0, 3);
  while (shards.length < 3) {
    if (shards.length === 0) shards.push(5008);
    else if (shards.length === 1) shards.push(5008);
    else shards.push(5011);
  }

  const spellMatches = Array.from(unescaped.matchAll(/spell\/([0-9]+)\.png/g)).map(m => Number(m[1]));
  const summoners: number[] = Array.from(new Set(spellMatches)).slice(0, 2);
  if (summoners.length < 2) {
    summoners.length = 0;
    summoners.push(...fallbackDefaults.summoners);
  }

  const title = source === 'otp_matchup'
    ? `OTP #${otpRank} Matchup`
    : `OTP #${otpRank} (${otpName})`;

  return {
    id: `otp-${otpRank}`,
    title,
    championName,
    role: role || 'mid',
    patch,
    sampleSize: 100,
    winRate: 100.0,
    coreItems,
    boots,
    starterItems,
    summoners,
    runes: {
      primaryStyleId,
      subStyleId,
      selections,
      shards
    },
    source,
    otpName,
    otpRank
  };
}

async function checkOtpMatchup(
  slug: string,
  championName: string,
  opponentName: string,
  role: string,
  rank: number
): Promise<OpggProBuild | null> {
  const url = `https://www.op.gg/summoners/euw/${encodeURIComponent(slug)}`;
  console.log(`[OPGG] Nivel 1: Analizando perfil del OTP ${rank} (${slug}): ${url}`);

  try {
    await rateLimitGuard();
    const res = await axios.get<string>(url, { headers: OPGG_HEADERS, timeout: 8000 });
    if (!res.data) return null;

    const $ = cheerio.load(res.data);
    const scriptTexts: string[] = [];
    $('script').each((_, el) => {
      const txt = $(el).html() || '';
      if (txt.includes('self.__next_f.push')) {
        scriptTexts.push(txt);
      }
    });

    const fullPayload = scriptTexts.join('\n');
    const unescaped = fullPayload.replace(/\\"/g, '"').replace(/\\\\/g, '\\');

    const opponentArchetype = getOpponentArchetype(opponentName);
    const archetypeMembers = opponentArchetype ? getArchetypeMembers(opponentArchetype) : [];

    let hasMatch = false;
    if (opponentName && unescaped.toLowerCase().includes(opponentName.toLowerCase())) {
      hasMatch = true;
    }
    if (!hasMatch && archetypeMembers.length > 0) {
      for (const member of archetypeMembers) {
        if (unescaped.toLowerCase().includes(member.toLowerCase())) {
          hasMatch = true;
          break;
        }
      }
    }

    if (hasMatch) {
      return extractBuildFromPayload(unescaped, championName, role, 'otp_matchup', slug, rank);
    }

    return null;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[OPGG] Error al consultar perfil OTP ${slug}: ${msg}`);
    return null;
  }
}

async function checkOtpGeneralMatch(
  slug: string,
  championName: string,
  role: string,
  rank: number
): Promise<OpggProBuild | null> {
  const url = `https://www.op.gg/summoners/euw/${encodeURIComponent(slug)}`;
  console.log(`[OPGG] Nivel 2 Fallback: Obteniendo partida general del OTP ${rank} (${slug}): ${url}`);

  try {
    await rateLimitGuard();
    const res = await axios.get<string>(url, { headers: OPGG_HEADERS, timeout: 8000 });
    if (!res.data) return null;

    const $ = cheerio.load(res.data);
    const scriptTexts: string[] = [];
    $('script').each((_, el) => {
      const txt = $(el).html() || '';
      if (txt.includes('self.__next_f.push')) {
        scriptTexts.push(txt);
      }
    });

    const fullPayload = scriptTexts.join('\n');
    const unescaped = fullPayload.replace(/\\"/g, '"').replace(/\\\\/g, '\\');

    // Extraer build general de la última partida del OTP con el campeón
    if (unescaped.toLowerCase().includes(championName.toLowerCase())) {
      return extractBuildFromPayload(unescaped, championName, role, 'otp_general', slug, rank);
    }

    return null;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[OPGG] Error al consultar partida general del OTP ${slug}: ${msg}`);
    return null;
  }
}

async function fetchGeneralProBuild(championName: string, role: string): Promise<OpggProBuild | null> {
  const fallbackDefaults = getDefaultItemsForChampion(championName, role);
  const normalizedChamp = championName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const mappedRole = ROLE_MAP[role.toLowerCase()] || 'top';
  const url = `https://www.op.gg/champions/${normalizedChamp}/build/${mappedRole}?tier=master`;

  console.log(`[OPGG] Nivel 3: Ejecutando scraping general de Challenger/GM para ${championName} (${mappedRole}): ${url}`);

  try {
    await rateLimitGuard();
    const response = await axios.get<string>(url, { headers: OPGG_HEADERS, timeout: 10000 });
    if (response.status !== 200 || !response.data) return null;

    const $ = cheerio.load(response.data);
    const scriptPushes: string[] = [];
    $('script').each((_, element) => {
      const scriptContent = $(element).html() || '';
      if (scriptContent.includes('self.__next_f.push')) {
        scriptPushes.push(scriptContent);
      }
    });

    if (scriptPushes.length === 0) return null;
    const fullPayload = scriptPushes.join('\n');

    const patchMatch = fullPayload.match(/Patch\s*([0-9]+\.[0-9]+)/i) || fullPayload.match(/lol\/([0-9]+\.[0-9]+\.[0-9]+)\/item/i);
    const patch = patchMatch ? patchMatch[1] : '16.15';

    const itemMatches = Array.from(fullPayload.matchAll(/item\/([0-9]+)\.png|metaId":([0-9]+)/g)).map(m => Number(m[1] || m[2]));
    const uniqueItems = Array.from(new Set(itemMatches)).filter(id => id > 1000);

    const coreItems = uniqueItems.filter(id => id >= 3000 && id <= 7000).slice(0, 3);
    if (coreItems.length < 3) {
      fallbackDefaults.coreItems.forEach(id => {
        if (coreItems.length < 3 && !coreItems.includes(id)) {
          coreItems.push(id);
        }
      });
    }

    const bootsMatch = fullPayload.match(/boots_0[\s\S]*?metaId":([0-9]+)/);
    const boots: number = bootsMatch ? Number(bootsMatch[1]) : (uniqueItems.find(id => [3047, 3006, 3009, 3020, 3111, 3117, 3158].includes(id)) || fallbackDefaults.boots);

    const starterItems: number[] = uniqueItems.filter(id => [1054, 1055, 1056, 2003, 1085, 1101, 1102, 1103].includes(id));
    if (starterItems.length === 0) starterItems.push(...fallbackDefaults.starterItems);

    const spellMatches = Array.from(fullPayload.matchAll(/spell\/([0-9]+)\.png/g)).map(m => Number(m[1]));
    const summoners: number[] = Array.from(new Set(spellMatches)).slice(0, 2);
    if (summoners.length < 2) summoners.push(...fallbackDefaults.summoners);

    const perkMatches = Array.from(fullPayload.matchAll(/perk\/([0-9]+)\.png/g)).map(m => Number(m[1]));

    const runeStyleMatches = Array.from(fullPayload.matchAll(/perkStyle\/([0-9]+)\.png/g)).map(m => Number(m[1]));
    const primaryStyleId: number = runeStyleMatches[0] || fallbackDefaults.runes.primaryStyleId;
    const subStyleId: number = runeStyleMatches[1] || fallbackDefaults.runes.subStyleId;

    const allPerks = perkMatches.filter(p => p >= 8000 && p < 9900);
    const selections: number[] = Array.from(new Set(allPerks)).slice(0, 6);
    if (selections.length < 6) {
      fallbackDefaults.runes.selections.forEach(p => {
        if (selections.length < 6 && !selections.includes(p)) {
          selections.push(p);
        }
      });
    }

    const rawShards = perkMatches.filter(p => p >= 5000 && p < 5020);
    const shards: number[] = rawShards.slice(0, 3);
    while (shards.length < 3) {
      if (shards.length === 0) shards.push(5008);
      else if (shards.length === 1) shards.push(5008);
      else shards.push(5011);
    }

    const gamesMatch = fullPayload.match(/([0-9,]+)\s*Games/i) || fullPayload.match(/matchCount":([0-9]+)/);
    const sampleSize: number = gamesMatch ? parseInt(gamesMatch[1].replace(/,/g, ''), 10) : 100;

    const winRateMatch = fullPayload.match(/([0-9]{2}\.[0-9]{1,2})%/);
    const winRate: number = winRateMatch ? parseFloat(winRateMatch[1]) : 52.4;

    return {
      id: 'general-pro',
      title: 'Challenger / GM',
      championName,
      role: mappedRole,
      patch,
      sampleSize,
      winRate,
      coreItems,
      boots,
      starterItems,
      summoners,
      runes: {
        primaryStyleId,
        subStyleId,
        selections,
        shards
      },
      source: 'general_pro'
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[OPGG] Error durante el scraping de fallback para ${championName}: ${errorMsg}`);
    return null;
  }
}

/**
 * Obtiene hasta 3 builds distintas para el campeón
 */
export async function fetchProBuilds(
  championName: string,
  role: string,
  opponentName?: string
): Promise<OpggProBuild[]> {
  if (!championName) return [];

  const startTime = Date.now();
  const normalizedChamp = championName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const topOtps = await fetchTopOtpSlugs(normalizedChamp);

  const collectedBuilds: OpggProBuild[] = [];
  const seenCoreSignatures = new Set<string>();

  const addUniqueBuild = (build: OpggProBuild | null) => {
    if (!build) return;
    const sig = `${build.coreItems.join('-')}_${build.runes.selections[0]}`;
    if (!seenCoreSignatures.has(sig)) {
      seenCoreSignatures.add(sig);
      build.executionTimeMs = Date.now() - startTime;
      collectedBuilds.push(build);
    }
  };

  // 1. Probar OTPs con matchup específico contra oponente o su arquetipo
  if (topOtps.length > 0 && opponentName) {
    for (let i = 0; i < Math.min(topOtps.length, 3); i++) {
      const otpBuild = await checkOtpMatchup(topOtps[i], championName, opponentName, role, i + 1);
      if (otpBuild) {
        addUniqueBuild(otpBuild);
      }
    }
  }

  // 2. Probar builds generales de los Top OTPs
  if (topOtps.length > 0 && collectedBuilds.length < 3) {
    for (let i = 0; i < topOtps.length && collectedBuilds.length < 3; i++) {
      const otpGen = await checkOtpGeneralMatch(topOtps[i], championName, role, i + 1);
      if (otpGen) {
        addUniqueBuild(otpGen);
      }
    }
  }

  // 3. Fallback a la build general de Challenger/GM de OP.GG
  if (collectedBuilds.length < 3) {
    const generalBuild = await fetchGeneralProBuild(championName, role);
    if (generalBuild) {
      addUniqueBuild(generalBuild);
    }
  }

  // Si aún no hay 3, generar variantes basadas en clase
  if (collectedBuilds.length === 0) {
    const fallback = getDefaultItemsForChampion(championName, role);
    collectedBuilds.push({
      id: 'fallback-1',
      title: 'Configuración Principal',
      championName,
      role,
      patch: '16.15',
      sampleSize: 100,
      winRate: 53.0,
      coreItems: fallback.coreItems,
      boots: fallback.boots,
      starterItems: fallback.starterItems,
      summoners: fallback.summoners,
      runes: fallback.runes,
      source: 'general_pro'
    });
  }

  return collectedBuilds;
}

export async function fetchProBuild(
  championName: string,
  role: string,
  opponentName?: string
): Promise<OpggProBuild | null> {
  const builds = await fetchProBuilds(championName, role, opponentName);
  return builds[0] || null;
}
