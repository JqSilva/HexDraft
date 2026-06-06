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
            <div className="absolute inset-0 flex items-center justify-center bg-[#070709]/60 transition-all duration-300">
              <svg width="13" height="22" className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="goldGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#9333EA" />
                    <stop offset="35%" stopColor="#7d2bcaff" />
                    <stop offset="70%" stopColor="#62239cff" />
                    <stop offset="100%" stopColor="#471972ff" />
                  </linearGradient>
                </defs>
                <path
                  d="M 6.5 6.5 H 17.5 V 12.5 L 12 18 V 21"
                  stroke="url(#goldGrad)"
                  strokeWidth="4.0"
                  strokeLinejoin="miter"
                  strokeLinecap="square"
                />
                <path
                  d="M12 25.5 L15 28.5 L12 31.5 L9 28.5 Z"
                  fill="url(#goldGrad)"
                  stroke="#4d320c"
                  strokeWidth="0.5"
                />
              </svg>
            </div>
          )}
        </div>

        {/* Icono de Posición (Flotante) */}
        {!isEnemy && position && posMapping[position] && (
          <div className="absolute -bottom-1.5 -right-1.5 bg-[#0c0d12] border border-slate-800 rounded-full p-1 z-20 shadow-md flex items-center justify-center w-7 h-7">
            <img
              src={`${POS_BASE}${posMapping[position]}`}
              className="w-[18px] h-[18px] select-none pointer-events-none"
              style={{
                filter: 'hue-rotate(200deg) saturate(180%) brightness(1.4)'
              }}
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
      <div className="relative w-14 h-14 bg-input-warm border border-border-warm shrink-0 rounded-sm">
        <div className="w-full h-full overflow-hidden rounded-sm relative">
          {hasChampion ? (
            <img
              src={`${IMG_BASE}${cid}.png`}
              className="w-full h-full object-cover z-10 relative transition-opacity duration-300"
              style={{ opacity: isLocked ? 1 : 0.5 }}
              alt="champion"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-[#070709]/60 transition-all duration-300">
              <svg width="13" height="22" className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="goldGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#9333EA" />
                    <stop offset="35%" stopColor="#7d2bcaff" />
                    <stop offset="70%" stopColor="#62239cff" />
                    <stop offset="100%" stopColor="#471972ff" />
                  </linearGradient>
                </defs>
                <path
                  d="M 6.5 6.5 H 17.5 V 12.5 L 12 18 V 21"
                  stroke="url(#goldGrad)"
                  strokeWidth="4.0"
                  strokeLinejoin="miter"
                  strokeLinecap="square"
                />
                <path
                  d="M12 25.5 L15 28.5 L12 31.5 L9 28.5 Z"
                  fill="url(#goldGrad)"
                  stroke="#4d320c"
                  strokeWidth="0.5"
                />
              </svg>
            </div>
          )}
        </div>

        {/* Icono de Posición (Flotante) */}
        {!isEnemy && position && posMapping[position] && (
          <div className="absolute -bottom-1.5 -right-1.5 bg-[#0c0d12] border border-slate-800 rounded-full p-1 z-20 shadow-md flex items-center justify-center w-7 h-7">
            <img
              src={`${POS_BASE}${posMapping[position]}`}
              className="w-[18px] h-[18px] select-none pointer-events-none"
              style={{
                filter: 'hue-rotate(200deg) saturate(180%) brightness(1.4)'
              }}
              alt="role"
            />
          </div>
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
    </div>
  );
});