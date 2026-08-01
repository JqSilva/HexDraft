// src/components/react/PlayerCard.tsx
import React from 'react';
import { getChampionCdnName } from '../../lib/championMapper.js';
import { hydrateAsset } from '../../lib/engine/hydrator.js';

export interface PlayerData {
  puuid: string;
  riotId?: string;
  summonerName?: string;
  teamId: number;
  championId: number;
  championName: string;
  profileIconId?: number;
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
}

interface PlayerCardProps {
  player: PlayerData;
  index: number;
  isAlly: boolean;
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

export const PlayerCard: React.FC<PlayerCardProps> = ({ player: p, index }) => {
  const todayGamesCount = (p.todayRecord?.wins || 0) + (p.todayRecord?.losses || 0);
  const hasTodayGames = (p.todayRecord?.totalGames || todayGamesCount) > 0;
  
  const rankedWr = p.ranked?.winrate || 0;
  const todayWr = p.todayRecord?.winrate !== undefined && p.todayRecord?.winrate !== null ? p.todayRecord.winrate : 0;
  const displayWinrate = hasTodayGames ? todayWr : rankedWr;

  const rawChampName = p.championName || 'Champion';
  const cdnName = getChampionCdnName(rawChampName);
  const loadingUrl = `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${cdnName}_0.jpg`;
  const displayName = p.summonerName || p.riotId || 'Invocador';

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

  // Dynamic tags
  const tags: string[] = [];
  if (p.isMain) tags.push('MAIN');
  if (p.todayRecord?.streak?.type === 'win') {
    tags.push(`${p.todayRecord.streak.count} STREAK`);
  } else if (p.todayRecord?.streak?.type === 'loss') {
    tags.push(`${p.todayRecord.streak.count} L-STREAK`);
    if (p.todayRecord.streak.count >= 3) tags.push('TILTEADO');
  } else if (!hasTodayGames) {
    tags.push('1ª PARTIDA');
  } else {
    tags.push('STABLE');
  }

  return (
    <div
      key={p.puuid || `${displayName}-${index}`}
      className="h-[360px] xl:h-[380px] w-full min-w-0 flex flex-col justify-between rounded-lg p-2.5 xl:p-3.5 transition-all duration-200 relative overflow-hidden group shadow-md bg-[#08070e]"
    >
      {/* FONDO: SPLASH ART DEL CAMPEÓN + MÁSCARA OSCURA DE CONTRASTE */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <img
          src={loadingUrl}
          alt={rawChampName}
          className="w-full h-full object-cover object-top opacity-55 group-hover:scale-105 transition-transform duration-500"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            if (!target.dataset.triedCdrag) {
              target.dataset.triedCdrag = 'true';
              target.src = `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-tiles/${p.championId}/${p.championId}000.jpg`;
            }
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#06050b] via-[#06050b]/80 to-transparent" />
      </div>

      {/* CONTENIDO CON Z-10 Y RESPONSIVIDAD PARA 1366P */}
      <div className="relative z-10 flex flex-col justify-between h-full min-h-0">
        {/* DIV 1: Icono del Invocador + Nombre */}
        <div className="flex items-center gap-1.5 mb-1">
          <div className="w-7 h-7 xl:w-9 xl:h-9 rounded-full overflow-hidden border border-purple-400/60 bg-black shrink-0 shadow-md">
            <img
              src={`https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/${p.profileIconId || 29}.png`}
              alt="profile"
              className="w-full h-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                if (!target.dataset.triedDdragon) {
                  target.dataset.triedDdragon = 'true';
                  target.src = `https://ddragon.leagueoflegends.com/cdn/16.12.1/img/profileicon/${p.profileIconId || 29}.png`;
                } else {
                  target.src = 'https://ddragon.leagueoflegends.com/cdn/16.12.1/img/profileicon/29.png';
                }
              }}
            />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-xs xl:text-sm text-white truncate drop-shadow max-w-[100px] xl:max-w-[130px]" title={displayName}>
              {displayName}
            </span>
          </div>
        </div>

