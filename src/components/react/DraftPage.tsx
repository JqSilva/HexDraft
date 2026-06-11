import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { LcuPlayer } from './PlayerSlot';
import type { Recommendation, BansRecommendation } from '../../lib/engine/engine';
import { getProcessedRecommendations, getProcessedBans, getSingleChampionBuild, getNameFromId } from '../../lib/engine/engine';
import { initializeEngineData } from '../../lib/engine/dataProvider';
import { CombatDirectivesPanel, MatchupAnalysisPanel } from './TacticalDirectives';
import { getTacticalDirectives } from '../../lib/engine/tacticalEngine';

// Importación de subcomponentes modulares
import { ConnectionStatus } from './ConnectionStatus';
import { TeamSidebar } from './TeamSidebar';
import { DraftLobby } from './DraftLobby';
import { DraftGrid } from './DraftGrid';
import { DraftSettings } from './DraftSettings';
import { ChampionPreviewModal } from './ChampionPreviewModal';
import { SkillTimeline } from './SkillTimeline';
import { ItemBuild } from './ItemBuild';

// =========================================================
// HELPERS
// =========================================================
const executeLcuAction = async (actionId: number, championId: number) => {
    try {
        await fetch('/api/execute-action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ actionId, championId, completed: true })
        });
        console.log(`✅ Acción ejecutada: ${championId}`);
    } catch (e) {
        console.error("❌ Error en acción LCU:", e);
    }
};

const importToClient = async (buildData: any) => {
    if (!buildData) return;
    try {
        const { build, name, id } = buildData;
        const runePayload = {
            name: `HexDraft: ${name}`,
            primaryStyleId: build.runes.primaryStyle,
            subStyleId: build.runes.secondaryStyle,
            selectedPerkIds: [
                ...build.runes.selections.map((r: any) => r.id || r),
                ...build.runes.shards.map((s: any) => s.id || s)
            ]
        };
        await Promise.all([
            fetch('/api/set-runes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(runePayload) }),
            fetch('/api/set-items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ championId: id, championName: name, items: build.items, skillOrder: build.skillOrder }) }),
            fetch('/api/set-spells', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ spell1Id: build.summoners[0].id, spell2Id: build.summoners[1].id }) })
        ]);
        console.log("✅ Configuración enviada al LCU");
    } catch (e) {
        console.error("❌ Error importando:", e);
    }
};

