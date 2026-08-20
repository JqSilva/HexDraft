// src/components/react/PlayerCard.tsx
import React from 'react';
import { getChampionCdnName } from '../../lib/championMapper.js';
import { hydrateAsset } from '../../lib/engine/hydrator.js';
import { getNameFromId } from '../../lib/engine/constants.js';
import { getDDragonUrl } from '../../lib/gameVersion.js';
import {
  generatePlayerTags,
  filterTagsByMode,
  TAG_CONFIG,
  type PlayerTagItem,
  type PlayerTagContext
} from '../../lib/services/playerTags.service.js';

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

const renderWinrateRing = (winrate: number | null) => {
  const wr = winrate !== null && !isNaN(winrate) ? Math.min(Math.max(winrate, 0), 100) : 0;
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (wr / 100) * circumference;

  return (
    <div className="relative w-9 h-9 xl:w-10 xl:h-10 flex items-center justify-center shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
        <circle
          cx="18"
          cy="18"
          r={radius}
          stroke="#1d1630"
          strokeWidth="3"
          fill="none"
        />
        <circle
          cx="18"
          cy="18"
          r={radius}
          stroke="#a855f7"
          strokeWidth="3"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={isNaN(strokeDashoffset) ? circumference : strokeDashoffset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute font-black font-mono text-[9px] xl:text-[10px] text-white">
        {winrate !== null ? `${Math.round(winrate)}%` : '0%'}
      </span>
    </div>
  );
};

export const PlayerCard: React.FC<PlayerCardProps> = ({
  player: p,
  index = 0,
  isAlly,
  customTags,
  mode = 'normal',
  maxTags
}) => {
  const todayWins = p.todayRecord?.wins || 0;
  const todayLosses = p.todayRecord?.losses || 0;
  const displayWinrate = p.todayRecord?.winrate !== undefined && p.todayRecord?.winrate !== null ? p.todayRecord.winrate : 0;

  const rawChampName = (p.championId && getNameFromId(p.championId)) || p.championName || 'Champion';
  const cdnName = getChampionCdnName(rawChampName);

  // Extracción del número de skin de la partida en vivo (o resuelto desde croma)
  const rawSkinId = p.skinId !== undefined ? p.skinId : (p.selectedSkinId !== undefined ? p.selectedSkinId : 0);
  const skinNum = p.skinNum !== undefined ? p.skinNum : (rawSkinId > 0 ? (rawSkinId % 1000) : 0);

  // URLs de carga del splash art (específico de skin o base)
  const skinLoadingUrl = `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${cdnName}_${skinNum}.jpg`;
  const baseLoadingUrl = `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${cdnName}_0.jpg`;

  const displayName = p.summonerName || p.riotId || 'Invocador';
  const summonerName = displayName.includes('#') ? displayName.split('#')[0] : displayName;
  const summonerTag = displayName.includes('#') ? displayName.split('#')[1] : '';

  // Solo Q & Flex
  const soloTier = p.ranked?.tier || 'UNRANKED';
  const soloRank = p.ranked?.division || p.ranked?.rank || '';
  const soloLp = p.ranked?.lp !== undefined ? p.ranked.lp : (p.ranked?.leaguePoints || 0);

  const flexTier = p.rankedFlex?.tier || 'UNRANKED';
  const flexRank = p.rankedFlex?.division || p.rankedFlex?.rank || '';
  const flexLp = p.rankedFlex?.lp !== undefined ? p.rankedFlex.lp : (p.rankedFlex?.leaguePoints || 0);

  // Hechizos de invocador
  const spell1 = p.spell1Id ? hydrateAsset('summoners', p.spell1Id) : null;
  const spell2 = p.spell2Id ? hydrateAsset('summoners', p.spell2Id) : null;

  React.useEffect(() => {
    if (skinNum > 0) {
      console.log(`[PlayerCard] Invocador: ${displayName} | Campeón: ${rawChampName} | Skin activa: #${skinNum} (${skinLoadingUrl})`);
    }
  }, [skinNum, rawChampName, displayName, skinLoadingUrl]);

  // Generación de etiquetas con el nuevo motor
  let computedTagItems: PlayerTagItem[] = [];

  if (customTags && customTags.length > 0) {
    computedTagItems = customTags.map((tagText, idx) => ({
      id: `custom_${idx}`,
      label: tagText,
      category: 'general',
      priority: 50,
      style: 'border-purple-400/50 text-purple-200 bg-purple-950/30',
      tooltip: 'Etiqueta personalizada del invocador.'
    }));
  } else {
    const ctx: PlayerTagContext = {
      puuid: p.puuid,
      summonerName: displayName,
      championId: p.championId,
      championName: rawChampName,
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

  // Filtrar según modo (Normal: 3-6 tags, Compacto: 2-3 tags prioritarios)
  const displayTags = filterTagsByMode(computedTagItems, maxTags ?? mode);

  const [imageLoaded, setImageLoaded] = React.useState<boolean>(false);

  React.useEffect(() => {
    setImageLoaded(false);
  }, [skinLoadingUrl]);

  return (
    <div
      key={p.puuid || `${displayName}-${index}`}
      className="h-full min-h-[230px] max-h-[390px] w-full max-w-[288px] min-w-0 flex flex-col justify-between rounded-lg p-2.5 xl:p-3.5 transition-all duration-200 relative overflow-hidden group shadow-md bg-[#08070e]"
    >
      {/* FONDO: SPLASH ART DE LA SKIN SELECCIONADA + MÁSCARA OSCURA DE CONTRASTE */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none bg-[#07060c]">
        {!imageLoaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#07060c] text-purple-400/70 z-1">
            <svg className="w-6 h-6 animate-spin text-purple-500/60" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" />
              <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          </div>
        )}
        <img
          src={skinLoadingUrl}
          alt={rawChampName}
          className={`w-full h-full object-cover object-top transition-opacity duration-300 ${
            imageLoaded ? 'opacity-55' : 'opacity-0'
          }`}
          onLoad={() => {
            setImageLoaded(true);
            if (skinNum > 0) {
              console.log(`%c[PlayerCard Skin]%c Cargada exitosamente skin #${skinNum} para ${rawChampName} (${displayName})`, 'color: #a855f7; font-weight: bold;', 'color: #e2e8f0;');
            }
          }}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            // 1. Si falló la skin específica, intentar cargar la skin base (_0.jpg)
            if (!target.dataset.triedBase && target.src !== baseLoadingUrl) {
              target.dataset.triedBase = 'true';
              console.warn(`[PlayerCard Fallback] Falló la imagen de skin #${skinNum} para ${rawChampName} (${displayName}). Aplicando fallback a skin base.`);
              target.src = baseLoadingUrl;
            } else if (!target.dataset.triedCdrag && p.championId > 0) {
              // 2. Intentar CommunityDragon
              target.dataset.triedCdrag = 'true';
              console.warn(`[PlayerCard Fallback] Falló skin base en DDragon para ${rawChampName}. Aplicando fallback a CommunityDragon.`);
              target.src = `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-tiles/${p.championId}/${p.championId}000.jpg`;
            } else if (!target.dataset.triedFallback) {
              // 3. Fallback genérico final
              target.dataset.triedFallback = 'true';
              console.error(`[PlayerCard Fallback] Error total al cargar splash art de ${rawChampName}. Usando fallback genérico Garen_0.jpg`);
              target.src = `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/Garen_0.jpg`;
            }
          }}
        />
        {/* Gradiente vertical para asegurar legibilidad total sin desenfoques */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#06050b]/75 via-transparent to-[#06050b]/95" />
      </div>

      {/* CONTENIDO */}
      <div className="relative z-10 flex flex-col justify-between h-full min-h-0">
        {/* BLOQUE SUPERIOR: Icono + Nombre */}
        <div className="flex items-center gap-1.5 xl:gap-2 shrink-0">
          <div className="w-7 h-7 xl:w-9 xl:h-9 rounded-full overflow-hidden border-2 border-purple-400/60 bg-black shrink-0 shadow-md">
            <img
              src={p.profileIconUrl || `https://opgg-static.akamaized.net/meta/images/profile_icons/profileIcon${p.profileIconId || 29}.jpg?image=q_auto:good,f_webp,w_200`}
              alt="profile"
              className="w-full h-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                if (!target.dataset.triedCdrag) {
                  target.dataset.triedCdrag = 'true';
                  target.src = `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/${p.profileIconId || 29}.png`;
                } else if (!target.dataset.triedDdragon) {
                  target.dataset.triedDdragon = 'true';
                  target.src = getDDragonUrl('profileicon', p.profileIconId || 29);
                } else if (!target.dataset.triedDefault) {
                  target.dataset.triedDefault = 'true';
                  target.src = getDDragonUrl('profileicon', 29);
                }
              }}
            />
          </div>
          <span className="font-bold text-xs xl:text-sm truncate drop-shadow text-white/90" title={displayName}>
            {summonerName} {summonerTag ? <span className="text-purple-400">#{summonerTag}</span> : null}
          </span>
        </div>

        <div className="flex-1 min-h-0" />

        <div className="space-y-1.5 xl:space-y-2 shrink-0">
          {/* Nombre del campeón como caption, con indicador de línea/rol */}
          <div className="flex items-center gap-1.5 xl:gap-2 justify-center">
            <span className="h-px flex-1 max-w-[20px] bg-purple-400/30" />
            <h3 className="text-[9px] xl:text-[11px] font-semibold text-white/70 uppercase tracking-[0.15em] drop-shadow-lg whitespace-nowrap flex items-center gap-1">
              <span>{rawChampName}</span>
              {p.role && (
                <span className="text-purple-400 font-mono font-bold text-[8.5px] xl:text-[9.5px]">
                  [{p.role}]
                </span>
              )}
            </h3>
            <span className="h-px flex-1 max-w-[20px] bg-purple-400/30" />
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <div className="flex flex-col items-center justify-center text-center bg-[#0f0e17]/70 rounded-xl py-1.5 border border-purple-950/40">
              <span className="text-[8px] xl:text-[9px] font-mono text-purple-400 font-bold uppercase tracking-wider">
                SOLO Q
              </span>
              <span className="text-[10px] xl:text-xs font-semibold text-white/80 uppercase tracking-wide">
                {soloTier !== 'UNRANKED' ? `${soloTier} ${soloRank}` : 'UNRANKED'}
              </span>
              <span className="text-[8.5px] xl:text-[9.5px] font-mono text-purple-300/80 font-medium">
                {soloTier !== 'UNRANKED' ? `${soloLp} LP` : '-'}
              </span>
            </div>

            <div className="flex flex-col items-center justify-center text-center bg-[#0f0e17]/70 rounded-xl py-1.5 border border-purple-950/40">
              <span className="text-[8px] xl:text-[9px] font-mono text-purple-400 font-bold uppercase tracking-wider">
                FLEX
              </span>
              <span className="text-[10px] xl:text-xs font-semibold text-white/80 uppercase tracking-wide">
                {flexTier !== 'UNRANKED' ? `${flexTier} ${flexRank}` : 'UNRANKED'}
              </span>
              <span className="text-[8.5px] xl:text-[9.5px] font-mono text-purple-300/80 font-medium">
                {flexTier !== 'UNRANKED' ? `${flexLp} LP` : '-'}
              </span>
            </div>
          </div>

          {/* ETIQUETAS DINÁMICAS (MODO RESPONSIVE) */}
          {displayTags.length > 0 && (
            <div className="flex items-center justify-center gap-1 flex-wrap pt-0.5">
              {displayTags.map((tagItem, i) => (
                <span
                  key={`${tagItem.id}_${i}`}
                  title={tagItem.tooltip}
                  className={`
                    px-1.5 py-0.5 rounded text-[8px] xl:text-[8.5px] font-mono font-bold uppercase tracking-wider
                    border flex items-center shadow-xs cursor-help transition-colors select-none
                    ${tagItem.style}
                  `}
                >
                  {tagItem.label}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between pt-1.5 border-t border-purple-950/80">
            <span className="text-xs xl:text-[11px] font-mono font-bold text-slate-300 drop-shadow">
              {`${todayWins}W - ${todayLosses}L`}
            </span>

            {renderWinrateRing(displayWinrate)}
          </div>
        </div>
      </div>
    </div>
  );
};