        {/* DIV 2: Nombre del Campeón en Titular */}
        <div className="my-0.5 xl:my-1 text-center">
          <h3 className="font-black text-lg xl:text-2xl 2xl:text-3xl text-white uppercase tracking-tight drop-shadow-lg truncate" title={rawChampName}>
            {rawChampName}
          </h3>
        </div>

        {/* DIV 3: Dos casillas de ELO Side-by-Side (Solo Q & Flex) TRANSPARENTES Y SIN BORDES */}
        <div className="grid grid-cols-2 gap-1.5 my-1">
          <div className="bg-transparent border-0 p-1 flex flex-col items-center justify-center text-center">
            <span className="text-[8px] xl:text-[9px] font-mono text-purple-400 font-bold uppercase tracking-wider">
              SOLO Q
            </span>
            <span className="text-[10px] xl:text-xs font-black text-white uppercase tracking-tight">
              {soloTier !== 'UNRANKED' ? `${soloTier} ${soloRank}` : 'UNRANKED'}
            </span>
            <span className="text-[8.5px] xl:text-[9.5px] font-mono text-purple-300/80 font-medium">
              {soloTier !== 'UNRANKED' ? `${soloLp} LP` : '-'}
            </span>
          </div>

          <div className="bg-transparent border-0 p-1 flex flex-col items-center justify-center text-center">
            <span className="text-[8px] xl:text-[9px] font-mono text-purple-400 font-bold uppercase tracking-wider">
              FLEX
            </span>
            <span className="text-[10px] xl:text-xs font-black text-white uppercase tracking-tight">
              {flexTier !== 'UNRANKED' ? `${flexTier} ${flexRank}` : 'UNRANKED'}
            </span>
            <span className="text-[8.5px] xl:text-[9.5px] font-mono text-purple-300/80 font-medium">
              {flexTier !== 'UNRANKED' ? `${flexLp} LP` : '-'}
            </span>
          </div>
        </div>

        {/* DIV 4: Espacio para Tags (FLEX-1 DINÁMICO QUE EMPUJA EL CONTENIDO) */}
        <div className="flex-1 min-h-[36px] flex items-center justify-center gap-1.5 my-1 flex-wrap">
          {tags.map((t, i) => (
            <span
              key={i}
              className="px-2 py-0.5 rounded-full bg-purple-950/90 border border-purple-700/60 text-purple-300 text-[8.5px] xl:text-[9px] font-mono font-bold uppercase shadow-sm"
            >
              {t}
            </span>
          ))}
        </div>

        {/* DIV 5: Pie de Card (Summoners, Partidas & Winrate Ring) */}
        <div className="flex items-center justify-between pt-1.5 border-t border-purple-950/80 mt-auto">
          {/* Summoners */}
          <div className="flex items-center gap-1 shrink-0">
            {spell1?.icon ? (
              <img src={spell1.icon} alt={spell1.name} title={spell1.name} className="w-4 h-4 xl:w-5 xl:h-5 rounded-sm object-cover border border-purple-900/50" />
            ) : (
              <div className="w-4 h-4 xl:w-5 xl:h-5 bg-black border border-purple-900/50 rounded-sm" />
            )}
            {spell2?.icon ? (
              <img src={spell2.icon} alt={spell2.name} title={spell2.name} className="w-4 h-4 xl:w-5 xl:h-5 rounded-sm object-cover border border-purple-900/50" />
            ) : (
              <div className="w-4 h-4 xl:w-5 xl:h-5 bg-black border border-purple-900/50 rounded-sm" />
            )}
          </div>

          {/* Partidas & Record */}
          <div className="flex flex-col items-center">
            <span className="text-[9.5px] xl:text-[10.5px] font-mono font-bold text-slate-300 drop-shadow">
              {hasTodayGames
                ? `${p.todayRecord?.wins || 0}W - ${p.todayRecord?.losses || 0}L`
                : `${p.ranked?.wins || 0}W - ${p.ranked?.losses || 0}L`}
            </span>
          </div>

          {/* Anillo de Winrate */}
          {renderWinrateRing(displayWinrate)}
        </div>
      </div>
    </div>
  );
};
