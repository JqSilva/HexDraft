import React, { memo } from 'react';

interface ItemBuildProps {
    currentBuild: any;
    onReImport: () => void;
}

export const ItemBuild = memo(({ currentBuild, onReImport }: ItemBuildProps) => {
    return (
        <div className="p-6 bg-bg-warm border border-border-warm rounded-sm tech-corners">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                    <h4 className="text-[12px] text-purple-accent font-black uppercase tracking-[0.3em] italic">
                        Build Recomendada
                    </h4>
                    {currentBuild?.isAdapted && (
                        <span className="text-[9px] bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 font-bold px-2 py-0.5 rounded-sm select-none animate-pulse">
                            ★ Adaptado al Matchup
                        </span>
                    )}
                </div>
                <button
                    onClick={onReImport}
                    className="px-6 py-2 bg-purple-accent hover:bg-purple-accent-hover text-white font-black uppercase text-[10px] tracking-widest rounded-sm transition-all duration-200 cursor-pointer active:scale-95 border-none"
                >
                    Re-Importar
                </button>
            </div>

            {/* Fila del Core Build (Starter + Boots + 3 Core Items) */}
            <div className="flex flex-wrap gap-4 items-center justify-center bg-input-warm/50 p-6 rounded-sm border border-border-warm mb-6">
                {/* Iniciales / Starter */}
                {currentBuild?.build?.items?.starter && currentBuild.build.items.starter.length > 0 && (
                    <>
                        <div className="flex gap-2">
                            {currentBuild.build.items.starter.map((item: any, idx: number) => (
                                <div key={`starter-${idx}`} className="relative group" title={item.name}>
                                    <img
                                        src={item.icon || `https://ddragon.leagueoflegends.com/cdn/16.9.1/img/item/${item.id}.png`}
                                        className="w-10 h-10 border border-border-warm rounded-sm hover:border-purple-accent transition-colors duration-200 cursor-default"
                                        alt="starter item"
                                    />
                                    <div className="absolute -top-1.5 -right-1.5 bg-input-warm border border-border-warm text-[6px] font-black px-1 py-0.5 rounded-sm text-slate-400">
                                        Ini
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="h-8 w-px bg-border-warm mx-1"></div>
                    </>
                )}
                
                {/* Botas */}
                {currentBuild?.build?.items?.boots && (
                    <>
                        <div className="relative" title={currentBuild.build.items.boots.name}>
                            <img
                                src={currentBuild.build.items.boots.icon || `https://ddragon.leagueoflegends.com/cdn/16.9.1/img/item/${currentBuild.build.items.boots.id}.png`}
                                className="w-12 h-12 border border-border-warm rounded-sm hover:border-purple-accent transition-colors duration-200 cursor-default"
                                alt="boots"
                            />
                            <div className="absolute -top-1.5 -right-1.5 bg-input-warm border border-border-warm text-[8px] font-black px-1 py-0.5 rounded-sm text-slate-400">
                                B
                            </div>
                        </div>
                        <div className="h-10 w-px bg-border-warm mx-1"></div>
                    </>
                )}

                {/* Core Items */}
                <div className="flex gap-3">
                    {currentBuild?.build?.items?.core.map((item: any, idx: number) => (
                        <div key={`core-${idx}`} className="relative group" title={item.name}>
                            <img
                                src={item.icon || `https://ddragon.leagueoflegends.com/cdn/16.9.1/img/item/${item.id}.png`}
                                className="w-12 h-12 border border-border-warm rounded-sm hover:border-purple-accent transition-colors duration-200 cursor-default"
                                alt="core item"
                            />
                            <div className="absolute -top-1.5 -right-1.5 bg-input-warm border border-border-warm text-[8px] font-black px-1 py-0.5 rounded-sm text-slate-400">
                                0{idx + 1}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Justificación de Botas y Evolución de Item de Soporte */}
            {(currentBuild?.bootsSelection || currentBuild?.supportEvolution) && (
                <div className={`grid grid-cols-1 ${currentBuild?.bootsSelection && currentBuild?.supportEvolution ? 'md:grid-cols-2' : ''} gap-4 mb-6`}>
                    {currentBuild?.bootsSelection && currentBuild?.build?.items?.boots && (
                        <div className="p-4 bg-purple-950/20 border border-purple-800/25 rounded-sm tech-corners animate-in fade-in duration-300 flex items-center gap-3">
                            <img 
                                src={currentBuild.build.items.boots.icon || `https://ddragon.leagueoflegends.com/cdn/16.9.1/img/item/${currentBuild.build.items.boots.id}.png`} 
                                className="w-9 h-9 rounded-sm border border-purple-500/30 flex-shrink-0"
                                alt={currentBuild.build.items.boots.name}
                            />
                            <div>
                                <span className="text-[9px] text-[#9055ff] font-black uppercase tracking-wider block">Adaptación de Botas: {currentBuild.build.items.boots.name}</span>
                                <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">{currentBuild.bootsSelection.reason}</p>
                            </div>
                        </div>
                    )}

                    {currentBuild?.supportEvolution && (
                        <div className="p-4 bg-cyan-950/20 border border-cyan-800/25 rounded-sm tech-corners animate-in fade-in duration-300 flex items-center gap-3">
                            <img 
                                src={currentBuild.supportEvolution.item?.icon || `https://ddragon.leagueoflegends.com/cdn/16.9.1/img/item/${currentBuild.supportEvolution.item?.id}.png`} 
                                className="w-9 h-9 rounded-sm border border-cyan-500/30 flex-shrink-0"
                                alt={currentBuild.supportEvolution.item?.name}
                            />
                            <div>
                                <span className="text-[9px] text-[#00d2ff] font-black uppercase tracking-wider block">Evolución de Soporte: {currentBuild.supportEvolution.item?.name}</span>
                                <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">{currentBuild.supportEvolution.reason}</p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Reemplazos de Items Core Sugeridos */}
            {currentBuild?.coreItemSwaps && currentBuild.coreItemSwaps.length > 0 && (
                <div className="mb-6 border border-amber-900/30 bg-amber-950/10 p-4 rounded-sm tech-corners animate-in fade-in duration-300">
                    <span className="text-[9px] text-amber-400 font-black uppercase tracking-wider block mb-3">
                        ⚠️ Reemplazos Sugeridos (Adaptación Situacional)
                    </span>
                    <div className="space-y-4">
                        {currentBuild.coreItemSwaps.map((swap: any, idx: number) => (
                            <div key={`swap-${idx}`} className="flex flex-col gap-2 p-3 bg-slate-900/30 border border-border-warm/30 rounded-sm">
                                <div className="flex items-center gap-3">
                                    {/* Item Reemplazado */}
                                    <div className="flex items-center gap-2 opacity-50">
                                        <img 
                                            src={swap.replaceItem.icon || `https://ddragon.leagueoflegends.com/cdn/16.9.1/img/item/${swap.replaceItem.id}.png`} 
                                            className="w-7 h-7 rounded-sm border border-red-500/25 animate-pulse"
                                            alt={swap.replaceItem.name} 
                                        />
                                        <span className="text-[10px] text-red-400 line-through font-bold">{swap.replaceItem.name}</span>
                                    </div>
                                    <span className="text-slate-500 text-xs">➔</span>
                                    {/* Item Nuevo */}
                                    <div className="flex items-center gap-2">
                                        <img 
                                            src={swap.withItem.icon || `https://ddragon.leagueoflegends.com/cdn/16.9.1/img/item/${swap.withItem.id}.png`} 
                                            className="w-7 h-7 rounded-sm border border-green-500/30"
                                            alt={swap.withItem.name} 
                                        />
                                        <span className="text-[10px] text-green-400 font-bold">{swap.withItem.name}</span>
                                    </div>
                                    {/* Prioridad Badge */}
                                    <span className={`ml-auto text-[8px] font-black uppercase px-2 py-0.5 rounded-sm border ${
                                        swap.priority === 'critical' 
                                            ? 'bg-red-950/40 border-red-500/40 text-red-400' 
                                            : 'bg-amber-950/40 border-amber-500/40 text-amber-400'
                                    }`}>
                                        {swap.priority === 'critical' ? 'Crítico' : 'Recomendado'}
                                    </span>
                                </div>
                                <p className="text-[10px] text-slate-300 italic pl-1">
                                    "{swap.reason}"
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Bifurcaciones de Continuación (Siempre se visualizan) */}
            {currentBuild?.build?.items?.paths && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-border-warm pt-6">
                    {/* Si vas bien */}
                    <div className="flex flex-col items-center bg-input-warm/20 p-4 rounded-sm border border-border-warm/50 tech-corners">
                        <span className="text-[9px] text-green-400 font-bold uppercase tracking-wider mb-3 flex items-center gap-1">
                            📈 Si vas bien (Snowball)
                        </span>
                        <div className="flex gap-3">
                            {currentBuild.build.items.paths.snowball?.map((item: any, idx: number) => (
                                <div key={`snowball-${idx}`} className="relative group animate-in fade-in zoom-in-95" title={item.name}>
                                    <img
                                        src={item.icon || `https://ddragon.leagueoflegends.com/cdn/16.9.1/img/item/${item.id}.png`}
                                        className="w-11 h-11 border border-border-warm rounded-sm hover:border-green-400 transition-colors duration-200 cursor-default"
                                        alt="snowball item"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Si vas normal */}
                    <div className="flex flex-col items-center bg-input-warm/20 p-4 rounded-sm border border-border-warm/50 tech-corners">
                        <span className="text-[9px] text-[#9055ff] font-bold uppercase tracking-wider mb-3 flex items-center gap-1">
                            ⚖️ Si vas normal
                        </span>
                        <div className="flex gap-3">
                            {currentBuild.build.items.paths.neutral?.map((item: any, idx: number) => (
                                <div key={`neutral-${idx}`} className="relative group animate-in fade-in zoom-in-95" title={item.name}>
                                    <img
                                        src={item.icon || `https://ddragon.leagueoflegends.com/cdn/16.9.1/img/item/${item.id}.png`}
                                        className="w-11 h-11 border border-border-warm rounded-sm hover:border-purple-accent transition-colors duration-200 cursor-default"
                                        alt="neutral item"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Si vas mal */}
                    <div className="flex flex-col items-center bg-input-warm/20 p-4 rounded-sm border border-border-warm/50 tech-corners">
                        <span className="text-[9px] text-red-400 font-bold uppercase tracking-wider mb-3 flex items-center gap-1">
                            🛡️ Si vas mal (Defensivo)
                        </span>
                        <div className="flex gap-3">
                            {currentBuild.build.items.paths.behind?.map((item: any, idx: number) => (
                                <div key={`behind-${idx}`} className="relative group animate-in fade-in zoom-in-95" title={item.name}>
                                    <img
                                        src={item.icon || `https://ddragon.leagueoflegends.com/cdn/16.9.1/img/item/${item.id}.png`}
                                        className="w-11 h-11 border border-border-warm rounded-sm hover:border-red-400 transition-colors duration-200 cursor-default"
                                        alt="behind item"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});

export default ItemBuild;
