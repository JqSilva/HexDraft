import React, { memo, useState, useEffect } from 'react';

interface ScoredCluster {
    pivotItem: number;
    damageType: 'AD' | 'AP' | 'Hybrid';
    totalPickrate: number;
    weightedWinrate: number;
    score: number;
    isWinner: boolean;
    title: string;
    build: any;
    coreItemSwaps: any[];
}

interface ItemBuildProps {
    currentBuild: any;
    onReImport: (activeBuildData?: any) => void;
    inDraft?: boolean;
    everyonePicked?: boolean;
}

const COMMON_SITUATIONAL_ITEMS = [
    { id: 3165, name: "Morellonomicón" },
    { id: 3033, name: "Recordatorio Mortal" },
    { id: 3075, name: "Cota de Espinas" },
    { id: 3135, name: "Bastón del Vacío" },
    { id: 3036, name: "Recuerdos de Lord Dominik" },
    { id: 3157, name: "Reloj de Arena de Zhonya" },
    { id: 3026, name: "Ángel Guardián" },
    { id: 6657, name: "Rookern Kaénico" },
    { id: 3156, name: "Fauces de Malmortius" }
];

const DAMAGE_COLORS: Record<string, { accent: string; title: string }> = {
    AD: {
        accent: 'border-amber-500/30 bg-amber-500/5 hover:border-amber-500/60',
        title: 'text-amber-400'
    },
    AP: {
        accent: 'border-blue-500/30 bg-blue-500/5 hover:border-blue-500/60',
        title: 'text-blue-400'
    },
    Hybrid: {
        accent: 'border-purple-500/30 bg-purple-500/5 hover:border-purple-500/60',
        title: 'text-purple-400'
    },
};

const ClusterTab = ({
    cluster,
    isActive,
    onClick
}: {
    cluster: any;
    isActive: boolean;
    onClick: () => void;
}) => {
    const isAp = cluster.damageType === 'AP';
    const isAd = cluster.damageType === 'AD';
    const typeKey = isAp ? 'AP' : isAd ? 'AD' : 'Hybrid';
    const colors = DAMAGE_COLORS[typeKey] || DAMAGE_COLORS.Hybrid;

    const tabStyle = isActive
        ? 'bg-bg-warm/30 border border-border-warm/50 border-b-transparent tech-corners rounded-t-sm z-20 font-bold'
        : 'bg-panel-warm border border-border-warm rounded-t-sm opacity-65 hover:opacity-100';

    const keystone = cluster.build?.runes?.keystone;
    const coreItems = cluster.build?.items?.core || [];

    return (
        <button
            onClick={onClick}
            className={`flex flex-col gap-0.5 p-1.5 px-2.5 transition-all duration-200 cursor-pointer text-left flex-1 min-w-0 ${tabStyle}`}
        >
            <div className="flex justify-between items-center w-full gap-1.5">
                <span className={`text-[10px] font-black uppercase tracking-wider ${colors.title} truncate max-w-[90px]`}>
                    {cluster.title || (isAp ? 'AP' : isAd ? 'AD' : 'Híbrido')}
                </span>
                <span className="text-[10.5px] font-mono font-black text-slate-400 tabular-nums">
                    {cluster.score > 0 ? '+' : ''}{cluster.score.toFixed(2)}
                </span>
            </div>

            {/* Icons row */}
            <div className="flex items-center gap-1.5 mt-0.5">
                {/* Keystone Rune Icon */}
                {keystone?.icon && (
                    <img
                        src={keystone.icon}
                        className="w-[22px] h-[22px] rounded-full bg-slate-950 border border-purple-accent/30"
                        alt="keystone"
                        title={keystone.name}
                    />
                )}
                {/* separator if runes & items both exist */}
                {keystone?.icon && coreItems.length > 0 && (
                    <div className="h-4.5 w-px bg-border-warm/30 mx-0.5"></div>
                )}
                {/* First 2 Core Item Icons */}
                {coreItems.slice(0, 2).map((item: any, idx: number) => (
                    <img
                        key={idx}
                        src={item.icon || `https://ddragon.leagueoflegends.com/cdn/16.9.1/img/item/${item.id}.png`}
                        className="w-[22px] h-[22px] rounded-sm border border-border-warm/60"
                        alt="core item"
                        title={item.name}
                    />
                ))}
            </div>
        </button>
    );
};

