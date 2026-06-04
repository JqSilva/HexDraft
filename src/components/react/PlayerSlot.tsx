import React, { memo } from 'react';

export interface LcuPlayer {
  championId: number;
  championPickIntent: number;
  assignedPosition: string;
  displayName?: string;
  gameName?: string;
  cellId: number;
}

interface PlayerProps {
  player: LcuPlayer;
  isEnemy?: boolean;
  compact?: boolean;
}

export const PlayerSlot = memo(({ player, isEnemy = false, compact = false }: PlayerProps) => {
  const IMG_BASE = "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/";
  const POS_BASE = "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/";

  const posMapping: Record<string, string> = {
    "top": "icon-position-top.png",
    "jungle": "icon-position-jungle.png",
    "middle": "icon-position-middle.png",
    "bottom": "icon-position-bottom.png",
    "utility": "icon-position-utility.png"
  };

  const cid = player.championId || player.championPickIntent || 0;
  const hasChampion = cid > 0;
  const isLocked = player.championId !== 0;
  const position = player.assignedPosition?.toLowerCase() || "";

  if (compact) {
    return (
      <div
        className={`w-16 h-16 bg-panel-warm border border-border-warm hover:border-purple-accent flex items-center justify-center rounded-sm transition-all duration-200 relative group cursor-default select-none ${isEnemy ? 'border-r-4 border-r-red-500' : 'border-l-4 border-l-cyan-500'
          }`}
        title={`${player.displayName || player.gameName || (isEnemy ? "Enemigo" : "Invocador")} - ${position || "Sin rol"}`}
      >
        {/* Imagen del Campeón */}
        <div className="w-full h-full bg-input-warm overflow-hidden rounded-sm relative">
          {hasChampion ? (
            <img
              src={`${IMG_BASE}${cid}.png`}
              className="w-full h-full object-cover z-10 relative transition-opacity duration-300"
              style={{ opacity: isLocked ? 1 : 0.4 }}
              alt="champion"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-sm font-black text-purple-heart-900">?</div>
          )}
        </div>

        {/* Icono de Posición (Flotante) */}
        {!isEnemy && position && posMapping[position] && (
          <div className="absolute -bottom-1 -right-1 bg-input-warm border border-border-warm rounded-sm p-0.5 z-20">
            <img
              src={`${POS_BASE}${posMapping[position]}`}
              className="w-3.5 h-3.5 invert brightness-200"
              alt="role"
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`h-20 bg-panel-warm border border-border-warm flex items-center px-3 rounded-sm transition-all duration-200 overflow-hidden relative group cursor-default ${isEnemy ? 'border-r-4 border-r-red-500 flex-row-reverse' : 'border-l-4 border-l-cyan-500'
      }`}>

      {/* Imagen del Campeón */}
      <div className="relative w-14 h-14 bg-input-warm border border-border-warm overflow-hidden shrink-0 rounded-sm">
        {hasChampion ? (
          <img
            src={`${IMG_BASE}${cid}.png`}
            className="w-full h-full object-cover z-10 relative transition-opacity duration-300"
            style={{ opacity: isLocked ? 1 : 0.5 }}
            alt="champion"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-lg font-black text-purple-heart-900">?</div>
        )}
      </div>

      {/* Textos del Invocador */}
      <div className={`flex flex-col min-w-0 ${isEnemy ? 'mr-3 text-right' : 'ml-3'}`}>
        <span className={`text-xs font-black uppercase tracking-wider truncate w-36 ${isEnemy ? 'text-red-400' : 'text-cyan-400'}`}>
          {player.displayName || player.gameName || (isEnemy ? "Enemigo" : "Buscando...")}
        </span>
        <span className={`text-[10px] uppercase font-black italic tracking-wider truncate ${isLocked ? 'text-slate-200' : 'text-[#DAD9FF]'}`}>
          {hasChampion ? (isLocked ? "Bloqueado" : "Eligiendo...") : "Esperando Pick"}
        </span>
      </div>

      {/* Icono de Posición */}
      {!isEnemy && position && posMapping[position] && (
        <div className="absolute right-1 mr-2 shrink-0 select-none">
          <img
            src={`${POS_BASE}${posMapping[position]}`}
            className="w-6 h-6 opacity-40 invert brightness-200"
            alt="role"
          />
        </div>
      )}
    </div>
  );
});