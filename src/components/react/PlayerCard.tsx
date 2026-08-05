// src/components/react/PlayerCard.tsx
import React from 'react';
import { getChampionCdnName } from '../../lib/championMapper.js';
import { hydrateAsset } from '../../lib/engine/hydrator.js';
import { getNameFromId } from '../../lib/engine/constants.js';
import { getDDragonUrl } from '../../lib/gameVersion.js';

export interface PlayerData {
  puuid: string;
  riotId?: string;
  summonerName?: string;
  teamId: number;
  championId: number;
  championName: string;
  profileIconId?: number;
  profileIconUrl?: string;
  spell1Id?: number;
  spell2Id?: number;
  keystoneId?: number;
  secondaryStyleId?: number;
  role?: string;
  isMain?: boolean;
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
    streak: {
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
}

interface PlayerCardProps {
  player: PlayerData;
  index?: number;
  isAlly?: boolean;
  customTags?: string[];
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

function getTagInfo(tag: string, p: PlayerData): { label: string; tooltip: string; style: string } {
  const upper = tag.toUpperCase().trim();
  const kdaText = p.lastMatchKda ? ` (${p.lastMatchKda})` : '';

  if (upper.includes('TILTEADO')) {
    const streak = p.todayRecord?.streak?.count || 3;
    const kdaMsg = p.lastMatchKda ? `Este jugador salió ${p.lastMatchKda} la partida anterior` : 'Este jugador tiene una racha negativa';
    return {
      label: 'TILTEADO',
      tooltip: `${kdaMsg} y acumula ${streak} derrotas seguidas.`,
      style: 'border-red-500/50 text-red-300'
    };
  }

  if (upper.includes('WIN STREAK')) {
    const streak = p.todayRecord?.streak?.count || 0;
    return {
      label: tag,
      tooltip: `Este jugador lleva una racha de ${streak > 0 ? streak : 'varias'} partidas ganadas seguidas.`,
      style: 'border-amber-400/50 text-amber-300'
    };
  }

  if (upper.includes('LOSS STREAK')) {
    const streak = p.todayRecord?.streak?.count || 0;
    return {
      label: tag,
      tooltip: `Este jugador lleva una racha de ${streak > 0 ? streak : 'varias'} partidas perdidas seguidas${kdaText}.`,
      style: 'border-cyan-400/50 text-cyan-300'
    };
  }

  if (upper === 'MVP') {
    return {
      label: 'MVP',
      tooltip: `Este jugador obtuvo el mejor puntaje de la partida anterior${kdaText}.`,
      style: 'border-amber-400/50 text-amber-300'
    };
  }

  if (upper === 'ACE') {
    return {
      label: 'ACE',
      tooltip: `Este jugador fue el mejor de su equipo${kdaText} a pesar de perder la partida anterior.`,
      style: 'border-purple-400/50 text-purple-200'
    };
  }

  if (upper.startsWith('MAIN')) {
    const mainChamp = p.topChampions?.find(c => upper.includes(c.name.toUpperCase()));
    const detail = mainChamp ? ` (${mainChamp.wins}V - ${mainChamp.losses}D, ${mainChamp.winrate}% WR)` : '';
    return {
      label: tag,
      tooltip: `Invocador frecuente con este campeón${detail}.`,
      style: 'border-purple-400/50 text-purple-200'
    };
  }

  if (upper === '1ª PARTIDA') {
    return {
      label: '1ª PARTIDA',
      tooltip: 'Este jugador aún no registra partidas hoy.',
      style: 'border-slate-400/50 text-slate-300'
    };
  }

  if (upper === 'CONSISTENTE') {
    const scoreText = p.opScoreAvg ? ` de ${p.opScoreAvg}` : '';
    return {
      label: 'CONSISTENTE',
      tooltip: `Mantiene un puntaje promedio${scoreText} alto en sus últimas partidas.`,
      style: 'border-emerald-400/50 text-emerald-300'
    };
  }

  if (upper === 'HIGH WR') {
    const wr = p.ranked?.winrate || 0;
    const wins = p.ranked?.wins || 0;
    const losses = p.ranked?.losses || 0;
    return {
      label: 'HIGH WR',
      tooltip: `Invocador con ${wr}% de victorias (${wins}V - ${losses}D en partidas clasificatorias).`,
      style: 'border-emerald-400/50 text-emerald-300'
    };
  }

  if (upper.includes('STREAMER') || upper.includes('ANÓNIMO')) {
    return {
      label: 'MODO STREAMER',
      tooltip: 'Nombre de invocador e información ocultos por modo streamer.',
      style: 'border-slate-500/50 text-slate-300'
    };
  }

  return {
    label: tag,
    tooltip: 'Etiqueta de rendimiento del jugador.',
    style: 'border-purple-400/50 text-purple-200'
  };
}

export const PlayerCard: React.FC<PlayerCardProps> = ({ player: p, index = 0, customTags }) => {
  const todayWins = p.todayRecord?.wins || 0;
  const todayLosses = p.todayRecord?.losses || 0;
  const hasTodayGames = (todayWins + todayLosses) > 0;
  const displayWinrate = p.todayRecord?.winrate !== undefined && p.todayRecord?.winrate !== null ? p.todayRecord.winrate : 0;

  const rawChampName = (p.championId && getNameFromId(p.championId)) || p.championName || 'Champion';
  const cdnName = getChampionCdnName(rawChampName);
  const loadingUrl = `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${cdnName}_0.jpg`;
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

  // Dynamic or Custom tags in Spanglish
  let tags: string[] = [];
  if (customTags && customTags.length > 0) {
    tags = customTags;
  } else {
    if (p.isMain) tags.push('MAIN');
    if (p.todayRecord?.streak?.type === 'win' && p.todayRecord.streak.count >= 3) {
      tags.push(`WIN STREAK ${p.todayRecord.streak.count}W`);
    } else if (p.todayRecord?.streak?.type === 'loss' && p.todayRecord.streak.count >= 3) {
      tags.push(`LOSS STREAK ${p.todayRecord.streak.count}L`);
      tags.push('TILTEADO');
    } else if (!hasTodayGames) {
      tags.push('1ª PARTIDA');
    } else {
      tags.push('STABLE');
    }
  }

  return (
    <div
      key={p.puuid || `${displayName}-${index}`}
      className="h-full min-h-[230px] max-h-[380px] w-full max-w-[288px] min-w-0 flex flex-col justify-between rounded-lg p-2.5 xl:p-3.5 transition-all duration-200 relative overflow-hidden group shadow-md bg-[#08070e]"
    >
      {/* FONDO: SPLASH ART DEL CAMPEÓN + MÁSCARA OSCURA DE CONTRASTE */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <img
          src={loadingUrl}
          alt={rawChampName}
          className="w-full h-full object-cover object-top opacity-55 group-hover:scale-105 transition-transform duration-500"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            if (!target.dataset.triedCdrag && p.championId > 0) {
              target.dataset.triedCdrag = 'true';
              target.src = `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-tiles/${p.championId}/${p.championId}000.jpg`;
            } else if (!target.dataset.triedFallback) {
              target.dataset.triedFallback = 'true';
              target.src = `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/Garen_0.jpg`;
            }
          }}
        />
        {/* Gradiente más suave arriba (deja ver más splash) y fuerte abajo (contraste para el footer) */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#06050b]/70 via-transparent to-[#06050b]/95" />
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
            <div className="flex flex-col items-center justify-center text-center bg-[#0f0e17]/70 rounded-xl py-1.5">
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

            <div className="flex flex-col items-center justify-center text-center bg-[#0f0e17]/70 rounded-xl py-1.5">
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
          {tags.length > 0 && (
            <div className="flex items-center justify-center gap-1.5 flex-wrap">
              {tags.map((t, i) => {
                const info = getTagInfo(t, p);
                return (
                  <span
                    key={i}
                    title={info.tooltip}
                    className={`
                      px-2 py-0.5 rounded-md text-[9px] xl:text-[8.5px] font-mono font-semibold uppercase tracking-wider
                      bg-black/80 border flex items-center shadow-sm cursor-help transition-colors duration-150
                      ${info.style}
                    `}
                  >
                    {info.label}
                  </span>
                );
              })}
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
