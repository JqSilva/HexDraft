import React from 'react';
import type { Champion } from './types';
import { POS_BASE, posMapping, posLabels, getTierInfo, getRoleKey } from './utils';

interface ChampionListProps {
  processedChampions: Champion[];
  selectedLane: string;
  setSelectedLane: (lane: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  toggleSort: (field: 'winrate' | 'pickrate' | 'tier' | 'name') => void;
  renderSortIndicator: (field: 'winrate' | 'pickrate' | 'tier' | 'name') => React.ReactNode;
  lastUpdated: string;
  timeAgoText: string;
}

export const ChampionList = ({
  processedChampions,
  selectedLane,
  setSelectedLane,
  searchQuery,
  setSearchQuery,
  toggleSort,
  renderSortIndicator,
  lastUpdated,
  timeAgoText
}: ChampionListProps) => {
  return (
    <div className="w-full flex flex-col p-4 md:p-6 animate-in fade-in duration-300">
      
      {/* Cabecera Táctica (Ocupa todo el ancho) */}
      <header className="relative flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-warm pb-4 mb-6">
        <div>
          <span className="text-[10px] uppercase tracking-[0.3em] font-black text-slate-500 block mb-1">
            FILTRO GLOBAL DE META // ANÁLISIS DE DESEMPEÑO
          </span>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-black text-white uppercase tracking-tight">
              Estadísticas de <span className="text-purple-accent">Campeones</span>
            </h1>
          </div>
        </div>
      
        {lastUpdated && lastUpdated !== '-' && (
          <div className="flex flex-row gap-4 text-[12px] text-slate-400 uppercase tracking-widest font-mono select-none">
            <div>META: <span className="text-[#9055ff] font-bold text-right">Diamante  </span></div>
            <div>ACTUALIZADO: <span className="text-[#9055ff] font-bold">{timeAgoText}</span></div>
          </div>
        )}
      </header>

      {/* Contenido Principal Centrado */}
      <div className="w-full max-w-[1300px] mx-auto flex flex-col gap-6">
        
        {/* Fila de Filtros y Buscador */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 select-none">
          {/* Filtros de Línea */}
          <div className="flex flex-wrap gap-2">
            {["ALL", "TOP", "JNG", "MID", "ADC", "SUP"].map((lane) => {
              const isActive = selectedLane === lane;
              const mappedIcon = posMapping[getRoleKey(lane)];
              
              return (
                <button
                  key={lane}
                  onClick={() => setSelectedLane(lane)}
                  className={`flex items-center gap-2 px-4 py-2 border rounded-sm font-black text-xs tracking-widest uppercase transition-all duration-200 cursor-pointer active:scale-95
                    ${isActive 
                      ? "bg-purple-accent/20 border-purple-accent text-white shadow-[0_0_15px_rgba(144,85,255,0.15)]" 
                      : "bg-panel-warm border-border-warm text-slate-400 hover:text-slate-200 hover:border-border-warm-hover"
                    }`}
                >
                  {mappedIcon && (
                    <img
                      src={`${POS_BASE}${mappedIcon}`}
                      className="w-4 h-4 object-contain"
                      style={{
                        filter: isActive 
                          ? 'hue-rotate(200deg) saturate(180%) brightness(1.4)' 
                          : 'grayscale(60%) opacity(0.6)'
                      }}
                      alt={lane}
                    />
                  )}
                  {lane === "ALL" ? "TODOS" : posLabels[getRoleKey(lane)]?.toUpperCase()}
                </button>
              );
            })}
          </div>

          {/* Buscador de Campeones */}
          <div className="relative w-full md:w-72">
            <input
              type="text"
              placeholder="BUSCAR CAMPEÓN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#060608] border border-border-warm rounded-sm px-4 py-2 text-xs font-black tracking-wider text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-accent focus:ring-1 focus:ring-purple-accent/30 transition-all duration-300 uppercase"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-[10px] font-black uppercase tracking-wider"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>

        {/* Tabla de Estadísticas */}
        <div className="bg-panel-warm border border-border-warm rounded-sm tech-corners shadow-xl overflow-hidden flex flex-col">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse select-none">
              <thead>
                <tr className="border-b border-border-warm text-slate-300 font-extrabold uppercase text-[10px] tracking-wider bg-black/50">
                  <th className="py-3 px-4 text-center w-14">#</th>
                  <th className="py-3 px-4 cursor-pointer hover:text-white transition-colors duration-150" onClick={() => toggleSort('name')}>
                    Campeón {renderSortIndicator('name')}
                  </th>
                  <th className="py-3 px-4">Línea Principal</th>
                  <th className="py-3 px-4 text-center w-24 cursor-pointer hover:text-white transition-colors duration-150" onClick={() => toggleSort('tier')}>
                    Tier {renderSortIndicator('tier')}
                  </th>
                  <th className="py-3 px-4 text-center cursor-pointer hover:text-white transition-colors duration-150" onClick={() => toggleSort('winrate')}>
                    Winrate {renderSortIndicator('winrate')}
                  </th>
                  <th className="py-3 px-4 text-center cursor-pointer hover:text-white transition-colors duration-150" onClick={() => toggleSort('pickrate')}>
                    Pickrate {renderSortIndicator('pickrate')}
                  </th>
                  <th className="py-3 px-4 text-center">Partidas</th>
                </tr>
              </thead>
              <tbody>
                {processedChampions.length > 0 ? (
                  processedChampions.map((champ, index) => {
                    const tierInfo = getTierInfo(champ.meta?.tier || 5);
                    const isPositiveWin = (champ.meta?.winRate || 50.0) >= 50.0;
                    
                    return (
                      <tr 
                        key={champ.id}
                        onClick={() => {
                          const nameSlug = champ.name.toLowerCase().replace(/[^a-z0-9]/g, "");
                          const laneParam = champ.lane?.toLowerCase() || "unknown";
                          window.location.href = `/champion/${nameSlug}/buildbuild?lane=${laneParam}`;
                        }}
                        className="border-b border-border-warm/60 hover:bg-white/[0.02] transition-colors duration-100 cursor-pointer group text-slate-300 font-bold text-xs"
                      >
                        {/* Rango */}
                        <td className="py-2.5 px-4 text-center font-mono font-bold text-slate-400">
                          {index + 1}
                        </td>

                        {/* Campeón */}
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={`https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${champ.id}.png`}
                              className="w-8 h-8 rounded-sm border border-border-warm group-hover:border-purple-accent/60 transition-colors object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = "/favicon.svg";
                              }}
                              alt={champ.name}
                            />
                            <span className="font-extrabold text-xs text-slate-200 group-hover:text-white transition-colors uppercase tracking-wide">
                              {champ.name}
                            </span>
                          </div>
                        </td>

                        {/* Línea */}
                        <td className="py-2.5 px-4">
                          {champ.lane && posMapping[champ.lane.toUpperCase()] ? (
                            <div className="flex items-center gap-2">
                              <img
                                src={`${POS_BASE}${posMapping[champ.lane.toUpperCase()]}`}
                                className="w-4 h-4 object-contain brightness-110"
                                style={{ filter: 'hue-rotate(200deg) saturate(180%) brightness(1.4)' }}
                                alt={champ.lane}
                              />
                              <span className="text-[11px] font-bold uppercase text-slate-300 tracking-wider">
                                {posLabels[champ.lane.toUpperCase()]}
                              </span>
                              <span className="text-[9px] font-mono text-slate-550">
                                ({champ.lanesPickrate?.[champ.lane.toUpperCase()] ? `${champ.lanesPickrate[champ.lane.toUpperCase()].toFixed(1)}%` : '100%'})
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-555 font-extrabold text-[9px] tracking-widest uppercase">UNKNOWN</span>
                          )}
                        </td>

                        {/* Tier */}
                        <td className="py-2.5 px-4 text-center">
                          <span className={`inline-block px-2.5 py-0.5 border text-[10px] font-black rounded-sm shadow-inner uppercase tracking-wider ${tierInfo.color}`}>
                            {tierInfo.label}
                          </span>
                        </td>

                        {/* Winrate */}
                        <td className="py-2.5 px-4 text-center font-mono font-extrabold">
                          <span className={isPositiveWin ? "text-emerald-400" : "text-red-400"}>
                            {(champ.meta?.winRate || 50.0).toFixed(2)}%
                          </span>
                        </td>

                        {/* Pickrate */}
                        <td className="py-2.5 px-4 text-center font-mono font-extrabold text-slate-300">
                          {champ.pickrate}%
                        </td>

                        {/* Partidas */}
                        <td className="py-2.5 px-4 text-center font-mono text-slate-400">
                          {champ.matches.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="py-12 px-6 text-center text-slate-500 tracking-widest uppercase text-sm font-bold">
                      No se encontraron campeones con los filtros aplicados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
export default ChampionList;
