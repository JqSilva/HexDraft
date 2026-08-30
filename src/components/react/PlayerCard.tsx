// src/components/react/PlayerCard.tsx
import React, { useState, useEffect } from 'react';
import { getChampionCdnName } from '../../lib/championMapper.js';
import { hydrateAsset } from '../../lib/engine/core/hydrator.js';
import { getNameFromId } from '../../lib/engine/core/constants.js';
import {
  generatePlayerTags,
  filterTagsByMode,
  type PlayerTagItem,
  type PlayerTagContext
} from '../../lib/services/playerTags.service.js';

const POS_BASE = "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/";

const posMapping: Record<string, string> = {
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
  "SUPP": "icon-position-utility.png",
  "SUPPORT": "icon-position-utility.png",
  "DUO_SUPPORT": "icon-position-utility.png"
};

const SECONDARY_STYLE_ICONS: Record<number, string> = {
  8000: "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/styles/7201_precision.png",
  8100: "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/styles/7200_domination.png",
  8200: "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/styles/7202_sorcery.png",
  8300: "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/styles/7203_whimsy.png",
  8400: "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/styles/7204_resolve.png"
};

const MINI_CREST_BASE = "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-mini-crests/";

const getRankIconUrl = (tier: string): string => {
  const normalizedTier = (tier || 'unranked').toLowerCase().trim();
  return `${MINI_CREST_BASE}${normalizedTier}.svg`;
};

export interface PlayerData {
  puuid: string;
  riotId?: string;
  summonerName?: string;
  teamId: number;
  championId: number;
  championName: string;
  skinId?: number;
  selectedSkinId?: number;
  skinNum?: number;
  profileIconId?: number;
  profileIconUrl?: string;
  spell1Id?: number;
  spell2Id?: number;
  keystoneId?: number;
  secondaryStyleId?: number;
  role?: string;
  isMain?: boolean;
  isStreamerMode?: boolean;
  ranked?: {
    tier: string;
    division?: string;
    rank?: string;
    lp?: number;
    leaguePoints?: number;
    wins: number;
    losses: number;
    winrate: number;
  };
  rankedFlex?: {
    tier: string;
    division?: string;
    rank?: string;
    lp?: number;
    leaguePoints?: number;
    wins: number;
    losses: number;
    winrate: number;
  };
  todayRecord?: {
    wins: number;
    losses: number;
    totalGames?: number;
    winrate: number | null;
    streak?: {
      type: 'win' | 'loss' | null;
      count: number;
    };
  };
  topChampions?: Array<{
    name: string;
    wins: number;
    losses: number;
    winrate: number;
  }>;
  lastMatchKda?: string;
  lastMatchResult?: string;
  opScoreAvg?: number;
  recentMatches?: Array<{
    championId: number;
    championName?: string;
    win: boolean;
    kills: number;
    deaths: number;
    assists: number;
    cs: number;
    gameDurationMinutes: number;
    visionScore: number;
    visionWardsBought: number;
    damageShare?: number;
    turretDamage?: number;
    firstBlood?: boolean;
    role?: string;
  }>;
  duoPartner?: {
    name: string;
    gamesTogether: number;
    winrate: number;
  };
  tags?: string[];
}

interface PlayerCardProps {
  player: PlayerData;
  index?: number;
  isAlly?: boolean;
  customTags?: string[];
  mode?: 'normal' | 'compact';
  maxTags?: number;
}

