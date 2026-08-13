import React, { useState, useEffect } from 'react';

export const AutoUpdateGuard = () => {
  // 1. Cargar configuraciones del auto-aceptar al montar
  const [configs, setConfigs] = useState({ autoAcceptEnabled: false, autoAcceptDelayPct: 80 });
  const readyCheckMaxRef = React.useRef<number>(10);
  const lastNotifiedReadyCheckRef = React.useRef<boolean>(false);
  const readyCheckStartTimeRef = React.useRef<number>(0);
  const isAcceptingRef = React.useRef<boolean>(false);

  useEffect(() => {
    const fetchConfigs = async () => {
      try {
        const res = await fetch('/api/config');
        if (res.ok) {
          const data = await res.json();
          setConfigs({
            autoAcceptEnabled: data.auto_accept_enabled === true,
            autoAcceptDelayPct: data.auto_accept_delay_pct || 80
          });
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

  // 2. Polling dinámico de alta frecuencia para monitorear matchmaking, auto-aceptar de forma iterativa y redirigir a /draft
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let pollingTimeout: any = null;

    const checkDraftPhase = async () => {
      let nextInterval = 3000;
      try {
        const res = await fetch('/api/game-status');
        if (!res.ok) return;

        const { phase } = await res.json();

        if (phase === 'Matchmaking') {
          nextInterval = 500; // Polling rápido buscando partida
          readyCheckMaxRef.current = 10;
          readyCheckStartTimeRef.current = 0;
          isAcceptingRef.current = false;
          if (lastNotifiedReadyCheckRef.current) {
            lastNotifiedReadyCheckRef.current = false;
          }
        } 
        else if (phase === 'ReadyCheck') {
          nextInterval = 300; // Sondeo continuo de alta velocidad durante ReadyCheck

          if (!lastNotifiedReadyCheckRef.current) {
            lastNotifiedReadyCheckRef.current = true;
            readyCheckStartTimeRef.current = Date.now();
            console.log('[AutoUpdateGuard] ¡Partida encontrada! Monitoreando cartel de aceptación...');
            
            if (sessionStorage.getItem('hexdraft_telegram_notified_readycheck') !== 'true') {
              sessionStorage.setItem('hexdraft_telegram_notified_readycheck', 'true');
              notifyTelegram('¡Partida encontrada! Preparando fase de selección.');
            }
          }

          // LÓGICA DE AUTO-ACEPTACIÓN CON RESPETO AL DELAY CONFIGURADO
          if (configs.autoAcceptEnabled) {
            try {
              const rcRes = await fetch('/api/ready-check');
              if (rcRes.ok) {
                const rcData = await rcRes.json();
                
                // Si la partida está activa en ReadyCheck y el jugador aún no ha respondido
                if (rcData.active && rcData.playerResponse !== 'Accepted' && rcData.playerResponse !== 'Declined') {
                  const timerSeconds = typeof rcData.timer === 'number' && rcData.timer > 0 ? rcData.timer : 10;
                  if (timerSeconds > readyCheckMaxRef.current || readyCheckMaxRef.current === 10) {
                    readyCheckMaxRef.current = timerSeconds;
                  }

                  const realElapsedSeconds = readyCheckStartTimeRef.current > 0 ? (Date.now() - readyCheckStartTimeRef.current) / 1000 : 0;
                  const delayPct = configs.autoAcceptDelayPct || 80;
                  const targetDelaySeconds = (delayPct / 100) * readyCheckMaxRef.current;
                  
                  // Forzar solo si queda muy poco tiempo (<= 1.5s) y ya transcurrieron al menos 2s reales
                  const forceSafety = timerSeconds <= 1.5 && realElapsedSeconds >= 2.0;

                  if ((realElapsedSeconds >= targetDelaySeconds || forceSafety) && !isAcceptingRef.current) {
                    isAcceptingRef.current = true;
                    console.log(`[AutoUpdateGuard] Ejecutando auto-aceptar al alcanzar ${delayPct}% del cartel... (Transcurrido: ${realElapsedSeconds.toFixed(1)}s / Meta: ${targetDelaySeconds.toFixed(1)}s, Restante: ${timerSeconds.toFixed(1)}s)`);
                    
                    const acceptRes = await fetch('/api/ready-check', { method: 'POST' });
                    if (acceptRes.ok) {
                      console.log('[AutoUpdateGuard] Partida aceptada con éxito en LCU.');
                      if (sessionStorage.getItem('hexdraft_telegram_notified_accepted') !== 'true') {
                        sessionStorage.setItem('hexdraft_telegram_notified_accepted', 'true');
                        notifyTelegram('Partida aceptada. Entrando al lobby de draft.');
                      }
                    } else {
                      console.error('[AutoUpdateGuard] Error respondiendo POST /api/ready-check (se reintentará en 300ms).');
                      isAcceptingRef.current = false;
                    }
                  }
                }
              }
            } catch (err) {
              console.error('[AutoUpdateGuard] Error al consultar /api/ready-check:', err);
              isAcceptingRef.current = false;
            }
          }
        } 
        else if (phase === 'ChampSelect') {
          nextInterval = 3000;
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
          sessionStorage.removeItem('hexdraft_draft_redirected');
          sessionStorage.removeItem('hexdraft_telegram_notified_readycheck');
          sessionStorage.removeItem('hexdraft_telegram_notified_accepted');
          readyCheckMaxRef.current = 10;
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
    };
  }, [configs]);

  return null;
};