export const ItemBuild = memo(({ currentBuild, onReImport, inDraft, everyonePicked }: ItemBuildProps) => {
    const scoredClusters: ScoredCluster[] = currentBuild?.scoredClusters || [];
    const [activeTabKey, setActiveTabKey] = useState<string | null>(null);
    const [isManualSelection, setIsManualSelection] = useState(false);

    // Reset tab selections when champion changes
    useEffect(() => {
        setIsManualSelection(false);
        if (scoredClusters.length > 0) {
            setActiveTabKey(scoredClusters[0].title);
        } else {
            setActiveTabKey(null);
        }
    }, [currentBuild?.name]);

    // Reactively follow the new winner if user hasn't made a manual selection
    useEffect(() => {
        if (!isManualSelection && scoredClusters.length > 0) {
            setActiveTabKey(scoredClusters[0].title);
        }
    }, [scoredClusters, isManualSelection]);

    if (!currentBuild) return null;

    const activeCluster = scoredClusters.find(c => c.title === activeTabKey) || scoredClusters[0];
    const build = activeCluster ? activeCluster.build : currentBuild.build;
    const coreItemSwaps = activeCluster ? activeCluster.coreItemSwaps : currentBuild.coreItemSwaps;

    // Compile flat situational items list
    const situationalItemsList: any[] = [];
    const seen = new Set();
    if (build?.items?.paths) {
        const allPaths = [
            ...(build.items.paths.snowball || []),
            ...(build.items.paths.neutral || []),
            ...(build.items.paths.behind || [])
        ];
        allPaths.forEach((item: any) => {
            if (item && !seen.has(item.id)) {
                seen.add(item.id);
                situationalItemsList.push(item);
            }
        });
    }

    const finalSituational = situationalItemsList.length > 0
        ? situationalItemsList
        : COMMON_SITUATIONAL_ITEMS.map(item => ({
            id: item.id,
            name: item.name,
            icon: `https://ddragon.leagueoflegends.com/cdn/16.9.1/img/item/${item.id}.png`
        }));

    return (
        <div className="h-full flex flex-col gap-0">
            {/* Cabecera / Tabs */}
            <div className="flex justify-between items-end gap-3 shrink-0">
                {/* Selector de Clusters / Tabs (max 4) */}
                {scoredClusters.length >= 2 ? (
                    <div className="flex gap-1 items-end flex-1 min-w-0 -mb-px z-10">
                        {scoredClusters.map((cluster, idx) => (
                            <ClusterTab
                                key={`cluster-tab-${idx}`}
                                cluster={cluster}
                                isActive={cluster.title === activeCluster?.title}
                                onClick={() => {
                                    setActiveTabKey(cluster.title);
                                    setIsManualSelection(true);
                                }}
                            />
                        ))}
                    </div>
                ) : (
                    <h4 className="text-[11px] text-purple-accent font-black uppercase tracking-[0.3em] italic pb-2 pl-2">
                        Build Recomendada
                    </h4>
                )}
            </div>

            {/* Panel de Contenido de la Build Activa (sin scrollbar) */}
            <div className="flex-grow p-2 bg-bg-warm/30 border border-border-warm/50 rounded-sm rounded-tl-none flex flex-col gap-6 overflow-hidden">
                {/* Banner de Estado del Draft */}
                {inDraft && (
                    <div className={`py-1 px-3 text-center text-[9px] uppercase font-bold tracking-[0.15em] border rounded-sm flex items-center justify-center gap-2 select-none shrink-0 ${
                        everyonePicked
                            ? 'bg-emerald-950/20 border-emerald-500/25 text-emerald-400'
                            : 'bg-amber-950/20 border-amber-500/25 text-amber-400 animate-pulse'
                    }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${
                            everyonePicked 
                                ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' 
                                : 'bg-amber-400 shadow-[0_0_6px_#fbbf24] animate-pulse'
                        }`} />
                        <span>
                            {everyonePicked 
                                ? 'Draft completo: Análisis finalizado e importado con éxito' 
                                : 'Esperando selecciones: Adaptando build en tiempo real'}
                        </span>
                    </div>
                )}
                {/* 1. RUNAS */}
                {build?.runes && (
                    <div className="py-0.5 px-2 flex flex-col mt-2 gap-1.5 shrink-0">
                        <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block text-center w-full">
                            Runas
                        </span>
                        <div className="flex items-center justify-center gap-2 flex-wrap w-full">
                            {/* Keystone */}
                            {build.runes.keystone && (
                                <div className="relative group shrink-0" title={build.runes.keystone.name}>
                                    <img
                                        src={build.runes.keystone.icon}
                                        className="w-12 h-12 rounded-full border border-purple-accent bg-slate-950 p-0.5 hover:scale-105 transition-transform duration-250"
                                        alt="keystone"
                                    />
                                </div>
                            )}

                            <div className="h-8 w-px bg-border-warm/30 shrink-0"></div>

                            {/* Primary Selections */}
                            <div className="flex gap-1.5 justify-center shrink-0">
                                {build.runes.selections?.slice(1, 4).map((rune: any, idx: number) => rune && (
                                    <div key={`prim-${idx}`} className="relative group w-[38px] h-[38px]" title={rune.name}>
                                        <img
                                            src={rune.icon}
                                            className="w-full h-full rounded-full border border-border-warm/40 bg-slate-950/40 p-0.5 hover:border-purple-accent transition-colors"
                                            alt="primary rune"
                                        />
                                    </div>
                                ))}
                            </div>

                            <div className="h-8 w-px bg-border-warm/30 shrink-0"></div>

                            {/* Secondary Selections */}
                            <div className="flex gap-1.5 justify-center shrink-0">
                                {build.runes.selections?.slice(4, 6).map((rune: any, idx: number) => rune && (
                                    <div key={`sec-${idx}`} className="relative group w-[38px] h-[38px]" title={rune.name}>
                                        <img
                                            src={rune.icon}
                                            className="w-full h-full rounded-full border border-border-warm/40 bg-slate-950/40 p-0.5 hover:border-purple-accent transition-colors"
                                            alt="secondary rune"
                                        />
                                    </div>
                                ))}
                            </div>

                            <div className="h-8 w-px bg-border-warm/30 shrink-0"></div>

                            {/* Shards */}
                            <div className="flex gap-1 justify-center shrink-0">
                                {build.runes.shards?.map((shard: any, idx: number) => shard && (
                                    <div key={`shard-${idx}`} className="relative group w-[34px] h-[34px]" title={shard.name}>
                                        <img
                                            src={shard.icon}
                                            className="w-full h-full rounded-full border border-border-warm/30 bg-slate-950/80 p-0.5 hover:border-purple-accent transition-colors"
                                            alt="shard"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. BUILD COMPLETA */}
                <div className=" py-0.5 px-2 flex flex-col gap-2.5 shrink-0">
                    <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block text-center w-full">
                        Objetos de Inicio y Core Build
                    </span>
                    <div className="flex flex-wrap gap-1 items-center justify-center w-full">
                        {/* Iniciales / Starter */}
                        {build?.items?.starter && build.items.starter.length > 0 && (
                            <>
                                <div className="flex gap-1.5 justify-center">
                                    {build.items.starter.map((item: any, idx: number) => (
                                        <div key={`starter-${idx}`} className="relative group w-[45px] h-[45px]" title={item.name}>
                                            <img
                                                src={item.icon || `https://ddragon.leagueoflegends.com/cdn/16.9.1/img/item/${item.id}.png`}
                                                className="w-full h-full border border-border-warm/60 rounded-sm hover:border-purple-accent transition-colors cursor-default"
                                                alt="starter item"
                                            />
                                        </div>
                                    ))}
                                </div>
                                <div className="h-9 w-px bg-border-warm/30 mx-1 shrink-0"></div>
                            </>
                        )}

                        {/* Botas */}
                        {build?.items?.boots && (
                            <>
                                <div className="relative w-12 h-12 shrink-0" title={build.items.boots.name}>
                                    <img
                                        src={build.items.boots.icon || `https://ddragon.leagueoflegends.com/cdn/16.9.1/img/item/${build.items.boots.id}.png`}
                                        className="w-full h-full border border-border-warm/60 rounded-sm hover:border-purple-accent transition-colors cursor-default"
                                        alt="boots"
                                    />
                                    <div className="absolute -top-1.5 -right-1.5 bg-input-warm border border-border-warm/60 text-[8px] font-black px-1 py-0.5 rounded-sm text-slate-400 select-none">
                                        B
                                    </div>
                                </div>
                                <div className="h-9 w-px bg-border-warm/30 mx-1 shrink-0"></div>
                            </>
                        )}

                        {/* Core Items */}
                        <div className="flex gap-1.5 justify-center">
                            {build?.items?.core?.map((item: any, idx: number) => (
                                <div key={`core-${idx}`} className="relative w-12 h-12 group" title={item.name}>
                                    <img
                                        src={item.icon || `https://ddragon.leagueoflegends.com/cdn/16.9.1/img/item/${item.id}.png`}
                                        className="w-full h-full border border-border-warm/60 rounded-sm hover:border-purple-accent transition-colors cursor-default"
                                        alt="core item"
                                    />
                                    <div className="absolute -top-1.5 -right-1.5 bg-input-warm border border-border-warm/60 text-[8px] font-black px-1 py-0.5 rounded-sm text-slate-400 select-none">
                                        0{idx + 1}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 3. OBJETOS SITUACIONALES */}
                <div className="py-0.5 px-2 flex flex-col gap-2.5 shrink-0">
                    <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block text-center w-full">
                        Objetos Situacionales
                    </span>
                    <div className="flex flex-wrap gap-1.5 items-center justify-center w-full">
                        {finalSituational.map((item: any, idx: number) => (
                            <div key={`situational-${idx}`} className="relative w-[42px] h-[42px] group" title={item.name}>
                                <img
                                    src={item.icon || `https://ddragon.leagueoflegends.com/cdn/16.9.1/img/item/${item.id}.png`}
                                    className="w-full h-full border border-border-warm/40 rounded-sm hover:border-purple-accent transition-colors cursor-default"
                                    alt={item.name}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Botón Re-Importar Centrado al Final con mt-auto */}
                <div className="flex justify-center items-center  shrink-0">
                    <button
                        onClick={() => onReImport({
                            name: activeCluster?.title ? `${currentBuild.name} (${activeCluster.title})` : currentBuild.name,
                            id: currentBuild.id,
                            build: build,
                            coreItemSwaps: coreItemSwaps
                        })}
                        className="px-6 py-1.5 bg-panel-warm tech-corners rounded-sm border-border-warm/60 hover:bg-[#9055ff] text-white font-black uppercase text-[10px] tracking-widest transition-all duration-200 cursor-pointer active:scale-95 shrink-0"
                    >
                        Re-Importar
                    </button>
                </div>
            </div>
        </div>
    );
});

export default ItemBuild;
