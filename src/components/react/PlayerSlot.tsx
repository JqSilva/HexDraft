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
        className={`w-16 h-16 bg-[#130f1e] border border-ink-800/60 ${
          isEnemy ? 'hover:border-status-danger/60' : 'hover:border-violet-muted/60'
        } shadow-[0_2px_8px_rgba(0,0,0,0.4)] flex items-center justify-center rounded-lg transition-all duration-200 relative group cursor-default select-none`}
        aria-label={`${player.displayName || player.gameName || (isEnemy ? "Enemigo" : "Invocador")} - ${position || "Sin rol"}`}
      >
        {/* Imagen del Campeón */}
        <div className="w-full h-full bg-ink-900/90 overflow-hidden rounded-lg relative">
          {hasChampion ? (
            <img
              src={`${IMG_BASE}${cid}.png`}
              className="w-full h-full object-cover scale-[1.12] z-10 relative transition-opacity duration-300"
              style={{ opacity: isLocked ? 1 : 0.45 }}
              alt={`Campeón de ${player.displayName || player.gameName || (isEnemy ? "enemigo" : "tu equipo")}`}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-ink-950/60 transition-opacity duration-300">
              <svg width="13" height="22" className="opacity-40" viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id={`goldGradCompact-${isEnemy ? 'enemy' : 'ally'}`} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor={isEnemy ? "#db7886" : "#9b4de6"} />
                    <stop offset="100%" stopColor={isEnemy ? "#991b1b" : "#6c14d5"} />
                  </linearGradient>
                </defs>
                <path
                  d="M 6.5 6.5 H 17.5 V 12.5 L 12 18 V 21"
                  stroke={`url(#goldGradCompact-${isEnemy ? 'enemy' : 'ally'})`}
                  strokeWidth="3.5"
                  strokeLinejoin="miter"
                  strokeLinecap="square"
                />
                <path
                  d="M12 25.5 L15 28.5 L12 31.5 L9 28.5 Z"
                  fill={`url(#goldGradCompact-${isEnemy ? 'enemy' : 'ally'})`}
                />
              </svg>
            </div>
          )}
        </div>

        {/* Icono de Posición (Flotante) */}
        {!isEnemy && position && posMapping[position] && (
          <div className="absolute -bottom-1.5 -right-1.5 bg-ink-900 border border-ink-700 rounded-full p-1 z-20 shadow-sm flex items-center justify-center w-6 h-6">
            <img
              src={`${POS_BASE}${posMapping[position]}`}
              className="w-3.5 h-3.5 select-none pointer-events-none opacity-80"
              alt={`Posición: ${position || "sin asignar"}`}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`h-20 bg-[#130f1e] border border-ink-800/60 ${
        isEnemy ? 'hover:border-status-danger/40' : 'hover:border-violet-muted/50'
      } shadow-[0_2px_10px_rgba(0,0,0,0.4)] flex items-center px-3.5 rounded-lg transition-all duration-200 overflow-hidden relative group cursor-default ${
        isEnemy ? 'flex-row-reverse' : 'flex-row'
      }`}
    >
      {/* Imagen del Campeón */}
      <div className="relative w-14 h-14 bg-ink-900/90 shrink-0 rounded-lg overflow-hidden border border-ink-800/40">
        <div className="w-full h-full overflow-hidden rounded-lg relative">
          {hasChampion ? (
            <img
              src={`${IMG_BASE}${cid}.png`}
              className="w-full h-full object-cover scale-[1.12] z-10 relative transition-opacity duration-300"
              style={{ opacity: isLocked ? 1 : 0.5 }}
              alt={`Campeón de ${player.displayName || player.gameName || (isEnemy ? "enemigo" : "tu equipo")}`}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-ink-950/60 transition-opacity duration-300">
              <svg width="13" height="22" className="opacity-40" viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id={`goldGradSlot-${isEnemy ? 'enemy' : 'ally'}`} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor={isEnemy ? "#db7886" : "#9b4de6"} />
                    <stop offset="100%" stopColor={isEnemy ? "#991b1b" : "#6c14d5"} />
                  </linearGradient>
                </defs>
                <path
                  d="M 6.5 6.5 H 17.5 V 12.5 L 12 18 V 21"
                  stroke={`url(#goldGradSlot-${isEnemy ? 'enemy' : 'ally'})`}
                  strokeWidth="3.5"
                  strokeLinejoin="miter"
                  strokeLinecap="square"
                />
                <path
                  d="M12 25.5 L15 28.5 L12 31.5 L9 28.5 Z"
                  fill={`url(#goldGradSlot-${isEnemy ? 'enemy' : 'ally'})`}
                />
              </svg>
            </div>
          )}
        </div>

        {/* Icono de Posición (Flotante) */}
        {!isEnemy && position && posMapping[position] && (
          <div className="absolute -bottom-1 -right-1 bg-ink-900 border border-ink-700 rounded-full p-1 z-20 shadow-sm flex items-center justify-center w-6 h-6">
            <img
              src={`${POS_BASE}${posMapping[position]}`}
              className="w-3.5 h-3.5 select-none pointer-events-none opacity-80"
              alt={`Posición: ${position || "sin asignar"}`}
            />
          </div>
        )}
      </div>

      {/* Textos del Invocador: espejados según el bando */}
      <div className={`flex-1 flex flex-col min-w-0 ${
        isEnemy ? 'mr-3 text-right items-end' : 'ml-3 text-left items-start'
      }`}>
        <span className={`text-[13px] font-medium truncate w-full leading-snug tracking-tight ${
          isEnemy ? 'text-[#f296a2]' : 'text-text-strong'
        }`}>
          {player.displayName || player.gameName || (isEnemy ? "Enemigo" : "Buscando...")}
        </span>
        <span className={`text-[10px] uppercase font-mono tracking-wider truncate w-full ${
          isLocked ? 'text-text-secondary font-medium' : 'text-text-muted'
        }`}>
          {hasChampion ? (isLocked ? "Bloqueado" : "Eligiendo...") : "Esperando Pick"}
        </span>
      </div>
    </div>
  );
});

PlayerSlot.displayName = 'PlayerSlot';

export default PlayerSlot;