const PHASE_TRANSLATIONS: Record<string, string> = {
    'Offline': 'Desconectado',
    'None': 'Fuera de Partida',
    'Lobby': 'Lobby de Espera',
    'Matchmaking': 'Buscando Partida',
    'ReadyCheck': 'Aceptar Partida',
    'ChampSelect': 'Selección de Campeón',
    'InProgress': 'En Partida',
    'Reconnect': 'Reconectando',
    'WaitingForStats': 'Esperando Estadísticas',
    'PreEndOfGame': 'Fin de Partida',
    'EndOfGame': 'Partida Finalizada'
};

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

    // --- CONFIGURACIÓN ---
    const [autoPick, setAutoPick] = useState<boolean>(() => (typeof window !== 'undefined' ? localStorage.getItem('autoPick') === 'true' : false));
    const [autoBan, setAutoBan] = useState<boolean>(() => (typeof window !== 'undefined' ? localStorage.getItem('autoBan') === 'true' : false));

    // --- REFERENCIAS ---
    const activeActionRef = useRef<any>(null);
    const lastActionKeyRef = useRef<string>("none");
    const lastFingerprintRef = useRef<string>("");
    const lastImportedIdRef = useRef<number>(0);
    const lastImportedSignatureRef = useRef<string>("");
    const currentDataRef = useRef<any>(null);
    const isPollingRef = useRef<boolean>(false);
    const apiTimeAtSyncRef = useRef<number>(0);
    const timestampAtSyncRef = useRef<number>(0);

    const isPlaying = gamePhase === 'InProgress';

    // Nombres de campeones aliados y enemigos para el motor táctico
    const allyNames = useMemo(() => {
        return myTeam.map(p => getNameFromId(p.championId || p.championPickIntent)).filter(Boolean) as string[];
    }, [myTeam]);

    const enemyNames = useMemo(() => {
        return theirTeam.map(p => getNameFromId(p.championId || p.championPickIntent)).filter(Boolean) as string[];
    }, [theirTeam]);

    const tacticalDirectives = useMemo(() => {
        if (!currentBuild) return null;
        return getTacticalDirectives(currentBuild.name, myRole, allyNames, enemyNames);
    }, [currentBuild, myRole, allyNames, enemyNames]);

    // Cargar datos de la base de datos SQLite local al montar
    useEffect(() => {
        const loadDb = async () => {
            try {
                console.log("🔌 Cargando campeones desde SQLite a través del endpoint...");
                const res = await fetch('/api/champions');
                if (res.ok) {
                    const data = await res.json();
                    initializeEngineData(data);
                    console.log("Base de datos SQLite sincronizada con el motor cliente.");
                } else {
                    console.warn("No se pudo obtener datos de SQLite, usando fallback estático.");
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
        const media = window.matchMedia("(max-width: 1200px)");
        const listener = (e: MediaQueryListEvent) => setIsCompact(e.matches);
        setIsCompact(media.matches);
        media.addEventListener("change", listener);
        return () => media.removeEventListener("change", listener);
    }, []);

    // Toast de conexión al cliente
    useEffect(() => {
        if (prevConnected !== null && prevConnected !== isConnected) {
            setToast({
                message: isConnected ? "Conectado a LCU" : "Desconectado de LCU",
                type: isConnected ? 'success' : 'error'
            });
            const timer = setTimeout(() => setToast(null), 4000);
            return () => clearTimeout(timer);
        }
        setPrevConnected(isConnected);
    }, [isConnected, prevConnected]);

    // Guardar configuraciones en localStorage
    useEffect(() => {
        localStorage.setItem('autoPick', String(autoPick));
    }, [autoPick]);

    useEffect(() => {
        localStorage.setItem('autoBan', String(autoBan));
    }, [autoBan]);

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

                // Lógica de ejecución automática (3.5s)
                if (remaining <= 3500 && remaining > 500 && !activeActionRef.current.completed) {
                    if ((activeActionRef.current.type === 'pick' && autoPick) || 
                        (activeActionRef.current.type === 'ban' && autoBan)) {
                        handleAutoExecution();
                    }
                }
            }
        }, 100);
        return () => clearInterval(interval);
    }, [autoPick, autoBan]);

    const handleAutoExecution = async () => {
        const data = currentDataRef.current;
        const currentAction = activeActionRef.current;
        if (!data || !currentAction || currentAction.completed) return;

        currentAction.completed = true; // Bloqueo inmediato
        console.log(`🚀 [AUTO] Ejecutando ${currentAction.type}...`);

        try {
            const cleanMyTeam = data.myTeam.map((p: any) => p.championId).filter((id: number) => id !== 0);
            const cleanTheirTeam = data.theirTeam.map((p: any) => p.championId).filter((id: number) => id !== 0);
            const bannedIds = data.actions?.flat().filter((a: any) => a.type === 'ban' && a.completed).map((a: any) => a.championId) || [];
            const unavailableIds = [...new Set([...bannedIds, ...cleanMyTeam, ...cleanTheirTeam])];
            
            const myPlayer = data.myTeam.find((p: any) => p.cellId === data.localPlayerCellId);
            const currentRole = myPlayer?.assignedPosition?.toLowerCase() || "jungle";

            // Obtener campeones preseleccionados por compañeros de equipo (excluyéndome a mí)
            const allyHovered = data.myTeam
                .filter((p: any) => p.cellId !== data.localPlayerCellId)
                .map((p: any) => p.championPickIntent || 0)
                .filter((id: number) => id !== 0);

            let targetId = 0;
            if (currentAction.type === 'pick') {
                const picks = getProcessedRecommendations(cleanMyTeam, cleanTheirTeam, unavailableIds, currentRole);
                const availablePicks = picks.filter(p => !allyHovered.includes(p.id));
                if (availablePicks.length > 0) targetId = availablePicks[0].id;
            } else if (currentAction.type === 'ban'){
                const picks = getProcessedRecommendations(cleanMyTeam, cleanTheirTeam, unavailableIds, currentRole);
                const allyHoveredOrSelected = data.myTeam.map((p: any) => p.championId || p.championPickIntent || 0).filter((id: number) => id !== 0);
                const bans = getProcessedBans(picks).filter(b => !unavailableIds.includes(b.id) && !allyHoveredOrSelected.includes(b.id));
                if (bans.length > 0) targetId = bans[0].id;
            }

            if (targetId > 0) {
                await executeLcuAction(currentAction.id, targetId);
            } else {
                currentAction.completed = false;
            }
        } catch (e) {
            currentAction.completed = false;
        }
    };

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

                let apiTime = data.timer?.adjustedTimeLeftInPhase || 30000;
                let adjusted = apiTime > 30000 ? apiTime - 5000 : apiTime;

                timestampAtSyncRef.current = Date.now();
                apiTimeAtSyncRef.current = adjusted;
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
        lastActionKeyRef.current = "none";
        timestampAtSyncRef.current = 0;
        activeActionRef.current = null;

        setInDraft(false);
        setRecommendations([]);
        setBanRecommendations([]);
        setMyTeam(Array(5).fill({ championId: 0, championPickIntent: 0, assignedPosition: '', cellId: 0 }));
        setTheirTeam(Array(5).fill({ championId: 0, championPickIntent: 0, assignedPosition: '', cellId: 0 }));
        setView('lobby');
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
            const { phase } = await statusRes.json();

            setGamePhase(phase);
            setIsConnected(phase !== 'Offline');

            if (phase === 'ChampSelect' || phase === 'ReadyCheck') {
                nextInterval = 1500;
                const draftRes = await fetch('/api/champ-select');
                const data = await draftRes.json();

                if (data.inDraft) {
                    setInDraft(true);
                    currentDataRef.current = data;
                    setMyTeam(data.myTeam);
                    setTheirTeam(data.theirTeam);
                    handleTimerSync(data); 

                    const myPlayer = data.myTeam.find((p: any) => p.cellId === data.localPlayerCellId);
                    const myId = myPlayer?.championId || 0;
                    const currentRole = myPlayer?.assignedPosition?.toLowerCase() || "jungle";
                    setMyRole(currentRole);
                    localStorage.setItem('last_my_team', JSON.stringify(data.myTeam));
                    localStorage.setItem('last_their_team', JSON.stringify(data.theirTeam));
                    localStorage.setItem('last_my_role', currentRole);
                    
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

                    const picks = getProcessedRecommendations(cleanMyTeam, cleanTheirTeam, unavailableIds, currentRole, activeIdForEngine);

                    if (myId > 0) {
                        // 1. Calcular y actualizar la build en la interfaz (React state)
                        const buildData = getSingleChampionBuild(myId, cleanMyTeam, cleanTheirTeam, currentRole);
                        if (buildData && (!currentBuild || currentBuild.name !== buildData.name || JSON.stringify(currentBuild.build.items.core) !== JSON.stringify(buildData.build.items.core))) {
                            setCurrentBuild(buildData);
                            localStorage.setItem('last_build_data', JSON.stringify(buildData));
                            if (view !== 'reasons' && view !== 'build') {
                                setView('build');
                            }
                        }

                        // 2. Cargar razones de recomendación (una sola vez)
                        const pickedRec = picks.find(r => r.id === myId);
                        if (pickedRec && !selectedRecommendation) {
                            console.log("✅ Razones capturadas con éxito");
                            setSelectedRecommendation(pickedRec);
                            localStorage.setItem('last_pick_analysis', JSON.stringify(pickedRec));
                        }

                        // 3. Cargar datos tácticos adicionales (una sola vez)
                        const champName = getNameFromId(myId);
                        if (champName && !tacticalData) {
                            fetch(`/api/tactical-data?champion=${champName}&role=${currentRole}`)
                                .then(res => res.json())
                                .then(tData => {
                                    setTacticalData(tData);
                                    console.log("🔥 Data táctica cargada:", tData);
                                })
                                .catch(err => console.error("Error táctico:", err));
                        }

                        // 4. Exportación automática al LCU de LoL al bloquear o cambiar de playstyle
                        if (buildData) {
                            const coreIds = (buildData.build.items.core || []).map((i: any) => i.id || i).join(',');
                            const runesIds = (buildData.build.runes.selections || []).map((r: any) => r.id || r).join(',');
                            const buildSig = `${myId}-${buildData.name}-${coreIds}-${runesIds}`;

                            if (buildSig !== lastImportedSignatureRef.current) {
                                lastImportedSignatureRef.current = buildSig;
                                console.log(`🎯 [AUTO] Exportando playstyle unificado al LCU para ${champName} (Firma: ${buildSig})`);
                                await importToClient({ ...buildData, id: myId });
                            }
                        }
                    } else {
                        const fingerprint = `${data.isBanPhase}-${cleanMyTeam.join(',')}-${myHoverIntent}`;
                        if (fingerprint !== lastFingerprintRef.current) {
                            lastFingerprintRef.current = fingerprint;
                    
                            // Permitimos recomendar baneo de preselecciones en la UI
                            const bans = getProcessedBans(picks).filter(b => !lockedAndBannedIds.includes(b.id));

                            setRecommendations(picks.slice(0, 20));
                            setBanRecommendations(bans.slice(0, 20));
                            setView(data.isBanPhase ? 'bans' : 'picks');
                        }
                    }
                }
            } 
            else if (phase === 'InProgress') {
                nextInterval = 30000;

                // 1. Restaurar build desde localStorage si no está en memoria
                let activeBuild = currentBuild;
                if (!activeBuild) {
                    try {
                        const savedBuild = localStorage.getItem('last_build_data');
                        if (savedBuild) {
                            activeBuild = JSON.parse(savedBuild);
                            setCurrentBuild(activeBuild);
                            console.log("🔄 Build restaurada desde localStorage para InProgress");
                        }
                    } catch (e) {
                        console.error("Error restaurando build:", e);
                    }
                }

                // 2. Restaurar equipos si están vacíos
                const teamsEmpty = myTeam.every(p => p.championId === 0 && p.championPickIntent === 0);
                if (teamsEmpty) {
                    try {
                        const savedMyTeam = localStorage.getItem('last_my_team');
                        const savedTheirTeam = localStorage.getItem('last_their_team');
                        const savedRole = localStorage.getItem('last_my_role');
                        if (savedMyTeam) setMyTeam(JSON.parse(savedMyTeam));
                        if (savedTheirTeam) setTheirTeam(JSON.parse(savedTheirTeam));
                        if (savedRole) setMyRole(savedRole);
                        console.log("🔄 Equipos restaurados desde localStorage");
                    } catch (e) {
                        console.error("Error restaurando equipos:", e);
                    }
                }

                // 3. Cargar datos tácticos si no están en memoria
                if (!tacticalData && activeBuild) {
                    fetch(`/api/tactical-data?champion=${activeBuild.name}&role=${myRole}`)
                        .then(res => res.json())
                        .then(tData => {
                            setTacticalData(tData);
                            console.log("🔥 Data táctica cargada durante InProgress");
                        })
                        .catch(err => console.error("Error táctico InProgress:", err));
                }

                // 4. Restaurar recomendación seleccionada
                let currentRec = selectedRecommendation;
                if (!currentRec) {
                    const saved = localStorage.getItem('last_pick_analysis');
                    if (saved) {
                        currentRec = JSON.parse(saved);
                        setSelectedRecommendation(currentRec);
                    }
                }

                // 5. Establecer vista correcta
                if (activeBuild) {
                    if (view !== 'build' && view !== 'reasons') {
                        setView('build');
                    }
                } else if (currentRec && view !== 'reasons') {
                    setView('reasons');
                }
            }
            else {
                if (phase === 'None' || phase === 'Lobby') {
                    if (inDraft || lastFingerprintRef.current !== "" || currentBuild) {
                        resetDraftState();
                        setSelectedRecommendation(null);
                        setCurrentBuild(null);
                        setTacticalData(null);
                        localStorage.removeItem('last_build_data');
                        localStorage.removeItem('last_my_team');
                        localStorage.removeItem('last_their_team');
                        localStorage.removeItem('last_my_role');
                        nextInterval = 10000;
                    }
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
    const handleReImport = useCallback(() => {
        if (currentBuild) {
            importToClient(currentBuild);
        }
    }, [currentBuild]);

    const handleSelectChamp = useCallback((rec: Recommendation) => {
        if (view !== 'bans') {
            setPreviewChamp(rec);
        }
    }, [view]);

    const handleCloseModal = useCallback(() => {
        setPreviewChamp(null);
    }, []);

    const isBuildOrReasonsView = isPlaying || view === 'build' || view === 'reasons';

    const hasPicked = useMemo(() => {
        return inDraft && (view === 'build' || view === 'reasons') && currentBuild !== null;
    }, [inDraft, view, currentBuild]);

    return (
        <div className="flex-1 flex flex-col w-full max-w-[1550px] mx-auto px-4 py-8 overflow-x-hidden relative">
            {/* TOAST DE CONEXIÓN */}
            {toast && (
                <div className={`fixed bottom-6 right-6 z-[9999] flex items-center gap-3 py-3 px-5 border rounded-sm shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-5 duration-350 select-none
                    ${toast.type === 'success' 
                        ? 'bg-emerald-950/85 border-emerald-500/40 text-emerald-200 shadow-emerald-950/40' 
                        : 'bg-red-950/85 border-red-500/40 text-red-200 shadow-red-950/40'
                    }`}
                >
                    <div className={`w-2 h-2 rounded-full ${toast.type === 'success' ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px_#10b981]' : 'bg-red-500 shadow-[0_0_8px_#ef4444]'}`} />
                    <span className="text-[10px] font-black uppercase tracking-widest">{toast.message}</span>
                </div>
            )}

            <div className={`flex flex-row w-full items-start relative z-10 px-2 md:px-4 transition-all duration-700 ${
                isPlaying ? 'gap-0 justify-center' : 'gap-4 md:gap-6 justify-between'
            }`}>
                {/* LISTADO DE ALIADOS */}
                <TeamSidebar
                    team={myTeam}
                    isPlaying={isPlaying}
                    isCompact={isCompact || hasPicked}
                    isEnemy={false}
                />

                {/* AREA CENTRAL */}
                <div className={`transition-all duration-700 ease-in-out ${
                    isPlaying 
                        ? 'flex-[10] w-full max-w-[1400px] mx-auto' 
                        : 'flex-1 min-w-0 mx-2 md:mx-4'
                }`}>
                    <div className="bg-panel-warm border border-border-warm p-6 md:p-8 rounded-sm backdrop-blur-md min-h-[600px] relative overflow-hidden flex flex-col tech-corners">
                        
                        {/* CABECERA DINÁMICA */}
                        <header className="mb-6 flex justify-between items-center border-b border-border-warm pb-5">
                            <div>
                                <h2 className="text-xl md:text-2xl font-black uppercase tracking-[0.3em] text-white italic">
                                    {isBuildOrReasonsView && currentBuild ? (
                                        <>Análisis Táctico: <span className="text-[#9055ff]">{currentBuild.name}</span></>
                                    ) : (
                                        view === 'bans' ? (
                                            <><span className="text-[#9055ff]">Bans</span> Recomendados</>
                                        ) : (
                                            <>Hex<span className="text-[#9055ff]">Draft</span></>
                                        )
                                    )}
                                </h2>
                                <p className="text-[9px] md:text-[10px] text-slate-400 uppercase font-bold tracking-[0.2em] mt-2">
                                    {isPlaying ? 'Monitor de partida activo' : 'Motor de recomendación en línea'}
                                </p>
                            </div>
                            
                            <div className="flex items-center gap-3">
                                {/* Indicador LCU sutil */}
                                <div className="flex items-center gap-1.5 border border-border-warm bg-black/45 px-2.5 py-1 rounded-sm select-none" title={isConnected ? 'LCU Conectado' : 'LCU Desconectado'}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500 shadow-[0_0_6px_#10b981]' : 'bg-red-500 shadow-[0_0_6px_#ef4444]'}`} />
                                    <span className="text-[8px] font-black tracking-wider text-slate-400 uppercase font-mono">LCU</span>
                                </div>

                                <div className={`text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 border rounded-sm select-none ${
                                    isPlaying ? 'text-green-500 border-green-950/30 bg-green-950/10' : 'text-[#9055ff] border-[#9055ff]/20 bg-[#9055ff]/10'
                                }`}>
                                    Fase: <span className="text-white">{PHASE_TRANSLATIONS[gamePhase] || gamePhase}</span>
                                </div>
                            </div>
                        </header>

                        <div className="relative flex-1">
                            {/* 1. ESPERA / LOBBY */}
                            {!inDraft && !isPlaying && (
                                <DraftLobby />
                            )}

                            {/* 2. VISTA DE PARTIDA / BUILD */}
                            {isBuildOrReasonsView && currentBuild && tacticalDirectives ? (
                                <div className="grid grid-cols-12 gap-6 lg:gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                                    {/* FILA 1: EVOLUCIÓN DE HABILIDADES (Ancho completo) */}
                                    <div className="col-span-12">
                                        <SkillTimeline
                                            skillOrder={currentBuild.build?.skillOrder}
                                            tacticalData={tacticalData}
                                        />
                                    </div>

                                    {/* FILA 2: MÓDULOS DE ANÁLISIS */}
                                    {/* COL 1: BUILD */}
                                    <div className="col-span-12 md:col-span-6 lg:col-span-4">
                                        <ItemBuild
                                            currentBuild={currentBuild}
                                            onReImport={handleReImport}
                                        />
                                    </div>

                                    {/* COL 2: DIRECTIVAS GENERALES */}
                                    <div className="col-span-12 md:col-span-6 lg:col-span-4">
                                        <CombatDirectivesPanel
                                            scalingType={tacticalDirectives.scalingType}
                                            combatStyle={tacticalDirectives.combatStyle}
                                            winrateCurveAnalysis={tacticalDirectives.winrateCurveAnalysis}
                                            generalDirectives={tacticalDirectives.generalDirectives}
                                        />
                                    </div>

                                    {/* COL 3: ENFRENTAMIENTOS Y SINERGIAS */}
                                    <div className="col-span-12 lg:col-span-4">
                                        <MatchupAnalysisPanel
                                            matchups={tacticalDirectives.matchups}
                                            synergies={tacticalDirectives.synergies}
                                        />
                                    </div>
                                </div>
                            ) : (
                                /* 3. DRAFT GRID (SELECCIÓN / BANEOS) */
                                inDraft && (
                                    <DraftGrid
                                        recommendations={view === 'bans' ? banRecommendations : recommendations}
                                        onSelectChampion={handleSelectChamp}
                                        isBan={view === 'bans'}
                                    />
                                )
                            )}
                        </div>

                        {/* CONFIGURACIÓN Y SWITCHES */}
                        {!isPlaying && (
                            <DraftSettings
                                autoPick={autoPick}
                                setAutoPick={setAutoPick}
                                autoBan={autoBan}
                                setAutoBan={setAutoBan}
                            />
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
            </div>
        </div>
    );
};