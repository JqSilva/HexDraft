import React, { useState, useEffect, useRef } from 'react';
import { useAppMode } from './useAppMode';

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
  const { mode, isAdmin, loaded: modeLoaded } = useAppMode();
  const [isSyncing, setIsSyncing] = useState<'meta_builds' | 'SyncEstructuraLanes' | null>(null);
  const [version, setVersion] = useState<string>('--.--');
  const [lastSync, setLastSync] = useState<string>('-');
  const [lastLaneSync, setLastLaneSync] = useState<string>('-');
  const [forceSync, setForceSync] = useState<boolean>(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [progressPhase, setProgressPhase] = useState<string>('idle');
  const [showRecommendAlert, setShowRecommendAlert] = useState<boolean>(false);

  const [logs, setLogs] = useState<LogItem[]>([
    { time: '--:--', msg: 'Esperando inicialización de sincronización masiva...', type: 'idle' }
  ]);
  const [toast, setToast] = useState<ToastState>({ visible: false, title: '', body: '', type: 'info' });

  // Estados para Publicación de GitHub (Admin)
  const [publishStatus, setPublishStatus] = useState<{
    lastPublishDate: string;
    lastPublishVersion: number;
    lastPublishPatch: string;
    currentPatch: string;
    lastSyncTimestamp: string;
    pendingPublish: boolean;
  } | null>(null);
  const [loadingPublish, setLoadingPublish] = useState(true);
  const [actionState, setActionState] = useState<'idle' | 'syncing' | 'publishing' | 'done' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('Listo');

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [logs]);

  // Cargar versión y estado de recomendación de sincronización
  const fetchInitialData = async () => {
    try {
      const checkRes = await fetch('/api/sync?type=check');
      if (checkRes.ok) {
        const checkData = await checkRes.json();
        setVersion(checkData.version || '--.--');
        setLastSync(checkData.last_sync_timestamp || '-');
        setLastLaneSync(checkData.last_lane_sync_timestamp || '-');
        if (checkData.needs_build_sync || checkData.needs_lane_sync) {
          setShowRecommendAlert(true);
        } else {
          setShowRecommendAlert(false);
        }
      }
    } catch (e) {
      console.error("No se pudo comprobar el estado de sincronización:", e);
    }
  };

  const fetchPublishStatus = async () => {
    try {
      const res = await fetch('/api/sync/status');
      if (res.ok) {
        const data = await res.json();
        setPublishStatus(data);
      }
    } catch (e) {
      console.error('Error al obtener estado de sincronización:', e);
    } finally {
      setLoadingPublish(false);
    }
  };

  const handlePublishGithub = async () => {
    setActionState('publishing');
    setStatusMessage('Compilando base de datos y subiendo a GitHub...');

    try {
      const res = await fetch('/api/sync/publish', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Fallo en la publicación');
      }
      setActionState('done');
      setStatusMessage(`Publicado con éxito: Versión ${data.version} (Parche ${data.patch})`);
      fetchPublishStatus();
      
      setTimeout(() => {
        setActionState('idle');
        setStatusMessage('Listo');
      }, 5000);

    } catch (e: any) {
      setActionState('error');
      setStatusMessage(`Error en publicación: ${e.message || 'Error desconocido'}`);
    }
  };

  useEffect(() => {
    fetchInitialData();
    if (modeLoaded && isAdmin) {
      fetchPublishStatus();
    }
  }, [modeLoaded, isAdmin]);

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
    if (ts === '-' || !ts) return 'Nunca';
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
        <div className="fixed top-24 right-6 z-50 animate-in slide-in-from-top-4 slide-in-from-right-4 duration-300">
          <div className={`p-4 rounded-sm border ${
            toast.type === 'error' 
              ? 'bg-red-950/40 border-red-500/50 text-red-200 shadow-[0_0_15px_rgba(239,68,68,0.15)]' 
              : toast.type === 'warn' 
                ? 'bg-yellow-950/40 border-yellow-500/50 text-yellow-200 shadow-[0_0_15px_rgba(234,179,8,0.15)]' 
                : 'bg-purple-950/40 border-purple-500/50 text-purple-200 shadow-[0_0_15px_rgba(144,85,255,0.15)]'
            } backdrop-blur-md max-w-sm`}>
            <h4 className="text-[10px] font-black uppercase tracking-wider">{toast.title}</h4>
            <p className="text-[9px] uppercase mt-1 tracking-wide font-bold">{toast.body}</p>
          </div>
        </div>
      )}

      <div className="w-full flex flex-col p-4 md:p-6 text-slate-200 animate-in fade-in duration-300">
        
        {/* Cabecera Táctica (Ocupa todo el ancho) */}
        <header className="relative flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-warm pb-4 mb-6">
          <div>
            <span className="text-[10px] uppercase tracking-[0.3em] font-black text-slate-500 block mb-1">
              MANTENIMIENTO // TELEMETRÍA DE BASE DE DATOS
            </span>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-black text-white uppercase tracking-tight">
                Sincronización <span className="text-purple-accent">de Datos</span>
              </h1>
              {modeLoaded && (
                <span className={`px-2 py-0.5 text-[9px] uppercase font-black tracking-wider border rounded-sm ${
                  isAdmin 
                    ? 'bg-purple-950/40 border-purple-500/40 text-purple-300' 
                    : 'bg-slate-900 border-slate-700 text-slate-400'
                }`}>
                  Modo: {mode}
                </span>
              )}
            </div>
          </div>
        </header>

        {/* Alerta de Actualización Recomendada */}
        {showRecommendAlert && (
          <div className="mb-6 bg-amber-500/10 border border-amber-500/20 rounded-sm p-4 text-slate-200 relative overflow-hidden shadow-lg animate-in slide-in-from-top-4 duration-300">
            <div className="absolute top-0 left-0 w-[3px] h-full bg-amber-500" />
            <div className="flex items-center gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
              <div className="flex-1">
                <h4 className="text-[10px] font-black uppercase text-amber-500 tracking-wider">
                  Sincronización recomendada
                </h4>
                <p className="text-[9.5px] uppercase tracking-wide font-bold text-slate-400 mt-0.5">
                  Se ha detectado un parche nuevo o han pasado más de 3 días desde la última sincronización masiva. Se recomienda realizar una actualización manual para asegurar la precisión de los análisis de composición.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Contenido Principal Centrado */}
        <div className="w-full max-w-[1300px] mx-auto flex flex-col gap-6">
          {/* TARJETA DE ESTADO GLOBAL (SINGLE DIAGNOSTIC CARD) */}
          <div className="bg-[#0b0b0f] border border-border-warm rounded-sm p-6 tech-corners shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 h-32 w-32 bg-purple-accent/5 rounded-full blur-3xl pointer-events-none" />
            
            <div className="mb-6">
              <h3 className="text-xs text-purple-accent font-black uppercase tracking-[0.2em] italic mb-1">
                Estado del Motor y Base de Datos
              </h3>
              <p className="text-[9.5px] text-slate-500 uppercase tracking-widest font-extrabold">
                Diagnóstico y telemetría de caché en tiempo real
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-2">
              {/* Campo 1: Versión */}
              <div className="md:border-r border-border-warm-hover/40 pr-4">
                <span className="block text-[8.5px] text-slate-500 uppercase tracking-widest font-black mb-1">Versión LoL Activa</span>
                <span className="text-sm font-mono font-black text-white">{version}</span>
              </div>
              
              {/* Campo 2: Último Meta Sync */}
              <div className="md:border-r border-border-warm-hover/40 pr-4">
                <span className="block text-[8.5px] text-slate-500 uppercase tracking-widest font-black mb-1">Último Meta Sync</span>
                <span className="text-xs font-mono font-black text-slate-300 truncate block">
                  {formatTimestamp(lastSync)}
                </span>
              </div>

              {/* Campo 3: Mapeo de Carriles */}
              <div className="md:border-r border-border-warm-hover/40 pr-4">
                <span className="block text-[8.5px] text-slate-500 uppercase tracking-widest font-black mb-1">Mapeo de Carriles</span>
                <span className="text-xs font-mono font-black text-slate-300 truncate block">
                  {formatTimestamp(lastLaneSync)}
                </span>
              </div>

              {/* Campo 4: Integridad */}
              <div>
                <span className="block text-[8.5px] text-slate-500 uppercase tracking-widest font-black mb-1">Integridad del Cache</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${isSyncing ? 'bg-yellow-500 animate-pulse' : 'bg-cyan-400 shadow-[0_0_8px_#00f0ff]'}`} />
                  <span className={`text-[10px] font-black tracking-wider uppercase font-mono ${isSyncing ? 'text-yellow-500' : 'text-cyan-400'}`}>
                    {isSyncing ? 'Sincronizando' : 'Actualizado'}
                  </span>
                </div>
              </div>
            </div>
          </div>

        {/* ACCIONES DE SINCRONIZACIÓN */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Card 1: Builds & Meta */}
          <div className="bg-[#0b0b0f] border border-border-warm rounded-sm p-6 tech-corners shadow-2xl relative overflow-hidden flex flex-col justify-between gap-5">
            <div className="absolute top-0 right-0 h-32 w-32 bg-purple-accent/5 rounded-full blur-3xl pointer-events-none" />
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-purple-accent font-black uppercase tracking-widest font-mono">01 //</span>
                <h4 className="text-sm font-black text-white uppercase tracking-wider italic">Sincronización de Meta & Builds</h4>
              </div>
              <p className="text-[11px] text-slate-400 uppercase tracking-wide leading-relaxed font-bold">
                Extrae datos estadísticos en tiempo real de OP.GG y DPM.lol para recalcular coeficientes Bayesianos, tiers de campeones y diagramas de builds sugeridos.
              </p>
            </div>

            <div className="space-y-4 pt-2">
              <label className={`flex items-center gap-3 p-3  cursor-pointer select-none transition-all duration-200 active:scale-[0.99]`}>
                <input 
                  type="checkbox" 
                  checked={forceSync}
                  onChange={(e) => setForceSync(e.target.checked)}
                  disabled={!!isSyncing}
                  className="sr-only"
                />
                <div className={`w-4 h-4 rounded-sm border flex items-center justify-center transition-colors duration-200 shrink-0 ${forceSync ? 'bg-purple-accent border-purple-accent' : 'bg-black/40 border-slate-700'}`}>
                  {forceSync && <span className="text-[8px] font-bold text-white"></span>}
                </div>
                <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider">
                  Forzar descarga completa (ignora caché diferencial y descarga todo de cero)
                </span>
              </label>

              <div className="flex items-center gap-3">
                <button 
                  onClick={() => runSync('meta_builds')}
                  disabled={!!isSyncing} 
                  className={`flex-1 px-6 py-3.5 font-black uppercase text-[9.5px] tracking-widest rounded-sm transition-all duration-200 border cursor-pointer select-none active:scale-95
                    ${isSyncing 
                      ? 'bg-border-warm border-border-warm text-slate-500 cursor-not-allowed' 
                      : 'bg-purple-accent border-purple-accent hover:bg-purple-accent/90 text-white shadow-[0_0_15px_rgba(144,85,255,0.2)]'}`}
                >
                  {isSyncing === 'meta_builds' ? 'Procesando...' : 'Ejecutar Sincronización'}
                </button>
                
                {isSyncing === 'meta_builds' && (
                  <button 
                    onClick={cancelSync}
                    className="px-5 py-3.5 bg-transparent border border-red-900/50 hover:bg-red-600/20 text-red-500 font-black uppercase text-[9px] tracking-widest rounded-sm transition-all duration-200 cursor-pointer active:scale-95"
                  >
                    Detener
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Card 2: Lanes Mapping */}
          <div className="bg-[#0b0b0f] border border-border-warm rounded-sm p-6 tech-corners shadow-2xl relative overflow-hidden flex flex-col justify-between gap-5">
            <div className="absolute top-0 right-0 h-32 w-32 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-purple-accent font-black uppercase tracking-widest font-mono">02 //</span>
                <h4 className="text-sm font-black text-white uppercase tracking-wider italic">Mapeo de Posiciones y Carriles</h4>
              </div>
              <p className="text-[11px] text-slate-400 uppercase tracking-wide leading-relaxed font-bold">
                Actualiza y mapea la distribución de líneas (Top, Jng, Mid, Adc, Sup) preferidas de cada campeón conforme a los roles más jugados en el parche actual (Diamond+).
              </p>
            </div>

            <div className="pt-2 flex items-center gap-3">
              <button 
                onClick={() => runSync('SyncEstructuraLanes')}
                disabled={!!isSyncing}
                className={`flex-1 px-6 py-3.5 font-black uppercase text-[9.5px] tracking-widest rounded-sm transition-all duration-200 border cursor-pointer select-none active:scale-95
                  ${isSyncing 
                    ? 'bg-border-warm border-border-warm text-slate-500 cursor-not-allowed' 
                    : 'bg-transparent border-border-warm hover:border-slate-800 text-slate-400 hover:text-slate-200'}`}
              >
                {isSyncing === 'SyncEstructuraLanes' ? 'Procesando...' : 'Actualizar Mapeo'}
              </button>
              
              {isSyncing === 'SyncEstructuraLanes' && (
                <button 
                  onClick={cancelSync}
                  className="px-5 py-3.5 bg-transparent border border-red-900/50 hover:bg-red-600/20 text-red-500 font-black uppercase text-[9px] tracking-widest rounded-sm transition-all duration-200 cursor-pointer active:scale-95"
                >
                  Detener
                </button>
              )}
            </div>
          </div>

          {/* Card 3: GitHub Releases (Publicación) */}
          <div className="bg-[#0b0b0f] border border-border-warm rounded-sm p-6 tech-corners shadow-2xl relative overflow-hidden flex flex-col justify-between gap-5">
            <div className="absolute top-0 right-0 h-32 w-32 bg-purple-accent/5 rounded-full blur-3xl pointer-events-none" />
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-purple-accent font-black uppercase tracking-widest font-mono">03 //</span>
                <h4 className="text-sm font-black text-white uppercase tracking-wider italic">Distribución en GitHub</h4>
              </div>
              <p className="text-[11px] text-slate-400 uppercase tracking-wide leading-relaxed font-bold">
                Empaqueta la base de datos local actual, calcula su checksum SHA256 y la publica como un asset binario en una nueva release de GitHub.
              </p>
            </div>

            {/* Telemetría de GitHub */}
            {!loadingPublish && publishStatus && (
              <div className="text-[9.5px] uppercase font-mono space-y-1.5 py-1.5 border-t border-b border-border-warm-hover/30">
                <div className="flex justify-between">
                  <span className="text-slate-500">Última Release:</span>
                  <span className="font-bold text-slate-300">
                    {publishStatus.lastPublishVersion ? `v${publishStatus.lastPublishVersion} (Parche ${publishStatus.lastPublishPatch})` : 'Ninguna'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Publicado el:</span>
                  <span className="font-bold text-slate-300">
                    {publishStatus.lastPublishDate !== '-' ? formatTimestamp(publishStatus.lastPublishDate) : 'Nunca'}
                  </span>
                </div>
                {publishStatus.pendingPublish && (
                  <div className="text-amber-500 font-black animate-pulse text-[9px] pt-1">
                    ⚠ Cambios locales pendientes de publicar
                  </div>
                )}
              </div>
            )}

            <div className="pt-2 flex flex-col gap-2.5">
              <button 
                onClick={handlePublishGithub}
                disabled={actionState === 'publishing' || !!isSyncing}
                className={`w-full px-6 py-3.5 font-black uppercase text-[9.5px] tracking-widest rounded-sm transition-all duration-200 border cursor-pointer select-none active:scale-95
                  ${actionState === 'publishing' || !!isSyncing
                    ? 'bg-border-warm border-border-warm text-slate-500 cursor-not-allowed' 
                    : 'bg-[#0e1c14] border-emerald-500/30 hover:border-emerald-500 text-emerald-300 hover:text-white shadow-[0_0_15px_rgba(16,185,129,0.1)]'}`}
              >
                {actionState === 'publishing' ? 'Publicando...' : 'Publicar en GitHub'}
              </button>
              
              {/* Mensaje de estado */}
              {actionState !== 'idle' && (
                <div className={`text-[9.5px] uppercase font-bold tracking-wider text-center ${
                  actionState === 'error' ? 'text-red-400' : 'text-emerald-400'
                }`}>
                  {statusMessage}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* TERMINAL DE EVENTOS (PREMIUM cyberpunk CONSOLE SHELL) */}
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
          <div className="flex-1 flex flex-col p-6 min-h-0">
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
                  <div key={i} className="flex gap-4 items-start select-text leading-relaxed">
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

        </div>
      </div>
    </>
  );
};