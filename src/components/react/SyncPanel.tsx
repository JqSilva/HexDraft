import React, { useState, useEffect } from 'react';

export const SyncPanel = () => {
  const [isSyncing, setIsSyncing] = useState<string | null>(null);
  const [version, setVersion] = useState('--.--');
  const [logs, setLogs] = useState([
    { time: '--:--', msg: 'Esperando inicialización de sincronización masiva...', type: 'idle' },
    { time: '12:31', msg: 'Nexo: Versión detectada automáticamente', type: 'info' },
    { time: '12:30', msg: 'Sistema Guard: Conexión LCU establecida en Puerto 5421', type: 'guard' }
  ]);
  const [toast, setToast] = useState({ visible: false, title: '', body: '', type: 'info' });

  // Auto-detección de versión al cargar
  useEffect(() => {
    fetch('/api/game-version')
      .then(res => res.json())
      .then(data => {
        setVersion(data.short);
        triggerToast("Protocolo Listo", `Versión LCU: ${data.short}`, "info");
      })
      .catch(() => triggerToast("Error", "No se pudo conectar con el LCU", "error"));
  }, []);

  const triggerToast = (title: string, body: string, type: string) => {
    setToast({ visible: true, title, body, type });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 6000);
  };

  const addLog = (msg: string, type: string) => {
    const now = new Date();
    const time = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
    setLogs(prev => [{ time, msg, type }, ...prev].slice(0, 5));
  };

  const runSync = async (type: 'meta_builds' | 'SyncEstructuraLanes') => {
    setIsSyncing(type);
    addLog(`Iniciando sincronización ${type === 'meta_builds' ? 'Bayesiana' : 'Global'}...`, 'sync');
    triggerToast("Iniciando", `Actualizando base de datos ${version}...`, "warn");

    try {
      // La API debe responder solo cuando el script termine
      const res = await fetch(`/api/sync?type=${type}&version=${version}`);
      if (res.ok) {
        addLog(`ÉXITO: Sincronización ${type} finalizada.`, 'success');
        triggerToast("Éxito", "Sincronización finalizada", "info");
      } else {
        throw new Error();
      }
    } catch (e) {
      addLog(`ERROR: Fallo en la sincronización ${type}.`, 'error');
      triggerToast("Error", "Fallo en la API", "error");
    } finally {
      setIsSyncing(null);
    }
  };
  useEffect(() => {
        const checkServerStatus = async () => {
            try {
                const res = await fetch('/api/sync?type=status');
                const data = await res.json();
                
                // Si el servidor está ocupado pero nuestro estado local no lo sabía
                // (por ejemplo, después de un reload de Vite)
                if (data.syncing && !isSyncing) {
                    console.log("🔄 Re-vinculando con proceso en curso...");
                    setIsSyncing('Procesando...'); // Bloqueamos los botones
                    addLog("Motor en marcha: Re-vinculando monitor...", "info");
                } 
                // Si el servidor terminó pero nosotros seguíamos esperando
                else if (!data.syncing && isSyncing) {
                    addLog("Sincronización finalizada correctamente.", "success");
                    triggerToast("Éxito", "Base de datos actualizada", "info");
                    setIsSyncing(null);
                }
            } catch (e) { /* Error de red */ }
        };

        // Consultamos cada 2 segundos para tener feedback rápido
        const interval = setInterval(checkServerStatus, 2000);
        return () => clearInterval(interval);
    }, [isSyncing]); // Dependemos de isSyncing para saber cuándo actuar

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
      <div className="max-w-6xl mx-auto grid grid-cols-12 gap-10 relative z-10">
        {/* PARÁMETROS DE RED */}
        <div className="col-span-12 lg:col-span-4 space-y-8">
          <div className="p-8 bg-slate-900/40 border border-slate-800 backdrop-blur-md rounded-sm">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-purple-500 mb-8 border-b border-slate-800/50 pb-3">Parámetros de Red</h3>
            <div className="space-y-6">
              <div>
                <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-3">Versión del Parche LCU</label>
                <input 
                  type="text" 
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  className="w-full p-4 bg-[#020617] border border-slate-700 text-white font-mono text-2xl text-center focus:border-purple-600 outline-none transition-all rounded-sm shadow-inner" 
                />
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed uppercase font-bold tracking-tight">
                Asegúrate de que la versión coincida con el cliente para evitar errores de mapeo en el motor.
              </p>
            </div>
          </div>

          {/* ESTADO DEL ALMACÉN */}
          <div className="p-8 bg-slate-900/40 border border-slate-800 backdrop-blur-md rounded-sm">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-300 mb-8 border-b border-slate-800/50 pb-3">Estado del Almacén</h3>
            <div className="space-y-8">
              <div>
                <div className="flex justify-between mb-3">
                  <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider">Cobertura de Campeones</span>
                  <span className="text-[11px] font-black uppercase text-purple-500">168 / 168</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className={`h-full bg-purple-600 shadow-[0_0_10px_rgba(168,85,247,0.4)] transition-all duration-1000 ${isSyncing ? 'w-1/2 animate-pulse' : 'w-full'}`}></div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-slate-500 uppercase font-black">Última Sync</span>
                  <span className="text-sm text-slate-200 font-mono">23.05.2026</span>
                </div>
                <div className="flex flex-col gap-1 text-right">
                  <span className="text-[10px] text-slate-500 uppercase font-black">Integridad</span>
                  <span className={`text-sm font-black ${isSyncing ? 'text-yellow-500 animate-pulse' : 'text-cyan-400'}`}>
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
            <div className={`p-10 bg-slate-900/40 border backdrop-blur-md rounded-sm flex flex-col md:flex-row gap-10 items-center transition-colors ${isSyncing === 'short' ? 'border-purple-600' : 'border-slate-800 hover:border-purple-600/50'}`}>
              <div className="flex-1">
                <div className="flex items-center gap-4 mb-3">
                  <span className={`w-12 h-[3px] transition-colors ${isSyncing === 'meta_builds' ? 'bg-purple-400' : 'bg-purple-600'}`}></span>
                  <h2 className="text-2xl font-black text-white uppercase tracking-wider italic">Sync. Meta & Builds</h2>
                </div>
                <p className="text-sm text-slate-400 uppercase tracking-wide mb-8 font-medium">Actualización masiva: OP.GG, ADN de Daño, Scaling y Builds Bayesiana.</p>
              </div>
              <button 
                onClick={() => runSync('meta_builds')}
                disabled={!!isSyncing} 
                className={`w-full md:w-auto px-12 py-5 font-black uppercase text-xs tracking-[0.3em] rounded-sm transition-all shrink-0 active:scale-95 border-none cursor-pointer ${isSyncing === 'short' ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-500 text-white shadow-xl'}`}
              >
                {isSyncing === 'meta_builds' ? 'Ejecutando...' : 'Ejecutar'}
              </button>

                {isSyncing && (
                    <button 
                        onClick={cancelSync}
                        className="px-6 py-5 bg-red-950/30 border border-red-900/50 hover:bg-red-600 text-red-500 hover:text-white font-black uppercase text-[10px] tracking-widest rounded-sm transition-all animate-in fade-in zoom-in-95"
                    >
                        Cancelar
                    </button>
                )}
            </div>

            {/* BOTÓN SYNC LONG */}
            <div className={`p-10 bg-slate-900/40 border backdrop-blur-md rounded-sm flex flex-col md:flex-row gap-10 items-center transition-colors ${isSyncing === 'long' ? 'border-slate-400' : 'border-slate-800 hover:border-slate-600'}`}>
              <div className="flex-1">
                <div className="flex items-center gap-4 mb-3">
                  <span className={`w-12 h-[3px] ${isSyncing === 'SyncEstructuraLanes' ? 'bg-white' : 'bg-slate-700'}`}></span>
                  <h2 className="text-2xl font-black text-white uppercase tracking-wider italic">Mapeo de Posiciones</h2>
                </div>
                <p className="text-sm text-slate-400 uppercase tracking-wide mb-8 font-medium">Sincronización de carriles y roles populares según la Tierlist Global.</p>
              </div>
              <button 
                onClick={() => runSync('SyncEstructuraLanes')}
                disabled={!!isSyncing}
                className={`w-full md:w-auto px-12 py-5 font-black uppercase text-xs tracking-[0.3em] rounded-sm transition-all shrink-0 active:scale-95 border-none cursor-pointer ${isSyncing === 'long' ? 'bg-slate-900 text-slate-600' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'}`}
              >
                {isSyncing === 'SyncEstructuraLanes' ? 'Refrescando...' : 'Refrescar'}
              </button>
            </div>
          </div>

          {/* MONITOR DE ACTIVIDAD */}
          <div className="p-8 bg-black/40 border border-slate-800 rounded-sm min-h-[165px]">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-6">Monitor de Actividad Reciente</h3>
            <div className="space-y-4 font-mono text-[11px]">
              {logs.map((log, i) => (
                <div key={i} className="flex gap-4 animate-in fade-in slide-in-from-left-2">
                  <span className={`${log.type === 'error' ? 'text-red-600' : log.type === 'sync' ? 'text-yellow-500' : log.type === 'guard' ? 'text-purple-600' : 'text-cyan-500'} font-bold`}>
                    [{log.time}]
                  </span>
                  <span className={log.type === 'error' ? 'text-red-400' : log.type === 'idle' ? 'text-slate-500' : 'text-slate-200'}>
                    {log.msg}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* TOAST NOTIFICATION */}
      <div className={`fixed bottom-10 right-10 z-50 bg-[#020617] border border-slate-700 p-5 rounded-sm shadow-[0_20px_50px_rgba(0,0,0,0.5)] max-w-md flex items-center gap-5 transition-all duration-300 ${toast.visible ? 'translate-y-0 opacity-100' : 'translate-y-24 opacity-0 pointer-events-none'}`}>
        <div className={`w-2 h-2 rounded-full animate-pulse shrink-0 ${toast.type === 'error' ? 'bg-red-600' : toast.type === 'warn' ? 'bg-yellow-600' : 'bg-purple-600'}`}></div>
        <div className="flex flex-col">
          <span className="text-xs font-black uppercase tracking-[0.2em] text-purple-500">{toast.title}</span>
          <span className="text-sm text-slate-300 font-mono mt-1">{toast.body}</span>
        </div>
      </div>
    </>
  );
};