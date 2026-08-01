// src/components/react/PlayerCard.tsx
import React from 'react';
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
    division: string;
    lp: number;
    wins: number;
    losses: number;
    winrate: number;
  };
  todayRecord?: {
    wins: number;
    losses: number;
    winrate: number;
    streak: {
      type: 'win' | 'loss' | null;
      count: number;
    };
  };
}

interface PlayerCardProps {
  player: PlayerData;
  isAlly: boolean;
}

function formatChampDDragonName(name: string): string {
  if (!name) return 'Aatrox';
  const clean = name.replace(/['\s.]/g, '');
  const specialMap: Record<string, string> = {
    'Wukong': 'MonkeyKing',
    'LeBlanc': 'Leblanc',
    'KhaZix': 'Khazix',
    'ChoGath': 'Chogath',
    'VelKoz': 'Velkoz',
    'BelVeth': 'Belveth',
    'NunuWillump': 'Nunu'
  };
  return specialMap[clean] || clean;
}

const WinrateRing: React.FC<{ percentage: number }> = ({ percentage }) => {
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative w-11 h-11 flex items-center justify-center shrink-0">
      <svg className="w-11 h-11 transform -rotate-90">
        <circle
          cx="22"
          cy="22"
          r={radius}
          stroke="#261b38"
          strokeWidth="3"
          fill="transparent"
        />
        <circle
          cx="22"
          cy="22"
          r={radius}
          stroke="#a855f7"
          strokeWidth="3"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={isNaN(strokeDashoffset) ? circumference : strokeDashoffset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-[10px] font-black text-white">
        {percentage}%
      </span>
    </div>
  );
};

export const PlayerCard: React.FC<PlayerCardProps> = ({ player, isAlly }) => {
  const champSlug = formatChampDDragonName(player.championName);
  const splashUrl = `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${champSlug}_0.jpg`;
  const iconUrl = player.profileIconId
    ? `https://ddragon.leagueoflegends.com/cdn/16.9.1/img/profileicon/${player.profileIconId}.png`
    : `https://ddragon.leagueoflegends.com/cdn/16.9.1/img/champion/${champSlug}.png`;

  const spell1 = player.spell1Id ? hydrateAsset('summoners', player.spell1Id) : null;
  const spell2 = player.spell2Id ? hydrateAsset('summoners', player.spell2Id) : null;
  const keystone = player.keystoneId ? hydrateAsset('runes', player.keystoneId) : null;

  const ranked = player.ranked || { tier: 'UNRANKED', division: '', lp: 0, wins: 0, losses: 0, winrate: 0 };
  const today = player.todayRecord || { wins: 0, losses: 0, winrate: 0, streak: { type: null, count: 0 } };

  const eloDisplay = ranked.tier !== 'UNRANKED'
    ? `${ranked.tier} ${ranked.division} • ${ranked.lp} LP`
    : 'UNRANKED';

  const displayWinrate = today.wins > 0 || today.losses > 0 ? today.winrate : ranked.winrate;

  const streakText = today.streak.type === 'win'
    ? `RACHA ${today.streak.count}W`
    : today.streak.type === 'loss'
    ? `RACHA ${today.streak.count}L`
    : (today.wins > 0 || today.losses > 0 ? 'HOY' : 'GENERAL');

  return (
    <div className="relative w-full h-full min-h-[360px] rounded-xl overflow-hidden bg-[#0a0812] border border-purple-900/30 hover:border-purple-600/60 flex flex-col justify-between p-4 shadow-xl select-none group transition-all duration-300">
      {/* Fondo de campeón con Fade vertical de splash art a color oscuro */}
      <div
        className="absolute top-0 left-0 right-0 h-[70%] bg-cover bg-center bg-no-repeat opacity-50 group-hover:opacity-70 transition-opacity duration-500"
        style={{ backgroundImage: `url(${splashUrl})` }}
      />
      {/* Degradado para desvanecer suavemente hacia abajo (fade) */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0812]/40 via-[#0a0812]/75 to-[#0a0812] pointer-events-none" />

      {/* Cabecera: Avatar circular, Nombre del Invocador y Elo */}
      <div className="relative z-10 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full border-2 border-purple-500/40 overflow-hidden bg-black shrink-0 shadow-md">
          <img
            src={iconUrl}
            alt="Icon"
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://ddragon.leagueoflegends.com/cdn/16.9.1/img/champion/${champSlug}.png`;
            }}
          />
        </div>

        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <h4 className="text-xs font-bold text-white truncate leading-snug">
              {player.riotId || player.summonerName || 'Invocador'}
            </h4>
            {player.isMain && (
              <span className="shrink-0 bg-amber-500/20 border border-amber-500/50 text-amber-300 text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full">
                MAIN
              </span>
            )}
          </div>
          <p className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider truncate">
            {eloDisplay}
          </p>
        </div>
      </div>

      {/* Cuerpo Central: Nombre del Campeón, Rol pill, Hechizos y Runas */}
      <div className="relative z-10 flex flex-col items-center justify-center my-auto text-center gap-2 pt-4">
        <h3 className="text-2xl lg:text-3xl font-black text-white uppercase tracking-wider drop-shadow-lg">
          {player.championName}
        </h3>

        {/* Rol Pill en color púrpura redondeado */}
        <div className="inline-flex items-center justify-center bg-[#6b21a8] border border-[#a855f7]/50 text-white text-[9px] font-black uppercase px-3 py-0.5 rounded-full tracking-widest shadow-sm">
          {player.role || 'MID'}
        </div>

        {/* Iconos de Hechizos de Invocador y Runa Keystone */}
        <div className="flex items-center justify-center gap-1.5 bg-[#120e1f]/80 border border-purple-900/50 px-2.5 py-1 rounded-md mt-1">
          {spell1?.icon && (
            <img src={spell1.icon} alt={spell1.name} title={spell1.name} className="w-5 h-5 rounded-sm object-cover" />
          )}
          {spell2?.icon && (
            <img src={spell2.icon} alt={spell2.name} title={spell2.name} className="w-5 h-5 rounded-sm object-cover" />
          )}
          {keystone?.icon && (
            <img src={keystone.icon} alt={keystone.name} title={keystone.name} className="w-5 h-5 rounded-full object-cover bg-black p-0.5 border border-purple-500/40" />
          )}
        </div>
      </div>

      {/* Pie de Card: Record W-L, Texto de Estado/Racha y Anillo Circular de Winrate */}
      <div className="relative z-10 pt-3 border-t border-purple-900/30 flex items-center justify-between mt-auto">
        <div className="flex flex-col">
          <span className="text-xs font-black text-white tracking-wide">
            {today.wins > 0 || today.losses > 0 ? `${today.wins}W - ${today.losses}L` : `${ranked.wins}W - ${ranked.losses}L`}
          </span>
          <span className="text-[9px] font-bold text-purple-400 uppercase tracking-widest mt-0.5">
            {streakText}
          </span>
        </div>

        {/* Anillo de Winrate en formato SVG circular */}
        <WinrateRing percentage={displayWinrate} />
      </div>
    </div>
  );
};
