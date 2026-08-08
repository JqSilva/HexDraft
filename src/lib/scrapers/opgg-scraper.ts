/**
 * Scraper para OP.GG (EUW Leaderboard Top 5 OTPs con fallback a partida general de OTP y Challenger/GM)
 *
 * Flujo Jerárquico:
 * 1. Nivel 1: Obtiene los Top 5 jugadores (OTPs) del campeón en EUW desde:
 *    https://www.op.gg/leaderboards/champions/{champion}?region=euw
 *    Recorre del Top 1 al Top 5 buscando una partida contra el oponente o su arquetipo.
 * 2. Nivel 2: Si ninguno de los 5 tiene partida contra ese arquetipo, toma la configuración
 *    de la partida más reciente de cualquiera de los 5 OTPs (del Top 1 al Top 5).
 * 3. Nivel 3: Si no se pudo obtener ninguna partida de los 5 OTPs, recurre a la build
 *    estadística general de Challenger/GM/Master de OP.GG.
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { getOpponentArchetype } from '../engine/archetypes.js';

export interface OpggBuildRunes {
  primaryStyleId: number;
  subStyleId: number;
  selections: number[];
  shards: number[];
}

export interface OpggProBuild {
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

    // Búsqueda complementaria en scripts
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
  const patchMatch = unescaped.match(/Patch\s*([0-9]+\.[0-9]+)/i) || unescaped.match(/lol\/([0-9]+\.[0-9]+\.[0-9]+)\/item/i);
  const patch = patchMatch ? patchMatch[1] : '16.15';

  const itemMatches = Array.from(unescaped.matchAll(/item\/([0-9]+)\.png|metaId":([0-9]+)/g)).map(m => Number(m[1] || m[2]));
  const uniqueItems = Array.from(new Set(itemMatches)).filter(id => id > 1000);

  const coreItems = uniqueItems.filter(id => id >= 3000 && id <= 7000).slice(0, 3);
  if (coreItems.length < 3) {
    coreItems.push(3161, 6610, 6333);
  }

  const boots = uniqueItems.find(id => [3047, 3006, 3009, 3020, 3111, 3117, 3158].includes(id)) || 3020;
  const starterItems = uniqueItems.filter(id => [1054, 1055, 1056, 2003, 1085, 1101, 1102, 1103, 3865, 3866, 3867].includes(id));
  if (starterItems.length === 0) starterItems.push(1056, 2003);

  const perkMatches = Array.from(unescaped.matchAll(/perk\/([0-9]+)\.png/g)).map(m => Number(m[1]));

  const runeStyleMatches = Array.from(unescaped.matchAll(/perkStyle\/([0-9]+)\.png/g)).map(m => Number(m[1]));
  const primaryStyleId = runeStyleMatches[0] || 8100;
  const subStyleId = runeStyleMatches[1] || 8200;

  // 6 runas principales (4 primarias + 2 secundarias)
  const allPerks = perkMatches.filter(p => p >= 8000 && p < 9900);
  const selections: number[] = Array.from(new Set(allPerks)).slice(0, 6);
  if (selections.length < 6) {
    const defaultPerks = [8112, 8139, 8138, 8135, 8210, 8226];
    defaultPerks.forEach(p => {
      if (selections.length < 6 && !selections.includes(p)) {
        selections.push(p);
      }
    });
  }

  // 3 fragmentos de estadísticas exactos (preservando duplicados válidos como 5008 + 5008)
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
    const normRole = role.toLowerCase();
    if (normRole === 'jungle' || normRole === 'jg') {
      summoners.push(4, 11);
    } else if (normRole === 'adc' || normRole === 'bottom') {
      summoners.push(4, 7);
    } else if (normRole === 'support' || normRole === 'utility') {
      summoners.push(4, 14);
    } else {
      summoners.push(4, 12);
    }
  }

  return {
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
    const hasOpponentMention = opponentName ? unescaped.toLowerCase().includes(opponentName.toLowerCase()) : false;
    const hasArchetypeMention = opponentArchetype ? unescaped.toLowerCase().includes(opponentArchetype.toLowerCase()) : false;

    if (hasOpponentMention || hasArchetypeMention) {
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
  const normalizedChamp = championName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const mappedRole = ROLE_MAP[role.toLowerCase()] || 'top';
  const url = `https://www.op.gg/champions/${normalizedChamp}/build/${mappedRole}?tier=master`;

  console.log(`[OPGG] Nivel 3 Fallback: Ejecutando scraping general para ${championName} (${mappedRole}): ${url}`);

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

    const coreMatch = fullPayload.match(/core_items_0[\s\S]*?metaId":([0-9]+)[\s\S]*?metaId":([0-9]+)[\s\S]*?metaId":([0-9]+)/);
    const coreItems: number[] = coreMatch
      ? [Number(coreMatch[1]), Number(coreMatch[2]), Number(coreMatch[3])]
      : [3161, 6610, 6333];

    const bootsMatch = fullPayload.match(/boots_0[\s\S]*?metaId":([0-9]+)/);
    const boots: number = bootsMatch ? Number(bootsMatch[1]) : 3020;

    const starterBlockMatch = fullPayload.match(/starter_items_0[\s\S]*?tbody/);
    const starterItems: number[] = [];
    if (starterBlockMatch) {
      const matches = Array.from(starterBlockMatch[0].matchAll(/metaId":([0-9]+)/g));
      matches.forEach(m => starterItems.push(Number(m[1])));
    }
    if (starterItems.length === 0) starterItems.push(1056, 2003);

    const spellMatches = Array.from(fullPayload.matchAll(/spell\/([0-9]+)\.png/g)).map(m => Number(m[1]));
    const summoners: number[] = Array.from(new Set(spellMatches)).slice(0, 2);
    if (summoners.length < 2) summoners.push(4, 12);

    const perkMatches = Array.from(fullPayload.matchAll(/perk\/([0-9]+)\.png/g)).map(m => Number(m[1]));

    const runeStyleMatches = Array.from(fullPayload.matchAll(/perkStyle\/([0-9]+)\.png/g)).map(m => Number(m[1]));
    const primaryStyleId: number = runeStyleMatches[0] || 8100;
    const subStyleId: number = runeStyleMatches[1] || 8200;

    const allPerks = perkMatches.filter(p => p >= 8000 && p < 9900);
    const selections: number[] = Array.from(new Set(allPerks)).slice(0, 6);
    if (selections.length < 6) {
      const defaultPerks = [8112, 8139, 8138, 8135, 8210, 8226];
      defaultPerks.forEach(p => {
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
    const winRate: number = winRateMatch ? parseFloat(winRateMatch[1]) : 50.0;

    return {
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

export async function fetchProBuild(
  championName: string,
  role: string,
  opponentName?: string
): Promise<OpggProBuild | null> {
  if (!championName) {
    console.error('[OPGG] Nombre de campeón nulo o vacío.');
    return null;
  }

  const startTime = Date.now();
  const normalizedChamp = championName.toLowerCase().replace(/[^a-z0-9]/g, '');

  // 1. Obtener Top 5 OTPs del campeón en EUW
  const topOtps = await fetchTopOtpSlugs(normalizedChamp);

  // NIVEL 1: Buscar partida contra el oponente o su arquetipo en los Top 1..5
  if (topOtps.length > 0 && opponentName) {
    for (let i = 0; i < topOtps.length; i++) {
      const rank = i + 1;
      const slug = topOtps[i];
      console.log(`[OPGG] Evaluando Top ${rank} OTP (${slug}) contra oponente ${opponentName}...`);

      const otpBuild = await checkOtpMatchup(slug, championName, opponentName, role, rank);
      if (otpBuild) {
        const endTime = Date.now();
        otpBuild.executionTimeMs = endTime - startTime;
        console.log(`[OPGG] Nivel 1 Éxito: Build encontrada en el Top ${rank} OTP (${slug}) en ${otpBuild.executionTimeMs} ms.`);
        return otpBuild;
      }
    }
  }

  // NIVEL 2: Fallback a la primera partida disponible de cualquiera de los Top 5 OTPs
  if (topOtps.length > 0) {
    console.log('[OPGG] Nivel 2 Fallback: Buscando la partida más reciente de cualquiera de los Top 5 OTPs...');
    for (let i = 0; i < topOtps.length; i++) {
      const rank = i + 1;
      const slug = topOtps[i];
      const generalOtpBuild = await checkOtpGeneralMatch(slug, championName, role, rank);
      if (generalOtpBuild) {
        const endTime = Date.now();
        generalOtpBuild.executionTimeMs = endTime - startTime;
        console.log(`[OPGG] Nivel 2 Éxito: Partida general de OTP encontrada en Top ${rank} (${slug}) en ${generalOtpBuild.executionTimeMs} ms.`);
        return generalOtpBuild;
      }
    }
  }

  // NIVEL 3: Fallback a la build estadística general de Challenger/GM/Master de OP.GG
  console.log('[OPGG] Nivel 3 Fallback: Recurriendo a la build general de alto elo de OP.GG...');
  const generalBuild = await fetchGeneralProBuild(championName, role);
  if (generalBuild) {
    const endTime = Date.now();
    generalBuild.executionTimeMs = endTime - startTime;
    console.log(`[OPGG] Nivel 3 Éxito: Build general de fallback obtenida en ${generalBuild.executionTimeMs} ms.`);
    return generalBuild;
  }

  return null;
}
