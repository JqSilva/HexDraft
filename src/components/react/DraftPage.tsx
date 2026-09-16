import { rolesFromPlayers } from '../../lib/engine/draftContext';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { LcuPlayer } from './PlayerSlot';
import type { Recommendation } from '../../lib/engine/picks/types';
import type { BansRecommendation } from '../../lib/engine/bans/types';
import { getProcessedRecommendations, getSingleChampionBuild } from '../../lib/engine/picks/index';
import { getProcessedBans } from '../../lib/engine/bans/index';
import { getNameFromId, setEngineWeights, initializePersonalStats } from '../../lib/engine/core/constants';
import { ENRICHED_DB, initializeEngineData, initializeItemsData } from '../../lib/engine/core/dataProvider';
import { CombatDirectivesPanel } from './TacticalDirectives';
import { getTacticalDirectives } from '../../lib/engine/tacticalEngine';
import { analyzeComposition } from '../../lib/engine/picks/compositionAnalyzer';
import { getChampionCdnName } from '../../lib/championMapper';
import { notifyTelegram } from '../../lib/services/telegram.service';

// Importación de subcomponentes modulares
import { ConnectionStatus } from './ConnectionStatus';
import { TeamSidebar } from './TeamSidebar';
import { DraftLobby } from './DraftLobby';
import { DraftGrid } from './DraftGrid';
import { DraftSettings } from './DraftSettings';
import { ChampionPreviewModal } from './ChampionPreviewModal';
import { SkillTimeline } from './SkillTimeline';
import { ItemBuild } from './ItemBuild';
import { LiveGamePanel } from './LiveGamePanel';

// Modular components & utils
import { DraftDamageBalance } from './draft/DraftDamageBalance';
import {
    getFriendlyRoleName,
    executeLcuAction,
    importToClient,
    PHASE_TRANSLATIONS,
    POS_BASE,
    posMapping,
    posLabels
} from './draft/utils';

