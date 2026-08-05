// src/lib/services/opgg.service.ts
import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'node:fs';
import path from 'node:path';
import { getNameFromId } from '../engine/engine.js';

const CACHE_FILE_PATH = path.resolve(process.cwd(), 'src/lib/data/opgg-cache.json');
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora de caché por jugador

export interface OpggPlayerProfile {
  puuid: string;
  riotId: string;
  summonerName: string;
  profileIconId: number;
  profileIconUrl?: string;
  isStreamerMode: boolean;
  ranked: {
    tier: string;
    division: string;
    rank: string;
    lp: number;
    wins: number;
    losses: number;
    winrate: number;
  };
  rankedFlex: {
    tier: string;
    division: string;
    rank: string;
    lp: number;
    wins: number;
    losses: number;
    winrate: number;
  };
  todayRecord: {
    wins: number;
    losses: number;
    winrate: number | null;
    streak: {
      type: 'win' | 'loss' | null;
      count: number;
    };
  };
  topChampions: Array<{
    name: string;
    wins: number;
    losses: number;
    winrate: number;
  }>;
  isMain: boolean;
  tags: string[];
  lastMatchKda?: string;
  lastMatchResult?: string;
  opScoreAvg?: number;
}

interface CacheSchema {
  sessions: Record<string, { timestamp: number; data: OpggPlayerProfile[] }>;
  players: Record<string, { timestamp: number; data: OpggPlayerProfile }>;
}

let memoryCache: CacheSchema | null = null;

function loadCache(): CacheSchema {
  if (memoryCache) return memoryCache;
  try {
    if (fs.existsSync(CACHE_FILE_PATH)) {
      const raw = fs.readFileSync(CACHE_FILE_PATH, 'utf-8');
      memoryCache = JSON.parse(raw);
      return memoryCache!;
    }
  } catch (e) {
    console.error('[OPGG Service] Error al cargar caché:', e);
  }
  memoryCache = { sessions: {}, players: {} };
  return memoryCache!;
}

function saveCache(cache: CacheSchema): void {
  try {
    fs.mkdirSync(path.dirname(CACHE_FILE_PATH), { recursive: true });
    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(cache, null, 2), 'utf-8');
  } catch (e) {
    console.error('[OPGG Service] Error al guardar caché:', e);
  }
}

/**
  Determina si un invocador está en modo streamer o es anónimo.
 */
export function checkIsStreamerMode(gameName: string, tagLine: string): boolean {
  if (!gameName || gameName.trim() === '') return true;
  const lowerName = gameName.toLowerCase().trim();
  const lowerTag = (tagLine || '').toLowerCase().trim();

  // Solamente marcar como Streamer Mode si el nombre es explicitamente anonimo o streamer
  if (
    lowerName === 'anónimo' ||
    lowerName === 'anonymous' ||
    lowerName === 'streamer' ||
    lowerTag === 'streamer' ||
    lowerTag === 'anon' ||
    lowerTag === 'hidden'
  ) {
    return true;
  }

  return false;
}

/**
 * Scrapea el perfil de OP.GG para un jugador específico.
 */
