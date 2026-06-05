import React, { useState, useEffect } from 'react';
import { getNameFromId } from '../../lib/engine/engine';

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

// Casos especiales de Riot para nombres de archivos DDragon
const getChampionCdnName = (name: string): string => {
  if (!name) return "Garen";
  const special: Record<string, string> = {
    "Wukong": "MonkeyKing",
    "Nunu y Willump": "Nunu",
    "Maestro Yi": "MasterYi",
    "Dr. Mundo": "DrMundo",
    "Jarvan IV": "JarvanIV",
    "Lee Sin": "LeeSin",
    "Aurelion Sol": "AurelionSol",
    "K'Sante": "Ksante",
    "Kai'Sa": "Kaisa",
    "Kha'Zix": "Khazix",
    "Vel'Koz": "Velkoz",
    "Bel'Veth": "Belveth",
    "Renata Glasc": "Renata",
    "LeBlanc": "Leblanc",
    "Cho'Gath": "Chogath",
  };
  if (special[name]) return special[name];
  return name.replace(/[^a-zA-Z0-9]/g, "");
};

const getChampionRole = (name: string): string => {
  const roles: Record<string, string> = {
    "Zed": "Asesino / Mid",
    "Yasuo": "Luchador / Mid",
    "Ahri": "Mago / Mid",
    "Jinx": "Tirador / Bot",
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

const getChampionGradient = (name: string): string => {
  const colors: Record<string, string> = {
    "Zed": "from-purple-600 to-indigo-600",
    "Yasuo": "from-amber-600 to-yellow-500",
    "Ahri": "from-teal-600 to-cyan-500",
    "Jinx": "from-rose-600 to-pink-500",
    "Lee Sin": "from-red-600 to-orange-500",
    "Lux": "from-sky-500 to-blue-600",
    "Garen": "from-emerald-600 to-teal-500",
    "Viego": "from-violet-600 to-fuchsia-600",
    "Yone": "from-crimson-600 to-red-500",
  };
  return colors[name] || "from-purple-500 to-pink-500";
};

// Datos por defecto (mock) cuando LCU está offline
const DEFAULT_SUMMONER: SummonerData = {
  isConnected: false,
  gameVersion: "14.9.1",
  summoner: "Alex Legend",
  level: 128,
  xpPercent: 43,
  xpCurrent: 12450,
  xpMax: 28950,
  profileIconId: 29,
  ranked: {
    tier: "CHALLENGER",
    division: "I",
    lp: 842,
    wins: 142,
    losses: 105
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
      case 'MASTER': return 'text-purple-400';
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
    <div className="w-full h-full flex flex-col gap-6 p-4 md:p-6 animate-in fade-in duration-500 overflow-y-auto">      
      {/* TOP BAR */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-warm pb-5">
        <div>
          <span className="text-[9px] uppercase tracking-[0.3em] font-black text-slate-500">BIENVENIDO DE NUEVO,</span>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-white uppercase tracking-tight">{summonerName}</h1>
            <span className="bg-[#9055ff]/10 border border-[#9055ff]/30 text-[#9055ff] text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded">
              {ranked.tier} {ranked.division}
            </span>
          </div>
        </div>

        {/* LCU connection status indicator */}
          <div className={`flex items-center justify-center gap-2 mt-3 mr-32 px-3 py-1.5 bg-[#0f0f12] border border-border-warm rounded-sm text-[8.5px] uppercase tracking-widest font-black ${data.isConnected ? 'text-green-500' : 'text-slate-400'
            }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${data.isConnected ? 'bg-green-500 animate-pulse' : 'bg-slate-600'}`}></span>
            {data.isConnected ? 'LCU CONECTADO' : 'LCU OFFLINE'}
          </div>

        {/* Icons and profile */}
        <div className="flex items-center gap-4 self-end md:self-auto">
          {/* Summoner Avatar */}
          <div className="relative">
            <img
              src={`https://ddragon.leagueoflegends.com/cdn/${data.gameVersion || "14.9.1"}/img/profileicon/${profileIconId}.png`}
              alt="Summoner Icon"
              className="w-10 h-10 rounded-full border border-border-warm bg-black select-none shadow-[0_0_12px_rgba(0,0,0,0.5)]"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/favicon.svg";
              }}
            />
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-[#070709] shadow-md"></span>
          </div>
        </div>
      </header>

      {/* HERO SECTION & TOP CHAMPIONS ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* A. Hero Banner Card */}
        <div className="lg:col-span-8 bg-[#0f0f13]/90 border border-border-warm rounded-sm relative overflow-hidden flex flex-col justify-between p-6 md:p-8 min-h-[250px] tech-corners shadow-xl group">
          {/* Background Grid Pattern & Ambient Glows */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#9055ff]/10 via-transparent to-transparent pointer-events-none z-0"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_500px_at_100%_0%,rgba(144,85,255,0.06),transparent)] pointer-events-none z-0"></div>

          {/* Content layout */}
          <div className="flex gap-2">
            
              <div className="flex flex-col z-10 space-y-3 w-1/2">
                <span className="self-start inline-block bg-[#9055ff]/15 border border-[#9055ff]/30 text-[#9055ff] text-[9px] font-black uppercase tracking-[0.2em] px-2.5 py-1 rounded-sm select-none">
                  SISTEMA DE ASISTENCIA
                </span>
                <h2 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tighter leading-none">
                  HEXDRAFT <span className="text-[#9055ff]">TACTICAL</span>
                </h2>
                <p className="text-[9px] uppercase tracking-[0.15em] font-bold text-slate-400 mt-1">
                  Optimización de Composiciones // Runas & Builds Automáticas
                </p>
                <p className="text-xs text-slate-300 leading-relaxed font-medium">
                  Sincroniza HexDraft con tu cliente de League of Legends para recibir análisis de matchups, prioridades de picks/bans y configuraciones óptimas directamente en tu cliente.
                </p>
                <div className="relative z-10 flex flex-col sm:flex-row gap-4 mt-6 items-start sm:items-center">
                <a
                  href="/draft"
                  className="px-8 py-3.5 bg-[#9055ff] text-white text-[10px] font-black uppercase tracking-[0.2em] hover:bg[#7b3aff] transition-all duration-300 shadow-[0_0_20px_rgba(144,85,255,0.35)] hover:shadow-[0_0_25px_rgba(144,85,255,0.5)] rounded-sm cursor-pointer border border-[#9055ff]/50"
                >
                  INICIAR DRAFT HELPER
                </a>

                <a
                  href="/actualizar"
                  className="px-6 py-3.5 bg-[#08080b] border border-border-warm hover:border-[#9055ff]/50 text-slate-400 hover:text-white text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 rounded-sm cursor-pointer"
                >
                  BASE DE DATOS
                </a>
              </div>
            </div>
            <div className="flex items-center justify-center w-1/2 relative select-none">
              {/* Background ambient glow circle */}
              <div className="absolute w-36 h-36  rounded-full pointer-events-none"></div>
              <img 
                src="/favicon.svg" 
                alt="HexDraft Logo" 
                className="w-24 h-24 md:w-42 md:h-42 block relative z-10 transition-transform duration-500 hover:scale-105 "
              />
            </div>
          </div>
            

          {/* Patch Version Display Overlay */}
          
        </div>

        {/* B. Top Champions / Collection List */}
        <div className="lg:col-span-4 bg-[#0f0f13]/90 border border-border-warm rounded-sm p-5 flex flex-col justify-between tech-corners shadow-xl min-h-[250px]">
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-border-warm">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">MAESTRÍA DE CAMPEONES</span>
            <a href="#" onClick={(e) => e.preventDefault()} className="text-[8px] font-bold text-[#9055ff] hover:underline uppercase tracking-widest">VER TODOS</a>
          </div>

          {/* List of 4 champions */}
          <div className="space-y-3.5 flex-1 flex flex-col justify-center">
            {masteryList.map((m, index) => {
              const champId = m.championId;
              const points = m.points;
              const lvl = m.level;
              const name = getNameFromId(champId) || "Campeón";
              const role = getChampionRole(name);
              const gradient = getChampionGradient(name);
              const progressWidth = index === 0 ? 92 : index === 1 ? 72 : index === 2 ? 61 : 48;

              return (
                <div key={champId} className="flex items-center gap-3 group hover:bg-white/[0.01] p-1.5 rounded transition-colors duration-200">
                  <img
                    src={`https://ddragon.leagueoflegends.com/cdn/${data.gameVersion || "14.9.1"}/img/champion/${getChampionCdnName(name)}.png`}
                    alt={name}
                    className="w-10 h-10 rounded-sm border border-border-warm select-none object-cover shadow-lg group-hover:border-[#9055ff]/40 transition-colors duration-300"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/favicon.svg";
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <span className="text-xs font-black text-white tracking-wider group-hover:text-[#9055ff] transition-colors duration-200">{name}</span>
                      <span className="text-[9px] font-mono font-bold text-slate-400">{points.toLocaleString()} PTS</span>
                    </div>
                    <span className="block text-[8.5px] text-slate-500 uppercase tracking-widest font-semibold mb-1.5">{role}</span>
                    {/* Horizontal progress bar */}
                    <div className="w-full bg-[#15151a] h-1.5 rounded-full overflow-hidden border border-[#22222b] relative">
                      <div
                        className={`bg-gradient-to-r ${gradient} h-full rounded-full transition-all duration-1000 ease-out`}
                        style={{ width: `${progressWidth}%` }}
                      ></div>
                    </div>
                  </div>
                  {/* Mastery Level Badge */}
                  <div className="w-7 h-7 flex items-center justify-center rounded border border-[#9055ff]/20 bg-[#9055ff]/5 text-[10px] font-mono font-black text-[#9055ff] group-hover:bg-[#9055ff]/10 transition-colors duration-200 select-none shadow">
                    L{lvl}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* BOTTOM SECTIONS: RECENT MATCHES, PLAYER PROFILE, ACCLAIMS */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

        {/* A. Recent Matches (Bottom Left Grid) */}
        <div className="xl:col-span-5 bg-[#0f0f13]/90 border border-border-warm rounded-sm p-5 tech-corners shadow-xl flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-border-warm">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">HISTORIAL RECIENTE</span>
            <a href="#" onClick={(e) => e.preventDefault()} className="text-[8px] font-bold text-[#9055ff] hover:underline uppercase tracking-widest">VER PARTIDAS</a>
          </div>

          {/* Matches list */}
          <div className="grid grid-cols-2 gap-3.5">
            {matchesList.map((match, idx) => {
              const name = getNameFromId(match.championId) || "Campeón";
              const role = getChampionRole(name);
              const borderClass = match.win ? "border-green-500/25 hover:border-green-500/40" : "border-red-500/25 hover:border-red-500/40";
              const badgeBg = match.win ? "bg-green-500/10 border-green-500/30 text-green-500" : "bg-red-500/10 border-red-500/30 text-red-500";

              return (
                <div key={idx} className={`bg-[#08080b] border ${borderClass} p-3.5 rounded flex flex-col justify-between items-center text-center transition-all duration-300 relative group`}>
                  <div className={`absolute top-0.5 left-0.5 w-1.5 h-1.5 border-t border-l ${match.win ? 'border-green-500' : 'border-red-500'}`}></div>
                  <div className={`absolute top-2.5 right-2.5 border ${badgeBg} text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-sm select-none`}>
                    {match.win ? 'VICTORIA' : 'DERROTA'}
                  </div>

                  {/* Champion portrait icon */}
                  <div className="w-11 h-11 rounded-full border border-border-warm overflow-hidden mb-2 mt-2 shadow-lg group-hover:border-[#9055ff]/40 group-hover:scale-105 transition-all duration-300">
                    <img
                      src={`https://ddragon.leagueoflegends.com/cdn/${data.gameVersion || "14.9.1"}/img/champion/${getChampionCdnName(name)}.png`}
                      alt={name}
                      className="w-full h-full object-cover select-none"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/favicon.svg";
                      }}
                    />
                  </div>
                  <div>
                    <span className="block text-xs font-black text-white uppercase tracking-wider">{name} - {role.split(' / ')[1] || 'Mid'}</span>
                    <span className="block text-[11px] font-mono font-bold text-slate-300 mt-1">{match.kills} / {match.deaths} / {match.assists} <span className="text-slate-500 font-normal">KDA</span></span>
                  </div>
                  <div className="w-full h-px bg-border-warm my-2"></div>
                  <div className="flex justify-between w-full text-[9px] font-mono text-slate-500">
                    <span>{match.csPerMin} CS/M</span>
                    <span>Hace {match.timeAgo.split(' ')[0]}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* B. Player Profile Details (Center Bottom) */}
        <div className="xl:col-span-4 bg-[#0f0f13]/90 border border-border-warm rounded-sm p-5 tech-corners shadow-xl flex flex-col justify-between min-h-[340px]">
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-border-warm">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">DATOS DEL INVOCADOR</span>
            <span className="text-[9px] font-bold text-slate-400 font-mono">ESTE MES</span>
          </div>

          {/* Profile centered layout wrapping avatar, ranks, and grid tightly */}
          <div className="flex-1 flex flex-col justify-center gap-6 my-auto">
            <div className="flex flex-col items-center justify-center gap-3 text-center">
              <div className="relative flex items-center justify-center">
                {/* Outer animated rotating orbit ring */}
                <div className="absolute w-20 h-20 border border-dashed border-[#9055ff]/40 rounded-full animate-[spin_20s_linear_infinite]"></div>
                <div className="absolute w-18 h-18 border-2 border-t-transparent border-r-[#9055ff] border-b-transparent border-l-[#9055ff] rounded-full animate-[spin_8s_linear_infinite]"></div>

                {/* Summoner Icon inside orbit */}
                <img
                  src={`https://ddragon.leagueoflegends.com/cdn/${data.gameVersion || "14.9.1"}/img/profileicon/${profileIconId}.png`}
                  alt="Avatar"
                  className="w-14 h-14 rounded-full border-2 border-[#9055ff] bg-black select-none z-10"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/favicon.svg";
                  }}
                />
              </div>

              <div className="space-y-2.5 w-full">
                <span className="block text-base font-black text-white">{summonerName}</span>
                
                {/* Columns layout side-by-side to remove empty space on the right */}
                <div className="flex justify-center items-center gap-4 text-center w-full px-2">
                  <div className="flex-1">
                    <span className="block text-[8px] text-slate-500 uppercase tracking-widest font-black mb-0.5">Solo/Duo</span>
                    <span className={`block text-[11px] font-black uppercase tracking-wider ${getTierColor(ranked.tier)}`}>
                      {ranked.tier} {ranked.division}
                    </span>
                    <span className="block text-[9px] font-mono font-bold text-slate-400">{ranked.lp} LP</span>
                  </div>
                  
                  <div className="w-px bg-border-warm h-8 self-center shrink-0"></div>
                  
                  <div className="flex-1">
                    <span className="block text-[8px] text-slate-500 uppercase tracking-widest font-black mb-0.5">Flexible</span>
                    <span className={`block text-[10px] font-bold uppercase tracking-wider ${getTierColor(data.rankedFlex?.tier || 'UNRANKED')}`}>
                      {data.rankedFlex ? `${data.rankedFlex.tier} ${data.rankedFlex.division}` : 'UNRANKED'}
                    </span>
                    <span className="block text-[8.5px] font-mono text-slate-400">{data.rankedFlex?.lp || 0} LP</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Core Stats table positioned directly under the profile details */}
            <div className="grid grid-cols-4 gap-2 text-center bg-[#08080b]/60 p-3 border border-border-warm rounded">
              <div>
                <span className="block text-[11px] font-mono font-black text-white">{winRate}%</span>
                <span className="block text-[7.5px] uppercase font-bold text-slate-500 tracking-wider">Winrate</span>
              </div>
              <div className="border-l border-border-warm">
                <span className="block text-[11px] font-mono font-black text-white">{totalGames}</span>
                <span className="block text-[7.5px] uppercase font-bold text-slate-500 tracking-wider">Partidas</span>
              </div>
              <div className="border-l border-border-warm">
                <span className="block text-[11px] font-mono font-black text-white">{ranked.wins}</span>
                <span className="block text-[7.5px] uppercase font-bold text-slate-500 tracking-wider">Victorias</span>
              </div>
              <div className="border-l border-border-warm">
                <span className="block text-[11px] font-mono font-black text-white">3.4K</span>
                <span className="block text-[7.5px] uppercase font-bold text-slate-500 tracking-wider">KDA Score</span>
              </div>
            </div>
          </div>
        </div>

        {/* C. Campeones Fuertes (Bottom Right Grid) */}
        <div className="xl:col-span-3 bg-[#0f0f13]/90 border border-border-warm rounded-sm p-5 tech-corners shadow-xl flex flex-col justify-between min-h-[340px]">
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-border-warm">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">META: CAMPEONES FUERTES</span>
            <span className="text-[8px] font-bold text-[#9055ff] hover:underline uppercase tracking-widest font-mono">P{data.gameVersion || "14.9.1"}</span>
          </div>

          {/* Role Meta List */}
          <div className="space-y-2.5 flex-1 flex flex-col justify-between">
            {/* TOP LANE */}
            <div className="flex items-center justify-between py-1 border-b border-border-warm/30 last:border-0">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">TOP</span>
              <div className="flex gap-2">
                <div className="group relative flex items-center justify-center">
                  <img src={`https://ddragon.leagueoflegends.com/cdn/${data.gameVersion || "14.9.1"}/img/champion/Aatrox.png`} alt="Aatrox" className="w-6 h-6 rounded-full border border-border-warm hover:border-[#9055ff]/60 transition-all duration-200" />
                  <span className="absolute bottom-full mb-1 scale-0 transition-all rounded bg-[#0b0b0e] p-1 text-[8px] text-white group-hover:scale-100 whitespace-nowrap border border-border-warm z-20">Aatrox</span>
                </div>
                <div className="group relative flex items-center justify-center">
                  <img src={`https://ddragon.leagueoflegends.com/cdn/${data.gameVersion || "14.9.1"}/img/champion/Garen.png`} alt="Garen" className="w-6 h-6 rounded-full border border-border-warm hover:border-[#9055ff]/60 transition-all duration-200" />
                  <span className="absolute bottom-full mb-1 scale-0 transition-all rounded bg-[#0b0b0e] p-1 text-[8px] text-white group-hover:scale-100 whitespace-nowrap border border-border-warm z-20">Garen</span>
                </div>
                <div className="group relative flex items-center justify-center">
                  <img src={`https://ddragon.leagueoflegends.com/cdn/${data.gameVersion || "14.9.1"}/img/champion/Darius.png`} alt="Darius" className="w-6 h-6 rounded-full border border-border-warm hover:border-[#9055ff]/60 transition-all duration-200" />
                  <span className="absolute bottom-full mb-1 scale-0 transition-all rounded bg-[#0b0b0e] p-1 text-[8px] text-white group-hover:scale-100 whitespace-nowrap border border-border-warm z-20">Darius</span>
                </div>
              </div>
            </div>

            {/* JUNGLE LANE */}
            <div className="flex items-center justify-between py-1 border-b border-border-warm/30 last:border-0">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">JNG</span>
              <div className="flex gap-2">
                <div className="group relative flex items-center justify-center">
                  <img src={`https://ddragon.leagueoflegends.com/cdn/${data.gameVersion || "14.9.1"}/img/champion/LeeSin.png`} alt="Lee Sin" className="w-6 h-6 rounded-full border border-border-warm hover:border-[#9055ff]/60 transition-all duration-200" />
                  <span className="absolute bottom-full mb-1 scale-0 transition-all rounded bg-[#0b0b0e] p-1 text-[8px] text-white group-hover:scale-100 whitespace-nowrap border border-border-warm z-20">Lee Sin</span>
                </div>
                <div className="group relative flex items-center justify-center">
                  <img src={`https://ddragon.leagueoflegends.com/cdn/${data.gameVersion || "14.9.1"}/img/champion/Viego.png`} alt="Viego" className="w-6 h-6 rounded-full border border-border-warm hover:border-[#9055ff]/60 transition-all duration-200" />
                  <span className="absolute bottom-full mb-1 scale-0 transition-all rounded bg-[#0b0b0e] p-1 text-[8px] text-white group-hover:scale-100 whitespace-nowrap border border-border-warm z-20">Viego</span>
                </div>
                <div className="group relative flex items-center justify-center">
                  <img src={`https://ddragon.leagueoflegends.com/cdn/${data.gameVersion || "14.9.1"}/img/champion/Brand.png`} alt="Brand" className="w-6 h-6 rounded-full border border-border-warm hover:border-[#9055ff]/60 transition-all duration-200" />
                  <span className="absolute bottom-full mb-1 scale-0 transition-all rounded bg-[#0b0b0e] p-1 text-[8px] text-white group-hover:scale-100 whitespace-nowrap border border-border-warm z-20">Brand</span>
                </div>
              </div>
            </div>

            {/* MID LANE */}
            <div className="flex items-center justify-between py-1 border-b border-border-warm/30 last:border-0">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">MID</span>
              <div className="flex gap-2">
                <div className="group relative flex items-center justify-center">
                  <img src={`https://ddragon.leagueoflegends.com/cdn/${data.gameVersion || "14.9.1"}/img/champion/Ahri.png`} alt="Ahri" className="w-6 h-6 rounded-full border border-border-warm hover:border-[#9055ff]/60 transition-all duration-200" />
                  <span className="absolute bottom-full mb-1 scale-0 transition-all rounded bg-[#0b0b0e] p-1 text-[8px] text-white group-hover:scale-100 whitespace-nowrap border border-border-warm z-20">Ahri</span>
                </div>
                <div className="group relative flex items-center justify-center">
                  <img src={`https://ddragon.leagueoflegends.com/cdn/${data.gameVersion || "14.9.1"}/img/champion/Zed.png`} alt="Zed" className="w-6 h-6 rounded-full border border-border-warm hover:border-[#9055ff]/60 transition-all duration-200" />
                  <span className="absolute bottom-full mb-1 scale-0 transition-all rounded bg-[#0b0b0e] p-1 text-[8px] text-white group-hover:scale-100 whitespace-nowrap border border-border-warm z-20">Zed</span>
                </div>
                <div className="group relative flex items-center justify-center">
                  <img src={`https://ddragon.leagueoflegends.com/cdn/${data.gameVersion || "14.9.1"}/img/champion/Yone.png`} alt="Yone" className="w-6 h-6 rounded-full border border-border-warm hover:border-[#9055ff]/60 transition-all duration-200" />
                  <span className="absolute bottom-full mb-1 scale-0 transition-all rounded bg-[#0b0b0e] p-1 text-[8px] text-white group-hover:scale-100 whitespace-nowrap border border-border-warm z-20">Yone</span>
                </div>
              </div>
            </div>

            {/* BOT LANE */}
            <div className="flex items-center justify-between py-1 border-b border-border-warm/30 last:border-0">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">BOT</span>
              <div className="flex gap-2">
                <div className="group relative flex items-center justify-center">
                  <img src={`https://ddragon.leagueoflegends.com/cdn/${data.gameVersion || "14.9.1"}/img/champion/Jinx.png`} alt="Jinx" className="w-6 h-6 rounded-full border border-border-warm hover:border-[#9055ff]/60 transition-all duration-200" />
                  <span className="absolute bottom-full mb-1 scale-0 transition-all rounded bg-[#0b0b0e] p-1 text-[8px] text-white group-hover:scale-100 whitespace-nowrap border border-border-warm z-20">Jinx</span>
                </div>
                <div className="group relative flex items-center justify-center">
                  <img src={`https://ddragon.leagueoflegends.com/cdn/${data.gameVersion || "14.9.1"}/img/champion/Kaisa.png`} alt="Kai'Sa" className="w-6 h-6 rounded-full border border-border-warm hover:border-[#9055ff]/60 transition-all duration-200" />
                  <span className="absolute bottom-full mb-1 scale-0 transition-all rounded bg-[#0b0b0e] p-1 text-[8px] text-white group-hover:scale-100 whitespace-nowrap border border-border-warm z-20">Kai'Sa</span>
                </div>
                <div className="group relative flex items-center justify-center">
                  <img src={`https://ddragon.leagueoflegends.com/cdn/${data.gameVersion || "14.9.1"}/img/champion/Ezreal.png`} alt="Ezreal" className="w-6 h-6 rounded-full border border-border-warm hover:border-[#9055ff]/60 transition-all duration-200" />
                  <span className="absolute bottom-full mb-1 scale-0 transition-all rounded bg-[#0b0b0e] p-1 text-[8px] text-white group-hover:scale-100 whitespace-nowrap border border-border-warm z-20">Ezreal</span>
                </div>
              </div>
            </div>

            {/* SUPPORT LANE */}
            <div className="flex items-center justify-between py-1 border-b border-border-warm/30 last:border-0">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">SUP</span>
              <div className="flex gap-2">
                <div className="group relative flex items-center justify-center">
                  <img src={`https://ddragon.leagueoflegends.com/cdn/${data.gameVersion || "14.9.1"}/img/champion/Thresh.png`} alt="Thresh" className="w-6 h-6 rounded-full border border-border-warm hover:border-[#9055ff]/60 transition-all duration-200" />
                  <span className="absolute bottom-full mb-1 scale-0 transition-all rounded bg-[#0b0b0e] p-1 text-[8px] text-white group-hover:scale-100 whitespace-nowrap border border-border-warm z-20">Thresh</span>
                </div>
                <div className="group relative flex items-center justify-center">
                  <img src={`https://ddragon.leagueoflegends.com/cdn/${data.gameVersion || "14.9.1"}/img/champion/Lux.png`} alt="Lux" className="w-6 h-6 rounded-full border border-border-warm hover:border-[#9055ff]/60 transition-all duration-200" />
                  <span className="absolute bottom-full mb-1 scale-0 transition-all rounded bg-[#0b0b0e] p-1 text-[8px] text-white group-hover:scale-100 whitespace-nowrap border border-border-warm z-20">Lux</span>
                </div>
                <div className="group relative flex items-center justify-center">
                  <img src={`https://ddragon.leagueoflegends.com/cdn/${data.gameVersion || "14.9.1"}/img/champion/Nautilus.png`} alt="Nautilus" className="w-6 h-6 rounded-full border border-border-warm hover:border-[#9055ff]/60 transition-all duration-200" />
                  <span className="absolute bottom-full mb-1 scale-0 transition-all rounded bg-[#0b0b0e] p-1 text-[8px] text-white group-hover:scale-100 whitespace-nowrap border border-border-warm z-20">Nautilus</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

