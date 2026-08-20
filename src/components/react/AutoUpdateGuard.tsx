// src/components/react/AutoUpdateGuard.tsx
import React, { useState, useEffect, useRef } from 'react';

// Constantes de sondeo y temporización autónoma
const POLL_INTERVAL_IDLE_MS = 3000;         // Reposo / fuera de partida
const POLL_INTERVAL_MATCHMAKING_MS = 200;   // Búsqueda de partida (sondeo rápido)
const POLL_INTERVAL_CHAMP_SELECT_MS = 1500; // Fase de selección de campeón
const READY_CHECK_TOTAL_SECONDS = 10.0;     // Duración nominal del cartel de aceptación
const READY_CHECK_TICK_MS = 50;             // Tick del cronómetro interno
const READY_CHECK_SAFETY_MARGIN_SEC = 1.0;  // Disparo de seguridad si se acerca al límite

export const AutoUpdateGuard = () => {
  const [showNotification, setShowNotification] = useState<boolean>(false);
  const [reason, setReason] = useState<string>('');

  // 1. Cargar configuraciones del auto-aceptar al montar
  const [configs, setConfigs] = useState({ autoAcceptEnabled: false, autoAcceptDelayPct: 80 });
  const configsRef = useRef({ autoAcceptEnabled: false, autoAcceptDelayPct: 80 });

  const lastNotifiedReadyCheckRef = useRef<boolean>(false);
  const readyCheckStartTimeRef = useRef<number>(0);
  const isAcceptingRef = useRef<boolean>(false);
  const readyCheckIntervalRef = useRef<any>(null);

  useEffect(() => {
    configsRef.current = configs;
  }, [configs]);

  useEffect(() => {
    const fetchConfigs = async () => {
      try {
        const res = await fetch('/api/config');
        if (res.ok) {
          const data = await res.json();
          const loaded = {
            autoAcceptEnabled: data.auto_accept_enabled === true,
            autoAcceptDelayPct: typeof data.auto_accept_delay_pct === 'number' ? data.auto_accept_delay_pct : 80
          };
          setConfigs(loaded);
          configsRef.current = loaded;
        }
      } catch (e) {
        console.error('[AutoUpdateGuard] Error cargando configs:', e);
      }
    };
    fetchConfigs();
  }, []);

  // Endpoint de notificación en Telegram
  const notifyTelegram = async (message: string) => {
    try {
      await fetch('/api/telegram-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
    } catch (e) {
      console.error('[AutoUpdateGuard] Fallo al simular notificación de Telegram:', e);
    }
  };

  const clearReadyCheckTimer = () => {
    if (readyCheckIntervalRef.current) {
      clearInterval(readyCheckIntervalRef.current);
      readyCheckIntervalRef.current = null;
    }
  };

  // 2. Polling dinámico de alta frecuencia para monitorear matchmaking, auto-aceptar de forma iterativa y redirigir a /draft
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let pollingTimeout: any = null;

    const checkDraftPhase = async () => {
      let nextInterval = POLL_INTERVAL_IDLE_MS;
      try {
        const res = await fetch('/api/game-status');
        if (!res.ok) return;

        const { phase } = await res.json();

        if (phase === 'Matchmaking') {
          nextInterval = POLL_INTERVAL_MATCHMAKING_MS; // Sondeo rápido buscando partida
          clearReadyCheckTimer();
          readyCheckStartTimeRef.current = 0;
          isAcceptingRef.current = false;
          if (lastNotifiedReadyCheckRef.current) {
            lastNotifiedReadyCheckRef.current = false;
          }
        } 
        else if (phase === 'ReadyCheck') {
          nextInterval = 300; // Sondeo continuo de fase durante ReadyCheck

          if (!lastNotifiedReadyCheckRef.current) {
            lastNotifiedReadyCheckRef.current = true;
            readyCheckStartTimeRef.current = performance.now();
            console.log('[AutoUpdateGuard] ¡Partida encontrada! Iniciando cronómetro autónomo de aceptación...');
            
            if (sessionStorage.getItem('hexdraft_telegram_notified_readycheck') !== 'true') {
              sessionStorage.setItem('hexdraft_telegram_notified_readycheck', 'true');
              notifyTelegram('¡Partida encontrada! Preparando fase de selección.');
            }

            // Iniciar cronómetro interno autónomo si Auto-Accept está activado
            if (configsRef.current.autoAcceptEnabled && !readyCheckIntervalRef.current) {
              const targetDelayMs = (configsRef.current.autoAcceptDelayPct / 100) * (READY_CHECK_TOTAL_SECONDS * 1000);
              const safetyMs = (READY_CHECK_TOTAL_SECONDS - READY_CHECK_SAFETY_MARGIN_SEC) * 1000;

              readyCheckIntervalRef.current = setInterval(async () => {
                if (readyCheckStartTimeRef.current === 0) return;
                const elapsedMs = performance.now() - readyCheckStartTimeRef.current;

                if ((elapsedMs >= targetDelayMs || elapsedMs >= safetyMs) && !isAcceptingRef.current) {
                  isAcceptingRef.current = true;
                  clearReadyCheckTimer();

                  console.log(`[AutoUpdateGuard] Ejecutando auto-aceptar al alcanzar ${(elapsedMs / 1000).toFixed(2)}s (Meta: ${(targetDelayMs / 1000).toFixed(2)}s)...`);
                  
                  try {
                    const acceptRes = await fetch('/api/ready-check', { method: 'POST' });
                    if (acceptRes.ok) {
                      console.log('[AutoUpdateGuard] Partida aceptada con éxito en LCU.');
                      if (sessionStorage.getItem('hexdraft_telegram_notified_accepted') !== 'true') {
                        sessionStorage.setItem('hexdraft_telegram_notified_accepted', 'true');
                        notifyTelegram('Partida aceptada. Entrando al lobby de draft.');
                      }
                    } else {
                      console.error('[AutoUpdateGuard] Error respondiendo POST /api/ready-check.');
                      isAcceptingRef.current = false;
                    }
                  } catch (err) {
                    console.error('[AutoUpdateGuard] Excepción enviando POST /api/ready-check:', err);
                    isAcceptingRef.current = false;
                  }
                }
              }, READY_CHECK_TICK_MS);
            }
          }
        } 
        else if (phase === 'ChampSelect') {
          nextInterval = POLL_INTERVAL_CHAMP_SELECT_MS;
          clearReadyCheckTimer();
          readyCheckStartTimeRef.current = 0;
          isAcceptingRef.current = false;
          const hasRedirected = sessionStorage.getItem('hexdraft_draft_redirected') === 'true';
          const isCurrentlyOnDraft = window.location.pathname === '/draft';

          if (!hasRedirected && !isCurrentlyOnDraft) {
            console.log('[AutoUpdateGuard] ¡Fase de selección detectada! Redirigiendo a /draft...');
            sessionStorage.setItem('hexdraft_draft_redirected', 'true');
            window.location.href = '/draft';
          }
        } 
        else {
          clearReadyCheckTimer();
          sessionStorage.removeItem('hexdraft_draft_redirected');
          sessionStorage.removeItem('hexdraft_telegram_notified_readycheck');
          sessionStorage.removeItem('hexdraft_telegram_notified_accepted');
          readyCheckStartTimeRef.current = 0;
          isAcceptingRef.current = false;
          if (lastNotifiedReadyCheckRef.current) {
            lastNotifiedReadyCheckRef.current = false;
          }
        }

      } catch (e) {
        console.warn('[AutoUpdateGuard] Error comprobando fase de juego:', e);
      } finally {
        pollingTimeout = setTimeout(checkDraftPhase, nextInterval);
      }
    };

    checkDraftPhase();

    return () => {
      if (pollingTimeout) clearTimeout(pollingTimeout);
      clearReadyCheckTimer();
    };
  }, [configs]);

  // 2. Comprobar recomendación de actualización al iniciar la sesión de la app
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const isDismissed = sessionStorage.getItem('hexdraft_sync_alert_dismissed') === 'true';
    if (isDismissed) return;

    const performUpdateCheck = async () => {
      try {
        const res = await fetch('/api/sync?type=check');
        if (!res.ok) return;

        const data = await res.json();
        if (data.needs_build_sync || data.needs_lane_sync) {
          let msg = 'Los datos locales tienen más de 3 días.';
          if (data.is_new_patch) {
            msg = `Nuevo parche detectado (${data.version}). Se recomienda actualizar la base de datos local.`;
          }
          setReason(msg);
          setShowNotification(true);
        }
      } catch (e) {
        console.error("Error en la comprobación de actualización:", e);
      }
    };

    // Pequeño retardo al arrancar
    const timer = setTimeout(performUpdateCheck, 2000);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setShowNotification(false);
    sessionStorage.setItem('hexdraft_sync_alert_dismissed', 'true');
  };

  if (!showNotification) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-[#0b0b0f] border border-border-warm text-slate-200 rounded-sm p-4 shadow-xl relative overflow-hidden flex flex-col gap-3">
        {/* Indicador superior plano */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-amber-500/50" />
        
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
            <span className="text-[10px] text-amber-500 font-bold uppercase tracking-wider">
              Actualización Recomendada
            </span>
          </div>
          <button 
            onClick={handleDismiss}
            className="text-slate-500 hover:text-white transition-colors duration-200 text-xs font-bold leading-none cursor-pointer"
          >
            ✕
          </button>
        </div>
        
        <div className="space-y-1">
          <h4 className="text-xs font-black text-white uppercase tracking-wide">
            Base de datos desactualizada
          </h4>
          <p className="text-[9.5px] text-slate-400 tracking-wide leading-relaxed uppercase font-bold">
            {reason}
          </p>
        </div>
        
        <div className="flex gap-2 justify-end pt-1">
          <button 
            onClick={handleDismiss}
            className="px-3 py-1.5 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white text-[9px] uppercase tracking-wider font-bold transition-all duration-200 rounded-sm cursor-pointer"
          >
            Omitir
          </button>
          <a 
            href="/actualizar"
            className="px-3 py-1.5 bg-[#1a1523] border border-purple-500/30 hover:border-purple-500/60 text-slate-200 hover:text-white text-[9px] uppercase tracking-wider font-black transition-all duration-200 rounded-sm cursor-pointer flex items-center gap-1 shadow-md"
          >
            Actualizar
          </a>
        </div>
      </div>
    </div>
  );
};
