// src/components/react/AutoUpdateGuard.tsx
import { useState, useEffect, useRef } from 'react';

// Constantes de sondeo y temporización autónoma
const POLL_INTERVAL_IDLE_MS = 3000;         // Reposo / fuera de partida
const POLL_INTERVAL_MATCHMAKING_MS = 200;   // Búsqueda de partida (sondeo rápido)
const POLL_INTERVAL_CHAMP_SELECT_MS = 1500; // Fase de selección de campeón
const READY_CHECK_TOTAL_SECONDS = 10.0;     // Duración nominal del cartel de aceptación
const READY_CHECK_TICK_MS = 50;             // Tick del cronómetro interno
const READY_CHECK_SAFETY_MARGIN_SEC = 1.0;  // Disparo de seguridad si se acerca al límite

export const AutoUpdateGuard = () => {
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

  return null;
};
