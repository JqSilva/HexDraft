// src/components/react/HistoryPage.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { getNameFromId } from '../../lib/engine/core/constants';
import assetsMap from '../../lib/data/assets-map.json';
import { getChampionCdnName } from '../../lib/championMapper';

interface Participant {
  championId: number;
  summonerName: string;
  lane: string;
}

interface Match {
  gameId: number;
  gameCreation: number;
  gameDuration: number;
  gameMode: string;
  queueId: number;
  win: boolean;
  championId: number;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  csPerMin: string;
  level: number;
  gold: number;
  damage: number;
  visionScore: number;
  spells: number[];
  runes: {
    keystone: number;
    primaryStyle: number;
    subStyle: number;
  };
  items: number[];
  lane: string;
  allies: Participant[];
  enemies: Participant[];
}

const SUMMONER_SPELLS: Record<number, string> = {
  1: "SummonerBoost",   // Cleanse
  3: "SummonerExhaust", // Exhaust
  4: "SummonerFlash",   // Flash
  6: "SummonerHaste",   // Ghost
  7: "SummonerHeal",    // Heal
  11: "SummonerSmite",  // Smite
  12: "SummonerTeleport",// Teleport
  14: "SummonerDot",     // Ignite
  21: "SummonerBarrier", // Barrier
  32: "SummonerSnowball",// Snowball / Mark
};

const QUEUE_MAP: Record<number, string> = {
  420: "Solo/Duo",
  440: "Flex",
  450: "ARAM",
  400: "Normal Draft",
  430: "Normal Blind",
  0: "Personalizada"
};

// Map lane pairings based on user specs:
// JG -> MID, TOP -> JG, MID -> JG, ADC -> SUPP, SUPP -> ADC
const getAlliedLane = (lane: string) => {
  const l = (lane || "").toUpperCase();
  if (l === "TOP") return "JUNGLE";
  if (l === "JUNGLE" || l === "JNG") return "MID";
  if (l === "MID" || l === "MIDDLE") return "JUNGLE";
  if (l === "ADC" || l === "BOT" || l === "BOTTOM") return "SUPPORT";
  if (l === "SUPPORT" || l === "SUP" || l === "UTILITY") return "ADC";
  return "JUNGLE"; // default
};

// Performance score builder (40 to 99 range)
const getPerformanceScore = (match: Match) => {
  const kda = (match.kills + match.assists) / (match.deaths || 1);
  const winBonus = match.win ? 15 : 0;
  const csBonus = parseFloat(match.csPerMin) * 3;
  const base = 40 + winBonus + csBonus + kda * 1.8;
  return Math.min(99, Math.max(30, Math.round(base)));
};

const getRankString = (score: number) => {
  if (score >= 85) return "MVP";
  if (score >= 78) return "2nd";
  if (score >= 70) return "3rd";
  if (score >= 60) return "4th";
  if (score >= 50) return "5th";
  if (score >= 42) return "6th";
  return "7th";
};

const now = Date.now();