export async function scrapeOpggProfile(
  gameName: string,
  tagLine: string,
  region: string = 'las',
  currentChampionId: number = 0
): Promise<OpggPlayerProfile> {
  const riotId = `${gameName}#${tagLine}`;
  const cleanTag = tagLine.replace(/^#/, '');

  // 1. Verificar Modo Streamer
  if (checkIsStreamerMode(gameName, tagLine)) {
    console.log(`[OPGG Service] Jugador en Modo Streamer detectado: ${riotId}`);
    return {
      puuid: `streamer_${gameName}_${tagLine}`,
      riotId: 'MODO STREAMER',
      summonerName: 'MODO STREAMER',
      profileIconId: 29,
      isStreamerMode: true,
      ranked: { tier: 'UNRANKED', division: '', rank: '', lp: 0, wins: 0, losses: 0, winrate: 0 },
      rankedFlex: { tier: 'UNRANKED', division: '', rank: '', lp: 0, wins: 0, losses: 0, winrate: 0 },
      todayRecord: { wins: 0, losses: 0, winrate: null, streak: { type: null, count: 0 } },
      topChampions: [],
      isMain: false,
      tags: ['MODO STREAMER']
    };
  }

  // 2. Verificar Caché Local
  const cacheKey = `${region}_${gameName.toLowerCase()}_${cleanTag.toLowerCase()}`;
  const cache = loadCache();
  const cachedEntry = cache.players[cacheKey];
  if (cachedEntry && Date.now() - cachedEntry.timestamp < CACHE_TTL_MS) {
    console.log(`[OPGG Service] Usando datos de caché para: ${riotId}`);
    return cachedEntry.data;
  }

  const profileSlug = `${encodeURIComponent(gameName)}-${encodeURIComponent(cleanTag)}`;
  const opggUrl = `https://www.op.gg/summoners/${region.toLowerCase()}/${profileSlug}`;

  console.log(`[OPGG Service] Scrapeando perfil en OP.GG: ${opggUrl}`);

  try {
    const res = await axios.get(opggUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
      },
      timeout: 8000
    });

    const html = res.data;
    const $ = cheerio.load(html);

    // Extraer Schema.org JSON-LD
    let schemaJson: any = null;
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const raw = $(el).html() || '';
        const parsed = JSON.parse(raw);
        if (parsed['@graph'] || parsed.description || parsed.name) {
          schemaJson = parsed;
        }
      } catch (_e) {
        // Ignorar JSON-LD malformado
      }
    });

    const graph = schemaJson?.['@graph'] || [];
    const profileNode = graph.find((n: any) => n['@type'] === 'ProfilePage' || n['@type'] === 'Dataset') || {};
    const personNode = graph.find((n: any) => n['@type'] === 'Person') || {};
    const description = profileNode.description || $('meta[name="description"]').attr('content') || '';

    // Extraer SoloQ y Flex Rank del resumen schema/description y HTML
    let soloTier = 'UNRANKED';
    let soloDivision = '';
    let soloLp = 0;
    let soloWins = 0;
    let soloLosses = 0;
    let soloWinrate = 0;

    let flexTier = 'UNRANKED';
    let flexDivision = '';
    let flexLp = 0;
    let flexWins = 0;
    let flexLosses = 0;
    let flexWinrate = 0;

    const soloRankMatch = description.match(/SOLORANKED rank is ([A-Za-z]+)\s*(\d*)\s*Division\s*(\d*)\s*(\d+)\s*LP with (\d+) wins, (\d+) losses, and a (\d+)%/i) ||
                          description.match(/([A-Za-z]+)\s*(\d+)?\s*(\d+)LP\s*\/\s*(\d+)Win\s*(\d+)Lose\s*Win rate\s*(\d+)%/i);

    if (soloRankMatch) {
      if (soloRankMatch.length >= 8) {
        soloTier = soloRankMatch[1].toUpperCase();
        soloDivision = soloRankMatch[3] ? ['I', 'II', 'III', 'IV'][parseInt(soloRankMatch[3]) - 1] || soloRankMatch[3] : (soloRankMatch[2] || '');
        soloLp = parseInt(soloRankMatch[4]) || 0;
        soloWins = parseInt(soloRankMatch[5]) || 0;
        soloLosses = parseInt(soloRankMatch[6]) || 0;
        soloWinrate = parseInt(soloRankMatch[7]) || 0;
      } else if (soloRankMatch.length >= 7) {
        soloTier = soloRankMatch[1].toUpperCase();
        soloDivision = soloRankMatch[2] ? ['I', 'II', 'III', 'IV'][parseInt(soloRankMatch[2]) - 1] || soloRankMatch[2] : '';
        soloLp = parseInt(soloRankMatch[3]) || 0;
        soloWins = parseInt(soloRankMatch[4]) || 0;
        soloLosses = parseInt(soloRankMatch[5]) || 0;
        soloWinrate = parseInt(soloRankMatch[6]) || 0;
      }
    }

    const flexRankMatch = description.match(/FLEXRANKED rank is ([A-Za-z]+)\s*(\d*)\s*Division\s*(\d*)\s*(\d+)\s*LP with (\d+) wins, (\d+) losses, and a (\d+)%/i) ||
                          description.match(/FLEX\s*5v5\s*[:\-]?\s*([A-Za-z]+)\s*(\d+)?\s*(\d+)LP\s*\/\s*(\d+)Win\s*(\d+)Lose\s*Win rate\s*(\d+)%/i) ||
                          html.match(/Flex 5v5[\s\S]{1,200}?([A-Za-z]+)\s*(\d+)?[\s\S]{1,50}?(\d+)LP/i);

    if (flexRankMatch) {
      if (flexRankMatch.length >= 8) {
        flexTier = flexRankMatch[1].toUpperCase();
        flexDivision = flexRankMatch[3] ? ['I', 'II', 'III', 'IV'][parseInt(flexRankMatch[3]) - 1] || flexRankMatch[3] : (flexRankMatch[2] || '');
        flexLp = parseInt(flexRankMatch[4]) || 0;
        flexWins = parseInt(flexRankMatch[5]) || 0;
        flexLosses = parseInt(flexRankMatch[6]) || 0;
        flexWinrate = parseInt(flexRankMatch[7]) || 0;
      } else if (flexRankMatch.length >= 4) {
        flexTier = flexRankMatch[1].toUpperCase();
        flexDivision = flexRankMatch[2] ? ['I', 'II', 'III', 'IV'][parseInt(flexRankMatch[2]) - 1] || flexRankMatch[2] : '';
        flexLp = parseInt(flexRankMatch[3]) || 0;
        if (flexRankMatch[4]) flexWins = parseInt(flexRankMatch[4]) || 0;
        if (flexRankMatch[5]) flexLosses = parseInt(flexRankMatch[5]) || 0;
        if (flexRankMatch[6]) flexWinrate = parseInt(flexRankMatch[6]) || 0;
      }
    }

    // Selector alternativo Cheerio si Flex sigue siendo UNRANKED
    if (flexTier === 'UNRANKED') {
      $('div, section, header, li').each((_, el) => {
        const text = $(el).text();
        if (text.includes('Flex 5v5') || text.includes('FLEX 5v5') || text.includes('Clasificatoria Flexible')) {
          const m = text.match(/(IRON|BRONZE|SILVER|GOLD|PLATINUM|EMERALD|DIAMOND|MASTER|GRANDMASTER|CHALLENGER)\s*([1-4]|I|II|III|IV)?\s*(\d+)\s*LP/i);
          if (m && flexTier === 'UNRANKED') {
            flexTier = m[1].toUpperCase();
            flexDivision = m[2] || '';
            flexLp = parseInt(m[3]) || 0;
          }
        }
      });
    }

    // Extraer Partidas Recientes de Schema ListItems
    const recentMatchesNode = graph.find((n: any) => n['@type'] === 'ItemList' && n['@id']?.includes('recent-games'));
    const itemList = recentMatchesNode?.itemListElement || [];

    let todayWins = 0;
    let todayLosses = 0;
    let recentWins = 0;
    let recentLosses = 0;
    let hasMvp = false;
    let hasAce = false;
    let totalOpScoreSum = 0;
    let validOpScoreCount = 0;

    const streakMatches: boolean[] = [];

    let lastMatchKda = '';
    let lastMatchResult = '';

    if (itemList.length > 0) {
      const firstItem = itemList[0]?.item || {};
      const firstProps = firstItem.additionalProperty || [];
      const kProp = firstProps.find((p: any) => p.name === 'kill' || p.name === 'kills');
      const dProp = firstProps.find((p: any) => p.name === 'death' || p.name === 'deaths');
      const aProp = firstProps.find((p: any) => p.name === 'assist' || p.name === 'assists');

      if (kProp && dProp && aProp) {
        lastMatchKda = `${kProp.value}/${dProp.value}/${aProp.value}`;
      }

      const firstName = firstItem.name || '';
      if (firstName.toUpperCase().includes('WIN')) lastMatchResult = 'Victoria';
      else if (firstName.toUpperCase().includes('LOSE')) lastMatchResult = 'Derrota';
    }

    itemList.forEach((item: any) => {
      const gameAction = item.item || {};
      const nameStr = gameAction.name || '';
      const startTimeStr = gameAction.startTime || '';
      const props = gameAction.additionalProperty || [];

      const isWin = nameStr.toUpperCase().includes('WIN');
      const isLose = nameStr.toUpperCase().includes('LOSE');

      if (isWin || isLose) {
        streakMatches.push(isWin);
        if (isWin) recentWins++;
        if (isLose) recentLosses++;

        // Verificar si la partida ocurrió hoy
        let isGameToday = false;
        if (startTimeStr) {
          const gameDate = new Date(startTimeStr);
          if (!isNaN(gameDate.getTime())) {
            const today = new Date();
            const sameDay = gameDate.getFullYear() === today.getFullYear() &&
                            gameDate.getMonth() === today.getMonth() &&
                            gameDate.getDate() === today.getDate();

            const diffHours = (today.getTime() - gameDate.getTime()) / (1000 * 60 * 60);
            const hoursSinceMidnight = today.getHours() + (today.getMinutes() / 60) + 1;

            if (sameDay || (diffHours >= 0 && diffHours <= hoursSinceMidnight)) {
              isGameToday = true;
            }
          } else {
            const lowerTime = startTimeStr.toLowerCase();
            if (lowerTime.includes('hour') || lowerTime.includes('hora') || lowerTime.includes('min') || lowerTime.includes('m ago') || lowerTime.includes('h ago')) {
              isGameToday = true;
            }
          }
        }

        if (isGameToday) {
          if (isWin) todayWins++;
          if (isLose) todayLosses++;
        }

        // Props de OP Score y Rank
        const rankProp = props.find((p: any) => p.name === 'opScoreRank');
        const scoreProp = props.find((p: any) => p.name === 'opScore');

        if (rankProp) {
          const rankVal = parseInt(rankProp.value);
          if (rankVal === 1) hasMvp = true;
          if (rankVal === 2 && isLose) hasAce = true;
        }

        if (scoreProp) {
          const scoreVal = parseFloat(scoreProp.value);
          if (!isNaN(scoreVal)) {
            totalOpScoreSum += scoreVal;
            validOpScoreCount++;
          }
        }
      }
    });

    const opScoreAvg = validOpScoreCount > 0 ? Math.round((totalOpScoreSum / validOpScoreCount) * 10) / 10 : undefined;

    // Calcular Racha Actual
    let streakType: 'win' | 'loss' | null = null;
    let streakCount = 0;
    if (streakMatches.length > 0) {
      const firstResult = streakMatches[0];
      for (const res of streakMatches) {
        if (res === firstResult) {
          streakCount++;
        } else {
          break;
        }
      }
      streakType = firstResult ? 'win' : 'loss';
    }

    // Extraer Campeones Principales del Resumen Meta
    const topChampions: Array<{ name: string; wins: number; losses: number; winrate: number }> = [];
    const champMatches = [...description.matchAll(/([A-Za-z0-9\s']+)\s*-\s*(\d+)Win\s*(\d+)Lose\s*Win rate\s*(\d+)%/g)];

    champMatches.forEach(m => {
      const name = m[1].trim();
      const wins = parseInt(m[2]) || 0;
      const losses = parseInt(m[3]) || 0;
      const winrate = parseInt(m[4]) || 0;
      topChampions.push({ name, wins, losses, winrate });
    });

    // Nombre del Campeón actual fijado en la partida
    const currentChampName = currentChampionId > 0 ? getNameFromId(currentChampionId) : null;
    const isMain = currentChampName
      ? topChampions.some(c => c.name.toLowerCase() === currentChampName.toLowerCase())
      : false;

    // CONSTRUIR LISTA DE TAGS SINTETIZADA
    const tags: string[] = [];

    if (isMain) {
      tags.push(`MAIN ${currentChampName?.toUpperCase()}`);
    }

    if (hasMvp) {
      tags.push('MVP');
    } else if (hasAce) {
      tags.push('ACE');
    }

    if (streakCount >= 3 && streakType === 'win') {
      tags.push(`WIN STREAK ${streakCount}W`);
    } else if (streakCount >= 3 && streakType === 'loss') {
      tags.push(`LOSS STREAK ${streakCount}L`);
      tags.push('TILTEADO');
    }

    if (todayWins + todayLosses === 0) {
      tags.push('1ª PARTIDA');
    }

    if (validOpScoreCount > 0 && totalOpScoreSum / validOpScoreCount >= 7.5) {
      tags.push('CONSISTENTE');
    }

    // Extraer profileIconId y profileIconUrl real del HTML
    let profileIconId = 29;
    let profileIconUrl = '';

    const directSrcMatch = html.match(/src="(https:\/\/opgg-static\.akamaized\.net\/meta\/images\/profile_icons\/profileIcon\d+\.[^"]+)"/i) ||
                           html.match(/src="(https:\/\/[^"]*profileIcon\d+\.[^"]+)"/i);

    if (directSrcMatch && directSrcMatch[1]) {
      profileIconUrl = directSrcMatch[1].replace(/&amp;/g, '&');
    }

    const iconMatch = html.match(/profile_icons\/profileIcon(\d+)\.(png|jpg)/i) ||
                      html.match(/profileIcon(\d+)\.(png|jpg)/i) ||
                      html.match(/profile_icon\/(\d+)/i) ||
                      html.match(/profileIconId":(\d+)/i) ||
                      html.match(/"profile_image_url":"[^"]*\/(\d+)\.(png|jpg)"/i);

    if (iconMatch && iconMatch[1]) {
      profileIconId = parseInt(iconMatch[1], 10) || 29;
    }

    if (!profileIconUrl && profileIconId > 0) {
      profileIconUrl = `https://opgg-static.akamaized.net/meta/images/profile_icons/profileIcon${profileIconId}.jpg?image=q_auto:good,f_webp,w_200`;
    }

    const profileData: OpggPlayerProfile = {
      puuid: personNode.identifier?.find((i: any) => i.name === 'puuid')?.value || `opgg_${cacheKey}`,
      riotId,
      summonerName: gameName,
      profileIconId,
      profileIconUrl,
      isStreamerMode: false,
      ranked: {
        tier: soloTier,
        division: soloDivision,
        rank: soloDivision,
        lp: soloLp,
        wins: soloWins,
        losses: soloLosses,
        winrate: soloWinrate
      },
      rankedFlex: {
        tier: flexTier,
        division: flexDivision,
        rank: flexDivision,
        lp: flexLp,
        wins: flexWins,
        losses: flexLosses,
        winrate: flexWinrate
      },
      todayRecord: {
        wins: todayWins,
        losses: todayLosses,
        winrate: (todayWins + todayLosses) > 0 ? Math.round((todayWins / (todayWins + todayLosses)) * 100) : null,
        streak: {
          type: streakType,
          count: streakCount
        }
      },
      topChampions,
      isMain,
      tags,
      lastMatchKda,
      lastMatchResult,
      opScoreAvg
    };

    // Guardar en Caché
    cache.players[cacheKey] = {
      timestamp: Date.now(),
      data: profileData
    };
    saveCache(cache);

    return profileData;

  } catch (error: any) {
    console.error(`[OPGG Service] Error al scrapear ${opggUrl}:`, error.message);

    // Fallback seguro en caso de error HTTP o timeout
    return {
      puuid: `fallback_${cacheKey}`,
      riotId,
      summonerName: gameName,
      profileIconId: 29,
      isStreamerMode: false,
      ranked: { tier: 'UNRANKED', division: '', rank: '', lp: 0, wins: 0, losses: 0, winrate: 0 },
      rankedFlex: { tier: 'UNRANKED', division: '', rank: '', lp: 0, wins: 0, losses: 0, winrate: 0 },
      todayRecord: { wins: 0, losses: 0, winrate: null, streak: { type: null, count: 0 } },
      topChampions: [],
      isMain: false,
      tags: ['STABLE']
    };
  }
}
