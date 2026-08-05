// src/components/react/LiveGamePanel.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { PlayerCard, type PlayerData } from './PlayerCard.js';

interface LiveGamePanelProps {
  onCloseManual?: () => void;
}

const ROLE_ORDER: Record<string, number> = {
  'TOP': 1,
  'JNG': 2,
  'JUNGLE': 2,
  'MID': 3,
  'MIDDLE': 3,
  'ADC': 4,
  'BOTTOM': 4,
  'BOT': 4,
  'SUPP': 5,
  'SUPPORT': 5,
  'UTILITY': 5
};

function sortPlayersByRole(players: PlayerData[]): PlayerData[] {
  return [...players].sort((a, b) => {
    const roleA = ROLE_ORDER[(a.role || '').toUpperCase()] || 3;
    const roleB = ROLE_ORDER[(b.role || '').toUpperCase()] || 3;
    return roleA - roleB;
  });
}

export const LiveGamePanel: React.FC<LiveGamePanelProps> = ({ onCloseManual }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [gameData, setGameData] = useState<{
    active: boolean;
    blueTeam?: PlayerData[];
    redTeam?: PlayerData[];
    myTeam?: PlayerData[];
    theirTeam?: PlayerData[];
    gameMode?: string;
  } | null>(null);

  const fetchLiveGame = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await fetch('/api/live-game');
        if (res.ok && !ignore) {
          const data = await res.json();
          setGameData(data);
        }
      } catch (e) {
        console.error('[LiveGamePanel] Error fetching live game:', e);
      } finally {
        if (!ignore) setLoading(false);
      }
    })();

    const interval = setInterval(fetchLiveGame, 1500);
    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, [fetchLiveGame]);

  const rawBlue = gameData?.blueTeam || gameData?.myTeam || [];
  const rawRed = gameData?.redTeam || gameData?.theirTeam || [];

  const blueTeam = sortPlayersByRole(rawBlue);
  const redTeam = sortPlayersByRole(rawRed);

  return (
    <div className="w-full h-full flex flex-col justify-between p-2.5 xl:p-4 text-slate-200 select-none overflow-hidden min-h-0">
      {/* BARRA SUPERIOR DE ACCIONES */}
      <div className="flex justify-between items-center pb-2 border-b border-purple-950/80 mb-2 shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-xs xl:text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
            <span className="text-purple-400 font-mono">[{gameData?.gameMode || 'RANKED SOLO/DUO'}]</span>
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {onCloseManual && (
            <button
              onClick={onCloseManual}
              className="px-2.5 py-1 text-[11px] font-mono font-bold uppercase tracking-wider bg-purple-950/60 hover:bg-purple-900/60 text-purple-200 rounded-sm border border-purple-700/50 transition-colors cursor-pointer"
            >
              Ver Vista In-Game
            </button>
          )}

          <button
            onClick={fetchLiveGame}
            className="px-2.5 py-1 text-[11px] font-mono font-bold uppercase tracking-wider bg-slate-900 hover:bg-slate-800 text-slate-200 rounded-sm border border-slate-700 transition-colors cursor-pointer"
          >
            Actualizar
          </button>
        </div>
      </div>

      {/* FILA SUPERIOR: JUGADORES ALIADOS ORDENADOS POR LÍNEA */}
      <div className="flex-1 min-h-0 py-1">
        
        <div className="grid grid-cols-5 gap-2 xl:gap-3 flex-1 min-h-0 w-full items-stretch h-full">
          {blueTeam.map((p, idx) => (
            <PlayerCard key={p.puuid || `blue_${idx}`} player={p} index={idx} isAlly={true} />
          ))}
        </div>
      </div>

      {/* SEPARADOR CENTRAL 'VS' ESTILIZADO DE LA MAQUETA */}
      <div className="relative my-1 xl:my-2 flex items-center justify-center shrink-0">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-purple-900/60" />
        </div>
        <div className="relative px-4 py-0.5 bg-[#0e0a1a] border border-purple-600/50 rounded-sm text-purple-400 font-black text-xs xl:text-base italic tracking-widest shadow-lg select-none">
          VS
        </div>
      </div>

      {/* FILA INFERIOR: JUGADORES ENEMIGOS ORDENADOS POR LÍNEA */}
      <div className="flex-1 min-h-0 py-1">
        
        <div className="grid grid-cols-5 gap-2 xl:gap-3 flex-1 min-h-0 w-full items-stretch h-full">
          {redTeam.map((p, idx) => (
            <PlayerCard key={p.puuid || `red_${idx}`} player={p} index={idx} isAlly={false} />
          ))}
        </div>
      </div>
    </div>
  );
};
