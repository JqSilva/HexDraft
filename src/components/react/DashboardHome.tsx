import React, { useState, useEffect } from 'react';
import { getNameFromId } from '../../lib/engine/core/constants';
import metaCache from '../../lib/data/meta-cache.json';
import { getChampionCdnName } from '../../lib/championMapper';
import { RankBadge } from './common/RankBadge';

// Interfaces para tipar la respuesta del API
interface RankedStats {
  tier: string;
  division: string;
  lp: number;
  wins: number;
  losses: number;
}

interface ChampionMastery {
  championId: number;
  level: number;
  points: number;
}

interface MatchData {
  championId: number;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  csPerMin: string;
  timeAgo: string;
  gameMode: string;
  lane?: string;
}

interface SummonerData {
  isConnected: boolean;
  gameVersion: string;
  summoner: string;
  level: number;
  xpPercent: number;
  xpCurrent: number;
  xpMax: number;
  profileIconId: number;
  ranked: RankedStats;
  rankedFlex?: RankedStats;
  mastery: ChampionMastery[];
  matches: MatchData[];
  error?: string;
}


const getChampionRole = (name: string): string => {
  const roles: Record<string, string> = {
    "Zed": "Asesino / Mid",
    "Yasuo": "Luchador / Mid",
    "Ahri": "Mago / Mid",
    "Jinx": "Tirador / ADC",
    "Lee Sin": "Luchador / Jungla",
    "Lux": "Mago / Soporte",
    "Garen": "Luchador / Top",
    "Viego": "Asesino / Jungla",
    "Yone": "Asesino / Mid",
    "Aatrox": "Luchador / Top",
    "Katarina": "Asesino / Mid",
    "Akali": "Asesino / Mid",
    "Thresh": "Soporte / Bot",
    "Teemo": "Mago / Top",
  };
  return roles[name] || "Luchador";
};

// Datos por defecto (mock) cuando LCU está offline
const DEFAULT_SUMMONER: SummonerData = {
  isConnected: false,
  gameVersion: "14.9.1",
  summoner: "Sin conexión",
  level: 128,
  xpPercent: 43,
  xpCurrent: 12450,
  xpMax: 28950,
  profileIconId: 29,
  ranked: {
    tier: "—",
    division: "—",
    lp: 0,
    wins: 0,
    losses: 0
  },
  rankedFlex: {
    tier: "DIAMOND",
    division: "IV",
    lp: 22,
    wins: 45,
    losses: 38
  },
  mastery: [
    { championId: 238, level: 7, points: 248500 },
    { championId: 157, level: 7, points: 185200 },
    { championId: 103, level: 6, points: 92000 },
    { championId: 222, level: 5, points: 45100 }
  ],
  matches: [
    { championId: 238, win: true, kills: 14, deaths: 2, assists: 8, csPerMin: "8.2", timeAgo: "24m hace", gameMode: "CLASSIC" },
    { championId: 157, win: false, kills: 4, deaths: 7, assists: 2, csPerMin: "6.8", timeAgo: "2h hace", gameMode: "CLASSIC" },
    { championId: 103, win: true, kills: 9, deaths: 1, assists: 12, csPerMin: "7.3", timeAgo: "5h hace", gameMode: "CLASSIC" },
    { championId: 238, win: true, kills: 18, deaths: 3, assists: 9, csPerMin: "8.5", timeAgo: "Ayer", gameMode: "CLASSIC" }
  ]
};

