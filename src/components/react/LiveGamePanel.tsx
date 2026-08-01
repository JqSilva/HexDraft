// src/components/react/LiveGamePanel.tsx
import React, { useState, useEffect } from 'react';
import { PlayerCard, type PlayerData } from './PlayerCard.js';

interface LiveGamePanelProps {
  onCloseManual?: () => void;
}

const ROLES = ['TOP', 'JNG', 'MID', 'ADC', 'SUPP'];

const DEFAULT_BLUE_PLACEHOLDERS: Partial<PlayerData>[] = [
  { championName: 'Riven', role: 'TOP', riotId: 'Aliado 1', ranked: { tier: 'GOLD', division: 'I', lp: 75, wins: 45, losses: 35, winrate: 56 } },
  { championName: 'Yasuo', role: 'JNG', riotId: 'Aliado 2', ranked: { tier: 'UNRANKED', division: '', lp: 0, wins: 0, losses: 0, winrate: 0 } },
  { championName: 'Zed', role: 'MID', riotId: 'Aliado 3', ranked: { tier: 'UNRANKED', division: '', lp: 0, wins: 0, losses: 0, winrate: 0 } },
  { championName: 'Jinx', role: 'ADC', riotId: 'Aliado 4', ranked: { tier: 'UNRANKED', division: '', lp: 0, wins: 0, losses: 0, winrate: 0 } },
  { championName: 'Thresh', role: 'SUPP', riotId: 'Aliado 5', ranked: { tier: 'UNRANKED', division: '', lp: 0, wins: 0, losses: 0, winrate: 0 } }
];

const DEFAULT_RED_PLACEHOLDERS: Partial<PlayerData>[] = [
  { championName: 'Darius', role: 'TOP', riotId: 'Enemigo 1', ranked: { tier: 'UNRANKED', division: '', lp: 0, wins: 0, losses: 0, winrate: 0 } },
  { championName: 'LeeSin', role: 'JNG', riotId: 'Enemigo 2', ranked: { tier: 'UNRANKED', division: '', lp: 0, wins: 0, losses: 0, winrate: 0 } },
  { championName: 'Ahri', role: 'MID', riotId: 'Enemigo 3', ranked: { tier: 'UNRANKED', division: '', lp: 0, wins: 0, losses: 0, winrate: 0 } },
  { championName: 'Ezreal', role: 'ADC', riotId: 'Enemigo 4', ranked: { tier: 'UNRANKED', division: '', lp: 0, wins: 0, losses: 0, winrate: 0 } },
  { championName: 'Leona', role: 'SUPP', riotId: 'Enemigo 5', ranked: { tier: 'UNRANKED', division: '', lp: 0, wins: 0, losses: 0, winrate: 0 } }
];

export const LiveGamePanel: React.FC<LiveGamePanelProps> = ({ onCloseManual }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [gameData, setGameData] = useState<{
    active: boolean;
    blueTeam: PlayerData[];
    redTeam: PlayerData[];
    gameMode?: string;
  } | null>(null);

  const fetchLiveGame = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/live-game');
      if (res.ok) {
        const data = await res.json();
        setGameData(data);
      }
    } catch (e) {
      console.error('[LiveGamePanel] Error fetching live game:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveGame();
  }, []);

  const rawBlue = gameData?.blueTeam || [];
  const rawRed = gameData?.redTeam || [];

  // Completar a 5 slots por equipo para asegurar que el grid ocupe todo el espacio
  const blueTeam: PlayerData[] = Array.from({ length: 5 }).map((_, idx) => {
    if (rawBlue[idx]) return { ...rawBlue[idx], role: rawBlue[idx].role || ROLES[idx] };
    const ph = DEFAULT_BLUE_PLACEHOLDERS[idx] || {};
    return {
      puuid: `ph_blue_${idx}`,
      teamId: 100,
      championId: 0,
      championName: ph.championName || 'Riven',
      role: ph.role || ROLES[idx],
      riotId: ph.riotId || `Aliado ${idx + 1}`,
      ranked: ph.ranked as any,
      todayRecord: { wins: 0, losses: 0, winrate: 0, streak: { type: null, count: 0 } }
    };
  });

  const redTeam: PlayerData[] = Array.from({ length: 5 }).map((_, idx) => {
    if (rawRed[idx]) return { ...rawRed[idx], role: rawRed[idx].role || ROLES[idx] };
    const ph = DEFAULT_RED_PLACEHOLDERS[idx] || {};
    return {
      puuid: `ph_red_${idx}`,
      teamId: 200,
      championId: 0,
      championName: ph.championName || 'Darius',
      role: ph.role || ROLES[idx],
      riotId: ph.riotId || `Enemigo ${idx + 1}`,
      ranked: ph.ranked as any,
      todayRecord: { wins: 0, losses: 0, winrate: 0, streak: { type: null, count: 0 } }
    };
  });

  return (
    <div className="w-full h-full min-h-full flex flex-col justify-between bg-[#06040a] text-white p-4 md:p-6 overflow-y-auto scrollbar-thin select-none flex-1">
      {/* Cabecera del Panel de Carga */}
      <div className="flex items-center justify-between gap-4 pb-3 mb-2 border-b border-purple-900/30 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xs font-black tracking-[0.2em] text-purple-400 uppercase bg-[#140b24] border border-purple-800/40 px-3 py-1 rounded-sm">
            [{gameData?.gameMode || 'RANKED SOLO/DUO'}]
          </span>
        </div>

        <div className="flex items-center gap-3">
          {onCloseManual && (
            <button
              onClick={onCloseManual}
              className="px-4 py-1.5 bg-[#140b24] hover:bg-purple-900/40 border border-purple-800/60 text-purple-200 text-xs font-black tracking-wider uppercase rounded-sm transition-colors cursor-pointer"
            >
              VER VISTA IN-GAME
            </button>
          )}
          <button
            onClick={fetchLiveGame}
            className="px-4 py-1.5 bg-[#6b21a8] hover:bg-[#7e22ce] text-white text-xs font-black tracking-wider uppercase rounded-sm transition-colors shadow-md cursor-pointer"
          >
            ACTUALIZAR
          </button>
        </div>
      </div>

      {/* Grid de Equipos: Ocupa todo el alto y ancho proporcionalmente */}
      <div className="flex flex-col justify-around gap-4 flex-1 min-h-0 py-2">
        {/* TEAM AZUL */}
        <div className="flex flex-col gap-2 flex-1 min-h-0">
          <h2 className="text-xs font-black uppercase tracking-[0.25em] text-indigo-400">
            TEAM AZUL (ALIADOS)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4 flex-1 min-h-0">
            {blueTeam.map((player) => (
              <PlayerCard key={player.puuid} player={player} isAlly={true} />
            ))}
          </div>
        </div>

        {/* SEPARADOR CENTRAL VS */}
        <div className="relative flex items-center justify-center my-1 shrink-0">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-purple-900/40" />
          </div>
          <div className="relative bg-[#0a0812] border border-purple-500/50 px-4 py-0.5 rounded-full text-xs font-black text-purple-300 tracking-widest uppercase shadow-md">
            VS
          </div>
        </div>

        {/* TEAM ROJO */}
        <div className="flex flex-col gap-2 flex-1 min-h-0">
          <h2 className="text-xs font-black uppercase tracking-[0.25em] text-rose-400">
            TEAM ROJO (ENEMIGOS)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4 flex-1 min-h-0">
            {redTeam.map((player) => (
              <PlayerCard key={player.puuid} player={player} isAlly={false} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
