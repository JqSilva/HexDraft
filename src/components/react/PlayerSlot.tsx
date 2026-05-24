// src/components/react/PlayerSlot.tsx
import React from 'react';

interface PlayerProps {
  player: any;
  isEnemy?: boolean;
}

export const PlayerSlot = ({ player, isEnemy = false }: PlayerProps) => {
  const IMG_BASE = "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/";
  const POS_BASE = "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/";
  
  const posMapping: any = {
    "top": "icon-position-top.png",
    "jungle": "icon-position-jungle.png",
    "middle": "icon-position-middle.png",
    "bottom": "icon-position-bottom.png",
    "utility": "icon-position-utility.png"
  };

  const cid = player.championId || player.championPickIntent || 0;
  const hasChampion = cid > 0; 
  const isLocked = player.championId !== 0; 

  return (
    <div className={`h-24 bg-slate-900/40 border border-slate-800 flex items-center px-4 rounded-sm transition-all overflow-hidden relative group ${
      isEnemy ? 'border-r-4 border-r-red-700 flex-row-reverse' : 'border-l-4 border-l-cyan-600'
    }`}> 
      
      {/* Imagen del Campeón */}
      <div className="relative w-16 h-16 bg-slate-950 border border-slate-800 overflow-hidden shrink-0 rounded-sm">
        {hasChampion ? (
          <img 
            src={`${IMG_BASE}${cid}.png`} 
            className="w-full h-full object-cover z-10 relative transition-opacity duration-300"
            style={{ opacity: isLocked ? 1 : 0.5 }} 
            alt="champion"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-xl font-bold text-slate-800">?</div>
        )}
      </div>

      {/* Textos del Invocador */}
      <div className={`flex flex-col min-w-0 ${isEnemy ? 'mr-4 text-right' : 'ml-4'}`}> 
        <span className={`text-xs font-bold uppercase tracking-wide truncate w-full ${isEnemy ? 'text-red-500' : 'text-cyan-500'}`}>
          {player.displayName || player.gameName || (isEnemy ? "Enemigo" : "Buscando...")}
        </span>
        <span className={`text-[11px] uppercase font-black italic tracking-wide truncate ${isLocked ? 'text-slate-300' : 'text-slate-500'}`}>
          {hasChampion ? (isLocked ? "Bloqueado" : "Eligiendo...") : "Esperando Pick"} 
        </span>
      </div>

      {/* Icono de Posición (Solo Aliados según tu código) */}
      {!isEnemy && player.assignedPosition && posMapping[player.assignedPosition.toLowerCase()] && (
        <div className="absolute right-1 mr-2 shrink-0">
          <img 
            src={`${POS_BASE}${posMapping[player.assignedPosition.toLowerCase()]}`} 
            className="w-8 h-8 opacity-50 brightness-200" 
            style={{ filter: "brightness(0) invert(1)" }}
            alt="role"
          />
        </div>
      )}
    </div>
  );
};