export const DashboardHome = () => {
  const [data, setData] = useState<SummonerData>(DEFAULT_SUMMONER);
  const [isLcuChecking, setIsLcuChecking] = useState(true);

  // Polling para sincronizar con LCU
  useEffect(() => {
    const fetchSummonerData = async () => {
      try {
        const res = await fetch('/api/me');
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (e) {
        console.error("Error conectando con API /api/me:", e);
      } finally {
        setIsLcuChecking(false);
      }
    };

    fetchSummonerData();
    const interval = setInterval(fetchSummonerData, 4000);
    return () => clearInterval(interval);
  }, []);

  const summonerName = data.summoner;
  const profileIconId = data.profileIconId;
  const ranked = data.ranked;
  const masteryList = data.mastery.slice(0, 4);
  const matchesList = data.matches || DEFAULT_SUMMONER.matches;

  // Calcular victorias totales y winrate
  const totalGames = ranked.wins + ranked.losses;
  const winRate = totalGames > 0 ? ((ranked.wins / totalGames) * 100).toFixed(1) : "50.0";

  // Retornar clase para el color del Tier de League of Legends
  const getTierColor = (tier: string) => {
    switch (tier.toUpperCase()) {
      case 'CHALLENGER': return 'text-red-500';
      case 'GRANDMASTER': return 'text-rose-500';
      case 'MASTER': return 'text-purple-accent';
      case 'DIAMOND': return 'text-sky-400';
      case 'PLATINUM': return 'text-emerald-400';
      case 'EMERALD': return 'text-green-400';
      case 'GOLD': return 'text-yellow-400';
      case 'SILVER': return 'text-slate-300';
      case 'BRONZE': return 'text-amber-700';
      case 'IRON': return 'text-zinc-500';
      default: return 'text-slate-400';
    }
  };

  return (
    <div className="w-full h-full flex flex-col gap-7 p-6 md:p-9 animate-in fade-in duration-300 overflow-y-auto">
      {/* TOP BAR */}
      <header className="relative flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-warm pb-4">
        <div>
          <span className="text-xs tracking-wide font-medium text-slate-500">Resumen de tu cuenta</span>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-white uppercase tracking-tight">{summonerName}</h1>
            <RankBadge tier={ranked.tier} division={ranked.division} />
          </div>
        </div>

        {/* LCU connection status indicator */}
        <div 
          className={`flex items-center justify-center gap-2 mt-3 md:mt-0 px-3 py-2 bg-panel-warm border border-border-warm rounded-lg text-xs tracking-wide font-medium ${
            data.isConnected ? 'text-green-500' : 'text-slate-400'
          } md:absolute md:-translate-x-1/2 md:-translate-y-1/2`}
          style={{
            left: 'var(--header-status-left)',
            top: 'var(--header-status-top)',
            transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          <span className={`w-2 h-2 rounded-full ${data.isConnected ? 'bg-green-500' : 'bg-slate-600'}`}></span>
          {isLcuChecking ? 'Comprobando conexión…' : data.isConnected ? 'Conectado al cliente' : 'Cliente no conectado'}
        </div>

        {/* Icons and profile */}
        <div className="flex items-center gap-4 self-end md:self-auto">
          {/* Summoner Avatar */}
          <div className="relative">
            <img
              src={`https://ddragon.leagueoflegends.com/cdn/${data.gameVersion || "14.9.1"}/img/profileicon/${profileIconId}.png`}
              alt="Summoner Icon"
              className="w-10 h-10 rounded-full border border-border-warm bg-black object-cover scale-[1.06] select-none shadow-sm"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/favicon.svg";
              }}
            />
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-[#070709] shadow-md"></span>
          </div>
        </div>
      </header>

      {/* HERO SECTION & TOP CHAMPIONS ROW */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">

        {/* A. Hero Banner Card */}
        <div className="md:col-span-7 lg:col-span-8 dashboard-hero border border-border-warm rounded-2xl relative overflow-hidden flex flex-row items-center justify-between p-7 md:p-10 min-h-[320px] md:min-h-[350px] group">

          {/* Left: Text Content & Actions */}
          <div className="flex flex-col z-10 gap-4 w-full md:w-[62%] justify-center h-full">
            <div className="flex items-center gap-2 text-sm font-semibold text-purple-accent select-none">
              <span className="w-5 h-px bg-purple-accent" aria-hidden="true"></span>
              <span>Asistente de draft</span>
            </div>
            <h2 className="max-w-[12ch] text-4xl md:text-6xl font-semibold text-white tracking-[-0.035em] leading-[0.94]">
              Decide con claridad
            </h2>
            <p className="text-sm md:text-base text-slate-300 leading-relaxed max-w-[42ch]">
              Recomendaciones de picks, bans, runas y builds en un solo lugar.
            </p>
            <p className="text-sm text-slate-400 leading-relaxed max-w-[48ch]">
              Conecta HexDraft con tu cliente de League of Legends para entender el contexto de la partida y actuar sin perder tiempo.
            </p>
            <div className="relative z-10 flex flex-col sm:flex-row gap-3 pt-2 items-start sm:items-center">
              <a
                href="/draft"
                className="min-h-11 px-5 py-2.5 bg-purple-accent text-white text-sm font-semibold hover:bg-purple-accent-hover transition-colors duration-200 rounded-lg cursor-pointer border border-purple-accent text-center"
              >
                Abrir draft
              </a>

              <a
                href="/actualizar"
                className="btn-quiet min-h-11 px-5 py-2.5 text-slate-300 hover:text-white text-sm font-medium cursor-pointer text-center"
              >
                Actualizar datos
              </a>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-5 mt-1 border-t border-white/[0.08] text-[11px] text-slate-400">
              <span><strong className="font-semibold text-slate-200">Picks y bans</strong> recomendados</span>
              <span><strong className="font-semibold text-slate-200">Runas y builds</strong> situacionales</span>
              <span><strong className="font-semibold text-slate-200">Contexto</strong> de partida</span>
            </div>
          </div>

          {/* Right: Centered Logo Illustration */}
          <div className="flex items-center justify-center w-[34%] relative select-none z-10 h-full">
            <img 
              src="/favicon.svg" 
              alt="HexDraft Logo" 
              className="w-40 h-40 md:w-56 md:h-56 lg:w-64 lg:h-64 object-contain block relative transition-transform duration-500 hover:scale-105"
            />
          </div>
        </div>

        {/* B. Top Champions / Collection List */}
        <div className="md:col-span-5 lg:col-span-4 dashboard-panel border border-border-warm rounded-xl p-5 flex flex-col justify-between min-h-[320px] md:min-h-[350px]">
          <div className="flex justify-between items-center mb-3 pb-2 border-b border-border-warm">
            <span className="text-sm font-semibold text-white">Maestría de campeones</span>
            <a href="/champions" className="text-xs font-medium text-purple-accent hover:text-purple-accent-hover hover:underline">Ver todos</a>
          </div>

          {/* List of 4 champions */}
          <div className="space-y-2.5 flex-1 flex flex-col justify-center">
            {masteryList.map((m, index) => {
              const champId = m.championId;
              const points = m.points;
              const lvl = m.level;
              const name = getNameFromId(champId) || "Campeón";
              const role = getChampionRole(name);
              const progressWidth = index === 0 ? 92 : index === 1 ? 72 : index === 2 ? 61 : 48;

              return (
                <div key={champId} className="flex items-center gap-3 group hover:bg-white/[0.01] p-1 rounded transition-colors duration-200">
                  <img
                    src={`https://ddragon.leagueoflegends.com/cdn/${data.gameVersion || "14.9.1"}/img/champion/${getChampionCdnName(name)}.png`}
                    alt={name}
                    className="w-9 h-9 rounded-lg border border-border-warm select-none object-cover scale-[1.06] shadow-sm group-hover:border-purple-accent/50 transition-colors duration-200"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/favicon.svg";
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <span className="text-sm font-semibold text-white group-hover:text-purple-accent-hover transition-colors duration-200">{name}</span>
                      <span className="text-[10px] font-mono font-bold text-slate-400">{points.toLocaleString()} PTS</span>
                    </div>
                    <span className="block text-xs text-slate-500 tracking-wide font-medium mb-1">{role}</span>
                    {/* Horizontal progress bar */}
                    <div className="w-full bg-input-warm h-1 rounded-full overflow-hidden border border-border-warm relative">
                      <div
                        className="bg-purple-accent h-full rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${progressWidth}%` }}
                      ></div>
                    </div>
                  </div>
                  {/* Mastery Level Badge */}
                  <div className="w-7 h-7 flex items-center justify-center rounded-md border border-purple-accent/30 bg-purple-accent/10 text-xs font-mono font-semibold text-purple-accent-hover group-hover:bg-purple-accent/15 transition-colors duration-200 select-none">
                    L{lvl}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* BOTTOM SECTIONS: RECENT MATCHES, PLAYER PROFILE, ACCLAIMS */}
      <div className="grid grid-cols-1 md:grid-cols-12 lg:grid-cols-12 gap-4">

        {/* A. Recent Matches (Bottom Left Grid) */}
        <div className="md:col-span-12 lg:col-span-5 dashboard-panel border border-border-warm rounded-xl p-5 flex flex-col justify-between">
          <div className="flex justify-between items-center mb-3 pb-2 border-b border-border-warm">
            <span className="text-sm font-semibold text-white">Historial reciente</span>
            <a href="/history" className="text-xs font-medium text-purple-accent hover:text-purple-accent-hover hover:underline">Ver partidas</a>
          </div>

          {/* Matches list */}
          <div className="grid grid-cols-2 gap-3">
            {matchesList.map((match, idx) => {
              const name = getNameFromId(match.championId) || "Campeón";
              const role = getChampionRole(name);
              const borderClass = match.win ? "border-green-500/25 hover:border-green-500/40" : "border-red-500/25 hover:border-red-500/40";
              const badgeBg = match.win ? "bg-green-500/10 border-green-500/30 text-green-500" : "bg-red-500/10 border-red-500/30 text-red-500";
              const displayLane = match.lane || role.split(' / ')[1] || 'MID';

              return (
                <div key={idx} className={`bg-[#08080b] border ${borderClass} p-3 rounded flex flex-col justify-between items-center text-center transition-all duration-300 relative group`}>
                  <div className={`absolute top-0.5 left-0.5 w-1.5 h-1.5 border-t border-l ${match.win ? 'border-green-500' : 'border-red-500'}`}></div>
                  <div className={`absolute top-2.5 right-2.5 border ${badgeBg} text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-sm select-none`}>
                    {match.win ? 'VICTORIA' : 'DERROTA'}
                  </div>

                  {/* Champion portrait icon */}
                  <div className="w-10 h-10 rounded-xl border border-border-warm overflow-hidden mb-1.5 mt-1.5 shadow-sm group-hover:border-purple-accent/50 group-hover:scale-105 transition-all duration-200">
                    <img
                      src={`https://ddragon.leagueoflegends.com/cdn/${data.gameVersion || "14.9.1"}/img/champion/${getChampionCdnName(name)}.png`}
                      alt={name}
                      className="w-full h-full object-cover scale-[1.08] select-none"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/favicon.svg";
                      }}
                    />
                  </div>
                  <div>
                    <span className="block text-xs font-black text-white uppercase tracking-wider">{name} - {displayLane}</span>
                    <span className="block text-xs font-mono font-bold text-slate-300 mt-0.5">{match.kills} / {match.deaths} / {match.assists} <span className="text-slate-500 font-normal">KDA</span></span>
                  </div>
                  <div className="w-full h-px bg-border-warm my-1.5"></div>
                  <div className="flex justify-between w-full text-[10.5px] font-mono text-slate-500">
                    <span>{match.csPerMin} CS/M</span>
                    <span>Hace {match.timeAgo.split(' ')[0]}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* B. Player Profile Details (Center Bottom) */}
        <div className="md:col-span-6 lg:col-span-4 dashboard-panel border border-border-warm rounded-xl p-5 flex flex-col justify-between min-h-[300px]">
          <div className="flex justify-between items-center mb-3 pb-2 border-b border-border-warm">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">DATOS DEL INVOCADOR</span>
            <span className="text-[11px] font-bold text-slate-400 font-mono">ESTE MES</span>
          </div>

          {/* Profile centered layout wrapping avatar, ranks, and grid tightly */}
          <div className="flex-1 flex flex-col justify-center gap-4 my-auto">
            <div className="flex flex-col items-center justify-center gap-2 text-center">
              <div className="relative flex items-center justify-center">
                {/* Outer animated rotating orbit ring */}
                <div className="absolute w-20 h-20 border border-purple-accent/30 rounded-full"></div>
                <div className="absolute w-[68px] h-[68px] border border-purple-accent/60 rounded-full"></div>

                {/* Summoner Icon inside orbit */}
                <img
                  src={`https://ddragon.leagueoflegends.com/cdn/${data.gameVersion || "14.9.1"}/img/profileicon/${profileIconId}.png`}
                  alt="Avatar"
                  className="w-14 h-14 rounded-full border-2 border-purple-accent/70 bg-black object-cover scale-[1.08] select-none z-10"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/favicon.svg";
                  }}
                />
              </div>

              <div className="space-y-1.5 w-full">
                <span className="block text-base font-black text-white">{summonerName}</span>
                
                {/* Columns layout side-by-side to remove empty space on the right */}
                <div className="flex justify-center items-center gap-4 text-center w-full px-2">
                  <div className="flex-1">
                    <span className="block text-[10px] text-slate-500 uppercase tracking-widest font-black mb-0.5">Solo/Duo</span>
                    <span className={`block text-xs font-black uppercase tracking-wider ${getTierColor(ranked.tier)}`}>
                      {ranked.tier} {ranked.division}
                    </span>
                    <span className="block text-[11px] font-mono font-bold text-slate-400">{ranked.lp} LP</span>
                  </div>
                  
                  <div className="w-px bg-border-warm h-6 self-center shrink-0"></div>
                  
                  <div className="flex-1">
                    <span className="block text-[10px] text-slate-500 uppercase tracking-widest font-black mb-0.5">Flexible</span>
                    <span className={`block text-[11px] font-bold uppercase tracking-wider ${getTierColor(data.rankedFlex?.tier || 'UNRANKED')}`}>
                      {data.rankedFlex ? `${data.rankedFlex.tier} ${data.rankedFlex.division}` : 'UNRANKED'}
                    </span>
                    <span className="block text-[10px] font-mono text-slate-400">{data.rankedFlex?.lp || 0} LP</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Core Stats table positioned directly under the profile details */}
            <div className="grid grid-cols-4 gap-2 text-center bg-[#08080b]/60 p-2.5 border border-border-warm rounded">
              <div>
                <span className="block text-xs font-mono font-black text-white">{winRate}%</span>
                <span className="block text-[9px] uppercase font-bold text-slate-500 tracking-wider">Winrate</span>
              </div>
              <div className="border-l border-border-warm">
                <span className="block text-xs font-mono font-black text-white">{totalGames}</span>
                <span className="block text-[9px] uppercase font-bold text-slate-500 tracking-wider">Partidas</span>
              </div>
              <div className="border-l border-border-warm">
                <span className="block text-xs font-mono font-black text-white">{ranked.wins}</span>
                <span className="block text-[9px] uppercase font-bold text-slate-500 tracking-wider">Victorias</span>
              </div>
              <div className="border-l border-border-warm">
                <span className="block text-xs font-mono font-black text-white">3.4K</span>
                <span className="block text-[9px] uppercase font-bold text-slate-500 tracking-wider">KDA Score</span>
              </div>
            </div>
          </div>
        </div>

        {/* C. Campeones Fuertes (Bottom Right Grid) */}
        <div className="md:col-span-6 lg:col-span-3 dashboard-panel border border-border-warm rounded-xl p-5 flex flex-col justify-between min-h-[300px]">
          <div className="flex justify-between items-center mb-3 pb-2 border-b border-border-warm">
            <span className="text-xs font-black uppercase tracking-[0.2em] text-white">META: CAMPEONES FUERTES</span>
            <span className="text-xs font-medium text-purple-accent font-mono">Parche {data.gameVersion || "14.9.1"}</span>
          </div>

          {/* Role Meta List */}
          <div className="space-y-2 flex-1 flex flex-col justify-between">
            {[
              { key: 'top', label: 'TOP' },
              { key: 'jungle', label: 'JNG' },
              { key: 'mid', label: 'MID' },
              { key: 'adc', label: 'ADC' },
              { key: 'support', label: 'SUP' },
            ].map(({ key, label }) => {
              const list = (metaCache as Record<string, any[]>)[key] || [];
              const top3 = list.slice(0, 3);
              return (
                <div key={key} className="flex items-center justify-between py-1 border-b border-border-warm/20 last:border-0">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">{label}</span>
                  <div className="flex gap-2">
                    {top3.map((champ, index) => {
                      const name = champ.name;
                      const winRate = champ.winRate || "50.0%";
                      const cdnName = getChampionCdnName(name);
                      return (
                        <div key={index} className="group relative flex items-center justify-center">
                          <img 
                            src={`https://ddragon.leagueoflegends.com/cdn/${data.gameVersion || "14.9.1"}/img/champion/${cdnName}.png`} 
                            alt={name} 
                            className="w-6 h-6 rounded-full border border-border-warm hover:border-purple-accent/60 transition-all duration-200"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "/favicon.svg";
                            }}
                          />
                          <span className="absolute bottom-full mb-1 scale-0 transition-all rounded bg-[#0b0b0e] p-1 text-[8.5px] text-white group-hover:scale-100 whitespace-nowrap border border-border-warm z-20">
                            {name} ({winRate})
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

