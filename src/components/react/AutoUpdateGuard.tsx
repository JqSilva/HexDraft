import React, { useState, useEffect, useRef } from 'react';

export const AutoUpdateGuard = () => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [currentSyncType, setCurrentSyncType] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [progressPhase, setProgressPhase] = useState<string>('idle');
  const [logs, setLogs] = useState<string[]>([]);
  const [version, setVersion] = useState<string>('14.9');
  
  const bypassedRef = useRef<boolean>(false);
  const logsConsoleEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logsConsoleEndRef.current) {
      logsConsoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  useEffect(() => {
    // Comprobar si ya se validó la actualización en esta sesión del navegador
    const isChecked = sessionStorage.getItem('hexdraft_startup_checked') === 'true';
    if (isChecked) return;

    const performUpdateCheck = async () => {
      try {
        const res = await fetch('/api/sync?type=check');
        if (!res.ok) return;

        const data = await res.json();
        setVersion(data.version || '14.9');

        if (data.needs_build_sync || data.needs_lane_sync) {
          setIsOpen(true);
          // Iniciar proceso secuencial de actualización
          startAutoSync(data.needs_build_sync, data.needs_lane_sync, data.version || '14.9');
        } else {
          // Todo al día, marcamos como verificado
          sessionStorage.setItem('hexdraft_startup_checked', 'true');
        }
      } catch (e) {
        console.error("Error en la comprobación de actualización automática:", e);
      }
    };

    // Un pequeño retardo para dejar que el sistema cargue visualmente primero
    const timer = setTimeout(performUpdateCheck, 1000);
    return () => clearTimeout(timer);
  }, []);

  const startAutoSync = async (needsBuild: boolean, needsLane: boolean, patchVersion: string) => {
    try {
      if (needsBuild) {
        setCurrentSyncType('Meta y Builds de Campeones');
        setProgressPercent(0);
        setProgressPhase('starting');
        setLogs(['[SISTEMA] Iniciando actualización automática de Meta & Builds...']);

        // Llamar a la API de sincronización para Builds
        const res = await fetch(`/api/sync?type=meta_builds&version=${patchVersion}&force=false`);
        if (!res.ok) throw new Error("No se pudo iniciar el servicio de sincronización");

        // Bucle de sondeo
        while (true) {
          await new Promise(r => setTimeout(r, 1500));
          if (bypassedRef.current) return;

          const statusRes = await fetch('/api/sync?type=status');
          const statusData = await statusRes.json();

          setLogs(statusData.logs || []);
          setProgressPercent(statusData.progressPercent || 0);
          setProgressPhase(statusData.progressPhase || 'puppeteer');

          if (!statusData.syncing) {
            if (statusData.progressPhase === 'done') {
              setLogs(prev => [...prev, '[SISTEMA] ✅ Actualización de Builds completada con éxito.']);
              break;
            } else if (statusData.progressPhase === 'cancelled') {
              throw new Error("Sincronización cancelada por el usuario.");
            } else {
              throw new Error("Fallo en el servicio de scraping de builds.");
            }
          }
        }
      }

      if (needsLane) {
        if (bypassedRef.current) return;
        setCurrentSyncType('Mapeo de Posiciones (Lanes)');
        setProgressPercent(0);
        setProgressPhase('starting');
        setLogs(prev => [...prev, '', '[SISTEMA] Iniciando mapeo de roles y carriles populares...']);

        // Llamar a la API de sincronización para Carriles
        const res = await fetch(`/api/sync?type=SyncEstructuraLanes&version=${patchVersion}`);
        if (!res.ok) throw new Error("No se pudo iniciar el mapeo de carriles");

        // Bucle de sondeo
        while (true) {
          await new Promise(r => setTimeout(r, 1500));
          if (bypassedRef.current) return;

          const statusRes = await fetch('/api/sync?type=status');
          const statusData = await statusRes.json();

          setLogs(statusData.logs || []);
          setProgressPercent(statusData.progressPercent || 0);
          setProgressPhase(statusData.progressPhase || 'lanes');

          if (!statusData.syncing) {
            if (statusData.progressPhase === 'done') {
              setLogs(prev => [...prev, '[SISTEMA] ✅ Mapeo de carriles completado con éxito.']);
              break;
            } else if (statusData.progressPhase === 'cancelled') {
              throw new Error("Mapeo cancelado por el usuario.");
            } else {
              throw new Error("Fallo en el mapeo de carriles.");
            }
          }
        }
      }

      // Proceso completado
      setProgressPercent(100);
      setProgressPhase('done');
      setLogs(prev => [...prev, '', '[SISTEMA] 🎉 Base de datos local actualizada correctamente. Redirigiendo...']);
      sessionStorage.setItem('hexdraft_startup_checked', 'true');
      
      // Cerrar el modal con transición suave
      setTimeout(() => setIsOpen(false), 2500);

    } catch (err: any) {
      if (bypassedRef.current) return;
      setProgressPhase('error');
      setLogs(prev => [...prev, '', `[SISTEMA] ❌ Error en actualización automática: ${err.message || err}`]);
    }
  };

  const handleBypass = async () => {
    bypassedRef.current = true;
    setIsOpen(false);
    sessionStorage.setItem('hexdraft_startup_checked', 'true');
    try {
      // Intentar abortar los motores que estén corriendo
      await fetch('/api/sync?type=cancel');
    } catch (e) {}
  };

  if (!isOpen) return null;

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes breathe {
          0%, 100% {
            transform: scale(1);
            filter: drop-shadow(0 0 15px rgba(144, 85, 255, 0.3));
          }
          50% {
            transform: scale(1.06);
            filter: drop-shadow(0 0 35px rgba(144, 85, 255, 0.75)) drop-shadow(0 0 10px rgba(0, 240, 255, 0.3));
          }
        }
        .breathing-logo {
          animation: breathe 3.5s ease-in-out infinite;
        }
        .scrollbar-thin::-webkit-scrollbar {
          width: 5px;
        }
        .scrollbar-thin::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.2);
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background: rgba(144, 85, 255, 0.2);
          border-radius: 2px;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover {
          background: rgba(144, 85, 255, 0.4);
        }
      `}} />

      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#07070b]/98 backdrop-blur-md p-6 select-none animate-in fade-in duration-500">
        <div className="w-full max-w-2xl flex flex-col items-center space-y-8">
          
          {/* Logo animado con efecto respiro */}
          <div className="relative w-28 h-28 flex items-center justify-center rounded-2xl bg-[#13131e]/80 border border-purple-500/20 shadow-[0_0_30px_rgba(144,85,255,0.15)] shrink-0 breathing-logo">
            <img src="/favicon.svg" alt="HexDraft Logo" className="w-20 h-20 object-cover rounded-xl" />
          </div>

          {/* Textos Informativos */}
          <div className="text-center space-y-2">
            <span className="text-[10px] text-purple-accent font-black uppercase tracking-[0.25em]">// Hextech Core Link</span>
            <h2 className="text-2xl font-black text-white uppercase tracking-wider">
              Actualización Automática
            </h2>
            <p className="text-xs text-slate-400 font-medium max-w-md uppercase tracking-wider leading-relaxed">
              {progressPhase === 'error' ? (
                <span className="text-red-500 font-bold">Fallo en la sincronización automática</span>
              ) : progressPhase === 'done' ? (
                <span className="text-green-500 font-bold">Base de datos optimizada con éxito</span>
              ) : (
                <>Actualizando <span className="text-white font-bold">{currentSyncType}</span> para el parche <span className="text-[#00f0ff] font-mono font-bold">{version}</span></>
              )}
            </p>
          </div>

          {/* Barra de Progreso y Indicadores */}
          <div className="w-full bg-[#11111a]/80 border border-border-warm/60 p-4 rounded-sm shadow-xl max-w-lg">
            <div className="flex justify-between items-center mb-2 text-[10px] uppercase tracking-wider font-bold">
              <span className="text-slate-400">Progreso de Descarga</span>
              <span className="text-purple-accent font-mono">{progressPercent}%</span>
            </div>
            <div className="w-full bg-[#050508] border border-slate-800/80 h-3 rounded-sm overflow-hidden relative">
              <div 
                className={`h-full rounded-sm transition-all duration-500 ease-out shadow-[0_0_8px_rgba(144,85,255,0.5)] ${
                  progressPhase === 'error' ? 'bg-red-600' : 'bg-gradient-to-r from-purple-accent to-fuchsia-400'
                }`}
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
          </div>

          {/* Mini Consola de Logs en vivo */}
          <div className="w-full max-w-lg bg-[#040407] border border-[#1b1b26] rounded-sm p-4 font-mono text-[9px] text-[#00f0ff] flex flex-col h-44 shadow-inner">
            <span className="text-[8px] uppercase tracking-widest text-slate-500 mb-2 flex-shrink-0 border-b border-slate-900 pb-1 font-bold">
              Consola de Eventos
            </span>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
              {logs.length === 0 ? (
                <div className="text-slate-500 italic">Conectando al motor de base de datos local...</div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="whitespace-pre-wrap leading-relaxed animate-in fade-in duration-200">
                    {log}
                  </div>
                ))
              )}
              <div ref={logsConsoleEndRef} />
            </div>
          </div>

          {/* Acciones de Control / Omisión */}
          <div className="pt-4 flex flex-col items-center space-y-4 w-full">
            {progressPhase === 'error' ? (
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setLogs([]);
                    setProgressPercent(0);
                    setProgressPhase('idle');
                    // Reiniciar chequeo forzando el arranque
                    startAutoSync(true, true, version);
                  }}
                  className="px-6 py-2.5 bg-purple-accent hover:bg-purple-accent-hover text-white font-black uppercase text-[10px] tracking-widest rounded-sm transition-all duration-200 cursor-pointer"
                >
                  Reintentar
                </button>
                <button 
                  onClick={handleBypass}
                  className="px-6 py-2.5 bg-transparent border border-slate-700 hover:border-slate-500 text-slate-400 hover:text-white font-black uppercase text-[10px] tracking-widest rounded-sm transition-all duration-200 cursor-pointer"
                >
                  Continuar a la App
                </button>
              </div>
            ) : (
              <button 
                onClick={handleBypass}
                className="px-8 py-3 bg-transparent border border-border-warm hover:border-purple-accent text-slate-500 hover:text-white font-bold uppercase text-[9px] tracking-widest transition-all duration-200 cursor-pointer rounded-sm"
              >
                Omitir actualización
              </button>
            )}
            <p className="text-[8px] text-slate-600 uppercase font-bold tracking-wider text-center">
              * Puedes sincronizar manualmente en cualquier momento desde el apartado de Sincronización.
            </p>
          </div>

        </div>
      </div>
    </>
  );
};