export const PlayerCard: React.FC<PlayerCardProps> = ({
  player: p,
  index = 0,
  isAlly,
  customTags,
  mode = 'normal',
  maxTags
}) => {
  const resolvedChampName = (p.championId && getNameFromId(p.championId)) || p.championName || 'Champion';
  const cdnName = getChampionCdnName(resolvedChampName);
  const displayChampName = (resolvedChampName === 'MonkeyKing' || resolvedChampName.toLowerCase() === 'monkeyking')
    ? 'Wukong'
    : (p.championId ? getNameFromId(p.championId) : resolvedChampName);

  const rawSkinId = p.skinId !== undefined ? p.skinId : (p.selectedSkinId !== undefined ? p.selectedSkinId : 0);
  const skinNum = p.skinNum !== undefined ? p.skinNum : (rawSkinId > 0 ? (rawSkinId % 1000) : 0);

  const skinLoadingUrl = `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${cdnName}_${skinNum}.jpg`;
  const baseLoadingUrl = `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${cdnName}_0.jpg`;

  const displayName = p.summonerName || p.riotId || 'Invocador';
  const cleanSummonerName = displayName.includes('#') ? displayName.split('#')[0] : displayName;

  const soloTier = p.ranked?.tier || 'UNRANKED';
  const soloRank = p.ranked?.division || p.ranked?.rank || '';
  const soloLp = p.ranked?.lp !== undefined ? p.ranked.lp : (p.ranked?.leaguePoints || 0);
  const soloWins = p.ranked?.wins || 0;
  const soloLosses = p.ranked?.losses || 0;
  const soloWinrate = p.ranked?.winrate || 0;

  const normalize = (name: string) => (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const rawChampName = displayChampName || resolvedChampName || p.championName || '';
  const champStat = p.topChampions?.find(c => {
    const cNorm = normalize(c.name);
    const targetNorm = normalize(rawChampName);
    return cNorm === targetNorm || (targetNorm === 'wukong' && cNorm === 'monkeyking') || (targetNorm === 'monkeyking' && cNorm === 'wukong');
  });
  const champGames = champStat ? (champStat.wins + champStat.losses) : 0;
  const champWr = champStat ? champStat.winrate : null;

  const spell1 = p.spell1Id ? hydrateAsset('summoners', p.spell1Id) : null;
  const spell2 = p.spell2Id ? hydrateAsset('summoners', p.spell2Id) : null;

  const keystoneId = p.keystoneId || 0;
  const secondaryStyleId = p.secondaryStyleId || 0;
  const keystoneAsset = keystoneId ? hydrateAsset('runes', keystoneId) : null;
  const secondaryStyleIconUrl = secondaryStyleId ? (SECONDARY_STYLE_ICONS[secondaryStyleId] || '') : '';

  const roleName = p.role?.toUpperCase() || 'MID';
  const roleIconUrl = `${POS_BASE}${posMapping[roleName] || 'icon-position-middle.png'}`;

  let computedTagItems: PlayerTagItem[] = [];
  if (customTags && customTags.length > 0) {
    computedTagItems = customTags.map((tagText, idx) => ({
      id: `custom_${idx}`,
      label: tagText,
      category: 'general',
      priority: 50,
      style: 'border-white/20 text-slate-200 bg-black/60',
      tooltip: 'Etiqueta personalizada del invocador.'
    }));
  } else {
    const ctx: PlayerTagContext = {
      puuid: p.puuid,
      summonerName: displayName,
      championId: p.championId,
      championName: displayChampName,
      role: p.role,
      isMain: p.isMain,
      isStreamerMode: p.isStreamerMode,
      todayRecord: p.todayRecord,
      ranked: p.ranked ? {
        tier: p.ranked.tier,
        wins: p.ranked.wins,
        losses: p.ranked.losses,
        winrate: p.ranked.winrate
      } : undefined,
      topChampions: p.topChampions,
      opScoreAvg: p.opScoreAvg,
      recentMatches: p.recentMatches,
      duoPartner: p.duoPartner
    };
    computedTagItems = generatePlayerTags(ctx);
  }

  const displayTags = filterTagsByMode(computedTagItems, maxTags ?? mode);
  const [imageLoaded, setImageLoaded] = useState<boolean>(false);

  useEffect(() => {
    setImageLoaded(false);
  }, [skinLoadingUrl]);

  return (
    <div
      key={p.puuid || `${displayName}-${index}`}
      className="bg-[#0b0c10] overflow-hidden border border-white/10 py-3.5 px-3 rounded-lg w-full max-w-[280px] flex min-h-[380px] max-h-[460px] flex-col justify-between items-center relative select-none shadow-2xl group"
    >
      {/* 1. FONDO SPLASH ART CON GRADIENTES EXACTOS */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none bg-[#090a0f]">
        {!imageLoaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#090a0f] text-slate-500 z-1">
            <svg className="w-6 h-6 animate-spin text-slate-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          </div>
        )}
        <img
          src={skinLoadingUrl}
          alt={displayChampName}
          className={`h-full w-full object-cover object-top transition-opacity duration-300 ${
            imageLoaded ? 'opacity-85' : 'opacity-0'
          }`}
          onLoad={() => setImageLoaded(true)}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            if (!target.dataset.triedBase && target.src !== baseLoadingUrl) {
              target.dataset.triedBase = 'true';
              target.src = baseLoadingUrl;
            } else if (!target.dataset.triedCdrag && p.championId > 0) {
              target.dataset.triedCdrag = 'true';
              target.src = `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-tiles/${p.championId}/${p.championId}000.jpg`;
            } else if (!target.dataset.triedFallback) {
              target.dataset.triedFallback = 'true';
              target.src = `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/Garen_0.jpg`;
            }
          }}
        />
        <div className="absolute w-full bottom-0 h-full bg-gradient-to-t from-[#08090d]/95 via-[#08090d]/35 via-35% to-transparent pointer-events-none" />
        <div className="absolute w-full top-0 h-full bg-gradient-to-b from-[#08090d]/80 via-transparent to-transparent pointer-events-none" />
      </div>

      {/* 2. CABECERA SUPERIOR: NOMBRE CAMPEÓN + WR */}
      <div className="flex flex-col items-center w-full pointer-events-none justify-start z-10 text-xs font-medium text-slate-300 pt-0.5">
        {displayChampName}
        <div className="flex flex-col items-center justify-center px-4 w-full text-xs mt-0.5">
          <div className="flex gap-1.5 items-center font-normal text-slate-100 text-[11.5px]">
            {champStat ? (
              <>
                {champGames} games - <span className="text-purple-400 font-bold">{champWr}% WR</span>
              </>
            ) : (
              <span className="text-slate-400 font-normal">Sin partidas SoloQ</span>
            )}
          </div>
        </div>
      </div>

      {/* 3. SECCIÓN MEDIA-INFERIOR: TAGS + SPELLS/RUNAS + JUGADOR + RANK */}
      <div className="flex flex-col items-center justify-center w-full z-30 mt-auto">
        
        {/* TAGS INMEDIATAMENTE ARRIBA DE LA BARRA DE CONTROL */}
        {displayTags.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1 mb-4 max-w-full z-30">
            {displayTags.map((tagItem, i) => (
              <span
                key={`${tagItem.id}_${i}`}
                title={tagItem.tooltip}
                className={`
                  px-2 py-0.5 rounded-full text-[9px] font-semibold tracking-tight
                  border shadow-sm cursor-help select-none
                  ${tagItem.style || 'border-white/15 bg-black/60 text-slate-200'}
                `}
              >
                {tagItem.label}
              </span>
            ))}
          </div>
        )}

        {/* BARRA HORIZONTAL (SPELLS • LÍNEA • RUNAS) */}
        <div className="flex items-center justify-between px-2.5 z-30 gap-4 w-full relative mb-1">
          <hr className="absolute left-0 w-full border-t border-white/10 pointer-events-none z-0" />
          <div className="flex gap-1.5 items-center justify-center z-10">
            <div
              className="w-[26px] h-[26px] rounded-full overflow-hidden bg-black/80 border border-slate-700 flex items-center justify-center shadow-md"
              title={spell1?.name || 'Hechizo 1'}
            >
              {spell1?.icon ? (
                <img src={spell1.icon} alt="spell1" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[8px] font-bold text-slate-400">D</span>
              )}
            </div>
            <div
              className="w-[26px] h-[26px] rounded-full overflow-hidden bg-black/80 border border-slate-700 flex items-center justify-center shadow-md"
              title={spell2?.name || 'Hechizo 2'}
            >
              {spell2?.icon ? (
                <img src={spell2.icon} alt="spell2" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[8px] font-bold text-slate-400">F</span>
              )}
            </div>
          </div>

          {/* Posición / Línea central */}
          <div
            className="w-[32px] h-[32px] rounded-md bg-[#12131a]/90  flex items-center justify-center p-1 shadow-md z-10"
            title={`Línea: ${roleName}`}
          >
            <img
              src={roleIconUrl}
              alt={roleName}
              className="w-8 h-8 object-contain brightness-125 opacity-90"
            />
          </div>

          {/* Runas (Keystone + SubStyle) */}
          <div className="flex items-center justify-center gap-1.5 z-10">
            <div
              className="w-[26px] h-[26px] rounded-full overflow-hidden bg-black/80 border border-amber-500/40 p-0.5 flex items-center justify-center shadow-md"
              title={keystoneAsset?.name || 'Runa Principal'}
            >
              {keystoneAsset?.icon ? (
                <img src={keystoneAsset.icon} alt="keystone" className="w-full h-full object-contain" />
              ) : (
                <span className="text-[7.5px] font-mono text-amber-300 font-bold">R</span>
              )}
            </div>
            <div
              className="w-[26px] h-[26px] rounded-full overflow-hidden bg-black/80 border border-slate-700/80 p-0.5 flex items-center justify-center shadow-md"
              title={`Árbol Secundario: ${secondaryStyleId || ''}`}
            >
              {secondaryStyleIconUrl ? (
                <img src={secondaryStyleIconUrl} alt="substyle" className="w-full h-full object-contain brightness-110" />
              ) : (
                <span className="text-[7.5px] font-mono text-slate-400 font-bold">S</span>
              )}
            </div>
          </div>
        </div>

        {/* NOMBRE DEL JUGADOR */}
        <h3
          className="flex items-center justify-center text-sm md:text-[15px] font-bold text-white text-center w-full my-1.5 z-20 truncate max-w-[95%] drop-shadow-md"
          title={displayName}
        >
          {cleanSummonerName}
        </h3>

        {/* FOOTER SOLO Q CON ÍCONO DE DIVISIÓN */}
        <div className="flex items-center gap-1.5 z-10 pointer-events-none whitespace-nowrap text-xs">
          <img
            alt={soloTier}
            src={getRankIconUrl(soloTier)}
            className="w-[18px] h-[18px] object-contain shrink-0"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              const normTier = (soloTier || 'unranked').toLowerCase().trim();
              if (!target.dataset.triedShared) {
                target.dataset.triedShared = 'true';
                target.src = `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-shared-components/global/default/${normTier}.png`;
              } else if (!target.dataset.triedOpgg) {
                target.dataset.triedOpgg = 'true';
                target.src = `https://opgg-static.akamaized.net/images/medals_new/${normTier}.png`;
              } else if (!target.dataset.triedFallback) {
                target.dataset.triedFallback = 'true';
                target.src = `${MINI_CREST_BASE}unranked.svg`;
              }
            }}
          />
          <span className="font-semibold text-[11px] lg:text-xs uppercase text-blue-400">
            {soloTier !== 'UNRANKED' ? (
              <>
                {(!['MASTER', 'GRANDMASTER', 'GM', 'CHALLENGER'].includes(soloTier.toUpperCase()) && soloRank) ? `${soloRank} - ` : ''}{soloLp}
                <span className="text-[8.5px] inline ml-0.5 font-bold">LP</span>
              </>
            ) : (
              'UNRANKED'
            )}
          </span>
          {soloTier !== 'UNRANKED' && (
            <span className="text-[11px] font-medium ml-1.5 opacity-80 text-blue-400">
              {soloWinrate}
              <span className="text-[10px] inline">%</span> ({soloWins}
              <span className="text-[8.5px] inline">w-</span>
              {soloLosses}
              <span className="text-[8.5px] inline">l</span>)
            </span>
          )}
        </div>

      </div>
    </div>
  );
};