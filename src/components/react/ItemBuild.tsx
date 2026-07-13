import React, { memo, useState, useEffect, useRef } from 'react';

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
    activePlaystyleIndex: number;
    setActivePlaystyleIndex: (index: number) => void;
    isCompact?: boolean;
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
    isCompact,
    onClick
}: {
    cluster: ScoredCluster;
    isActive: boolean;
    isCompact: boolean;
    onClick: () => void;
}) => {
    const isAp = cluster.damageType === 'AP';
    const isAd = cluster.damageType === 'AD';
    const typeKey = isAp ? 'AP' : isAd ? 'AD' : 'Hybrid';
    const colors = DAMAGE_COLORS[typeKey] || DAMAGE_COLORS.Hybrid;

    const tabStyle = isActive
        ? 'border rounded-sm border-border-warm/50 border-b-transparent tech-corners rounded-t-sm z-20 font-bold'
        : 'bg-panel-warm border border-border-warm rounded-t-sm opacity-65 hover:opacity-100';

    const keystone = cluster.build?.runes?.keystone;
    const coreItems = cluster.build?.items?.core || [];

    if (isCompact) {
        // Formato Ultra-Compacto Horizontal sin Nombre
        return (
            <button
                onClick={onClick}
                className={`flex items-center gap-2 p-1.5 px-3 transition-all duration-200 cursor-pointer shrink-0 ${tabStyle}`}
            >
                <div className="flex items-center gap-1">
                    {keystone?.icon && (
                        <img
                            src={keystone.icon}
                            className="w-[20px] h-[20px] rounded-full bg-slate-950 border border-purple-accent/30"
                            alt="keystone"
                            title={keystone.name}
                        />
                    )}
                    {keystone?.icon && coreItems.length > 0 && (
                        <div className="h-4 w-px bg-border-warm/30 mx-0.5"></div>
                    )}
                    {coreItems.slice(0, 2).map((item: any, idx: number) => (
                        <img
                            key={idx}
                            src={item.icon || `https://ddragon.leagueoflegends.com/cdn/16.9.1/img/item/${item.id}.png`}
                            className="w-[20px] h-[20px] rounded-sm border border-border-warm/60"
                            alt="core item"
                            title={item.name}
                        />
                    ))}
                </div>
                <span className="text-[10px] font-mono font-black text-slate-300 tabular-nums border-l border-border-warm/30 pl-2">
                    {cluster.score > 0 ? '+' : ''}{cluster.score.toFixed(1)}
                </span>
            </button>
        );
    }

    // Formato Detallado Vertical Completo
    return (
        <button
            onClick={onClick}
            className={`flex flex-col gap-0.5 p-1.5 px-2.5 transition-all duration-200 cursor-pointer text-left w-[145px] shrink-0 ${tabStyle}`}
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
                {keystone?.icon && (
                    <img
                        src={keystone.icon}
                        className="w-[22px] h-[22px] rounded-full bg-slate-950 border border-purple-accent/30"
                        alt="keystone"
                        title={keystone.name}
                    />
                )}
                {keystone?.icon && coreItems.length > 0 && (
                    <div className="h-4.5 w-px bg-border-warm/30 mx-0.5"></div>
                )}
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

export const ItemBuild = memo(({
    currentBuild,
    onReImport,
    inDraft,
    everyonePicked,
    activePlaystyleIndex,
    setActivePlaystyleIndex,
    isCompact = false
}: ItemBuildProps) => {
    const scoredClusters: ScoredCluster[] = currentBuild?.scoredClusters || [];

    if (inDraft && !everyonePicked) {
        return (
            <div className="h-full w-full flex items-center justify-center text-slate-400 font-bold uppercase tracking-wider text-[11px] text-center select-none">
                esperando que todos confirmen seleccion.
            </div>
        );
    }

    if (!currentBuild) return null;

    const clampedIndex = Math.min(activePlaystyleIndex, scoredClusters.length - 1);
    const activeCluster = scoredClusters[clampedIndex] ?? scoredClusters[0];
    const build = activeCluster ? activeCluster.build : currentBuild.build;
    const coreItemSwaps = activeCluster ? activeCluster.coreItemSwaps : currentBuild.coreItemSwaps;

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
        <div className="flex-1 min-h-0 flex flex-col gap-0">
            {/* Cabecera / Tabs */}
            <div className="flex justify-between items-end gap-3 shrink-0">
                {scoredClusters.length >= 1 ? (
                    <div className="flex gap-1 items-end flex-1 min-w-0 -mb-px z-10">
                        {scoredClusters.map((cluster, idx) => (
                            <ClusterTab
                                key={`cluster-tab-${cluster.pivotItem}-${idx}`}
                                cluster={cluster}
                                isActive={idx === clampedIndex}
                                isCompact={isCompact}
                                onClick={() => {
                                    setActivePlaystyleIndex(idx);
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

            {/* Panel de Contenido de la Build Activa */}
            <div className={`flex-grow p-3 md:p-4 bg-bg-warm/30 border border-border-warm/50 rounded-sm rounded-tl-none flex flex-col gap-4 overflow-hidden`}>
                <div className={`flex-1 min-h-0 overflow-y-auto scrollbar-tactical pr-2 flex flex-col  gap-5 pb-4 ${isCompact ? '' : "justify-center"}`}>

                    {/* Grid 2x2 Responsivo */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">

                        {/* Bloque [0,0]: Runas */}
                        {build?.runes && (
                            <div className="flex flex-col gap-2 min-w-0">
                                <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block text-center border-b border-border-warm/20 pb-1.5 mb-1 select-none">
                                    Runas
                                </span>
                                <div className="flex flex-wrap justify-center items-center gap-1.5 max-w-[225px] mx-auto w-full">
                                    {build.runes.keystone && (
                                        <div className="relative group shrink-0" title={build.runes.keystone.name}>
                                            <img
                                                src={build.runes.keystone.icon}
                                                className="w-10 h-10 rounded-full border border-purple-accent bg-slate-950 p-0.5 hover:scale-105 transition-transform duration-250"
                                                alt="keystone"
                                            />
                                        </div>
                                    )}

                                    <div className="h-6 w-px bg-border-warm/20 shrink-0"></div>

                                    <div className="flex gap-1 justify-center shrink-0">
                                        {build.runes.selections?.slice(1, 4).map((rune: any, idx: number) => rune && (
                                            <div key={`prim-${idx}`} className="relative group w-[30px] h-[30px]" title={rune.name}>
                                                <img
                                                    src={rune.icon}
                                                    className="w-full h-full rounded-full border border-border-warm/40 bg-slate-950/40 p-0.5 hover:border-purple-accent transition-colors"
                                                    alt="primary rune"
                                                />
                                            </div>
                                        ))}
                                    </div>

                                    <div className="h-6 w-px bg-border-warm/20 shrink-0"></div>

                                    <div className="flex gap-1 justify-center shrink-0">
                                        {build.runes.selections?.slice(4, 6).map((rune: any, idx: number) => rune && (
                                            <div key={`sec-${idx}`} className="relative group w-[30px] h-[30px]" title={rune.name}>
                                                <img
                                                    src={rune.icon}
                                                    className="w-full h-full rounded-full border border-border-warm/40 bg-slate-950/40 p-0.5 hover:border-purple-accent transition-colors"
                                                    alt="secondary rune"
                                                />
                                            </div>
                                        ))}
                                    </div>

                                    <div className="h-6 w-px bg-border-warm/20 shrink-0"></div>

                                    <div className="flex gap-0.5 justify-center shrink-0">
                                        {build.runes.shards?.map((shard: any, idx: number) => shard && (
                                            <div key={`shard-${idx}`} className="relative group w-[24px] h-[24px]" title={shard.name}>
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

                        {/* Bloque [0,1]: Objetos de Inicio y Botas */}
                        <div className="flex flex-col gap-2 min-w-0">
                            <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block text-center border-b border-border-warm/20 pb-1.5 mb-1 select-none">
                                Objetos de Inicio y Botas
                            </span>
                            <div className="flex flex-wrap justify-center items-center gap-2 max-w-[190px] mx-auto w-full">
                                {build?.items?.starter?.map((item: any, idx: number) => (
                                    <div key={`starter-${idx}`} className="relative group w-[40px] h-[40px]" title={item.name}>
                                        <img
                                            src={item.icon || `https://ddragon.leagueoflegends.com/cdn/16.9.1/img/item/${item.id}.png`}
                                            className="w-full h-full border border-border-warm/60 rounded-sm hover:border-purple-accent transition-colors cursor-default"
                                            alt="starter item"
                                        />
                                    </div>
                                ))}
                                {build?.items?.boots && (
                                    <div className="relative w-[40px] h-[40px]" title={build.items.boots.name}>
                                        <img
                                            src={build.items.boots.icon || `https://ddragon.leagueoflegends.com/cdn/16.9.1/img/item/${build.items.boots.id}.png`}
                                            className="w-full h-full border border-border-warm/60 rounded-sm hover:border-purple-accent transition-colors cursor-default"
                                            alt="boots"
                                        />
                                        <div className="absolute -top-1.5 -right-1.5 bg-input-warm border border-border-warm/60 text-[8px] font-black px-1 py-0.5 rounded-sm text-slate-400 select-none">
                                            B
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Bloque [1,0]: Core Build */}
                        <div className="flex flex-col gap-2 min-w-0">
                            <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block text-center border-b border-border-warm/20 pb-1.5 mb-1 select-none">
                                Core Build
                            </span>
                            <div className="flex flex-wrap justify-center items-center gap-2.5 max-w-[190px] mx-auto w-full">
                                {build?.items?.core?.map((item: any, idx: number) => (
                                    <div key={`core-${idx}`} className="relative w-[40px] h-[40px] group" title={item.name}>
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

                        {/* Bloque [1,1]: Objetos Situacionales */}
                        <div className="flex flex-col gap-2 min-w-0">
                            <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block text-center border-b border-border-warm/20 pb-1.5 mb-1 select-none">
                                Objetos Situacionales
                            </span>
                            <div className="flex flex-wrap justify-center items-center gap-2 max-w-[190px] mx-auto w-full">
                                {finalSituational.slice(0, 10).map((item: any, idx: number) => (
                                    <div key={`situational-${idx}`} className="relative w-[38px] h-[38px] group" title={item.name}>
                                        <img
                                            src={item.icon || `https://ddragon.leagueoflegends.com/cdn/16.9.1/img/item/${item.id}.png`}
                                            className="w-full h-full border border-border-warm/40 rounded-sm hover:border-purple-accent transition-colors cursor-default"
                                            alt={item.name}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Botón Re-Importar como fila del Grid (col-span-2) */}
                        <div className="col-span-1 md:col-span-2 flex justify-center items-center w-full mt-3 pt-3  shrink-0">
                            <button
                                onClick={() => onReImport({
                                    name: activeCluster?.title
                                        ? `${currentBuild.name} ${activeCluster.title.replace(/[()]/g, '').trim().toLowerCase()}`
                                        : currentBuild.name,
                                    id: currentBuild.id,
                                    build: build,
                                    coreItemSwaps: coreItemSwaps
                                })}
                                className="px-6 py-2 bg-panel-warm tech-corners rounded-sm border border-border-warm/60 hover:bg-[#9055ff]/10 hover:border-[#9055ff]/80 hover:text-[#d3c0ff] text-slate-200 font-extrabold uppercase text-[10px] tracking-widest transition-all duration-200 cursor-pointer active:scale-95 shrink-0"
                            >
                                Re-Importar
                            </button>
                        </div>

                    </div>

                </div>
            </div>
        </div>
    );
});

ItemBuild.displayName = 'ItemBuild';

export default ItemBuild;