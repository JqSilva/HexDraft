import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { PlayerSlot } from './PlayerSlot';
import type { LcuPlayer } from './PlayerSlot';
import { RecommendationCard } from './RecommendationCard';
import type { Recommendation, BansRecommendation } from '../../lib/engine/engine';
import { getProcessedRecommendations, getProcessedBans, getSingleChampionBuild, getNameFromId } from '../../lib/engine/engine';
import { TacticalDirectives } from './TacticalDirectives';

// =========================================================
// INTERFACES & TYPES
// =========================================================
interface LcuAction {
  id: number;
  actorCellId: number;
  championId: number;
  completed: boolean;
  type: 'pick' | 'ban';
  isInProgress: boolean;
}

interface LcuTimer {
  phase: string;
  adjustedTimeLeftInPhase: number;
}

interface LcuDraftData {
  inDraft: boolean;
  myTeam: LcuPlayer[];
  theirTeam: LcuPlayer[];
  actions: LcuAction[][];
  localPlayerCellId: number;
  timer: LcuTimer;
  isBanPhase: boolean;
}

// =========================================================
// HELPERS (Fuera del componente para eficiencia)
// =========================================================
const getCDIcon = (path: string): string => {
    if (!path) return "";
    let cleanPath = path.toLowerCase().trim();
    if (cleanPath.includes('perk-images/')) cleanPath = cleanPath.split('perk-images/')[1];
    if (cleanPath.startsWith('/')) cleanPath = cleanPath.substring(1);
    return `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/${cleanPath}`;
};

