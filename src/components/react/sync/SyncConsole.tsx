import React from 'react';
import type { LogItem } from './types';

interface SyncConsoleProps {
  isSyncing: boolean;
  progressPhase: string;
  progressPercent: number;
  logs: LogItem[];
  scrollRef: React.RefObject<HTMLDivElement | null>;
}

export const SyncConsole = ({
  isSyncing,
  progressPhase,
  progressPercent,
  logs,
  scrollRef
}: SyncConsoleProps) => {
  return (
    <div className="border border-border-warm bg-[#050508]/80 rounded-sm flex flex-col h-[400px] shadow-2xl relative overflow-hidden backdrop-blur-md">
      {/* Header de Consola */}
      <div className="flex justify-between items-center px-6 py-4 border-b border-border-warm/40 bg-black/40 flex-shrink-0 select-none">
        <div className="flex items-center gap-2">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 font-mono">
            HexDraft Core Event Log Console
          </h3>
        </div>
        
        {isSyncing && (
          <div className="text-[9.5px] font-mono text-purple-accent font-black uppercase tracking-wider">
            FASE: <span className="text-white font-bold">{
              progressPhase === 'opgg' 
                ? 'OP.GG SCRAPING' 
                : progressPhase === 'puppeteer' 
                  ? 'BUILDS & COUNTERS' 
                  : progressPhase === 'lanes' 
                    ? 'MAPEO LANES' 
                    : progressPhase.toUpperCase()
            }</span>
          </div>
        )}
      </div>

      {/* Consola principal */}
      <div className="flex-grow flex flex-col p-6 min-h-0">
        {/* Barra de progreso integrada */}
        {isSyncing && (
          <div className="mb-4 pb-4 border-b border-border-warm/20 flex-shrink-0">
            <div className="flex justify-between items-center mb-2 text-[9.5px] uppercase tracking-wider font-bold">
              <span className="text-slate-400 font-mono">Progreso de la tarea:</span>
              <span className="text-purple-accent font-mono font-black">{progressPercent}%</span>
            </div>
            <div className="w-full bg-[#11111a] border border-border-warm/40 h-2 rounded-sm overflow-hidden relative">
              <div 
                className="bg-gradient-to-r from-purple-accent to-fuchsia-400 h-full rounded-sm transition-all duration-300 shadow-[0_0_10px_rgba(144,85,255,0.4)]" 
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Lista de Logs */}
        <div 
          ref={scrollRef}
          className="space-y-2.5 font-mono text-[10px] md:text-[11px] flex-1 overflow-y-auto pr-2 scrollbar-thin select-text"
        >
          {logs.map((log, i) => {
            let textClass = 'text-slate-300';
            let tagClass = 'text-cyan-400';
            
            if (log.type === 'error') {
              textClass = 'text-rose-400';
              tagClass = 'text-rose-500 font-black';
            } else if (log.type === 'sync') {
              textClass = 'text-yellow-300';
              tagClass = 'text-yellow-500 font-black';
            } else if (log.type === 'success') {
              textClass = 'text-emerald-300';
              tagClass = 'text-emerald-500 font-black';
            } else if (log.type === 'guard') {
              textClass = 'text-purple-300';
              tagClass = 'text-purple-accent font-black';
            }

            return (
              <div key={`${log.time}-${log.msg}-${i}`} className="flex gap-4 items-start select-text leading-relaxed">
                <span className={`${tagClass} select-none shrink-0`}>
                  [{log.time}]
                </span>
                <span className={`${textClass} break-all`}>
                  {log.msg}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SyncConsole;
