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
  const [isSyncing, setIsSyncing] = useState<string | null>(null);
  const [version, setVersion] = useState<string>('--.--');
  const [logs, setLogs] = useState<LogItem[]>([
    { time: '--:--', msg: 'Esperando inicialización de sincronización masiva...', type: 'idle' },
    { time: '12:31', msg: 'Nexo: Versión detectada automáticamente', type: 'info' },
    { time: '12:30', msg: 'Sistema Guard: Conexión LCU establecida en Puerto 5421', type: 'guard' }
  ]);
  const [toast, setToast] = useState<ToastState>({ visible: false, title: '', body: '', type: 'info' });

  const [lolPath, setLolPath] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [logs]);

  // Auto-detección de versión y ruta al cargar
  useEffect(() => {
    fetch('/api/game-version')
      .then(res => res.json())
      .then(data => {
        setVersion(data.short);
        triggerToast("Protocolo Listo", `Versión LCU: ${data.short}`, "info");
      })
      .catch(() => triggerToast("Error", "No se pudo conectar con el LCU", "error"));

    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        setLolPath(data.path);
      })
      .catch(() => console.error("No se pudo obtener la ruta del lockfile"));
  }, []);

  const savePath = async () => {
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: lolPath })
      });
      if (res.ok) {
        const data = await res.json();
        setLolPath(data.path);
        setIsModalOpen(false);
        triggerToast("Ruta Guardada", "Configuración de LoL actualizada", "info");
        addLog(`ÉXITO: Ruta de LoL actualizada a: ${data.path}`, 'success');
      } else {
        throw new Error();
      }
    } catch (e) {
      triggerToast("Error", "No se pudo actualizar la ruta", "error");
      addLog("ERROR: Fallo al actualizar la ruta de LoL", "error");
    }
  };

  const triggerToast = (title: string, body: string, type: string) => {
    setToast({ visible: true, title, body, type });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 6000);
  };

  const addLog = (msg: string, type: string) => {
    const now = new Date();
    const time = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
    setLogs(prev => [{ time, msg, type }, ...prev].slice(0, 50));
  };

  const runSync = async (type: 'meta_builds' | 'SyncEstructuraLanes') => {
    setIsSyncing(type);
    addLog(`Iniciando sincronización ${type === 'meta_builds' ? 'Bayesiana' : 'Global'}...`, 'sync');
    triggerToast("Iniciando", `Actualizando base de datos ${version}...`, "warn");

    try {
      const res = await fetch(`/api/sync?type=${type}&version=${version}`);
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
          if (isSyncing !== 'Procesando...') {
            console.log("🔄 Re-vinculando o registrando proceso en curso...");
            setIsSyncing('Procesando...');
          }
        } else {
          if (isSyncing === 'Procesando...') {
            triggerToast("Finalizado", "Proceso de sincronización terminado", "info");
            setIsSyncing(null);
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

  return (
    <>
      <div className="max-w-7xl mx-auto grid grid-cols-12 gap-8 relative z-10 mt-25">
        {/* PARÁMETROS DE RED */}
        <div className="col-span-12 lg:col-span-4 space-y-8">
          <div className="p-6 md:p-8 bg-panel-warm border border-border-warm rounded-sm tech-corners">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-200 mb-6 border-b border-border-warm pb-3">
              <span className="text-purple-accent mr-2">//</span>Parámetros de Red
            </h3>
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Versión del Parche LCU</label>
                <input 
                  type="text" 
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  className="w-full p-4 bg-input-warm border border-border-warm text-white font-mono text-2xl text-center focus:border-purple-accent outline-none transition-all duration-200 rounded-sm" 
                />
              </div>
              <div className="pt-2 border-t border-border-warm/50 flex flex-col gap-2">
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="w-full py-2 bg-transparent border border-border-warm hover:border-purple-accent text-slate-400 hover:text-white font-bold uppercase text-[9px] tracking-widest transition-all duration-200 cursor-pointer rounded-sm"
                >
                  ⚙️ Configurar Ruta de LoL
                </button>
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed uppercase font-bold tracking-wider">
                Asegúrate de que la versión coincida con el cliente para evitar errores de mapeo en el motor.
              </p>
            </div>
          </div>

          {/* ESTADO DEL ALMACÉN */}
          <div className="p-6 md:p-8 bg-panel-warm border border-border-warm rounded-sm tech-corners">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-200 mb-6 border-b border-border-warm pb-3">
              <span className="text-hextech-blue mr-2">//</span>Estado del Almacén
            </h3>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Cobertura de Campeones</span>
                  <span className="text-[10px] font-black uppercase text-purple-accent">168 / 168</span>
                </div>
                <div className="w-full h-2 bg-input-warm border border-border-warm rounded-sm overflow-hidden">
                  <div className={`h-full bg-purple-accent transition-all duration-1000 ${isSyncing ? 'w-1/2 animate-pulse' : 'w-full'}`}></div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] text-slate-500 uppercase font-black">Última Sync</span>
                  <span className="text-xs text-slate-300 font-mono">23.05.2026</span>
                </div>
                <div className="flex flex-col gap-1 text-right">
                  <span className="text-[9px] text-slate-500 uppercase font-black">Integridad</span>
                  <span className={`text-xs font-black tracking-wider ${isSyncing ? 'text-yellow-500 animate-pulse' : 'text-[#00f0ff]'}`}>
                    {isSyncing ? 'PROCESANDO' : 'ÓPTIMA'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ACCIONES Y MONITOR */}
        <div className="col-span-12 lg:col-span-8 space-y-8">
          <div className="grid gap-6">
            {/* BOTÓN SYNC SHORT */}
            <div className={`p-8 bg-panel-warm border rounded-sm flex flex-col md:flex-row gap-8 items-center transition-colors duration-200 tech-corners ${isSyncing === 'meta_builds' ? 'border-purple-accent' : 'border-border-warm hover:border-purple-accent/50'}`}>
              <div className="flex-1">
                <div className="flex items-center gap-4 mb-2">
                  <span className={`w-8 h-[2px] transition-colors ${isSyncing === 'meta_builds' ? 'bg-purple-accent' : 'bg-purple-accent/50'}`}></span>
                  <h2 className="text-xl font-black text-white uppercase tracking-wider italic">Sync. Meta & Builds</h2>
                </div>
                <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">Actualización masiva: OP.GG, ADN de Daño, Scaling y Builds Bayesiana.</p>
              </div>
              <div className="flex gap-3 w-full md:w-auto shrink-0">
                <button 
                  onClick={() => runSync('meta_builds')}
                  disabled={!!isSyncing} 
                  className={`w-full md:w-auto px-8 py-4 font-black uppercase text-[11px] tracking-[0.2em] rounded-sm transition-all duration-200 border cursor-pointer select-none active:scale-95 ${isSyncing ? 'bg-border-warm border-border-warm text-slate-500 cursor-not-allowed' : 'bg-purple-accent hover:bg-purple-accent-hover border-purple-accent text-white'}`}
                >
                  {isSyncing === 'meta_builds' ? 'Ejecutando...' : 'Ejecutar'}
                </button>

                {isSyncing && (
                  <button 
                    onClick={cancelSync}
                    className="px-6 py-4 bg-transparent border border-red-900/50 hover:bg-red-600/20 text-red-500 hover:text-red-400 font-black uppercase text-[10px] tracking-widest rounded-sm transition-all duration-200 cursor-pointer select-none active:scale-95"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </div>

            {/* BOTÓN SYNC LONG */}
            <div className={`p-8 bg-panel-warm border rounded-sm flex flex-col md:flex-row gap-8 items-center transition-colors duration-200 tech-corners ${isSyncing === 'SyncEstructuraLanes' ? 'border-hextech-blue' : 'border-border-warm hover:border-hextech-blue/40'}`}>
              <div className="flex-1">
                <div className="flex items-center gap-4 mb-2">
                  <span className={`w-8 h-[2px] ${isSyncing === 'SyncEstructuraLanes' ? 'bg-hextech-blue' : 'bg-border-warm'}`}></span>
                  <h2 className="text-xl font-black text-white uppercase tracking-wider italic">Mapeo de Posiciones</h2>
                </div>
                <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">Sincronización de carriles y roles populares según la Tierlist Global.</p>
              </div>
              <button 
                onClick={() => runSync('SyncEstructuraLanes')}
                disabled={!!isSyncing}
                className={`w-full md:w-auto px-8 py-4 font-black uppercase text-[11px] tracking-[0.2em] rounded-sm transition-all duration-200 border cursor-pointer select-none active:scale-95 ${isSyncing ? 'bg-border-warm border-border-warm text-slate-500 cursor-not-allowed' : 'bg-transparent border-border-warm hover:border-hextech-blue hover:text-white text-slate-400'}`}
              >
                {isSyncing === 'SyncEstructuraLanes' ? 'Refrescando...' : 'Refrescar'}
              </button>
            </div>
          </div>

          {/* MONITOR DE ACTIVIDAD */}
          <div className="p-6 md:p-8 bg-input-warm border border-border-warm rounded-sm h-[286px] flex flex-col tech-corners">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 flex-shrink-0">
              <span className="text-purple-accent mr-2">//</span>Monitor de Actividad Reciente
            </h3>
            <div 
              ref={scrollRef}
              className="space-y-3 font-mono text-[10px] md:text-[11px] flex-1 overflow-y-auto pr-2"
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
      </div>

      {/* CONFIGURACIÓN RUTA HEXTECH MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg p-6 bg-panel-warm border border-border-warm rounded-sm relative animate-in zoom-in-95 duration-200 tech-corners">
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-white font-bold transition-colors duration-200 uppercase text-[10px] tracking-widest cursor-pointer"
            >
              ✕ Cerrar
            </button>

            <div className="mb-6 border-b border-border-warm pb-3">
              <span className="text-[10px] text-purple-accent font-black uppercase tracking-[0.2em]">// Configuración del Sistema</span>
              <h3 className="text-lg font-black text-white uppercase tracking-wider mt-1">
                Ruta de League of Legends
              </h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                  Carpeta de Instalación o Archivo Lockfile
                </label>
                <input 
                  type="text" 
                  value={lolPath}
                  onChange={(e) => setLolPath(e.target.value)}
                  placeholder="C:\Riot Games\League of Legends"
                  className="w-full p-3 bg-input-warm border border-border-warm text-slate-200 font-mono text-xs focus:border-purple-accent outline-none transition-all duration-200 rounded-sm" 
                />
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed uppercase font-bold tracking-wider">
                Introduce la carpeta raíz del juego (ej: <code className="text-white font-mono lowercase">C:\Riot Games\League of Legends</code>) o la ruta directa al archivo <code className="text-white font-mono lowercase">lockfile</code>. El sistema detectará automáticamente el archivo para establecer la conexión con el cliente de LoL.
              </p>
            </div>

            <div className="mt-8 pt-4 border-t border-border-warm flex justify-end gap-3">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-3 bg-transparent border border-border-warm hover:border-slate-500 text-slate-400 hover:text-white font-black uppercase text-[10px] tracking-widest rounded-sm transition-all duration-200 cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                onClick={savePath}
                className="px-6 py-3 bg-purple-accent hover:bg-purple-accent-hover text-white font-black uppercase text-[10px] tracking-widest rounded-sm transition-all duration-200 cursor-pointer"
              >
                Guardar Ruta
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};