const executeLcuAction = async (actionId: number, championId: number) => {
    try {
        await fetch('/api/execute-action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ actionId, championId, completed: true })
        });
        console.log(`✅ Acción ejecutada: ${championId}`);
    } catch (e) { console.error("❌ Error en acción LCU:", e); }
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
    } catch (e) { console.error("❌ Error importando:", e); }
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
    const [tacticalData, setTacticalData] = useState<{skills: string[]} | null>(null);
    
    // Responsividad: Modo compacto automático si la ventana mide menos de 1200px
    const [isCompact, setIsCompact] = useState<boolean>(false);

    // --- CONFIGURACIÓN ---
    const [autoPick, setAutoPick] = useState<boolean>(() => (typeof window !== 'undefined' ? localStorage.getItem('autoPick') === 'true' : false));
    const [autoBan, setAutoBan] = useState<boolean>(() => (typeof window !== 'undefined' ? localStorage.getItem('autoBan') === 'true' : false));

    // --- REFERENCIAS (Para evitar closures y fugas) ---
    const activeActionRef = useRef<any>(null);
    const lastActionKeyRef = useRef<string>("none");
    const lastFingerprintRef = useRef<string>("");
    const lastImportedIdRef = useRef<number>(0);
    const currentDataRef = useRef<any>(null);
    const isPollingRef = useRef<boolean>(false);
    
    // Referencias para el cálculo síncrono del tiempo
    const apiTimeAtSyncRef = useRef<number>(0);
    const timestampAtSyncRef = useRef<number>(0);

    const isPlaying = gamePhase === 'InProgress';

    // Hook para detectar responsividad en el lado del cliente
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const media = window.matchMedia("(max-width: 1200px)");
        const listener = (e: MediaQueryListEvent) => setIsCompact(e.matches);
        setIsCompact(media.matches);
        media.addEventListener("change", listener);
        return () => media.removeEventListener("change", listener);
    }, []);

    // Guardar configuraciones en localStorage
    useEffect(() => {
        localStorage.setItem('autoPick', String(autoPick));
    }, [autoPick]);

    useEffect(() => {
        localStorage.setItem('autoBan', String(autoBan));
    }, [autoBan]);

    // =========================================================
    // RELOJ ÚNICO (Con limpieza estricta)
    // =========================================================
    useEffect(() => {
        const interval = setInterval(() => {
            if (activeActionRef.current && timestampAtSyncRef.current > 0) {
                const now = Date.now();
                const elapsed = now - timestampAtSyncRef.current;
                const remaining = Math.max(0, apiTimeAtSyncRef.current - elapsed);
                
                setLocalTimeLeft(Math.floor(remaining));

                // Lógica de baneo automático (3.5s)
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
            
            const meRes = await fetch('/api/me');
            const { summoner } = await meRes.json();
            const myPlayer = data.myTeam.find((p: any) => p.gameName === summoner);
            const myRole = myPlayer?.assignedPosition?.toLowerCase() || "jungle";

            let targetId = 0;
            if (currentAction.type === 'pick') {
                const picks = getProcessedRecommendations(cleanMyTeam, cleanTheirTeam, unavailableIds, myRole);
                if (picks.length > 0) targetId = picks[0].id;
            } else if (currentAction.type === 'ban'){
                const picks = getProcessedRecommendations(cleanMyTeam, cleanTheirTeam, unavailableIds, myRole);
                const bans = getProcessedBans(picks).filter(b => !unavailableIds.includes(b.id));
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

                    const { summoner } = await (await fetch('/api/me')).json();
                    const myPlayer = data.myTeam.find((p: any) => p.gameName === summoner);
                    const myId = myPlayer?.championId || 0;
                    const myRole = myPlayer?.assignedPosition?.toLowerCase() || "jungle";
                    const myHoverIntent = myPlayer?.championPickIntent || 0;
                    const activeIdForEngine = myId > 0 ? myId : myHoverIntent;

                    const cleanMyTeam = data.myTeam
                        .filter((p: any) => p.gameName !== summoner) 
                        .map((p: any) => p.championId || p.championPickIntent)
                        .filter((id: number) => id !== 0);

                    const cleanTheirTeam = data.theirTeam.map((p: any) => p.championId || p.championPickIntent).filter((id: number) => id !== 0);
                    const bannedIds = data.actions?.flat().filter((a: any) => a.type === 'ban' && a.completed).map((a: any) => a.championId) || [];
                    const unavailableIds = [...new Set([...bannedIds, ...cleanMyTeam, ...cleanTheirTeam])];

                    const picks = getProcessedRecommendations(cleanMyTeam, cleanTheirTeam, unavailableIds, myRole, activeIdForEngine);

                    if (myId > 0) {
                        if (myId !== lastImportedIdRef.current) {
                            lastImportedIdRef.current = myId;
                            console.log(`🎯 Pick detectado: ${myId}`);

                            const pickedRec = picks.find(r => r.id === myId);
                            if (pickedRec) {
                                console.log("✅ Razones capturadas con éxito");
                                setSelectedRecommendation(pickedRec);
                                localStorage.setItem('last_pick_analysis', JSON.stringify(pickedRec));
                            }

                            const buildData = getSingleChampionBuild(myId);
                            if (buildData) {
                                setCurrentBuild(buildData);
                                setView('build');
                                await importToClient({ ...buildData, id: myId });
                            }

                            const champName = getNameFromId(myId);
                            fetch(`/api/tactical-data?champion=${champName}&role=${myRole}`)
                                .then(res => res.json())
                                .then(data => {
                                    setTacticalData(data);
                                    console.log("🔥 Data táctica cargada:", data);
                                })
                                .catch(err => console.error("Error táctico:", err));
                        }
                    } else {
                        const fingerprint = `${data.isBanPhase}-${cleanMyTeam.join(',')}-${myHoverIntent}`;
                        if (fingerprint !== lastFingerprintRef.current) {
                            lastFingerprintRef.current = fingerprint;
                    
                            const bans = getProcessedBans(picks).filter(b => !unavailableIds.includes(b.id));

                            setRecommendations(picks.slice(0, 20));
                            setBanRecommendations(bans.slice(0, 20));
                            setView(data.isBanPhase ? 'bans' : 'picks');
                        }
                    }
                }
            } 
            else if (phase === 'InProgress') {
                nextInterval = 30000;
                let currentRec = selectedRecommendation;

                if (!currentRec) {
                    const saved = localStorage.getItem('last_pick_analysis');
                    if (saved) {
                        currentRec = JSON.parse(saved);
                        setSelectedRecommendation(currentRec);
                    }
                }

                if (currentRec && view !== 'reasons') {
                    setView('reasons');
                } else {
                    setView('build');
                }
            }
            else {
                if (phase === 'None' || phase === 'Lobby') {
                    if (inDraft || lastFingerprintRef.current !== "") {
                        resetDraftState();
                        setSelectedRecommendation(null);
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

    return (
        <div className="flex flex-col gap-4 w-full overflow-hidden">
            {/* STATUS BAR */}
            <div className="w-fit mx-auto mt-2 flex items-center gap-3 py-2 px-4 bg-panel-warm border border-border-warm rounded-sm relative z-10 select-none">
                <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-[9px] uppercase tracking-[0.2em] font-black text-slate-400">
                    {isConnected ? 'Conectado' : 'Desconectado'} 
                </span>
            </div>

            <div className={`flex flex-row w-full items-start relative z-10 px-2 md:px-4 transition-all duration-700 ${
                isPlaying ? 'gap-0 justify-center' : 'gap-4 md:gap-6 justify-between'
            }`}>
                {/* ALIADOS */}
                <div className={`shrink space-y-3 column-transition ${
                    isPlaying ? 'ally-off-screen' : (isCompact ? 'w-16' : 'w-64 xl:w-72')
                }`}>
                    {!isPlaying && (
                        <h3 className="text-cyan-400 font-black text-xs uppercase tracking-widest border-b border-border-warm pb-3 flex items-center gap-2">
                            <span className="w-2.5 h-px bg-cyan-400"></span> 
                            {!isCompact && "Tu Equipo"}
                        </h3>
                    )}
                    {myTeam.map((player, i) => (
                        <PlayerSlot key={`ally-${i}`} player={player} compact={isCompact && !isPlaying} />
                    ))}
                </div>

                {/* CENTRO */}
                <div className={`transition-all duration-700 ease-in-out ${
                    isPlaying 
                        ? 'flex-[10] w-full max-w-[1400px] mx-auto' 
                        : 'flex-1 min-w-0 mx-2 md:mx-4'
                }`}>
                    <div className="bg-panel-warm border border-border-warm p-6 md:p-8 rounded-sm backdrop-blur-md min-h-[600px] relative overflow-hidden flex flex-col tech-corners">
                        
                        {/* HEADER DINÁMICO */}
                        <header className="mb-6 flex justify-between items-end border-b border-border-warm pb-5">
                            <div>
                                <h2 className="text-xl md:text-2xl font-black uppercase tracking-[0.3em] text-white italic">
                                    {isPlaying || view === 'build' || view === 'reasons' ? (
                                        <>Análisis Táctico: <span className="text-[#9055ff]">{currentBuild?.name || 'Cargando'}</span></>
                                    ) : (
                                        view === 'bans' ? (
                                            <><span className="text-[#9055ff]">Bans</span> Recomendados</>
                                        ) : (
                                            <>Hex<span className="text-[#9055ff]">Draft</span></>
                                        )
                                    )}
                                </h2>
                                <p className="text-[9px] md:text-[10px] text-slate-400 uppercase font-bold tracking-[0.2em] mt-2 mt-2">
                                    {isPlaying ? 'Monitor de partida activo' : 'Motor de recomendación en línea'}
                                </p>
                            </div>
                            <div className={`text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 border rounded-sm select-none ${
                                isPlaying ? 'text-green-500 border-green-950/30 bg-green-950/10' : 'text-[#9055ff] border-[#9055ff]/20 bg-[#9055ff]/10'
                            }`}>
                                Fase: <span className="text-white">{gamePhase}</span>
                            </div>
                        </header>

                        <div className="relative flex-1">
                            
                            {/* 1. ESTADO: FUERA DE DRAFT / ESPERA */}
                            {!inDraft && gamePhase !== 'InProgress' && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-center animate-in fade-in">
                                    <div className="relative w-20 h-20 mb-8">
                                        <svg width="100%" height="100%" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                                            <style>{`
                                                @keyframes hf1 { 0%,100%{opacity:.12} 8%{opacity:1} 20%{opacity:.12} }
                                                @keyframes hf2 { 0%,100%{opacity:.12} 16%{opacity:.12} 24%{opacity:1} 36%{opacity:.12} }
                                                @keyframes hf3 { 0%,100%{opacity:.12} 32%{opacity:.12} 40%{opacity:1} 52%{opacity:.12} }
                                                @keyframes hf4 { 0%,100%{opacity:.12} 48%{opacity:.12} 56%{opacity:1} 68%{opacity:.12} }
                                                @keyframes hf5 { 0%,100%{opacity:.12} 64%{opacity:.12} 72%{opacity:1} 84%{opacity:.12} }
                                                @keyframes hf6 { 0%,100%{opacity:.12} 80%{opacity:.12} 88%{opacity:1} 100%{opacity:.12} }
                                                .hf1 { animation: hf1 3.6s ease-in-out infinite; }
                                                .hf2 { animation: hf2 3.6s ease-in-out infinite; }
                                                .hf3 { animation: hf3 3.6s ease-in-out infinite; }
                                                .hf4 { animation: hf4 3.6s ease-in-out infinite; }
                                                .hf5 { animation: hf5 3.6s ease-in-out infinite; }
                                                .hf6 { animation: hf6 3.6s ease-in-out infinite; }
                                            `}</style>
                                            <line x1="50" y1="50" x2="50" y2="8" stroke="#7c3aed" strokeWidth="0.5" strokeOpacity="0.35"/>
                                            <line x1="50" y1="50" x2="86.4" y2="29" stroke="#7c3aed" strokeWidth="0.5" strokeOpacity="0.35"/>
                                            <line x1="50" y1="50" x2="86.4" y2="71" stroke="#7c3aed" strokeWidth="0.5" strokeOpacity="0.35"/>
                                            <line x1="50" y1="50" x2="50" y2="92" stroke="#7c3aed" strokeWidth="0.5" strokeOpacity="0.35"/>
                                            <line x1="50" y1="50" x2="13.6" y2="71" stroke="#7c3aed" strokeWidth="0.5" strokeOpacity="0.35"/>
                                            <line x1="50" y1="50" x2="13.6" y2="29" stroke="#7c3aed" strokeWidth="0.5" strokeOpacity="0.35"/>
                                            <line x1="50" y1="8" x2="86.4" y2="29" stroke="#4c1d95" strokeWidth="3.5" strokeLinecap="round"/>
                                            <line x1="86.4" y1="29" x2="86.4" y2="71" stroke="#4c1d95" strokeWidth="3.5" strokeLinecap="round"/>
                                            <line x1="86.4" y1="71" x2="50" y2="92" stroke="#4c1d95" strokeWidth="3.5" strokeLinecap="round"/>
                                            <line x1="50" y1="92" x2="13.6" y2="71" stroke="#4c1d95" strokeWidth="3.5" strokeLinecap="round"/>
                                            <line x1="13.6" y1="71" x2="13.6" y2="29" stroke="#4c1d95" strokeWidth="3.5" strokeLinecap="round"/>
                                            <line x1="13.6" y1="29" x2="50" y2="8" stroke="#4c1d95" strokeWidth="3.5" strokeLinecap="round"/>
                                            <line x1="50" y1="8" x2="86.4" y2="29" className="hf1" stroke="#c4b5fd" strokeWidth="3.5" strokeLinecap="round"/>
                                            <line x1="86.4" y1="29" x2="86.4" y2="71" className="hf2" stroke="#c4b5fd" strokeWidth="3.5" strokeLinecap="round"/>
                                            <line x1="86.4" y1="71" x2="50" y2="92" className="hf3" stroke="#c4b5fd" strokeWidth="3.5" strokeLinecap="round"/>
                                            <line x1="50" y1="92" x2="13.6" y2="71" className="hf4" stroke="#c4b5fd" strokeWidth="3.5" strokeLinecap="round"/>
                                            <line x1="13.6" y1="71" x2="13.6" y2="29" className="hf5" stroke="#c4b5fd" strokeWidth="3.5" strokeLinecap="round"/>
                                            <line x1="13.6" y1="29" x2="50" y2="8" className="hf6" stroke="#c4b5fd" strokeWidth="3.5" strokeLinecap="round"/>
                                        </svg>
                                    </div>
                                    <p className="text-slate-400 uppercase font-black tracking-[0.3em] text-xs animate-pulse">Esperando Selección...</p>
                                </div>
                            )}

                            {/* 2. VISTA DE PARTIDA / BUILD / REASONS */}
                            {(isPlaying || view === 'build' || view === 'reasons') && currentBuild ? (
                                <div className="grid grid-cols-12 gap-6 lg:gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                                    
                                    {/* COLUMNA IZQUIERDA: HABILIDADES Y EQUIPO */}
                                    <div className="col-span-12 lg:col-span-7 space-y-6 lg:space-y-8">
                                        
                                        {/* SKILL TIMELINE */}
                                        <div className="p-6 bg-bg-warm border border-border-warm rounded-sm w-full relative tech-corners">
                                            <div className="flex justify-between items-center mb-6">
                                                <h4 className="text-[12px] text-cyan-400 font-black uppercase tracking-[0.3em] italic">
                                                    Evolución de Habilidades
                                                </h4>
                                                
                                                {/* ORDEN DE MAXEO GLOBAL (Q > E > W) */}
                                                {currentBuild?.build?.skillOrder && (
                                                    <div className="flex items-center gap-2 px-3 py-1 bg-cyan-400/10 border border-cyan-400/20 rounded-sm">
                                                        <span className="text-[9px] text-cyan-400 font-black uppercase tracking-widest">Maxeo:</span>
                                                        <span className="text-[9px] text-white font-black tracking-widest uppercase">
                                                            {currentBuild.build.skillOrder} 
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {/* Orden de habilidades por nivel (1-15) */}
                                            <div className="flex flex-row justify-between items-center w-full gap-1 md:gap-2">
                                                {tacticalData ? (
                                                    tacticalData.skills.map((skill: string, idx: number) => {
                                                        const lvl = idx + 1;
                                                        const isUlt = skill === 'R';
                                                        return (
                                                            <div key={lvl} className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                                                                <span className="text-[8px] md:text-[10px] font-bold text-slate-600">{lvl}</span>
                                                                <div className={`w-full aspect-square max-w-[48px] border flex items-center justify-center font-black text-sm md:text-lg rounded-sm transition-all
                                                                    ${isUlt 
                                                                        ? 'bg-purple-accent/10 border-purple-accent text-purple-accent' 
                                                                        : 'bg-input-warm border-border-warm text-slate-300'}
                                                                `}>
                                                                    {skill}
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    <div className="w-full py-4 text-center">
                                                        <p className="text-slate-500 text-xs animate-pulse tracking-widest uppercase">
                                                            Obteniendo orden de habilidades...
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* RUTA DE BUILD / ITEMS */}
                                        <div className="p-6 bg-bg-warm border border-border-warm rounded-sm tech-corners">
                                            <div className="flex justify-between items-center mb-6">
                                                <h4 className="text-[12px] text-purple-accent font-black uppercase tracking-[0.3em] italic">Build Recomendada</h4>
                                                <button onClick={handleReImport} className="px-6 py-2 bg-purple-accent hover:bg-purple-accent-hover text-white font-black uppercase text-[10px] tracking-widest rounded-sm transition-all duration-200 cursor-pointer active:scale-95 border-none">Re-Importar</button>
                                            </div>
                                            <div className="flex flex-wrap gap-4 items-center justify-center bg-input-warm/50 p-6 md:p-8 rounded-sm border border-border-warm">
                                                {currentBuild?.build?.items?.core.map((item: any, idx: number) => (
                                                    <div key={idx} className="relative group">
                                                        <img src={`https://ddragon.leagueoflegends.com/cdn/16.9.1/img/item/${item.id}.png`} className="w-12 h-12 md:w-14 md:h-14 border border-border-warm rounded-sm hover:border-purple-accent transition-colors duration-200 cursor-default" alt="item" />
                                                        <div className="absolute -top-1.5 -right-1.5 bg-input-warm border border-border-warm text-[8px] font-black px-1 py-0.5 rounded-sm text-slate-400">0{idx+1}</div>
                                                    </div>
                                                ))}
                                                <div className="h-10 w-px bg-border-warm mx-2 md:mx-4"></div>
                                                <div className="relative">
                                                    <img src={`https://ddragon.leagueoflegends.com/cdn/16.9.1/img/item/${currentBuild?.build?.items?.boots?.id}.png`} className="w-12 h-12 md:w-14 md:h-14 border border-border-warm rounded-sm cursor-default" alt="boots" />
                                                    <div className="absolute -top-1.5 -right-1.5 bg-input-warm border border-border-warm text-[8px] font-black px-1 py-0.5 rounded-sm text-slate-400">B</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* COLUMNA DERECHA: CONSEJOS TÁCTICOS */}
                                    <div className="col-span-12 lg:col-span-5">
                                        {(() => {
                                            const champProfile = currentBuild ? (window as any).__ENRICHED_DB?.[currentBuild.name] || {} : {};
                                            
                                            return (
                                                <TacticalDirectives 
                                                    championName={currentBuild?.name || 'Tu Campeón'} 
                                                    scalingType={champProfile.scalingType}
                                                    reasons={selectedRecommendation?.reasons}
                                                />
                                            );
                                        })()}
                                    </div>
                                </div>
                            ) : (
                                /* 3. GRID DE SELECCIÓN (Picks / Bans) */
                                inDraft && (
                                    <div className="grid grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-x-2 gap-y-4 pb-4 max-w-fit w-full mx-auto animate-in zoom-in-95">
                                        {(view === 'bans' ? banRecommendations : recommendations).map((rec: any) => (
                                            <div key={rec.id} onClick={() => handleSelectChamp(rec)}>
                                                <RecommendationCard {...rec} isBan={view === 'bans'} />
                                            </div>
                                        ))}
                                    </div>
                                )
                            )}
                        </div>

                        {/* SWITCHES (Ocultos automáticamente en partida para centrar el dashboard) */}
                        {!isPlaying && (
                            <div className="flex justify-center gap-12 mt-8 z-50 pt-8 border-t border-border-warm/50">
                                <label className="flex items-center gap-3 cursor-pointer group select-none">
                                    <input type="checkbox" checked={autoPick} onChange={(e) => setAutoPick(e.target.checked)} className="hidden peer" />
                                    <div className="w-5 h-5 border border-border-warm rounded-sm bg-input-warm peer-checked:bg-purple-accent peer-checked:border-purple-accent transition-all duration-200 flex items-center justify-center">
                                        <span className="text-white text-xs opacity-0 peer-checked:opacity-100">✓</span>
                                    </div>
                                    <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 group-hover:text-slate-300 transition-colors duration-200">Autopick</span>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer group select-none">
                                    <input type="checkbox" checked={autoBan} onChange={(e) => setAutoBan(e.target.checked)} className="hidden peer" />
                                    <div className="w-5 h-5 border border-border-warm rounded-sm bg-input-warm peer-checked:bg-[#ff4655] peer-checked:border-[#ff4655] transition-all duration-200 flex items-center justify-center">
                                        <span className="text-white text-xs opacity-0 peer-checked:opacity-100">✓</span>
                                    </div>
                                    <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 group-hover:text-slate-300 transition-colors duration-200">Autoban</span>
                                </label>
                            </div>
                        )}

                        {previewChamp && (
                            <div 
                                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
                                onClick={() => setPreviewChamp(null)}
                            >
                                <div 
                                    className="w-full max-w-md p-6 bg-panel-warm border border-border-warm rounded-sm relative animate-in zoom-in-95 duration-150 tech-corners"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <button 
                                        onClick={() => setPreviewChamp(null)}
                                        className="absolute top-4 right-4 text-slate-500 hover:text-white font-bold transition-colors duration-200 uppercase text-[10px] tracking-widest cursor-pointer"
                                    >
                                        ✕ Cerrar
                                    </button>

                                    <div className="mb-6">
                                        <span className="text-[10px] text-cyan-400 font-black uppercase tracking-[0.2em]">Evaluación del Motor</span>
                                        <h3 className="text-xl font-black text-white uppercase tracking-wider mt-1">
                                            {previewChamp.name}
                                        </h3>
                                        <div className="h-px bg-border-warm w-full mt-3"></div>
                                    </div>

                                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                                        {previewChamp.reasons?.map((reason: string, i: number) => (
                                            <div key={i} className="flex items-start gap-3 text-xs text-slate-300 bg-input-warm/40 border border-border-warm/50 p-3 rounded-sm">
                                                <span className="text-purple-accent font-bold mt-0.5 text-[10px]">◆</span>
                                                <p className="leading-relaxed">{reason}</p>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="mt-6 pt-4 border-t border-border-warm flex justify-between items-center">
                                        <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Score proyectado:</span>
                                        <span className="text-sm font-black px-2.5 py-1 bg-purple-accent/10 border border-purple-accent/20 text-purple-accent rounded-sm">
                                            {previewChamp.score?.toFixed(1)} / 10
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ENEMIGOS */}
                <div className={`shrink space-y-3 text-right column-transition ${
                    isPlaying ? 'enemy-off-screen' : (isCompact ? 'w-16' : 'w-64 xl:w-72')
                }`}>
                    {!isPlaying && (
                        <h3 className="text-red-400 font-black text-xs uppercase tracking-widest border-b border-border-warm pb-3 flex items-center justify-end gap-2">
                            {!isCompact && "Enemigos"} 
                            <span className="w-2.5 h-px bg-red-400"></span>
                        </h3>
                    )}
                    {theirTeam.map((player, i) => (
                        <PlayerSlot key={`enemy-${i}`} player={player} isEnemy={true} compact={isCompact && !isPlaying} />
                    ))}
                </div>
            </div>
        </div>
    );
};