export const HistoryPage = () => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [gameVersion, setGameVersion] = useState<string>("14.9.1");
  const [loading, setLoading] = useState<boolean>(true);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch('/api/history');
        if (res.ok) {
          const data = await res.json();
          setMatches(data.matches || []);
          setGameVersion(data.gameVersion || "14.9.1");
          setIsConnected(data.isConnected || false);
        }
      } catch (e) {
        console.error("Error cargando historial de partidas:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  const getRuneIconUrl = (runeId: number) => {
    const rune = (assetsMap.runes as Record<string, any>)[runeId];
    if (rune && rune.icon) {
      return `https://ddragon.leagueoflegends.com/cdn/img/${rune.icon}`;
    }
    return '';
  };

  const getSpellIconUrl = (spellId: number) => {
    const spellName = SUMMONER_SPELLS[spellId] || 'SummonerFlash';
    return `https://ddragon.leagueoflegends.com/cdn/${gameVersion}/img/spell/${spellName}.png`;
  };

  const formatCreationDate = (timestamp: number, nowVal: number) => {
    const diff = nowVal - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "1d ago";
    return `${days}d ago`;
  };

  const formatDuration = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const getKdaRatio = (k: number, d: number, a: number) => {
    if (d === 0) return "Perfecto";
    return ((k + a) / d).toFixed(2);
  };

  const getQueueLabel = (queueId: number, mode: string) => {
    if (QUEUE_MAP[queueId]) return QUEUE_MAP[queueId];
    if (mode === "ARAM") return "ARAM";
    return "Classic";
  };

  // Group matches by formatted date key: e.g. "10 Jun"
  const getGroupDateKey = (timestamp: number) => {
    const date = new Date(timestamp);
    const day = date.getDate();
    const actualMonths = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const month = actualMonths[date.getMonth()];
    return `${day.toString().padStart(2, '0')} ${month}`;
  };

  const groupMatchesByDate = (matchesList: Match[]) => {
    const groups: Record<string, Match[]> = {};
    matchesList.forEach(m => {
      const key = getGroupDateKey(m.gameCreation);
      if (!groups[key]) groups[key] = [];
      groups[key].push(m);
    });
    return Object.entries(groups).map(([dateKey, groupMatches]) => {
      const wins = groupMatches.filter(m => m.win).length;
      const losses = groupMatches.length - wins;
      const totalScore = groupMatches.reduce((acc, m) => acc + getPerformanceScore(m), 0);
      const averageHexScore = parseFloat((totalScore / groupMatches.length).toFixed(1));
      return {
        dateKey,
        matches: groupMatches,
        stats: { wins, losses, averageHexScore }
      };
    });
  };

  if (loading) {
    return (
      <div className="w-full flex-1 flex flex-col items-center justify-center min-h-[500px]">
        <div className="relative w-12 h-12 flex items-center justify-center">
          <div className="absolute w-full h-full border border-dashed border-[#9055ff]/40 rounded-full animate-spin"></div>
          <div className="absolute w-10 h-10 border-2 border-t-transparent border-r-[#9055ff] border-b-transparent border-l-[#9055ff] rounded-full animate-[spin_3s_linear_infinite]"></div>
          <img src="/favicon.svg" alt="Loading" className="w-6 h-6 object-cover" />
        </div>
        <span className="mt-4 text-[10px] uppercase tracking-[0.25em] font-black text-slate-400 animate-pulse">
          Sincronizando Historial...
        </span>
      </div>
    );
  }

  const groupedGroups = groupMatchesByDate(matches);

  return (
    <div className="w-full h-full flex flex-col gap-5 p-4 md:p-6 animate-in fade-in duration-500 overflow-y-auto">
      {/* TOP HEADER */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-warm pb-4">
        <div>
          <span className="text-[10px] uppercase tracking-[0.3em] font-black text-slate-500">RESUMEN GENERAL</span>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-black text-white uppercase tracking-tight">
                <span className="text-purple-accent">Historial</span> de Partidas
              </h1>
          </div>
        </div>
        
        <div className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">
          PARCHE: <span className="text-[#9055ff] font-bold">{gameVersion}</span>
        </div>
      </header>

      {/* MATCH LIST CONTAINER */}
      <div className="flex flex-col gap-6 max-w-[1200px] w-full mx-auto select-none">
        {groupedGroups.length === 0 ? (
          <div className="bg-[#0f0f13]/90 border border-border-warm rounded-sm p-12 text-center tech-corners shadow-xl">
            <span className="text-xs uppercase tracking-widest text-slate-500 font-bold">
              No se han encontrado partidas recientes
            </span>
          </div>
        ) : (
          groupedGroups.map((group) => (
            <div key={group.dateKey} className="flex flex-col gap-2.5">
              {/* GROUP DAY HEADER */}
              <div className="flex items-center justify-between border-b border-slate-900 pb-1.5 px-0.5">
                <h3 className="text-sm font-black text-white tracking-wider uppercase font-mono">{group.dateKey}</h3>
                <div className="flex items-center gap-2">
                  <span className="bg-[#9055ff]/10 border border-[#9055ff]/30 text-[#9055ff] text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm">
                    Hex Score : {group.stats.averageHexScore}
                  </span>
                  <span className="bg-emerald-950/20 border border-emerald-900/30 text-emerald-400 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-sm">
                    {group.stats.wins} V
                  </span>
                  <span className="bg-rose-950/20 border border-rose-900/30 text-rose-400 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-sm">
                    {group.stats.losses} D
                  </span>
                </div>
              </div>

              {/* GROUPED MATCH ROWS */}
              <div className="flex flex-col gap-2">
                {group.matches.map((match) => {
                  const selfChampName = getNameFromId(match.championId) || "Garen";
                  const selfCdnName = getChampionCdnName(selfChampName);
                  const kdaRatio = getKdaRatio(match.kills, match.deaths, match.assists);
                  const score = getPerformanceScore(match);
                  const rank = getRankString(score);
                  
                  // Calculate dynamic KP%
                  const kp = Math.round(
                    Math.min(95, Math.max(10, ((match.kills + match.assists) / Math.max(1, match.kills + match.assists + (match.win ? 12 : 18))) * 100))
                  );

                  // Colors configuration: solid very dark background, subtle win/loss borders
                  const cardBg = match.win 
                    ? "bg-[#08080b] hover:bg-[#0c0d12] border-cyan-500/20 hover:border-cyan-500/40" 
                    : "bg-[#08080b] hover:bg-[#0c0d12] border-rose-500/20 hover:border-rose-500/40";
                    
                  const leftIndicatorColor = match.win ? "bg-cyan-500" : "bg-rose-500";
                  
                  // Lane identification
                  const playerLane = match.lane || "MID";
                  
                  // Allied direct lane partner
                  const alliedLaneName = getAlliedLane(playerLane);
                  const alliedParticipant = match.allies.find(a => {
                    const aLane = (a.lane || "").toUpperCase();
                    if (alliedLaneName === "JUNGLE") return aLane === "JUNGLE" || aLane === "JNG";
                    if (alliedLaneName === "SUPPORT") return aLane === "SUPPORT" || aLane === "SUP" || aLane === "UTILITY";
                    return aLane === alliedLaneName;
                  }) || match.allies.filter(a => !a.summonerName.includes("Frikz"))[0] || { championId: 103, summonerName: "Aliado", lane: alliedLaneName };

                  const alliedChampName = getNameFromId(alliedParticipant.championId) || "Ahri";
                  const alliedCdnName = getChampionCdnName(alliedChampName);

                  // VS Threat Section
                  // 1. Direct enemy lane opponent (e.g. if Mid, the enemy Mid)
                  const enemyOpponent = match.enemies.find(e => {
                    const eLane = (e.lane || "").toUpperCase();
                    if (playerLane === "JUNGLE") return eLane === "JUNGLE" || eLane === "JNG";
                    if (playerLane === "SUPPORT") return eLane === "SUPPORT" || eLane === "SUP" || eLane === "UTILITY";
                    return eLane === playerLane;
                  }) || match.enemies[0] || { championId: 266, summonerName: "Enemigo", lane: playerLane };

                  // 2. Enemy's allied lane (e.g. if enemy is Mid, their allied lane is Jungler)
                  const enemyAlliedLaneName = getAlliedLane(playerLane);
                  const enemyAlliedOpponent = match.enemies.find(e => {
                    const eLane = (e.lane || "").toUpperCase();
                    if (enemyAlliedLaneName === "JUNGLE") return eLane === "JUNGLE" || eLane === "JNG";
                    if (enemyAlliedLaneName === "SUPPORT") return eLane === "SUPPORT" || eLane === "SUP" || eLane === "UTILITY";
                    return eLane === enemyAlliedLaneName;
                  }) || match.enemies.filter(e => e.championId !== enemyOpponent.championId)[0] || { championId: 120, summonerName: "Enemigo Aliado", lane: enemyAlliedLaneName };

                  const vs1Cdn = getChampionCdnName(getNameFromId(enemyOpponent.championId) || "Yasuo");
                  const vs2Cdn = getChampionCdnName(getNameFromId(enemyAlliedOpponent.championId) || "Morgana");

                  // Items Array arrangement mapping: 
                  // Top Row = [item0, item1, item2, trinket]
                  // Bottom Row = [item3, item4, item5, empty]
                  const topRowItems = [match.items[0], match.items[1], match.items[2], match.items[6]];
                  const bottomRowItems = [match.items[3], match.items[4], match.items[5], 0];

                  // Progress ring circle color: Accent purple for MVP/Good performance, cyan for average, slate for others
                  const progressColor = score >= 75 
                    ? "stroke-[#9055ff]" 
                    : score >= 50 
                      ? "stroke-cyan-500" 
                      : "stroke-slate-500";

                  return (
                    <div 
                      key={match.gameId} 
                      className={`w-full h-[76px] flex items-center justify-between border ${cardBg} transition-all duration-300 rounded-sm relative overflow-hidden pl-3.5 pr-6 py-2`}
                    >
                      {/* Left colored indicator bar */}
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${leftIndicatorColor}`}></div>

                      {/* LEFT INFO: Duration, Queue and Time */}
                      <div className="flex flex-col justify-center w-[85px] shrink-0 gap-0.5">
                        <span className="text-[12px] font-black text-slate-100 font-mono">
                          {formatDuration(match.gameDuration)}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-400">
                          {formatCreationDate(match.gameCreation, now)}
                        </span>
                        <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-300">
                          {getQueueLabel(match.queueId, match.gameMode)}
                        </span>
                      </div>

                      {/* CHAMPIONS MATCHUP (Local & Allied Direct Lane Champion) */}
                      <div className="flex items-center gap-2.5 w-[95px] shrink-0">
                        {/* Player champion portrait with simple clean border matching the dashboard */}
                        <div className="relative shrink-0 select-none">
                          <img 
                            src={`https://ddragon.leagueoflegends.com/cdn/${gameVersion}/img/champion/${selfCdnName}.png`}
                            alt={selfChampName}
                            className="w-[46px] h-[46px] object-cover rounded border border-slate-700 bg-black"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "/favicon.svg";
                            }}
                          />
                        </div>

                        {/* Allied partner champion portrait (no edit icon, clean border) */}
                        <div className="relative select-none shrink-0">
                          <img 
                            src={`https://ddragon.leagueoflegends.com/cdn/${gameVersion}/img/champion/${alliedCdnName}.png`}
                            alt={alliedChampName}
                            className="w-[36px] h-[36px] object-cover rounded border border-slate-800 bg-black"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "/favicon.svg";
                            }}
                          />
                        </div>
                      </div>

                      {/* KDA & GENERAL STATS (fixed width to prevent layout shifting) */}
                      <div className="w-[175px] shrink-0 flex items-center">
                        <div className="flex flex-col justify-center w-full">
                          <div className="text-[13.5px] font-mono font-black text-slate-100 tracking-tight leading-none">
                            {match.kills} <span className="text-slate-600">/</span> <span className="text-rose-500 font-extrabold">{match.deaths}</span> <span className="text-slate-600">/</span> {match.assists}
                          </div>
                          
                          {/* Stats details directly under KDA */}
                          <div className="mt-1 flex flex-row items-center gap-1 text-[9.5px] font-mono font-bold text-slate-400 leading-none">
                            <span className={`shrink-0 ${match.win ? "text-cyan-400 font-extrabold" : "text-rose-400 font-extrabold"}`}>
                              {match.deaths === 0 ? "KDA Perfecto" : `${kdaRatio} KDA`}
                            </span>
                            <span className="text-slate-600 shrink-0">•</span>
                            <span className="shrink-0">
                              {match.csPerMin} CS/m
                            </span>
                            <span className="text-slate-600 shrink-0">•</span>
                            <span className="text-slate-500 font-medium shrink-0">
                              {kp}% KP
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* SUMMONER SPELLS, RUNES AND ITEMS GRID */}
                      <div className="flex items-center w-[160px] shrink-0">
                        {/* Spells & Runes 2x2 container */}
                        <div className="flex items-center gap-1">
                          {/* Spells Col */}
                          <div className="flex flex-col gap-0.5">
                            {match.spells.slice(0, 2).map((spellId, idx) => (
                              <img 
                                key={idx}
                                src={getSpellIconUrl(spellId)} 
                                alt="Spell"
                                className="w-[20px] h-[20px] rounded-sm border border-slate-800 bg-black"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = "/favicon.svg";
                                }}
                              />
                            ))}
                          </div>

                          {/* Runes Col */}
                          <div className="flex flex-col gap-0.5">
                            {/* Keystone */}
                            {match.runes.keystone > 0 ? (
                              <div className="w-[20px] h-[20px] rounded-sm border border-slate-800 bg-black/80 flex items-center justify-center p-0.5">
                                <img 
                                  src={getRuneIconUrl(match.runes.keystone)} 
                                  alt="Keystone"
                                  className="w-full h-full object-contain"
                                />
                              </div>
                            ) : (
                              <div className="w-[20px] h-[20px] rounded-sm border border-slate-850 bg-black/40"></div>
                            )}
                            
                            {/* Sub tree */}
                            {match.runes.subStyle > 0 ? (
                              <div className="w-[20px] h-[20px] rounded-sm border border-slate-800 bg-black/80 flex items-center justify-center p-0.5">
                                <img 
                                  src={getRuneIconUrl(match.runes.subStyle)} 
                                  alt="Secondary"
                                  className="w-full h-full object-contain opacity-80"
                                />
                              </div>
                            ) : (
                              <div className="w-[20px] h-[20px] rounded-sm border border-slate-850 bg-black/40"></div>
                            )}
                          </div>
                        </div>

                        {/* Divider Line */}
                        <div className="w-[1px] h-10 bg-slate-855 shrink-0 mx-2.5"></div>

                        {/* Items 4x2 Grid layout */}
                        <div className="flex flex-col gap-0.5 shrink-0">
                          {/* Top Row Items */}
                          <div className="flex gap-0.5">
                            {topRowItems.map((itemId, i) => (
                              <div 
                                key={`top-${i}`} 
                                className={`w-[22px] h-[22px] bg-[#07080f]/70 border border-slate-800 flex items-center justify-center overflow-hidden rounded-sm ${i === 3 ? 'border-cyan-800/40 bg-cyan-950/15' : ''}`}
                              >
                                {itemId > 0 ? (
                                  <img 
                                    src={`https://ddragon.leagueoflegends.com/cdn/${gameVersion}/img/item/${itemId}.png`} 
                                    alt="Item"
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src = "/favicon.svg";
                                    }}
                                  />
                                ) : null}
                              </div>
                            ))}
                          </div>
                          {/* Bottom Row Items */}
                          <div className="flex gap-0.5">
                            {bottomRowItems.map((itemId, i) => (
                              <div 
                                key={`bot-${i}`} 
                                className="w-[22px] h-[22px] bg-[#07080f]/70 border border-slate-800 flex items-center justify-center overflow-hidden rounded-sm"
                              >
                                {itemId > 0 ? (
                                  <img 
                                    src={`https://ddragon.leagueoflegends.com/cdn/${gameVersion}/img/item/${itemId}.png`} 
                                    alt="Item"
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src = "/favicon.svg";
                                    }}
                                  />
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* VS SECTION: Threat matchup connector */}
                      <div className="flex items-center w-[100px] shrink-0">
                        {/* Connecting line */}
                        <div className="w-8 h-[1px] bg-slate-855 relative">
                          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#090b14] px-0.5 text-[8.5px] font-extrabold text-slate-500 uppercase tracking-tighter leading-none select-none">
                            VS
                          </span>
                        </div>

                        {/* Overlapping threat champions (scaled up to w-[36px] for high resolution and crisp look, edit icon removed) */}
                        <div className="flex items-center relative pl-3 shrink-0 select-none">
                          {/* 1st circle: Direct enemy lane opponent */}
                          <div className="relative w-[36px] h-[36px] rounded-full border-2 border-slate-800 overflow-hidden z-10 bg-black" title={`Oponente Directo (${enemyOpponent.lane})`}>
                            <img 
                              src={`https://ddragon.leagueoflegends.com/cdn/${gameVersion}/img/champion/${vs1Cdn}.png`}
                              alt={getNameFromId(enemyOpponent.championId) || "Enemy"}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = "/favicon.svg";
                              }}
                            />
                          </div>
                          {/* 2nd circle: Enemy's allied lane */}
                          <div className="relative w-[36px] h-[36px] rounded-full border-2 border-slate-800 overflow-hidden z-0 -ml-3 bg-black" title={`Aliado del Oponente (${enemyAlliedOpponent.lane})`}>
                            <img 
                              src={`https://ddragon.leagueoflegends.com/cdn/${gameVersion}/img/champion/${vs2Cdn}.png`}
                              alt={getNameFromId(enemyAlliedOpponent.championId) || "Enemy"}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = "/favicon.svg";
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* PERFORMANCE RATING SCORE GAUGE */}
                      <div className="relative w-12 h-12 shrink-0 flex items-center justify-center">
                        <svg className="w-12 h-12 transform -rotate-90">
                          <circle
                            cx="24"
                            cy="24"
                            r="19"
                            className="stroke-slate-855"
                            strokeWidth="2.5"
                            fill="transparent"
                          />
                          <circle
                            cx="24"
                            cy="24"
                            r="19"
                            className={progressColor}
                            strokeWidth="2.5"
                            fill="transparent"
                            strokeDasharray={2 * Math.PI * 19}
                            strokeDashoffset={2 * Math.PI * 19 * (1 - score / 100)}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-[11.5px] font-black text-slate-100 font-mono leading-none">
                            {score}
                          </span>
                          <span className="text-[7.5px] text-slate-400 font-black tracking-tighter uppercase mt-0.5">
                            {rank}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default HistoryPage;
