import React, { useState, useEffect, useRef } from 'react';

interface LogItem {
  time: string;
  msg: string;
  type: string;
}

interface ToastState {
  visible: boolean;
  title: string;
  body: string;
  type: string;
}

export const SyncPanel = () => {
  const [isSyncing, setIsSyncing] = useState<'meta_builds' | 'SyncEstructuraLanes' | null>(null);
  const [version, setVersion] = useState<string>('--.--');
  const [lastSync, setLastSync] = useState<string>('-');
  const [lastLaneSync, setLastLaneSync] = useState<string>('-');
  const [forceSync, setForceSync] = useState<boolean>(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [progressPhase, setProgressPhase] = useState<string>('idle');

  const [logs, setLogs] = useState<LogItem[]>([
    { time: '--:--', msg: 'Esperando inicialización de sincronización masiva...', type: 'idle' }
  ]);
  const [toast, setToast] = useState<ToastState>({ visible: false, title: '', body: '', type: 'info' });

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [logs]);

  // Cargar versión LCU y timestamps iniciales
  const fetchInitialData = async () => {
    try {
      const vRes = await fetch('/api/game-version');
      const vData = await vRes.json();
      if (vData.short) {
        setVersion(vData.short);
      }
    } catch (e) {
      console.error("No se pudo obtener la versión de LoL");
    }

    try {
      const cRes = await fetch('/api/config');
      const cData = await cRes.json();
      setLastSync(cData.last_sync_timestamp || '-');
      setLastLaneSync(cData.last_lane_sync_timestamp || '-');
    } catch (e) {
      console.error("No se pudo obtener las marcas de tiempo de configuración");
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const triggerToast = (title: string, body: string, type: string) => {
    setToast({ visible: true, title, body, type });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 6000);
  };

  const addLog = (msg: string, type: string) => {
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    setLogs(prev => [{ time, msg, type }, ...prev].slice(0, 50));
  };

  const runSync = async (type: 'meta_builds' | 'SyncEstructuraLanes') => {
    setIsSyncing(type);
    setProgressPercent(0);
    setProgressPhase('starting');
    addLog(`Iniciando sincronización ${type === 'meta_builds' ? 'Bayesiana de Builds' : 'de Mapeo de Posiciones'}...`, 'sync');
    triggerToast("Iniciando", `Actualizando base de datos ${version}...`, "warn");

    try {
      const url = `/api/sync?type=${type}&version=${version}&force=${type === 'meta_builds' ? forceSync : 'false'}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error();
      }
      addLog(`MOTOR: Solicitud de sincronización ${type} enviada. Ejecutando en segundo plano...`, 'info');
    } catch (e) {
      addLog(`ERROR: Fallo al iniciar la sincronización ${type}.`, 'error');
      triggerToast("Error", "Fallo al iniciar el motor", "error");
      setIsSyncing(null);
    }
  };

  useEffect(() => {
    const checkServerStatus = async () => {
      try {
        const res = await fetch('/api/sync?type=status');
        const data = await res.json();
        
        if (data.logs && data.logs.length > 0) {
          const mappedLogs = data.logs.map((log: string) => {
            const match = log.match(/^\[(\d{2}):(\d{2}):(\d{2})\]\s*(.*)$/);
            if (match) {
              const [_, hh, mm, ss, msg] = match;
              let type = 'info';
              if (msg.includes('❌') || msg.includes('Error') || msg.includes('falló')) type = 'error';
              else if (msg.includes('🛑') || msg.includes('CANCEL')) type = 'error';
              else if (msg.includes('✅') || msg.includes('🏁') || msg.includes('finalizado') || msg.includes('finalizada')) type = 'success';
              else if (msg.includes('🚀') || msg.includes('Motor') || msg.includes('Iniciando') || msg.includes('Scrapeando') || msg.includes('⚡')) type = 'sync';
              return {
                time: `${hh}:${mm}:${ss}`,
                msg: msg,
                type: type
              };
            }
            return { time: '--:--', msg: log, type: 'info' };
          });
          setLogs([...mappedLogs].reverse());
        }

        if (data.syncing) {
          setIsSyncing(data.progressPhase === 'lanes' ? 'SyncEstructuraLanes' : 'meta_builds');
          setProgressPercent(data.progressPercent || 0);
          setProgressPhase(data.progressPhase || 'idle');
        } else {
          if (isSyncing) {
            triggerToast("Finalizado", "Proceso de sincronización terminado", "info");
            setIsSyncing(null);
            setProgressPercent(0);
            setProgressPhase('idle');
            fetchInitialData();
          }
        }
      } catch (e) { /* Error de red */ }
    };

    const interval = setInterval(checkServerStatus, 2000);
    return () => clearInterval(interval);
  }, [isSyncing]);

  const cancelSync = async () => {
    addLog("Enviando señal de aborto...", "error");
    try {
      const res = await fetch('/api/sync?type=cancel');
      if (res.ok) {
        triggerToast("Cancelando", "Deteniendo motores de scrapping", "error");
      }
    } catch (e) {
      addLog("Error al comunicar cancelación", "error");
    }
  };

  const formatTimestamp = (ts: string) => {
    if (ts === '-' || !ts) return 'Nunca sincronizado';
    try {
      const date = new Date(ts);
      if (isNaN(date.getTime())) return ts;
      return date.toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return ts;
    }
  };

  return (
    <>
      {toast.visible && (
        <div className="fixed top-24 right-6 z-50 animate-in slide-in-from-right duration-300">
          <div className={`p-4 rounded border ${toast.type === 'error' ? 'bg-red-900/40 border-red-500 text-red-200' : toast.type === 'warn' ? 'bg-yellow-900/40 border-yellow-500 text-yellow-200' : 'bg-purple-900/40 border-purple-500 text-purple-200'} shadow-lg backdrop-blur-md max-w-sm`}>
            <h4 className="text-xs font-black uppercase tracking-wider">{toast.title}</h4>
            <p className="text-[10px] uppercase mt-1 tracking-wide">{toast.body}</p>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-8 relative z-10 mt-8">
        
        {/* BARRA DE ESTADO GLOBAL (SIN CARDS) */}
        <div className="flex flex-wrap items-center justify-between gap-6 pb-6 border-b border-border-warm/30">
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-slate-500 uppercase font-black tracking-wider">Versión LoL:</span>
            <span className="text-xs font-mono font-bold text-white px-3 py-1 bg-[#13131a] border border-[#23232c] rounded-sm select-none">{version}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-slate-500 uppercase font-black tracking-wider">Última Sync Builds:</span>
            <span className="text-xs font-mono text-slate-300">{formatTimestamp(lastSync)}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-slate-500 uppercase font-black tracking-wider">Última Sync Carriles:</span>
            <span className="text-xs font-mono text-slate-300">{formatTimestamp(lastLaneSync)}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-slate-500 uppercase font-black tracking-wider">Integridad Base Datos:</span>
            <span className={`text-xs font-black tracking-wider uppercase ${isSyncing ? 'text-yellow-500' : 'text-[#00f0ff]'}`}>
              {isSyncing ? 'Actualizando' : 'Óptima'}
            </span>
          </div>
        </div>

        {/* ACCIONES DE SINCRONIZACIÓN (SIN CARDS) */}
        <div className="space-y-6">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9055ff]">// Panel de Control</h3>
          
          {/* Fila de Builds */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 py-6 border-b border-border-warm/20">
            <div className="flex-1 space-y-2">
              <h4 className="text-base font-black text-white uppercase tracking-wider italic">Sincronización de Meta & Builds</h4>
              <p className="text-xs text-slate-400 font-medium">Scrapea OP.GG y DPM.lol para actualizar coeficientes de winrate, tiers, builds bayesianas y counters.</p>
              
              <div className="pt-2 flex items-center gap-3 select-none">
                <input 
                  type="checkbox" 
                  id="force-sync-checkbox"
                  checked={forceSync}
                  onChange={(e) => setForceSync(e.target.checked)}
                  disabled={!!isSyncing}
                  className="w-3.5 h-3.5 text-purple-accent border-slate-700 bg-slate-900 rounded cursor-pointer disabled:opacity-50"
                />
                <label htmlFor="force-sync-checkbox" className="text-[10px] uppercase font-bold text-slate-400 tracking-wider cursor-pointer select-none">
                  Forzar descarga completa (omite el filtro diferencial y descarga todo de cero)
                </label>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button 
                onClick={() => runSync('meta_builds')}
                disabled={!!isSyncing} 
                className={`px-8 py-3.5 font-black uppercase text-[10px] tracking-widest rounded-sm transition-all duration-200 border cursor-pointer select-none active:scale-95 ${isSyncing ? 'bg-border-warm border-border-warm text-slate-500 cursor-not-allowed' : 'bg-purple-accent border-purple-accent hover:bg-purple-accent-hover text-white shadow-[0_0_15px_rgba(144,85,255,0.2)]'}`}
              >
                {isSyncing === 'meta_builds' ? 'Procesando...' : 'Ejecutar Sincronización'}
              </button>
              {isSyncing === 'meta_builds' && (
                <button 
                  onClick={cancelSync}
                  className="px-5 py-3.5 bg-transparent border border-red-900/50 hover:bg-red-600/20 text-red-500 font-black uppercase text-[9px] tracking-widest rounded-sm transition-all duration-200 cursor-pointer active:scale-95"
                >
                  Cancelar
                </button>
              )}
            </div>
          </div>

          {/* Fila de Mapeo */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 py-6 border-b border-border-warm/20">
            <div className="flex-1 space-y-1">
              <h4 className="text-base font-black text-white uppercase tracking-wider italic">Mapeo de Posiciones y Carriles</h4>
              <p className="text-xs text-slate-400 font-medium">Actualiza la matriz de roles preferidos de campeones basándose en el meta actual de Diamond+.</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button 
                onClick={() => runSync('SyncEstructuraLanes')}
                disabled={!!isSyncing}
                className={`px-8 py-3.5 font-black uppercase text-[10px] tracking-widest rounded-sm transition-all duration-200 border cursor-pointer select-none active:scale-95 ${isSyncing ? 'bg-border-warm border-border-warm text-slate-500 cursor-not-allowed' : 'bg-transparent border-border-warm hover:border-hextech-blue hover:text-white text-slate-400'}`}
              >
                {isSyncing === 'SyncEstructuraLanes' ? 'Procesando...' : 'Actualizar Mapeo'}
              </button>
              {isSyncing === 'SyncEstructuraLanes' && (
                <button 
                  onClick={cancelSync}
                  className="px-5 py-3.5 bg-transparent border border-red-900/50 hover:bg-red-600/20 text-red-500 font-black uppercase text-[9px] tracking-widest rounded-sm transition-all duration-200 cursor-pointer active:scale-95"
                >
                  Cancelar
                </button>
              )}
            </div>
          </div>
        </div>

        {/* TERMINAL DE EVENTOS (SIN PANELES EXTERNOS DE CARDS) */}
        <div className="border border-border-warm/30 bg-[#050508]/60 p-6 rounded-sm flex flex-col h-[400px]">
          <div className="flex justify-between items-center mb-4 flex-shrink-0">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              <span className="text-purple-accent mr-2">//</span>Terminal de Eventos
            </h3>
            {isSyncing && (
              <div className="text-[10px] font-mono text-purple-accent font-bold uppercase animate-pulse">
                Fase: {progressPhase === 'opgg' ? 'OP.GG Scraper' : progressPhase === 'puppeteer' ? 'Builds & Matchups' : progressPhase === 'lanes' ? 'Tierlist Lanes' : progressPhase}
              </div>
            )}
          </div>

          {/* Barra de progreso integrada en la propia consola */}
          {isSyncing && (
            <div className="mb-4 pb-4 border-b border-border-warm/20 flex-shrink-0">
              <div className="flex justify-between items-center mb-1.5 text-[9px] uppercase tracking-wider font-bold">
                <span className="text-slate-300 font-mono">Progreso:</span>
                <span className="text-purple-accent font-mono">{progressPercent}%</span>
              </div>
              <div className="w-full bg-[#11111a] border border-border-warm/30 h-2 rounded-sm overflow-hidden relative">
                <div 
                  className="bg-gradient-to-r from-purple-accent to-fuchsia-400 h-full rounded-sm transition-all duration-300 shadow-[0_0_8px_rgba(144,85,255,0.5)]" 
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
            </div>
          )}

          <div 
            ref={scrollRef}
            className="space-y-2.5 font-mono text-[10px] md:text-[11px] flex-1 overflow-y-auto pr-2 scrollbar-thin"
          >
            {logs.map((log, i) => (
              <div key={i} className="flex gap-4 animate-in fade-in slide-in-from-left-2">
                <span className={`${log.type === 'error' ? 'text-red-500' : log.type === 'sync' ? 'text-yellow-500' : log.type === 'guard' ? 'text-purple-accent' : 'text-[#00f0ff]'} font-bold`}>
                  [{log.time}]
                </span>
                <span className={log.type === 'error' ? 'text-red-400' : log.type === 'idle' ? 'text-slate-500' : 'text-slate-300'}>
                  {log.msg}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </>
  );
};