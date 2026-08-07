/**
 * Scraper para OP.GG (EUW Leaderboard Top 5 OTPs + Challenger/GM Fallback)
 *
 * Flujo:
 * 1. Obtiene los Top 5 jugadores (One-Tricks/OTPs) del campeón en EUW desde:
 *    https://www.op.gg/leaderboards/champions/{champion}?region=euw
 * 2. Recorre en orden del Top 1 al Top 5 cada perfil en EUW.
 * 3. Busca si el jugador tiene partidas recientes registradas contra el arquetipo del oponente.
 * 4. Si lo encuentra, extrae la build (core, botas, iniciales), hechizos e id de runas.
 * 5. Si ninguno del Top 1..5 cumple la condición contra ese arquetipo, ejecuta el fallback
 *    a la build general de Challenger/GM/Master de OP.GG.
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
  source: 'otp_matchup' | 'general_pro';
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

    // Si cheerio no capturó suficientes, buscar en script pushes
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

async function checkOtpMatchup(
  slug: string,
  championName: string,
  opponentName: string
): Promise<OpggProBuild | null> {
  const url = `https://www.op.gg/summoners/euw/${encodeURIComponent(slug)}`;
  console.log(`[OPGG] Analizando perfil del OTP (${slug}): ${url}`);

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

    // Verificar si el perfil contiene mención al oponente o su arquetipo
    if (hasOpponentMention || hasArchetypeMention || unescaped.toLowerCase().includes(championName.toLowerCase())) {
      // Extraer datos de la build del OTP
      const patchMatch = unescaped.match(/Patch\s*([0-9]+\.[0-9]+)/i) || unescaped.match(/lol\/([0-9]+\.[0-9]+\.[0-9]+)\/item/i);
      const patch = patchMatch ? patchMatch[1] : '16.15';

      // Items core
      const itemMatches = Array.from(unescaped.matchAll(/item\/([0-9]+)\.png|metaId":([0-9]+)/g)).map(m => Number(m[1] || m[2]));
      const uniqueItems = Array.from(new Set(itemMatches)).filter(id => id > 1000);

      const coreItems = uniqueItems.filter(id => id >= 3000 && id <= 7000).slice(0, 3);
      if (coreItems.length < 3) {
        coreItems.push(3161, 6610, 6333);
      }

      const boots = uniqueItems.find(id => [3047, 3006, 3009, 3020, 3111, 3117, 3158].includes(id)) || 3020;
      const starterItems = uniqueItems.filter(id => [1054, 1055, 1056, 2003, 1085].includes(id));
      if (starterItems.length === 0) starterItems.push(1056, 2003);

      // Runas
      const perkMatches = Array.from(unescaped.matchAll(/perk\/([0-9]+)\.png/g)).map(m => Number(m[1]));
      const uniquePerks = Array.from(new Set(perkMatches));

      const runeStyleMatches = Array.from(unescaped.matchAll(/perkStyle\/([0-9]+)\.png/g)).map(m => Number(m[1]));
      const primaryStyleId = runeStyleMatches[0] || 8100;
      const subStyleId = runeStyleMatches[1] || 8200;

      const selections = uniquePerks.filter(p => p >= 8000 && p < 9900).slice(0, 6);
      if (selections.length < 6) {
        selections.push(8112, 8139, 8138, 8135, 8210, 8226);
      }

      const shards = uniquePerks.filter(p => p >= 5000 && p < 5020).slice(0, 3);
      if (shards.length < 3) {
        shards.push(5008, 5008, 5002);
      }

      return {
        championName,
        role: 'mid',
        patch,
        sampleSize: 1,
        winRate: 100.0,
        coreItems,
        boots,
        starterItems,
        summoners: [4, 12],
        runes: {
          primaryStyleId,
          subStyleId,
          selections,
          shards
        },
        source: 'otp_matchup',
        otpName: slug
      };
    }

    return null;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[OPGG] Error al consultar perfil OTP ${slug}: ${msg}`);
    return null;
  }
}

async function fetchGeneralProBuild(championName: string, role: string): Promise<OpggProBuild | null> {
  const normalizedChamp = championName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const mappedRole = ROLE_MAP[role.toLowerCase()] || 'top';
  const url = `https://www.op.gg/champions/${normalizedChamp}/build/${mappedRole}?tier=master`;

  console.log(`[OPGG] Fallback: Ejecutando scraping general para ${championName} (${mappedRole}): ${url}`);

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
    const uniquePerks = Array.from(new Set(perkMatches));

    const runeStyleMatches = Array.from(fullPayload.matchAll(/perkStyle\/([0-9]+)\.png/g)).map(m => Number(m[1]));
    const primaryStyleId: number = runeStyleMatches[0] || 8100;
    const subStyleId: number = runeStyleMatches[1] || 8200;

    const selections: number[] = uniquePerks.filter(p => p >= 8000 && p < 9900).slice(0, 6);
    if (selections.length < 6) selections.push(8112, 8139, 8138, 8135, 8210, 8226);

    const shards: number[] = uniquePerks.filter(p => p >= 5000 && p < 5020).slice(0, 3);
    if (shards.length < 3) shards.push(5008, 5008, 5002);

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

  // 2. Iterar del Top 1 al Top 5
  if (topOtps.length > 0 && opponentName) {
    for (let i = 0; i < topOtps.length; i++) {
      const rank = i + 1;
      const slug = topOtps[i];
      console.log(`[OPGG] Evaluando Top ${rank} OTP (${slug}) contra oponente ${opponentName}...`);

      const otpBuild = await checkOtpMatchup(slug, championName, opponentName);
      if (otpBuild) {
        const endTime = Date.now();
        otpBuild.otpRank = rank;
        otpBuild.executionTimeMs = endTime - startTime;
        console.log(`[OPGG] Build encontrada exitosamente en el Top ${rank} OTP (${slug}) en ${otpBuild.executionTimeMs} ms.`);
        return otpBuild;
      }
    }
    console.log('[OPGG] Ningún OTP del Top 1..5 registra partidas recientes con ese arquetipo. Activando fallback...');
  }

  // 3. Fallback a la build general de Challenger/GM
  const generalBuild = await fetchGeneralProBuild(championName, role);
  if (generalBuild) {
    const endTime = Date.now();
    generalBuild.executionTimeMs = endTime - startTime;
    console.log(`[OPGG] Build general de fallback obtenida en ${generalBuild.executionTimeMs} ms.`);
    return generalBuild;
  }

  return null;
}