export const DraftPage = () => {
    // --- ESTADOS ---
    const [isConnected, setIsConnected] = useState<boolean>(false);
    const [gamePhase, setGamePhase] = useState<string>('Offline');
    const [inDraft, setInDraft] = useState<boolean>(false);
    const [view, setView] = useState<'lobby' | 'picks' | 'bans' | 'build' | 'reasons'>('lobby');
    const [previewChamp, setPreviewChamp] = useState<Recommendation | null>(null);
    const [myTeam, setMyTeam] = useState<LcuPlayer[]>(Array(5).fill({ championId: 0, championPickIntent: 0, assignedPosition: '', cellId: 0 }));
    const [theirTeam, setTheirTeam] = useState<LcuPlayer[]>(Array(5).fill({ championId: 0, championPickIntent: 0, assignedPosition: '', cellId: 0 }));
    const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
    const [banRecommendations, setBanRecommendations] = useState<BansRecommendation[]>([]);
    const [currentBuild, setCurrentBuild] = useState<any>(null);
    const [localTimeLeft, setLocalTimeLeft] = useState<number>(0);
    const [selectedRecommendation, setSelectedRecommendation] = useState<Recommendation | null>(null);
    const [tacticalData, setTacticalData] = useState<{ skills: string[] } | null>(null);
    const [isCompact, setIsCompact] = useState<boolean>(false);
    const [myRole, setMyRole] = useState<string>('jungle');
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
    const [prevConnected, setPrevConnected] = useState<boolean | null>(null);
    const [activePlaystyleIndex, setActivePlaystyleIndex] = useState<number>(0);
    const [localPlayerCellId, setLocalPlayerCellId] = useState<number>(0);

    // --- CONFIGURACIÓN ---
    const [autoPick, setAutoPick] = useState<boolean>(() => (typeof window !== 'undefined' ? localStorage.getItem('autoPick:v1') === 'true' : false));
    const [autoBan, setAutoBan] = useState<boolean>(() => (typeof window !== 'undefined' ? localStorage.getItem('autoBan:v1') === 'true' : false));
    const [autoExecuteSeconds, setAutoExecuteSeconds] = useState<number>(3.5);

    const handleToggleAutoPick = useCallback(async (val: boolean) => {
        setAutoPick(val);
        localStorage.setItem('autoPick:v1', String(val));
        try {
            await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ auto_pick: val })
            });
        } catch (e) {
            console.error('Error sincronizando auto_pick con la API:', e);
        }
    }, []);

    const handleToggleAutoBan = useCallback(async (val: boolean) => {
        setAutoBan(val);
        localStorage.setItem('autoBan:v1', String(val));
        try {
            await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ auto_ban: val })
            });
        } catch (e) {
            console.error('Error sincronizando auto_ban con la API:', e);
        }
    }, []);

    // --- REFERENCIAS ---
    const activeActionRef = useRef<any>(null);
    const lastActionKeyRef = useRef<string>("none");
    const lastFingerprintRef = useRef<string>("");
    const lastImportedIdRef = useRef<number>(0);
    const lastImportedSignatureRef = useRef<string>("");
    const lastEveryonePickedRef = useRef<boolean>(false);
    const currentDataRef = useRef<any>(null);
    const isPollingRef = useRef<boolean>(false);
    const apiTimeAtSyncRef = useRef<number>(0);
    const timestampAtSyncRef = useRef<number>(0);

    const notifiedBanRef = useRef<number>(0);
    const notifiedPickRef = useRef<number>(0);
    const notifiedStartRef = useRef<boolean>(false);
    const handleAutoExecutionRef = useRef<any>(null);
    const isRestoredRef = useRef<boolean>(false);

    const ROLE_MAP_TO_API: Record<string, string> = {
        "top": "top",
        "jungle": "jungle",
        "mid": "middle",
        "adc": "bottom",
        "supp": "utility"
    };

    const [showRoleModal, setShowRoleModal] = useState<boolean>(false);
    const [selectedRoleKey, setSelectedRoleKey] = useState<string>('top');
    const manualRoleSelectedRef = useRef<boolean>(false);

    const [isLoadingScreen, setIsLoadingScreen] = useState<boolean>(false);
    const [isGameReady, setIsGameReady] = useState<boolean>(false);
    const [manualOverrideLoadingScreen, setManualOverrideLoadingScreen] = useState<boolean | null>(null);

    const isPlaying = gamePhase === 'InProgress';
    const showLoadingScreenPanel = manualOverrideLoadingScreen !== null ? manualOverrideLoadingScreen : isLoadingScreen;

    const myPlayer = myTeam.find(p => p.cellId === localPlayerCellId);
    const myId = myPlayer?.championId || 0;

    useEffect(() => {
        queueMicrotask(() => setActivePlaystyleIndex(0));
    }, [myId]);

    const everyonePicked = useMemo(() => {
        if (!inDraft) return false;
        const myLocked = myTeam.every(p => p.championId > 0);
        const theirLocked = theirTeam.length === 0 || theirTeam.every(p => p.championId > 0);
        return myLocked && theirLocked;
    }, [inDraft, myTeam, theirTeam]);

    // Nombres de campeones aliados y enemigos para el motor táctico
    const allyNames = useMemo(() => {
        return myTeam.flatMap(p => {
            const name = getNameFromId(p.championId || p.championPickIntent);
            return name ? [name] : [];
        });
    }, [myTeam]);

    const enemyNames = useMemo(() => {
        return theirTeam.flatMap(p => {
            const name = getNameFromId(p.championId || p.championPickIntent);
            return name ? [name] : [];
        });
    }, [theirTeam]);

    const champData = useMemo(() => {
        if (!currentBuild) return null;
        return ENRICHED_DB[currentBuild.name] || null;
    }, [currentBuild]);

    const championScore = useMemo(() => {
        if (myId === 0) return undefined;
        const rec = recommendations.find(r => r.id === myId);
        if (rec) return rec.score;
        return undefined;
    }, [myId, recommendations]);

    const tacticalDirectives = useMemo(() => {
        const champName = getNameFromId(myId) || (currentBuild ? currentBuild.name : null);
        if (!champName) return null;
        return getTacticalDirectives(champName, myRole, allyNames, enemyNames);
    }, [myId, currentBuild, myRole, allyNames, enemyNames]);

    const myTeamAnalysis = useMemo(() => {
        return analyzeComposition(allyNames);
    }, [allyNames]);

    // Cargar datos de la base de datos SQLite local al montar
    useEffect(() => {
        const loadDb = async () => {
            try {
                console.log("🔌 Sincronizando motor HexDraft con bases de datos locales...");

                // 1. Obtener y configurar Pesos del Motor y Ajustes de Automatización
                const configRes = await fetch('/api/config');
                if (configRes.ok) {
                    const config = await configRes.json();
                    if (config.engine_weights) {
                        setEngineWeights(config.engine_weights);
                        console.log("⚖️ Pesos del motor sincronizados.");
                    }
                    if (typeof config.auto_pick === 'boolean') {
                        setAutoPick(config.auto_pick);
                        localStorage.setItem('autoPick:v1', String(config.auto_pick));
                    }
                    if (typeof config.auto_ban === 'boolean') {
                        setAutoBan(config.auto_ban);
                        localStorage.setItem('autoBan:v1', String(config.auto_ban));
                    }
                    if (typeof config.auto_execute_seconds === 'number' && !isNaN(config.auto_execute_seconds)) {
                        setAutoExecuteSeconds(config.auto_execute_seconds);
                    }
                }

                // 2. Obtener y configurar Items
                const itemsRes = await fetch('/api/items');
                if (itemsRes.ok) {
                    const itemsData = await itemsRes.json();
                    initializeItemsData(itemsData);
                }

                // 3. Obtener y configurar Estadísticas Personales (Maestría)
                const statsRes = await fetch('/api/personal-stats');
                if (statsRes.ok) {
                    const statsData = await statsRes.json();
                    initializePersonalStats(statsData);
                }

                // 4. Obtener y configurar Campeones Enriquecidos.
                // La API puede estar terminando una migración al arrancar; reintentar evita
                // que un fallo transitorio deje el motor vacío durante toda la sesión.
                let championsRes: Response | undefined;
                for (let attempt = 1; attempt <= 3; attempt += 1) {
                    try {
                        const candidate = await fetch('/api/champions');
                        if (candidate.ok) {
                            championsRes = candidate;
                            break;
                        }
                        console.warn(`No se pudo obtener campeones (intento ${attempt}/3): HTTP ${candidate.status}`);
                    } catch (error) {
                        if (attempt === 3) throw error;
                        console.warn(`No se pudo conectar con campeones (intento ${attempt}/3).`);
                    }
                    if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 250 * attempt));
                }
                if (championsRes?.ok) {
                    const data = await championsRes.json();
                    initializeEngineData(data);
                    console.log("🧬 Campeones enriquecidos sincronizados con el cliente.");
                } else {
                    console.warn("No se pudo obtener datos de SQLite después de 3 intentos; se reintentará al recargar la página.");
                }
            } catch (e) {
                console.error("Error cargando base de datos SQLite:", e);
            }
        };
        loadDb();
    }, []);

    // Hook para detectar responsividad en el lado del cliente
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const media = window.matchMedia("(max-width: 1400px)");
        const listener = (e: MediaQueryListEvent) => setIsCompact(e.matches);
        queueMicrotask(() => setIsCompact(media.matches));
        media.addEventListener("change", listener);
        return () => media.removeEventListener("change", listener);
    }, []);

    // Guardar configuraciones en localStorage
    useEffect(() => {
        localStorage.setItem('autoPick:v1', String(autoPick));
    }, [autoPick]);

    useEffect(() => {
        localStorage.setItem('autoBan:v1', String(autoBan));
    }, [autoBan]);

    const [autoPickAlert, setAutoPickAlert] = useState<{ active: boolean; message: string; submessage?: string }>({ active: false, message: '' });

    const handleAutoExecution = async () => {
        const data = currentDataRef.current;
        const currentAction = activeActionRef.current;
        if (!data || !currentAction || currentAction.completed) return;

        currentAction.completed = true; // Bloqueo inmediato para evitar doble envío simultáneo
        console.log(`🚀 [AUTO] Iniciando auto-ejecución para ${currentAction.type}...`);

        try {
            const cleanMyTeam = data.myTeam.map((p: any) => p.championId).filter((id: number) => id !== 0);
            const cleanTheirTeam = data.theirTeam.map((p: any) => p.championId).filter((id: number) => id !== 0);
            const bannedIds = data.actions?.flat().filter((a: any) => a.type === 'ban' && a.completed).map((a: any) => a.championId) || [];
            const unavailableIds = [...new Set([...bannedIds, ...cleanMyTeam, ...cleanTheirTeam])];

            const myPlayer = data.myTeam.find((p: any) => p.cellId === data.localPlayerCellId);
            const rawRole = myPlayer?.assignedPosition;
            const hasValidRole = Boolean(rawRole && rawRole.trim() !== '' && rawRole.toLowerCase() !== 'none');
            const currentRole = hasValidRole ? rawRole.toLowerCase() : "jungle";

            // Obtener campeones preseleccionados por compañeros de equipo (excluyéndome a mí)
            const allyHovered = data.myTeam
                .filter((p: any) => p.cellId !== data.localPlayerCellId)
                .map((p: any) => p.championPickIntent || 0)
                .filter((id: number) => id !== 0);

            let targetId = 0;
            if (currentAction.type === 'pick') {
                // Nivel 1: Recomendaciones en estado de React de la UI
                const availableStatePicks = recommendations.filter(p => !unavailableIds.includes(p.id) && !allyHovered.includes(p.id));
                if (availableStatePicks.length > 0) {
                    targetId = availableStatePicks[0].id;
                }

                // Nivel 2: Recalcular recomendaciones con el rol del jugador
                if (targetId === 0) {
                    const picks = getProcessedRecommendations(cleanMyTeam, cleanTheirTeam, unavailableIds, currentRole, undefined, undefined, { allyRoles: rolesFromPlayers(data.myTeam), enemyRoles: rolesFromPlayers(data.theirTeam) });
                    const availablePicks = picks.filter(p => !allyHovered.includes(p.id));
                    if (availablePicks.length > 0) targetId = availablePicks[0].id;
                }

                // Nivel 3: Recalcular con roles de fallback si el rol actual fue inválido o vacío
                if (targetId === 0) {
                    for (const fallbackRole of ["jungle", "middle", "top", "bottom", "utility"]) {
                        const fallbackPicks = getProcessedRecommendations(cleanMyTeam, cleanTheirTeam, unavailableIds, fallbackRole, undefined, undefined, { allyRoles: rolesFromPlayers(data.myTeam), enemyRoles: rolesFromPlayers(data.theirTeam) });
                        const available = fallbackPicks.filter(p => !allyHovered.includes(p.id));
                        if (available.length > 0) {
                            targetId = available[0].id;
                            break;
                        }
                    }
                }

                // Nivel 4: Usar el campeón preseleccionado (hover) del propio jugador si no está ocupado
                if (targetId === 0) {
                    const myHover = myPlayer?.championPickIntent || 0;
                    if (myHover > 0 && !unavailableIds.includes(myHover)) {
                        targetId = myHover;
                    }
                }

                // (Sin Nivel 5: No se fuerza ningún campeón aleatorio al azar)
            } else if (currentAction.type === 'ban') {
                const allyHoveredOrSelected = data.myTeam.map((p: any) => p.championId || p.championPickIntent || 0).filter((id: number) => id !== 0);

                // Nivel 1: Recomendaciones de ban de la UI
                const availableBans = banRecommendations.filter(b => !unavailableIds.includes(b.id) && !allyHoveredOrSelected.includes(b.id));
                if (availableBans.length > 0) {
                    targetId = availableBans[0].id;
                }

                // Nivel 2: Recalcular recomendaciones de ban
                if (targetId === 0) {
                    const picks = getProcessedRecommendations(cleanMyTeam, cleanTheirTeam, unavailableIds, currentRole, undefined, undefined, { allyRoles: rolesFromPlayers(data.myTeam), enemyRoles: rolesFromPlayers(data.theirTeam) });
                    const bannedNames = bannedIds.map((id: number) => getNameFromId(id)).filter(Boolean) as string[];
                    const allyNames = data.myTeam.map((p: any) => getNameFromId(p.championId || p.championPickIntent || 0)).filter(Boolean) as string[];
                    const enemyNames = data.theirTeam.map((p: any) => getNameFromId(p.championId || p.championPickIntent || 0)).filter(Boolean) as string[];
                    const myHoverName = getNameFromId(myPlayer?.championPickIntent || 0) || null;
                    const bans = getProcessedBans(
                        picks,
                        myHoverName,
                        currentRole,
                        allyNames,
                        enemyNames,
                        bannedNames
                    ).filter(b => !unavailableIds.includes(b.id) && !allyHoveredOrSelected.includes(b.id));
                    if (bans.length > 0) targetId = bans[0].id;
                }
            }

            if (targetId > 0) {
                const success = await executeLcuAction(currentAction.id, targetId);
                if (!success) {
                    console.warn(`⚠️ [AUTO] executeLcuAction retornó false para ${targetId}, avisando al usuario.`);
                    currentAction.completed = false;
                    if (currentAction.type === 'pick') {
                        setAutoPickAlert({
                            active: true,
                            message: '⚠️ ALERTA: ERROR AL EJECUTAR AUTO-PICK',
                            submessage: 'No se pudo enviar la selección al cliente de League. ¡Por favor selecciona tu campeón manualmente de inmediato!'
                        });
                        notifyTelegram('⚠️ ALERTA: Error enviando Auto-Pick al juego. Por favor selecciona tu campeón manualmente.');
                    }
                } else {
                    console.log(`🎉 [AUTO] ${currentAction.type} completado con éxito para ID: ${targetId}`);
                    if (currentAction.type === 'pick') {
                        setAutoPickAlert({ active: false, message: '' });
                    }
                }
            } else {
                console.error(`❌ [AUTO] No se encontró campeón elegible para ${currentAction.type}. Notificando al usuario.`);
                currentAction.completed = false;
                if (currentAction.type === 'pick') {
                    const reasonMsg = !hasValidRole
                        ? 'Riot no asignó una posición/rol válido a tu jugador. ¡Selecciona tu campeón manualmente!'
                        : 'No se encontró un campeón disponible para auto-pick. ¡Por favor selecciona tu campeón manualmente!';

                    setAutoPickAlert({
                        active: true,
                        message: '⚠️ ATENCIÓN: SE REQUIERE SELECCIÓN MANUAL',
                        submessage: reasonMsg
                    });
                    notifyTelegram(`⚠️ ATENCIÓN: Auto-Pick requiere acción manual (${reasonMsg}). Por favor selecciona en el juego.`);
                }
            }
        } catch (e) {
            console.error("❌ [AUTO] Excepción en handleAutoExecution:", e);
            currentAction.completed = false;
        }
    };

    useEffect(() => {
        handleAutoExecutionRef.current = handleAutoExecution;
    });

    // =========================================================
    // RELOJ ÚNICO (Con baneo/pick automático)
    // =========================================================
    useEffect(() => {
        const interval = setInterval(() => {
            if (activeActionRef.current && timestampAtSyncRef.current > 0) {
                const now = Date.now();
                const elapsed = now - timestampAtSyncRef.current;
                const remaining = Math.max(0, apiTimeAtSyncRef.current - elapsed);

                setLocalTimeLeft(Math.floor(remaining));

                // Lógica de ejecución automática dinámica
                const thresholdMs = (autoExecuteSeconds || 3.5) * 1000;
                if (remaining <= thresholdMs && remaining > 500 && !activeActionRef.current.completed) {
                    if ((activeActionRef.current.type === 'pick' && autoPick) ||
                        (activeActionRef.current.type === 'ban' && autoBan)) {
                        if (handleAutoExecutionRef.current) {
                            handleAutoExecutionRef.current();
                        }
                    }
                }
            }
        }, 100);
        return () => clearInterval(interval);
    }, [autoPick, autoBan, autoExecuteSeconds]);

    const handleTimerSync = (data: any) => {
        const myCellId = data.localPlayerCellId;
        const myAction = data.actions?.flat().find(
            (a: any) => a.actorCellId === myCellId && a.isInProgress && !a.completed
        );

        if (myAction) {
            const riotPhase = data.timer?.phase || "UNKNOWN";
            const actionKey = `${myAction.id}-${myAction.type}-${riotPhase}`;

            if (riotPhase === "PLANNING") {
                timestampAtSyncRef.current = Date.now();
                apiTimeAtSyncRef.current = 0;
            }

            if (lastActionKeyRef.current !== actionKey && riotPhase !== "PLANNING") {
                console.log(`Sincronizando ancla para: ${riotPhase}`);

                lastActionKeyRef.current = actionKey;
                activeActionRef.current = myAction;

                const apiTime = data.timer?.adjustedTimeLeftInPhase || 30000;
                const adjusted = apiTime > 30000 ? apiTime - 5000 : apiTime;

                timestampAtSyncRef.current = Date.now();
                apiTimeAtSyncRef.current = adjusted;

                // PRE-VERIFICACIÓN INMEDIATA AL INICIAR TU TURNO DE PICK
                if (myAction.type === 'pick' && autoPick) {
                    try {
                        const cleanMyTeam = data.myTeam.map((p: any) => p.championId).filter((id: number) => id !== 0);
                        const cleanTheirTeam = data.theirTeam.map((p: any) => p.championId).filter((id: number) => id !== 0);
                        const bannedIds = data.actions?.flat().filter((a: any) => a.type === 'ban' && a.completed).map((a: any) => a.championId) || [];
                        const unavailableIds = [...new Set([...bannedIds, ...cleanMyTeam, ...cleanTheirTeam])];
                        const myPlayer = data.myTeam.find((p: any) => p.cellId === data.localPlayerCellId);
                        const allyHovered = data.myTeam
                            .filter((p: any) => p.cellId !== data.localPlayerCellId)
                            .map((p: any) => p.championPickIntent || 0)
                            .filter((id: number) => id !== 0);

                        let testTargetId = 0;
                        const statePicks = recommendations.filter(p => !unavailableIds.includes(p.id) && !allyHovered.includes(p.id));
                        if (statePicks.length > 0) testTargetId = statePicks[0].id;

                        if (testTargetId === 0) {
                            const picks = getProcessedRecommendations(cleanMyTeam, cleanTheirTeam, unavailableIds, myRole, undefined, undefined, { allyRoles: rolesFromPlayers(data.myTeam), enemyRoles: rolesFromPlayers(data.theirTeam) });
                            const available = picks.filter(p => !allyHovered.includes(p.id));
                            if (available.length > 0) testTargetId = available[0].id;
                        }

                        if (testTargetId === 0) {
                            const myHover = myPlayer?.championPickIntent || 0;
                            if (myHover > 0 && !unavailableIds.includes(myHover)) testTargetId = myHover;
                        }

                        if (testTargetId > 0) {
                            const champName = getNameFromId(testTargetId) || `ID ${testTargetId}`;
                            console.log(`[AUTO-PICK CHECK] Tu turno de Pick ha comenzado. Campeón listo para auto-lock: ${champName} (ID: ${testTargetId}).`);
                        } else {
                            console.warn(`[AUTO-PICK CHECK] Tu turno de Pick ha comenzado, pero NO se encontró ningún campeón recomendado o preseleccionado elegible. Auto-pick NO podrá fijar automáticamente. ¡PICKEA MANUALMENTE!`);
                            setAutoPickAlert({
                                active: true,
                                message: 'SE REQUIERE SELECCIÓN MANUAL',
                                submessage: 'No se encontró un campeón disponible para auto-pick. ¡Por favor selecciona tu campeón manualmente en League of Legends!'
                            });
                        }
                    } catch (e) {
                        console.error('[AUTO-PICK CHECK] Error en pre-verificación de pick:', e);
                    }
                }
            }
        } else {
            activeActionRef.current = null;
            lastActionKeyRef.current = "none";
            timestampAtSyncRef.current = 0;
        }
    };

    const resetDraftState = useCallback(() => {
        console.log("🧹 Limpiando estado del Nexo (Fin de Draft)");

        lastFingerprintRef.current = "";
        lastImportedIdRef.current = 0;
        lastImportedSignatureRef.current = "";
        lastEveryonePickedRef.current = false;
        lastActionKeyRef.current = "none";
        timestampAtSyncRef.current = 0;
        activeActionRef.current = null;

        notifiedBanRef.current = 0;
        notifiedPickRef.current = 0;
        notifiedStartRef.current = false;
        isRestoredRef.current = false;
        manualRoleSelectedRef.current = false;
        setShowRoleModal(false);
        setAutoPickAlert({ active: false, message: '' });

        // Limpiar claves del sessionStorage para la siguiente partida
        try {
            sessionStorage.removeItem('hexdraft_telegram_notified_readycheck');
            sessionStorage.removeItem('hexdraft_telegram_notified_accepted');
            sessionStorage.removeItem('hexdraft_telegram_notified_start');
            // Eliminar todas las claves de bans y picks de la sesión
            for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);
                if (key && (key.startsWith('hexdraft_telegram_notified_ban_') || key.startsWith('hexdraft_telegram_notified_pick_'))) {
                    sessionStorage.removeItem(key);
                    i--; // Ajustar índice tras remoción
                }
            }
        } catch (e) {
            console.error("Error al limpiar sessionStorage:", e);
        }

        setInDraft(false);
        setRecommendations([]);
        setBanRecommendations([]);
        setMyTeam(Array(5).fill({ championId: 0, championPickIntent: 0, assignedPosition: '', cellId: 0 }));
        setTheirTeam(Array(5).fill({ championId: 0, championPickIntent: 0, assignedPosition: '', cellId: 0 }));
        setView('lobby');
        setActivePlaystyleIndex(0);
    }, []);

    // =========================================================
    // BUCLE PRINCIPAL (POLLING DE FASES)
    // =========================================================
    const updateLoop = async () => {
        if (isPollingRef.current) return;
        isPollingRef.current = true;
        let nextInterval = 5000;

        try {
            const statusRes = await fetch('/api/game-status');
            if (!statusRes.ok) return;
            const statusData = await statusRes.json();
            const phase = statusData.phase || 'Offline';

            if (gamePhase !== phase && (phase === 'None' || phase === 'Offline')) {
                setManualOverrideLoadingScreen(null);
            }
            setGamePhase(phase);
            setIsLoadingScreen(Boolean(statusData.isLoadingScreen));
            setIsGameReady(Boolean(statusData.isGameReady));
            setIsConnected(phase !== 'Offline');
            
            if (phase === 'ChampSelect' || phase === 'ReadyCheck') {
                nextInterval = 1500;
                const draftRes = await fetch('/api/champ-select');
                if (!draftRes.ok) return;
                const data = await draftRes.json();
                console.log(data);
                if (data.inDraft) {
                    setInDraft(true);
                    currentDataRef.current = data;
                    setMyTeam(data.myTeam);
                    setTheirTeam(data.theirTeam);
                    setLocalPlayerCellId(data.localPlayerCellId || 0);
                    handleTimerSync(data);

                    // --- DETECTAR ACCIONES COMPLETADAS PARA TELEGRAM ---
                    const cellId = data.localPlayerCellId || 0;
                    if (cellId > 0 && data.actions) {
                        const myBanAction = data.actions.flat().find(
                            (a: any) => a.actorCellId === cellId && a.type === 'ban' && a.completed
                        );
                        if (myBanAction && myBanAction.championId > 0 && notifiedBanRef.current !== myBanAction.championId) {
                            notifiedBanRef.current = myBanAction.championId;
                            const finalChampId = data.lastExecutedChampionId || myBanAction.championId;
                            const name = getNameFromId(finalChampId) || `ID ${finalChampId}`;

                            const storageKey = `hexdraft_telegram_notified_ban_${finalChampId}`;
                            if (sessionStorage.getItem(storageKey) !== 'true') {
                                sessionStorage.setItem(storageKey, 'true');
                                notifyTelegram(`Fase de Bloqueo: Baneando a <b>${name}</b>.`);
                            }
                        }

                        const myPickAction = data.actions.flat().find(
                            (a: any) => a.actorCellId === cellId && a.type === 'pick' && a.completed
                        );
                        if (myPickAction && myPickAction.championId > 0 && notifiedPickRef.current !== myPickAction.championId) {
                            notifiedPickRef.current = myPickAction.championId;
                            const finalChampId = data.lastExecutedChampionId || myPickAction.championId;
                            const name = getNameFromId(finalChampId) || `ID ${finalChampId}`;

                            const storageKey = `hexdraft_telegram_notified_pick_${finalChampId}`;
                            if (sessionStorage.getItem(storageKey) !== 'true') {
                                sessionStorage.setItem(storageKey, 'true');
                                notifyTelegram(`Fase de Selección: Campeón bloqueado: <b>${name}</b>.`);
                            }
                        }
                    }

                    const myPlayer = data.myTeam.find((p: any) => p.cellId === data.localPlayerCellId);
                    const myId = myPlayer?.championId || 0;
                    const rawRole = myPlayer?.assignedPosition;
                    const hasValidRole = Boolean(rawRole && rawRole.trim() !== '' && rawRole.toLowerCase() !== 'none');

                    let currentRole = myRole;
                    if (hasValidRole && !manualRoleSelectedRef.current) {
                        currentRole = rawRole.toLowerCase();
                        setMyRole(currentRole);
                        setShowRoleModal(false);
                    } else if (!hasValidRole && !manualRoleSelectedRef.current) {
                        setShowRoleModal(true);
                    }

                    localStorage.setItem('last_my_team:v1', JSON.stringify(data.myTeam));
                    localStorage.setItem('last_their_team:v1', JSON.stringify(data.theirTeam));
                    localStorage.setItem('last_my_role:v1', currentRole);

                    const myHoverIntent = myPlayer?.championPickIntent || 0;
                    const activeIdForEngine = myId > 0 ? myId : myHoverIntent;

                    const cleanMyTeam = data.myTeam
                        .filter((p: any) => p.cellId !== data.localPlayerCellId)
                        .map((p: any) => p.championId || p.championPickIntent)
                        .filter((id: number) => id !== 0);

                    const cleanTheirTeam = data.theirTeam.map((p: any) => p.championId || p.championPickIntent).filter((id: number) => id !== 0);
                    const bannedIds = data.actions?.flat().filter((a: any) => a.type === 'ban' && a.completed).map((a: any) => a.championId) || [];
                    const unavailableIds = [...new Set([...bannedIds, ...cleanMyTeam, ...cleanTheirTeam])];

                    // Campeones realmente bloqueados (picks fijados o baneados, sin incluir preselecciones/hovers)
                    const lockedMyTeam = data.myTeam.map((p: any) => p.championId).filter((id: number) => id !== 0);
                    const lockedTheirTeam = data.theirTeam.map((p: any) => p.championId).filter((id: number) => id !== 0);
                    const lockedAndBannedIds = [...new Set([...bannedIds, ...lockedMyTeam, ...lockedTheirTeam])];

                    let picks: Recommendation[] = [];
                    if (myId > 0) {
                        picks = getProcessedRecommendations(cleanMyTeam, cleanTheirTeam, [], currentRole, undefined, myId, { allyRoles: rolesFromPlayers(data.myTeam), enemyRoles: rolesFromPlayers(data.theirTeam) });
                    } else {
                        picks = getProcessedRecommendations(cleanMyTeam, cleanTheirTeam, unavailableIds, currentRole, activeIdForEngine, undefined, { allyRoles: rolesFromPlayers(data.myTeam), enemyRoles: rolesFromPlayers(data.theirTeam) });
                    }

                    if (myId > 0) {
                        setRecommendations(picks);
                        // Cambiar la vista a 'build' si no lo está ya, para mostrar el panel de análisis
                        if (view !== 'reasons' && view !== 'build') {
                            setView('build');
                        }

                        // 1. Calcular y actualizar la build en la interfaz (React state)
                        const buildData = getSingleChampionBuild(myId, cleanMyTeam, cleanTheirTeam, currentRole, { allyRoles: rolesFromPlayers(data.myTeam), enemyRoles: rolesFromPlayers(data.theirTeam) });
                        if (buildData) {
                            const coreIds = (buildData.build.items.core || []).map((i: any) => i.id || i).join(',');
                            const buildOrderIds = (buildData.build.items.buildOrder || buildData.build.items.core || []).map((i: any) => i.id || i).join(',');
                            const runesIds = (buildData.build.runes.selections || []).map((r: any) => r.id || r).join(',');
                            const scoresStr = (buildData.scoredClusters || []).map((c: any) => `${c.title}:${c.score}`).join(',');
                            const currentSig = `${myId}-${buildData.name}-${coreIds}-${buildOrderIds}-${runesIds}-${scoresStr}`;

                            const oldCoreIds = (currentBuild?.build?.items?.core || []).map((i: any) => i.id || i).join(',');
                            const oldBuildOrderIds = (currentBuild?.build?.items?.buildOrder || currentBuild?.build?.items?.core || []).map((i: any) => i.id || i).join(',');
                            const oldRunesIds = (currentBuild?.build?.runes?.selections || []).map((r: any) => r.id || r).join(',');
                            const oldScoresStr = (currentBuild?.scoredClusters || []).map((c: any) => `${c.title}:${c.score}`).join(',');
                            const prevSig = currentBuild ? `${currentBuild.id || myId}-${currentBuild.name}-${oldCoreIds}-${oldBuildOrderIds}-${oldRunesIds}-${oldScoresStr}` : '';

                            if (currentSig !== prevSig) {
                                setCurrentBuild(buildData);
                                localStorage.setItem('last_build_data:v1', JSON.stringify(buildData));
                                sessionStorage.setItem('hexdraft_active_build', JSON.stringify(buildData));
                            }
                        }

                        // 2. Cargar razones de recomendación
                        const pickedRec = picks.find(r => r.id === myId);
                        if (pickedRec && !selectedRecommendation) {
                            console.log("Razones capturadas con exito");
                            setSelectedRecommendation(pickedRec);
                            localStorage.setItem('last_pick_analysis:v1', JSON.stringify(pickedRec));
                        }

                        // 3. Cargar datos tácticos adicionales para el campeón activo
                        const champName = getNameFromId(myId);
                        if (champName && (!tacticalData || (tacticalData as any)?.champion !== champName.toLowerCase().replace(/[^a-z0-9]/g, ''))) {
                            fetch(`/api/tactical-data?champion=${champName}&role=${currentRole}`)
                                .then(res => res.ok ? res.json() : null)
                                .then(tData => {
                                    if (tData) setTacticalData(tData);
                                    console.log("Data tactica cargada:", tData);
                                })
                                .catch(err => console.error("Error tactico:", err));
                        }

                        // 4. Exportación automática al LCU de LoL al bloquear o cambiar de playstyle
                        if (buildData) {
                            const selectedCluster = buildData.scoredClusters?.[activePlaystyleIndex];
                            const activeBuild = selectedCluster ? selectedCluster.build : buildData.build;
                            const activeSwaps = selectedCluster ? selectedCluster.coreItemSwaps : buildData.coreItemSwaps;
                            const cleanClusterTitle = selectedCluster?.title
                                ? selectedCluster.title.replace(/[()]/g, '').trim().toLowerCase()
                                : '';
                            const activeName = cleanClusterTitle
                                ? `${buildData.name} ${cleanClusterTitle}`
                                : buildData.name;

                            const coreIds = (activeBuild.items.core || []).map((i: any) => i.id || i).join(',');
                            const buildOrderIds = (activeBuild.items.buildOrder || activeBuild.items.core || []).map((i: any) => i.id || i).join(',');
                            const runesIds = (activeBuild.runes.selections || []).map((r: any) => r.id || r).join(',');
                            const buildSig = `${myId}-${activeName}-${coreIds}-${buildOrderIds}-${runesIds}`;

                            let triggerImport = false;

                            if (buildSig !== lastImportedSignatureRef.current) {
                                lastImportedSignatureRef.current = buildSig;
                                triggerImport = true;
                            }

                            const everyonePicked = data.myTeam.every((p: any) => p.championId > 0) &&
                                (data.theirTeam.length === 0 || data.theirTeam.every((p: any) => p.championId > 0));

                            if (everyonePicked && !lastEveryonePickedRef.current) {
                                lastEveryonePickedRef.current = true;
                                triggerImport = true;
                                console.log(`[FINAL] Todos los jugadores han bloqueado sus campeones (Draft 100% completo). Ejecutando importacion definitiva.`);
                            }

                            if (triggerImport) {
                                console.log(`[AUTO] Exportando playstyle unificado al LCU para ${champName} (Firma: ${buildSig})`);
                                await importToClient({
                                    build: activeBuild,
                                    name: activeName,
                                    id: myId,
                                    coreItemSwaps: activeSwaps
                                });
                            }
                        }
                    } else {
                        const fingerprint = `${data.isBanPhase}-${cleanMyTeam.join(',')}-${myHoverIntent}`;
                        if (fingerprint !== lastFingerprintRef.current) {
                            lastFingerprintRef.current = fingerprint;

                            // Recomendaciones contextuales de bans en la UI pasando parámetros de draft completos
                            const bannedNames = bannedIds.map((id: number) => getNameFromId(id)).filter(Boolean) as string[];
                            const allyNames = data.myTeam.map((p: any) => getNameFromId(p.championId || p.championPickIntent || 0)).filter(Boolean) as string[];
                            const enemyNames = data.theirTeam.map((p: any) => getNameFromId(p.championId || p.championPickIntent || 0)).filter(Boolean) as string[];
                            const myHoverName = getNameFromId(myPlayer?.championPickIntent || 0) || null;
                            const bans = getProcessedBans(
                                picks,
                                myHoverName,
                                currentRole,
                                allyNames,
                                enemyNames,
                                bannedNames
                            ).filter(b => !lockedAndBannedIds.includes(b.id));

                            setRecommendations(picks.slice(0, 30));
                            setBanRecommendations(bans.slice(0, 20));
                            setView(data.isBanPhase ? 'bans' : 'picks');
                        }
                    }
                }
            }
            else if (phase === 'InProgress') {
                const isCurrentlyLoading = manualOverrideLoadingScreen !== null ? manualOverrideLoadingScreen : Boolean(statusData.isLoadingScreen);
                if (isCurrentlyLoading || !statusData.isGameReady) {
                    nextInterval = 1000; // Polling ultra-rápido (1s) durante la Pantalla de Carga
                } else {
                    nextInterval = 15000; // Polling relajado (15s) una vez iniciada la partida in-game
                }

                if (!notifiedStartRef.current) {
                    notifiedStartRef.current = true;

                    const storageKey = 'hexdraft_telegram_notified_start';
                    if (sessionStorage.getItem(storageKey) !== 'true') {
                        sessionStorage.setItem(storageKey, 'true');
                        notifyTelegram('La partida ha comenzado. ¡Buena suerte en la Grieta!');
                    }
                }

                if (!isRestoredRef.current) {
                    isRestoredRef.current = true;
                    console.log("[InProgress] Iniciando restauracion de estado de juego...");

                    // 1. Obtener campeón y jugadores reales en partida desde /api/live-game
                    let liveChampId = 0;
                    let liveMyTeamIds: number[] = [];
                    let liveTheirTeamIds: number[] = [];
                    try {
                        const liveRes = await fetch('/api/live-game');
                        if (liveRes.ok) {
                            const liveData = await liveRes.json();
                            const allPlayers = [...(liveData.blueTeam || []), ...(liveData.redTeam || [])];
                            const selfPlayer = allPlayers.find((p: any) => p.isSelf || p.isLocalPlayer || (p.summonerName && p.summonerName.toLowerCase().includes('frikz')));
                            if (selfPlayer && selfPlayer.championId > 0) {
                                liveChampId = selfPlayer.championId;
                            }
                            if (liveData.myTeam) {
                                liveMyTeamIds = liveData.myTeam.map((p: any) => p.championId).filter((id: number) => id > 0 && id !== liveChampId);
                            }
                            if (liveData.theirTeam) {
                                liveTheirTeamIds = liveData.theirTeam.map((p: any) => p.championId).filter((id: number) => id > 0);
                            }
                        }
                    } catch (error) {
                        console.warn('No se pudo restaurar el estado vivo del draft:', error);
                    }

                    // 2. Restaurar equipos y rol de localStorage si están vacíos
                    let restoredRole = myRole || 'top';
                    let restoredMyTeam = myTeam;
                    let restoredTheirTeam = theirTeam;
                    const teamsEmpty = myTeam.every(p => p.championId === 0 && p.championPickIntent === 0);
                    if (teamsEmpty) {
                        try {
                            const savedMyTeam = localStorage.getItem('last_my_team:v1');
                            const savedTheirTeam = localStorage.getItem('last_their_team:v1');
                            const savedRole = localStorage.getItem('last_my_role:v1');
                            if (savedMyTeam) {
                                restoredMyTeam = JSON.parse(savedMyTeam);
                                setMyTeam(restoredMyTeam);
                            }
                            if (savedTheirTeam) {
                                restoredTheirTeam = JSON.parse(savedTheirTeam);
                                setTheirTeam(restoredTheirTeam);
                            }
                            if (savedRole) {
                                restoredRole = savedRole;
                                setMyRole(savedRole);
                            }
                            console.log("Equipos restaurados desde localStorage");
                        } catch (e) {
                            console.error("Error restaurando equipos:", e);
                        }
                    }

                    // 3. Restaurar o calcular build completa y unificada
                    let activeBuild = currentBuild;
                    if (!activeBuild) {
                        try {
                            const savedBuild = sessionStorage.getItem('hexdraft_active_build') || localStorage.getItem('last_build_data:v1');
                            if (savedBuild) {
                                activeBuild = JSON.parse(savedBuild);
                            }
                        } catch (e) {
                            console.error("Error restaurando build:", e);
                        }
                    }

                    const liveChampName = liveChampId > 0 ? getNameFromId(liveChampId) : null;
                    const isSameChampion = activeBuild && (
                        activeBuild.id === liveChampId ||
                        (liveChampName && activeBuild.name?.toLowerCase() === liveChampName.toLowerCase()) ||
                        (!liveChampId && activeBuild.name)
                    );

                    if (isSameChampion && activeBuild) {
                        // Conservar build calculada con todos sus clusters intactos
                        setCurrentBuild(activeBuild);
                        console.log("Build previa conservada para InProgress:", activeBuild.name);
                    } else if (liveChampId > 0) {
                        // Campeón en vivo sin build previa o diferente: calcular con contexto completo
                        const cleanMyTeam = liveMyTeamIds.length > 0
                            ? liveMyTeamIds
                            : restoredMyTeam.map(p => p.championId).filter(id => id > 0 && id !== liveChampId);
                        const cleanTheirTeam = liveTheirTeamIds.length > 0
                            ? liveTheirTeamIds
                            : restoredTheirTeam.map(p => p.championId).filter(id => id > 0);

                        const newBuild = getSingleChampionBuild(liveChampId, cleanMyTeam, cleanTheirTeam, restoredRole, { allyRoles: rolesFromPlayers(restoredMyTeam), enemyRoles: rolesFromPlayers(restoredTheirTeam) });
                        if (newBuild) {
                            activeBuild = newBuild;
                            setCurrentBuild(newBuild);
                            localStorage.setItem('last_build_data:v1', JSON.stringify(newBuild));
                            sessionStorage.setItem('hexdraft_active_build', JSON.stringify(newBuild));
                            console.log("Nueva build generada para InProgress:", newBuild.name);
                        }
                    }

                    // 4. Cargar datos tácticos para el campeón activo
                    if (activeBuild && (!tacticalData || (tacticalData as any)?.champion !== activeBuild.name?.toLowerCase().replace(/[^a-z0-9]/g, ''))) {
                        fetch(`/api/tactical-data?champion=${activeBuild.name}&role=${restoredRole}`)
                            .then(res => res.ok ? res.json() : null)
                            .then(tData => {
                                if (tData) setTacticalData(tData);
                                console.log("Data tactica cargada durante InProgress para", activeBuild.name);
                            })
                            .catch(err => console.error("Error tactico InProgress:", err));
                    }

                    // 5. Restaurar recomendación seleccionada
                    let currentRec = selectedRecommendation;
                    if (!currentRec) {
                        const saved = localStorage.getItem('last_pick_analysis:v1');
                        if (saved) {
                            currentRec = JSON.parse(saved);
                            setSelectedRecommendation(currentRec);
                        }
                    }

                    // 6. Establecer vista correcta
                    if (activeBuild) {
                        if (view !== 'build' && view !== 'reasons') {
                            setView('build');
                        }
                    } else if (currentRec && view !== 'reasons') {
                        setView('reasons');
                    }
                }
            }
            else {
                if (inDraft || lastFingerprintRef.current !== "" || currentBuild) {
                    resetDraftState();
                    setSelectedRecommendation(null);
                    setCurrentBuild(null);
                    setTacticalData(null);
                    isRestoredRef.current = false;
                    localStorage.removeItem('last_build_data:v1');
                    localStorage.removeItem('last_my_team:v1');
                    localStorage.removeItem('last_their_team:v1');
                    localStorage.removeItem('last_my_role:v1');
                    localStorage.removeItem('last_pick_analysis:v1');
                    localStorage.removeItem('last_build_data');
                    localStorage.removeItem('last_my_team');
                    localStorage.removeItem('last_their_team');
                    localStorage.removeItem('last_my_role');
                    nextInterval = 10000;
                }
            }
        } catch (e) {
            console.error("Error en Nexo Loop:", e);
        } finally {
            isPollingRef.current = false;
            setTimeout(updateLoop, nextInterval);
        }
    };

    useEffect(() => {
        updateLoop();
    }, []);

    // Callbacks optimizados
    const handleReImport = useCallback((customBuild?: any) => {
        const data = customBuild || currentBuild;
        if (data) {
            importToClient(data);
        }
    }, [currentBuild]);

    const handleSelectChamp = useCallback((rec: any) => {
        setPreviewChamp(rec);
    }, []);

    const handleCloseModal = useCallback(() => {
        setPreviewChamp(null);
    }, []);

    const isBuildOrReasonsView = isPlaying || view === 'build' || view === 'reasons';

    const hasPicked = useMemo(() => {
        return inDraft && (view === 'build' || view === 'reasons') && currentBuild !== null;
    }, [inDraft, view, currentBuild]);

    return (
        <div className={`h-full w-full max-w-[1440px] mx-auto px-4 md:px-6 flex flex-col justify-center overflow-hidden relative min-h-0 ${isCompact ? 'py-1.5' : 'py-4'}`}>
            {/* TOAST DE CONEXIÓN */}
            {toast && (
                <div className={`fixed bottom-6 right-6 z-[9999] flex items-center gap-3 py-3 px-5 border rounded-xl shadow-lg animate-in slide-in-from-bottom-5 duration-250 select-none
                    ${toast.type === 'success'
                        ? 'bg-emerald-950/85 border-emerald-500/40 text-emerald-200 shadow-emerald-950/40'
                        : 'bg-red-950/85 border-red-500/40 text-red-200 shadow-red-950/40'
                    }`}
                >
                    <div className={`w-2 h-2 rounded-full ${toast.type === 'success' ? 'bg-emerald-400' : 'bg-red-500'}`} />
                    <span className="text-sm font-medium">{toast.message}</span>
                </div>
            )}

            <div className={`flex flex-row w-full items-center h-full min-h-0 relative z-10 px-2 md:px-4 transition-all duration-700 ${isPlaying ? 'gap-0 justify-center' : 'gap-4 md:gap-6 justify-between'
                }`}>
                {showLoadingScreenPanel ? (
                    <LiveGamePanel onCloseManual={() => setManualOverrideLoadingScreen(false)} />
                ) : (
                    <>
                        {/* LISTADO DE ALIADOS */}
                        <TeamSidebar
                            team={myTeam}
                            isPlaying={isPlaying}
                            isCompact={isCompact || hasPicked}
                            isEnemy={false}
                        />

                {/* AREA CENTRAL */}
                <div className={`transition-all duration-700 ease-in-out h-full ${(hasPicked || isPlaying)
                    ? (isCompact ? 'max-h-[580px] min-h-[450px]' : 'max-h-[780px] min-h-[600px]')
                    : (isCompact ? 'max-h-[500px] min-h-[350px]' : 'max-h-[650px] min-h-[400px]')
                    } ${isPlaying
                        ? 'flex-[10] w-full max-w-[1400px] mx-auto'
                        : 'flex-1 min-w-0 mx-2 md:mx-4'
                    }`}>
                    <div className={`bg-panel-warm border border-border-warm rounded-xl h-full min-h-0 relative overflow-hidden flex flex-col ${isCompact ? 'p-4 md:p-5' : 'p-6 md:p-8'
                        }`}>

                        {/* ALERTA DE AUTO-PICK SI HUBO ERROR O NO SE DETECTÓ EL ROL */}
                        {autoPickAlert.active && (
                            <div className="w-full bg-red-950/30 border border-red-500/50 text-red-100 p-3.5 rounded-lg flex items-center justify-between gap-4 mb-3 shrink-0">
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-semibold text-red-300">Atención</span>
                                    <div>
                                        <h4 className="text-sm font-semibold text-red-300">
                                            {autoPickAlert.message}
                                        </h4>
                                        <p className="text-sm text-red-100 leading-tight">
                                            {autoPickAlert.submessage}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setAutoPickAlert({ active: false, message: '' })}
                                    className="min-h-11 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-400/60 text-red-100 text-sm font-medium rounded-lg cursor-pointer"
                                >
                                    Entendido
                                </button>
                            </div>
                        )}

                        {/* CABECERA DINÁMICA */}
                        <header className="mb-3 flex justify-between items-center border-b border-border-warm pb-3 shrink-0">
                            <div className="flex items-center gap-3">
                                <div>
                                    <h2 className="text-xl md:text-2xl font-semibold text-white leading-tight">
                                        {isBuildOrReasonsView && currentBuild ? (
                                            <>Análisis <span className="text-purple-accent">de build</span></>
                                        ) : (
                                            view === 'bans' ? (
                                                <>Bans <span className="text-purple-accent">recomendados</span></>
                                            ) : (
                                                <>Hex<span className="text-purple-accent">Draft</span></>
                                            )
                                        )}
                                    </h2>
                                    <p className="text-sm text-slate-400 mt-1 flex items-center gap-2">
                                        {isPlaying ? 'Monitor de partida activo' : 'Motor de recomendación en línea'}
                                        {gamePhase !== 'Offline' && (
                                            <>
                                                <span className="text-slate-600" aria-hidden="true">·</span>
                                                <span className="text-slate-300">{PHASE_TRANSLATIONS[gamePhase] || gamePhase}</span>
                                            </>
                                        )}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setManualOverrideLoadingScreen(!showLoadingScreenPanel)}
                                    aria-label={showLoadingScreenPanel ? 'Ver análisis del draft' : 'Ver pantalla de carga'}
                                    title={showLoadingScreenPanel ? 'Ver análisis del draft' : 'Ver pantalla de carga'}
                                    className="btn-quiet min-h-11 min-w-11 px-3 py-2 select-none text-slate-300 hover:text-white transition-colors"
                                >
                                    <svg className="w-4 h-4 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                                        <rect x="3" y="4" width="18" height="13" rx="2" />
                                        <path strokeLinecap="round" d="M8 21h8M12 17v4" />
                                    </svg>
                                    <span className="sr-only">{showLoadingScreenPanel ? 'Ver análisis del draft' : 'Ver pantalla de carga'}</span>
                                </button>
                            </div>
                        </header>
                        <div className={`relative flex-1 min-h-0 ${isBuildOrReasonsView && (currentBuild || myId > 0) ? 'overflow-hidden pr-1' : 'overflow-y-auto scrollbar-thin pr-1'}`}>
                            {/* 1. ESPERA / LOBBY */}
                            {!inDraft && !isPlaying && (
                                <DraftLobby />
                            )}

                            {/* 2. VISTA DE PARTIDA / BUILD */}
                            {isBuildOrReasonsView && (currentBuild || myId > 0) && tacticalDirectives ? (
                                <div className="flex flex-col gap-6 h-full min-h-0 pt-4">

                                    {/* Módulos de Análisis — 3 columnas */}
                                    <div className="flex flex-col md:flex-row gap-4 md:gap-6 flex-1 min-h-0 ">
                                        {/* Columna 1: Tarjeta de Campeón (Izquierda) */}
                                        {currentBuild && !isCompact && (
                                            <div className="w-[250px] shrink-0 flex flex-col min-h-0 select-none text-left">
                                                {/* La identidad del campeón comparte el mismo lenguaje de pestañas que el resto del análisis. */}
                                                <div className="flex items-end h-[52px] shrink-0 -mb-px">
                                                    <div className="h-[52px] w-full min-w-0 bg-panel-warm border border-border-warm border-b-transparent rounded-t-lg z-20 flex items-center justify-between gap-3 px-4">
                                                        <h2 className="min-w-0 text-[17px] font-black text-white uppercase tracking-[0.14em] leading-none truncate select-all">
                                                            {champData?.name || currentBuild.name}
                                                        </h2>
                                                        <div className="shrink-0 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.12em] leading-none">
                                                            <span className="text-slate-500">
                                                                {getFriendlyRoleName(champData?.class || "CAMPEÓN").toUpperCase()}
                                                            </span>
                                                            <span className="text-slate-700" aria-hidden="true">/</span>
                                                            <span className="text-purple-accent">{champData?.damageType || "Adaptive"}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* La ilustración ocupa toda la card para que el campeón sea el elemento protagonista. */}
                                                <div className="flex-1 min-h-0 w-full overflow-hidden bg-bg-warm/30 shrink-0 relative border border-border-warm/60 rounded-sm rounded-tl-none">
                                                    <img
                                                        src={`https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${getChampionCdnName(currentBuild.name)}_0.jpg`}
                                                        alt={currentBuild.name}
                                                        className="w-full h-full object-cover scale-[1.07] object-[center_18%]"
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).src = "/favicon.svg";
                                                        }}
                                                    />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-[#07080c]/95 via-[#07080c]/15 to-transparent pointer-events-none" />

                                                    {/* Rol y score integrados en la card, sin añadir una segunda cabecera flotante. */}
                                                    <div className="absolute inset-x-0 bottom-0 pt-12 pb-3 px-3 flex items-center justify-center gap-3 z-10 select-none">
                                                        <div className="flex items-center gap-1.5">
                                                            <img
                                                                src={`${POS_BASE}${posMapping[myRole.toUpperCase()]}`}
                                                                className="w-5 h-5"
                                                                style={{ filter: 'hue-rotate(200deg) saturate(180%) brightness(1.4)' }}
                                                                alt="lane"
                                                            />
                                                            <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                                                                {myRole.toLocaleUpperCase()}
                                                            </span>
                                                        </div>

                                                        <span className="text-slate-500 font-bold">|</span>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="px-1.5 py-0.5 border border-purple-accent/40 bg-black/60 text-xs font-mono font-black text-purple-accent rounded-sm">
                                                                {championScore !== undefined ? championScore.toFixed(1) : '9.5'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Columna 2: Build de Ítems (Centro) */}
                                        <div className="flex-1 flex flex-col gap-3 min-h-0 overflow-hidden">
                                            {currentBuild && isCompact && (
                                                <div className="flex h-24 shrink-0 rounded-sm overflow-hidden bg-[#070709] border border-border-warm relative select-none">
                                                    {/* Imagen de Splash horizontal de fondo */}
                                                    <div className="absolute inset-0 z-0">
                                                        <img
                                                            src={`https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${getChampionCdnName(currentBuild.name)}_0.jpg`}
                                                            alt={currentBuild.name}
                                                            className="w-full h-full object-cover object-[right_25%] opacity-[0.2]"
                                                            onError={(e) => {
                                                                (e.target as HTMLImageElement).src = "/favicon.svg";
                                                            }}
                                                        />
                                                        <div className="absolute inset-0 bg-gradient-to-r from-[#070709] via-[#070709]/95 to-transparent" />
                                                    </div>

                                                    {/* Contenido del banner */}
                                                    <div className="relative z-10 flex w-full items-center justify-between px-6 py-2">
                                                        <div className="flex items-center gap-4">
                                                            {/* Retrato circular del campeón */}
                                                            <div className="w-14 h-14 rounded-full overflow-hidden border border-purple-accent/30 bg-slate-950 shrink-0">
                                                                <img
                                                                    src={`https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${myId}.png`}
                                                                    alt={currentBuild.name}
                                                                    className="w-full h-full object-cover scale-[1.15]"
                                                                    onError={(e) => {
                                                                        (e.target as HTMLImageElement).src = "/favicon.svg";
                                                                    }}
                                                                />
                                                            </div>
                                                            <div className="text-left">
                                                                <h2 className="text-base md:text-xl lg:text-xl font-black text-white uppercase tracking-wider leading-none mb-1.5 truncate max-w-[140px] md:max-w-[240px] lg:max-w-none">
                                                                    {currentBuild.name}
                                                                </h2>
                                                                <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.12em] leading-none">
                                                                    <span className="text-slate-500">
                                                                        {getFriendlyRoleName(champData?.class || "CAMPEÓN").toUpperCase()}
                                                                    </span>
                                                                    <span className="text-slate-700" aria-hidden="true">/</span>
                                                                    <span className="text-purple-accent">{champData?.damageType || "Adaptive"}</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-3">
                                                            <div className="flex items-center gap-1.5 bg-[#0f0f13]/60 border border-border-warm px-2.5 py-1 rounded-sm">
                                                                <img
                                                                    src={`${POS_BASE}${posMapping[myRole.toUpperCase()]}`}
                                                                    className="w-4.5 h-4.5"
                                                                    style={{ filter: 'hue-rotate(200deg) saturate(180%) brightness(1.4)' }}
                                                                    alt="lane"
                                                                />
                                                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                                                                    {myRole.toUpperCase()}
                                                                </span>
                                                            </div>

                                                            <span className="text-slate-700 font-bold">|</span>

                                                            <div className="flex items-center gap-1.5 bg-[#0f0f13]/60 border border-border-warm px-2.5 py-1 rounded-sm">
                                                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">SCORE:</span>
                                                                <span className="text-xs font-mono font-semibold text-purple-accent-hover">
                                                                    {championScore !== undefined ? championScore.toFixed(1) : '9.5'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            <ItemBuild
                                                currentBuild={currentBuild}
                                                onReImport={handleReImport}
                                                inDraft={inDraft}
                                                everyonePicked={everyonePicked}
                                                activePlaystyleIndex={activePlaystyleIndex}
                                                setActivePlaystyleIndex={setActivePlaystyleIndex}
                                                isCompact={isCompact}
                                            />
                                        </div>

                                        {/* Columna 3: Directivas Tácticas (Derecha) */}
                                        <div className="flex-1 min-h-0 flex flex-col gap-0 overflow-hidden">
                                            {/* Cabecera / Pestaña Simulada para Alineación Estética */}
                                            <div className="flex justify-between items-end gap-3 shrink-0 h-[52px] -mb-px">
                                                <div className="flex gap-1 items-end flex-1 min-w-0 -mb-px z-10">
                                                    <span className={`bg-panel-warm border border-border-warm border-b-transparent rounded-t-lg z-20 font-semibold text-purple-accent select-none h-[52px] flex items-center justify-center
                                                        ${isCompact
                                                            ? 'px-3 tracking-[0.1em] text-[9.5px]'
                                                            : 'px-5 tracking-[0.25em] text-[10px] md:text-[11px]'
                                                        }`}>
                                                        {isCompact ? 'Lectura' : 'Lectura de la partida'}
                                                    </span>
                                                </div>
                                                {/* Badge de Escalado Táctico alineado en la fila superior */}
                                                <div className={`border border-border-warm/50 border-b-transparent rounded-t-sm select-none z-20 flex items-center justify-center
                                                    ${isCompact
                                                        ? 'px-2 py-1.5 text-[12px] tracking-[0.1em] font-bold h-[30px] uppercase '
                                                        : 'px-3 py-1.5 text-[8px] md:text-[9px] font-black uppercase tracking-widest h-[32px]'
                                                    }
                                                    ${tacticalDirectives.scalingType === 'Early' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                                                        tacticalDirectives.scalingType === 'Late' ? 'bg-purple-accent/10 border-purple-accent/20 text-purple-accent' :
                                                            'bg-slate-400/10 border-slate-400/20 text-slate-300'
                                                    }`}>
                                                    {tacticalDirectives.scalingType === 'Early' ? 'Early Game Bully' :
                                                        tacticalDirectives.scalingType === 'Late' ? 'Late Game Wincon' :
                                                            'Mid Game Spike'}
                                                </div>
                                            </div>

                                            <div className="flex-grow min-h-0 overflow-hidden">
                                                <CombatDirectivesPanel
                                                    scalingType={tacticalDirectives.scalingType}
                                                    combatStyle={tacticalDirectives.combatStyle}
                                                    winrateCurveAnalysis={tacticalDirectives.winrateCurveAnalysis}
                                                    generalDirectives={tacticalDirectives.generalDirectives}
                                                    enemyNames={enemyNames}
                                                    myTeamAnalysis={myTeamAnalysis}
                                                    hideTitle={true}
                                                    threats={tacticalDirectives.matchups.threats}
                                                    synergies={tacticalDirectives.synergies}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    {/* Evolución de Habilidades */}

                                    <div className="shrink-0">
                                        <SkillTimeline
                                            skillOrder={currentBuild?.build?.skillOrder}
                                            tacticalData={tacticalData}
                                        />
                                    </div>
                                </div>
                            ) : (
                                /* 3. DRAFT GRID (SELECCIÓN / BANEOS) */
                                inDraft && (
                                    <div className="space-y-6">
                                        <DraftDamageBalance allyNames={allyNames} myTeamAnalysis={myTeamAnalysis} />

                                        <DraftGrid
                                            recommendations={view === 'bans' ? banRecommendations : recommendations}
                                            onSelectChampion={handleSelectChamp}
                                            isBan={view === 'bans'}
                                        />
                                    </div>
                                )
                            )}
                        </div>

                        {/* CONFIGURACIÓN Y SWITCHES */}
                        {!isPlaying && !hasPicked && (
                            <DraftSettings
                                autoPick={autoPick}
                                setAutoPick={handleToggleAutoPick}
                                autoBan={autoBan}
                                setAutoBan={handleToggleAutoBan}
                            />
                        )}

                        {/* MODAL DE SELECCIÓN MANUAL DE ROL */}
                        {showRoleModal && inDraft && (
                            <div className="fixed inset-0 z-[9999] bg-black/85 flex items-center justify-center p-4 backdrop-blur-none animate-in fade-in duration-200">
                                <div className="bg-panel-warm border border-border-warm rounded-xl p-6 max-w-sm w-full text-slate-200 shadow-lg relative overflow-hidden flex flex-col gap-5">
                                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-purple-accent" />

                                    <div>
                                        <h3 className="text-base font-black text-white uppercase tracking-tight flex items-center gap-2">
                                            <span className="text-purple-accent font-mono">Selección manual</span>
                                        </h3>
                                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider leading-relaxed mt-2">
                                            Por favor selecciona tu carril:
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-1 gap-2">
                                        {['top', 'jungle', 'mid', 'adc', 'supp'].map((roleKey) => {
                                            const isSelected = selectedRoleKey === roleKey;
                                            return (
                                                <button
                                                    key={roleKey}
                                                    type="button"
                                                    onClick={() => setSelectedRoleKey(roleKey)}
                                                    className={`w-full py-2.5 px-4 text-xs font-mono font-black uppercase tracking-widest rounded-sm border transition-all duration-200 flex items-center justify-between cursor-pointer select-none ${isSelected
                                                            ? 'bg-purple-accent/20 border-purple-accent text-white shadow-sm'
                                                            : 'bg-[#111116] border-border-warm text-slate-400 hover:text-white hover:border-slate-700'
                                                        }`}
                                                >
                                                    <span>{roleKey}</span>
                                                    {isSelected && <span className="text-purple-accent font-bold">✓</span>}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            const apiRole = ROLE_MAP_TO_API[selectedRoleKey] || 'jungle';
                                            manualRoleSelectedRef.current = true;
                                            setMyRole(apiRole);
                                            setShowRoleModal(false);
                                            setAutoPickAlert({ active: false, message: '' });
                                            console.log(`Rol fijado manualmente: ${selectedRoleKey} -> API: ${apiRole}`);
                                        }}
                                        className="w-full py-2.5 bg-purple-accent hover:bg-purple-accent/90 text-white text-xs font-black uppercase tracking-widest rounded-sm transition-all duration-200 cursor-pointer shadow-lg active:scale-95 mt-1"
                                    >
                                        Enviar
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* MODAL DE PREVISUALIZACIÓN */}
                        <ChampionPreviewModal
                            previewChamp={previewChamp}
                            onClose={handleCloseModal}
                        />
                    </div>
                </div>

                {/* LISTADO DE ENEMIGOS */}
                <TeamSidebar
                    team={theirTeam}
                    isPlaying={isPlaying}
                    isCompact={isCompact || hasPicked}
                    isEnemy={true}
                />
                    </>
                )}
            </div>
        </div>
    );
};
