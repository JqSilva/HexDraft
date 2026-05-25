import React, { useState, useEffect, useRef } from 'react';
import { PlayerSlot } from './PlayerSlot';
import { RecommendationCard } from './RecommendationCard';
import type { Recommendation, BansRecommendation } from '../../lib/engine/engine';
import { getProcessedRecommendations, getProcessedBans, getSingleChampionBuild } from '../../lib/engine/engine';

// =========================================================
// HELPERS (Fuera del componente para eficiencia)
// =========================================================
const getCDIcon = (path: string) => {
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
    const [isConnected, setIsConnected] = useState(false);
    const [gamePhase, setGamePhase] = useState('Offline');
    const [inDraft, setInDraft] = useState(false);
    const [view, setView] = useState<'lobby' | 'picks' | 'bans' | 'build' | 'reasons'>('lobby');
    const [myTeam, setMyTeam] = useState<any[]>(Array(5).fill({}));
    const [theirTeam, setTheirTeam] = useState<any[]>(Array(5).fill({}));
    const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
    const [banRecommendations, setBanRecommendations] = useState<BansRecommendation[]>([]);
    const [currentBuild, setCurrentBuild] = useState<any>(null);
    const [localTimeLeft, setLocalTimeLeft] = useState<number>(0);
    const [selectedRecommendation, setSelectedRecommendation] = useState<any>(null);

    // --- CONFIGURACIÓN ---
    const [autoPick, setAutoPick] = useState(() => (typeof window !== 'undefined' ? localStorage.getItem('autoPick') === 'true' : false));
    const [autoBan, setAutoBan] = useState(() => (typeof window !== 'undefined' ? localStorage.getItem('autoBan') === 'true' : false));

    // --- REFERENCIAS (Para evitar closures y fugas) ---
    const activeActionRef = useRef<any>(null);
    const lastActionKeyRef = useRef<string>("none");
    const lastFingerprintRef = useRef("");
    const lastImportedIdRef = useRef(0);
    const currentDataRef = useRef<any>(null);
    const isPollingRef = useRef(false);
    
    // Referencias para el cálculo síncrono del tiempo
    const apiTimeAtSyncRef = useRef<number>(0);
    const timestampAtSyncRef = useRef<number>(0);

    // =========================================================
    // RELOJ ÚNICO (Con limpieza estricta)
    // =========================================================
    useEffect(() => {
        const interval = setInterval(() => {
            if (activeActionRef.current && timestampAtSyncRef.current > 0) {
                const now = Date.now();
                // Calculamos cuánto ha pasado desde que capturamos el tiempo "una pura vez"
                const elapsed = now - timestampAtSyncRef.current;
                const remaining = Math.max(0, apiTimeAtSyncRef.current - elapsed);
                
                setLocalTimeLeft(Math.floor(remaining));

                // Lógica de baneo automático (3.5s)
                console.log(remaining);
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
            const cleanMyTeam = data.myTeam.map((p: any) => p.championId || p.championPickIntent).filter((id: number) => id !== 0);
            const cleanTheirTeam = data.theirTeam.map((p: any) => p.championId || p.championPickIntent).filter((id: number) => id !== 0);
            const bannedIds = data.actions?.flat().filter((a: any) => a.type === 'ban' && a.completed).map((a: any) => a.championId) || [];
            const unavailableIds = [...new Set([...bannedIds, ...cleanMyTeam, ...cleanTheirTeam])];
            
            const meRes = await fetch('/api/me');
            const { summoner } = await meRes.json();
            const myPlayer = data.myTeam.find((p: any) => p.gameName === summoner);
            const myRole = myPlayer?.assignedPosition?.toLowerCase() || "jungle";

            let targetId = 0;
            console.log(currentAction.type);
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

    // =========================================================
    // BUCLE PRINCIPAL (POLLING DE FASES)
    // =========================================================
    const updateLoop = async () => {
        if (isPollingRef.current) return;
        isPollingRef.current = true;
        let nextInterval = 5000;

        try {
            const statusRes = await fetch('/api/game-status');
            const statusData = await statusRes.json();
            const phase = statusData.phase;

            setGamePhase(phase);
            setIsConnected(phase !== 'Offline');

            if (phase === 'ChampSelect' || phase === 'ReadyCheck'){
                nextInterval = 1500;
                const draftRes = await fetch('/api/champ-select');
                const data = await draftRes.json();

                if (data.inDraft) {
                    setInDraft(true);
                    currentDataRef.current = data;

                    // 1. SINCRONIZACIÓN DE TURNO
                    const myCellId = data.localPlayerCellId;
                    const myAction = data.actions?.flat().find((a: any) => a.actorCellId === myCellId && a.isInProgress && !a.completed);
                    
                    if (myAction) {
                        const riotPhase = data.timer?.phase || "UNKNOWN";
                        const actionKey = `${myAction.id}-${myAction.type}-${riotPhase}`;
                        
                        if (riotPhase === "PLANNING") {
                            timestampAtSyncRef.current = Date.now();
                            apiTimeAtSyncRef.current = 0;
                        }
                        if (lastActionKeyRef.current !== actionKey && riotPhase != "PLANNING") {
                            // === ESTO SE EJECUTA UNA PURA VEZ POR FASE ===
                            console.log(`🆕 Fase Detectada: ${riotPhase}. Sincronizando ancla.`);
    
                            
                            lastActionKeyRef.current = actionKey;
                            activeActionRef.current = myAction;

                            let apiTime = data.timer?.adjustedTimeLeftInPhase || 30000;
                            let adjusted = apiTime > 30000 ? apiTime - 5000 : apiTime;
                            
                            // Asignamos a las variables de referencia y NO las tocamos más 
                            // hasta que actionKey cambie de nuevo.
                            timestampAtSyncRef.current = Date.now();
                            apiTimeAtSyncRef.current = adjusted;
                        }
                    } else {
                        activeActionRef.current = null;
                        lastActionKeyRef.current = "none";
                        timestampAtSyncRef.current = 0;
                    }

                    // 2. DETECCIÓN DE PICK MANUAL O AUTOMÁTICO
                    // Obtenemos tu ID de campeón actual
                    const meRes = await fetch('/api/me');
                    const meData = await meRes.json();
                    const myPlayer = data.myTeam.find((p: any) => p.gameName === meData.summoner);
                    const myId = myPlayer?.championId || 0;

                    if (myId > 0) {
                        // Si ya tienes un campeón (Pick completado)
                        if (myId !== lastImportedIdRef.current) {
                            console.log(`🎯 Pick detectado: ${myId}. Importando configuración...`);
                            lastImportedIdRef.current = myId;
                            
                            const buildData = getSingleChampionBuild(myId);
                            if (buildData) {
                                setCurrentBuild(buildData);
                                setView('build'); 
                                await importToClient({ ...buildData, id: myId });
                            }
                        }
                    } else {
                        // Si aún no has pickeado (myId === 0), seguimos con las recomendaciones
                        const fingerprint = `${data.isBanPhase}-${data.myTeam.map((p: any) => p.championId || p.championPickIntent).join(',')}`;
                         
                        // 2. HUELLA DIGITAL (RECOMENDACIONES)
                        if (fingerprint !== lastFingerprintRef.current) {
                            lastFingerprintRef.current = fingerprint;
                            setMyTeam(data.myTeam);
                            setTheirTeam(data.theirTeam);

                            const meRes = await fetch('/api/me');
                            const meData = await meRes.json();
                            const myPlayer = data.myTeam.find((p: any) => p.gameName === meData.summoner);
                            const myId = myPlayer?.championId || 0;
                            const myRole = myPlayer?.assignedPosition?.toLowerCase() || "jungle";

                            if (myId > 0) {
                                if (myId !== lastImportedIdRef.current) {
                                    lastImportedIdRef.current = myId;
                                    const buildData = getSingleChampionBuild(myId);
                                    if (buildData) {
                                        setCurrentBuild(buildData);
                                        setView('build');
                                        await importToClient({ ...buildData, id: myId });
                                    }
                                }
                            } else {
                                const cleanMyTeam = data.myTeam.map((p: any) => p.championId || p.championPickIntent).filter((id: number) => id !== 0);
                                const cleanTheirTeam = data.theirTeam.map((p: any) => p.championId || p.championPickIntent).filter((id: number) => id !== 0);
                                const bannedIds = data.actions?.flat().filter((a: any) => a.type === 'ban' && a.completed).map((a: any) => a.championId) || [];
                                const unavailableIds = [...new Set([...bannedIds, ...cleanMyTeam, ...cleanTheirTeam])];

                                const picks = getProcessedRecommendations(cleanMyTeam, cleanTheirTeam, unavailableIds, myRole);
                                const bans = getProcessedBans(picks).filter(b => !unavailableIds.includes(b.id));

                                setRecommendations(picks.slice(0, 20));
                                setBanRecommendations(bans.slice(0, 20));
                                setView(data.isBanPhase ? 'bans' : 'picks');
                            }
                        }
                    }
                }
            } 
            else if (phase === 'InProgress'){
                nextInterval = 30000;
                const myFinalId = lastImportedIdRef.current;

                if (myFinalId > 0) {
                    const finalRec = recommendations.find(r => r.id === myFinalId);

                    if (finalRec) {
                        setSelectedRecommendation(finalRec);
                        
                        if (view !== 'reasons') {
                            console.log("Partida en curso: Mostrando análisis táctico.");
                            setView('reasons');
                        }
                    } else {
                        if (view !== 'build') setView('build');
                    }
                }
            }
            else {
                // RESET TOTAL
                if (inDraft || lastFingerprintRef.current !== "") {
                    lastFingerprintRef.current = "";
                    lastImportedIdRef.current = 0;
                    lastActionKeyRef.current = "none";
                    timestampAtSyncRef.current = 0;
                    setInDraft(false);
                    setRecommendations([]);
                    setBanRecommendations([]);
                    setMyTeam(Array(5).fill({}));
                    setTheirTeam(Array(5).fill({}));
                    setView('lobby');
                    activeActionRef.current = null;
                    nextInterval = 10000;
                }
            }
        } catch (e) { console.error(e); }
        finally {
            isPollingRef.current = false;
            setTimeout(updateLoop, nextInterval);
        }
    };

    useEffect(() => {
        updateLoop();
    }, []);

    return (
        <div className="flex flex-col gap-6 w-full">
            {/* STATUS BAR */}
            <div className="w-fit mx-auto mt-6 flex items-center gap-3 py-2.5 px-4 bg-slate-900/80 border border-slate-800 rounded-sm relative z-10">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-600'}`}></div>
                <span className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-400">
                    {isConnected ? 'Conectado' : 'Desconectado'} 
                </span>
            </div>

            <div className="flex flex-row gap-6 w-full justify-between items-start relative z-10">
                {/* ALIADOS */}
                <div className="w-72 shrink space-y-4 min-w-[200px]">
                    <h3 className="text-cyan-500 font-black text-xs uppercase tracking-widest border-b border-slate-800 pb-3 flex items-center gap-2"><span className="w-3 h-px bg-cyan-500"></span> Tu Equipo</h3>
                    {myTeam.map((player, i) => <PlayerSlot key={`ally-${i}`} player={player} />)}
                </div>

                {/* CENTRO */}
                <div className="flex-1 min-w-[750px]">
                    <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-sm backdrop-blur-md min-h-[600px] relative overflow-hidden shadow-2xl">
                        <header className="mb-6 flex justify-between items-end border-b border-slate-800 pb-5">
                            <div>
                                <h2 className="text-xl font-black uppercase tracking-[0.3em] text-white italic">
                                    {view === 'build' ? (
                                        <>Build: <span className="text-purple-500">{currentBuild?.name}</span></>
                                    ) : view === 'bans' ? (
                                        <><span className="text-purple-500">Bans</span> Recomendados</>
                                    ) : view === 'picks' ? (
                                        <><span className="text-purple-500">Picks</span> Recomendados</>
                                    ) : (
                                        <>Hex<span className="text-purple-500">Draft</span></>
                                    )}
                                </h2>
                                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-[0.2em] mt-2">
                                    {view === 'build' ? 'Sincronizado con meta actual' : 'MOTOR DE RECOMENDACIÓN ACTIVO'}
                                </p>
                            </div>
                            <div className="text-[10px] text-purple-500 font-black uppercase tracking-[0.2em] bg-purple-950/20 px-3 py-1 border border-purple-900/30 rounded-sm">
                                Fase: <span className="text-white">{inDraft ? (view === 'bans' ? 'Bans' : 'Picks') : 'Lobby'}</span>
                            </div>
                        </header>

                        <div className="relative min-h-[400px]">
                            {/* 1. ESTADO: FUERA DE DRAFT (LOADING) */}
                            {!inDraft && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-center animate-in fade-in">
                                    <div className="relative w-20 h-20 mb-8">
                                        <svg
                                            width="100%"
                                            height="100%"
                                            viewBox="0 0 100 100"
                                            xmlns="http://www.w3.org/2000/svg"
                                        >
                                            <style>{`
                                            @keyframes hf1 { 0%,100%{opacity:.12} 0%{opacity:.12} 8%{opacity:1} 20%{opacity:.12} }
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

                                            {/* Centro: 50,50 — Radio: 42
                                                top:       50, 8
                                                top-right: 86.4, 29
                                                bot-right: 86.4, 71
                                                bottom:    50, 92
                                                bot-left:  13.6, 71
                                                top-left:  13.6, 29
                                            */}

                                            {/* Líneas interiores de faceta — siempre visibles */}
                                            <line x1="50" y1="50" x2="50"   y2="8"    stroke="#7c3aed" strokeWidth="0.5" strokeOpacity="0.35"/>
                                            <line x1="50" y1="50" x2="86.4" y2="29"   stroke="#7c3aed" strokeWidth="0.5" strokeOpacity="0.35"/>
                                            <line x1="50" y1="50" x2="86.4" y2="71"   stroke="#7c3aed" strokeWidth="0.5" strokeOpacity="0.35"/>
                                            <line x1="50" y1="50" x2="50"   y2="92"   stroke="#7c3aed" strokeWidth="0.5" strokeOpacity="0.35"/>
                                            <line x1="50" y1="50" x2="13.6" y2="71"   stroke="#7c3aed" strokeWidth="0.5" strokeOpacity="0.35"/>
                                            <line x1="50" y1="50" x2="13.6" y2="29"   stroke="#7c3aed" strokeWidth="0.5" strokeOpacity="0.35"/>

                                            {/* Caras exteriores base — siempre visibles, tenues */}
                                            <line x1="50"   y1="8"  x2="86.4" y2="29"  stroke="#4c1d95" strokeWidth="3.5" strokeLinecap="round"/>
                                            <line x1="86.4" y1="29" x2="86.4" y2="71"  stroke="#4c1d95" strokeWidth="3.5" strokeLinecap="round"/>
                                            <line x1="86.4" y1="71" x2="50"   y2="92"  stroke="#4c1d95" strokeWidth="3.5" strokeLinecap="round"/>
                                            <line x1="50"   y1="92" x2="13.6" y2="71"  stroke="#4c1d95" strokeWidth="3.5" strokeLinecap="round"/>
                                            <line x1="13.6" y1="71" x2="13.6" y2="29"  stroke="#4c1d95" strokeWidth="3.5" strokeLinecap="round"/>
                                            <line x1="13.6" y1="29" x2="50"   y2="8"   stroke="#4c1d95" strokeWidth="3.5" strokeLinecap="round"/>

                                            {/* Caras animadas encima */}
                                            <line x1="50"   y1="8"  x2="86.4" y2="29"  className="hf1" stroke="#c4b5fd" strokeWidth="3.5" strokeLinecap="round"/>
                                            <line x1="86.4" y1="29" x2="86.4" y2="71"  className="hf2" stroke="#c4b5fd" strokeWidth="3.5" strokeLinecap="round"/>
                                            <line x1="86.4" y1="71" x2="50"   y2="92"  className="hf3" stroke="#c4b5fd" strokeWidth="3.5" strokeLinecap="round"/>
                                            <line x1="50"   y1="92" x2="13.6" y2="71"  className="hf4" stroke="#c4b5fd" strokeWidth="3.5" strokeLinecap="round"/>
                                            <line x1="13.6" y1="71" x2="13.6" y2="29"  className="hf5" stroke="#c4b5fd" strokeWidth="3.5" strokeLinecap="round"/>
                                            <line x1="13.6" y1="29" x2="50"   y2="8"   className="hf6" stroke="#c4b5fd" strokeWidth="3.5" strokeLinecap="round"/>
                                        </svg>
                                        </div>
                                    <p className="text-slate-400 uppercase font-black tracking-[0.3em] text-xs animate-pulse">Esperando Selección...</p>
                                </div>
                            )} 
                            {/* 2. VISTA: RAZONES (REASONS) */}
                            {inDraft && view === 'reasons' && selectedRecommendation && (
                                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="relative z-[300] flex flex-col gap-6 p-8 bg-[#020617] border border-slate-800 rounded-sm shadow-2xl backdrop-blur-md">
                                        <header className="flex items-center justify-between border-b border-slate-800 pb-6">
                                            <div className="flex gap-6 items-center">
                                                <div className="w-16 h-16 bg-slate-900 border-2 border-cyan-600 p-1 rounded-sm">
                                                    <img 
                                                    src={`https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${selectedRecommendation.id}.png`} 
                                                    className="w-full h-full object-cover" 
                                                    />
                                                </div>
                                                <div>
                                                    <h3 className="text-white font-black text-2xl uppercase tracking-tighter italic">
                                                        Análisis: <span className="text-cyan-500">{selectedRecommendation.name}</span>
                                                    </h3>
                                                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1">
                                                        Puntaje Estratégico: <span className="text-cyan-400">{selectedRecommendation.score.toFixed(1)}</span>
                                                    </p>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => setView(selectedRecommendation.type === 'ban' ? 'bans' : 'picks')} 
                                                className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-black uppercase text-[10px] tracking-widest rounded-sm transition-all border-none cursor-pointer"
                                                >
                                                Volver
                                            </button>
                                        </header>
                                    <div className="space-y-4">
                                        <h4 className="text-[10px] text-cyan-500 font-black uppercase tracking-[0.4em] italic">Desglose de Argumentos</h4>
                                        <div className="grid gap-3">
                                            {selectedRecommendation.reasons?.map((reason: string, idx: number) => (
                                                <div key={idx} className="flex items-center gap-4 p-4 bg-slate-900/40 border border-slate-800/50 rounded-sm group hover:border-cyan-900/50 transition-colors">
                                                <span className="text-cyan-600 font-bold text-xs">0{idx + 1}</span>
                                                <p className="text-sm text-slate-300 font-medium tracking-wide">
                                                    {reason}
                                                </p>
                                                </div>
                                            ))}
                                            {(!selectedRecommendation.reasons || selectedRecommendation.reasons.length === 0) && (
                                                <p className="text-slate-500 italic text-sm p-4">No hay razones detalladas para esta sugerencia.</p>
                                            )}
                                        </div>
                                    </div>
                                
                                    {/* Botón opcional para ver la build desde aquí */}
                                    <button 
                                        onClick={() => {
                                        setCurrentBuild(getSingleChampionBuild(selectedRecommendation.id));
                                        setView('build');
                                        }}
                                        className="mt-4 w-full py-4 bg-purple-600/10 hover:bg-purple-600/20 border border-purple-600/30 text-purple-400 font-black uppercase text-[10px] tracking-[0.3em] transition-all"
                                    >
                                        Ver Configuración de Build
                                    </button>
                                    </div>
                                </div> 
                            )} 
                            {/* 3. VISTA: CONSTRUCCIÓN (BUILD) */}
                            {inDraft && view === 'build' && currentBuild && (
                                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="relative z-[300] flex flex-col gap-8 p-10 bg-[#020617] border border-slate-800 rounded-sm shadow-2xl backdrop-blur-md">
                                        <div className="flex items-center justify-between border-b border-slate-800 pb-8">
                                            <div className="flex gap-8 items-center">
                                                <div className="relative flex items-center">
                                                    <div className="w-20 h-20 bg-slate-900 border-2 border-purple-600 p-2 rounded-sm shadow-lg">
                                                        <img src={getCDIcon(currentBuild?.build?.runes?.keystone?.icon)} className="w-full h-full object-contain" />
                                                    </div>
                                                    <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-slate-950 border border-slate-700 p-1.5 rounded-sm">
                                                        <img src={`https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/styles/${currentBuild?.build?.runes?.secondaryStyle === 8000 ? '7201_precision.png' : currentBuild?.build?.runes?.secondaryStyle === 8100 ? '7200_domination.png' : currentBuild?.build?.runes?.secondaryStyle === 8200 ? '7202_sorcery.png' : currentBuild?.build?.runes?.secondaryStyle === 8300 ? '7203_whimsy.png' : '7204_resolve.png'}`} className="w-full h-full object-contain" />
                                                    </div>
                                                </div>
                                                <div>
                                                    <h3 className="text-white font-black text-3xl uppercase tracking-tighter italic">{currentBuild?.name}</h3>
                                                    <div className="flex gap-4 mt-2">
                                                        <p className="text-[10px] text-green-500 font-black uppercase tracking-[0.2em]">Secuencia: {currentBuild?.build?.skillOrder}</p>
                                                        <span className="text-slate-800">|</span>
                                                        <p className="text-[10px] text-cyan-400 font-black uppercase tracking-[0.2em]">Sincronizado</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <button onClick={() => importToClient(currentBuild)} className="px-10 py-5 bg-purple-600 hover:bg-purple-500 text-white font-black uppercase text-[10px] tracking-[0.2em] rounded-sm transition-all shadow-xl border-none cursor-pointer active:scale-95">Re-Importar</button>
                                        </div>
                                        <div className="space-y-6">
                                            <h4 className="text-[10px] text-purple-500 font-black uppercase tracking-[0.4em] italic">Ruta de Armamento</h4>
                                            <div className="bg-slate-900/40 border border-slate-800 p-12 rounded-sm flex flex-wrap items-center justify-center">
                                                {currentBuild?.build?.items?.core.map((item: any, idx: number) => (
                                                    <div key={idx} className="flex items-center">
                                                        <div className="relative group/item">
                                                            <img src={`https://ddragon.leagueoflegends.com/cdn/16.9.1/img/item/${item.id}.png`} className="w-14 h-14 border border-slate-700 rounded-sm" />
                                                            <div className="absolute -top-2 -right-2 bg-slate-950 border border-slate-700 text-[8px] font-black px-1.5 py-0.5 rounded-sm text-slate-400">0{idx+1}</div>
                                                        </div>
                                                        {idx < currentBuild.build.items.core.length - 1 && <div className="px-5 text-slate-800"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="m9 18 6-6-6-6"></path></svg></div>}
                                                    </div>
                                                ))}
                                                <div className="h-14 w-[1px] bg-slate-800 mx-8"></div>
                                                <img src={`https://ddragon.leagueoflegends.com/cdn/16.9.1/img/item/${currentBuild?.build?.items?.boots?.id}.png`} className="w-14 h-14 border border-slate-700 rounded-sm" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )} 
                            {/* 4. VISTA: RECOMENDACIONES (GRID PRINCIPAL) */}
                            {inDraft && (view === 'picks' || view === 'bans') && (
                                <div className="grid grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-x-2 gap-y-4 pb-4 max-w-fit w-full mx-auto relative animate-in zoom-in-95">
                                    {(view === 'bans' ? banRecommendations : recommendations).map((rec: any) => (
                                        <div key={rec.id} onClick={() => { if (view !== 'bans') { setSelectedRecommendation(rec); setView('reasons'); } }}>
                                            <RecommendationCard {...rec} isBan={view === 'bans'} />
                                        </div>
                                    ))}
                                </div>
                                )
                            }
                        </div>

                        {/* SWITCHES */}
                        <div className="absolute bottom-6 left-0 w-full flex justify-center gap-12 z-50 pt-8 pb-2">
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <input type="checkbox" checked={autoPick} onChange={(e) => setAutoPick(e.target.checked)} className="hidden peer" />
                                <div className="w-5 h-5 border-2 border-slate-700 rounded-sm bg-slate-950 peer-checked:bg-purple-600 peer-checked:border-purple-600 transition-all flex items-center justify-center">
                                    <span className="text-white text-xs opacity-0 peer-checked:opacity-100">✓</span>
                                </div>
                                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 group-hover:text-slate-300">Autopick</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <input type="checkbox" checked={autoBan} onChange={(e) => setAutoBan(e.target.checked)} className="hidden peer" />
                                <div className="w-5 h-5 border-2 border-slate-700 rounded-sm bg-slate-950 peer-checked:bg-red-600 peer-checked:border-red-600 transition-all flex items-center justify-center">
                                    <span className="text-white text-xs opacity-0 peer-checked:opacity-100">✓</span>
                                </div>
                                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 group-hover:text-slate-300">Autoban</span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* ENEMIGOS */}
                <div className="w-72 shrink space-y-4 min-w-[200px] text-right">
                    <h3 className="text-red-500 font-black text-xs uppercase tracking-widest border-b border-slate-800 pb-3 flex items-center justify-end gap-2">Enemigos <span className="w-3 h-px bg-red-500"></span></h3>
                    {theirTeam.map((player, i) => <PlayerSlot key={`enemy-${i}`} player={player} isEnemy={true} />)}
                </div>
            </div>
        </div>
    );
};