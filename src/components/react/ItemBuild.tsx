import React, { memo } from 'react';

interface ItemBuildProps {
    currentBuild: any;
    onReImport: () => void;
}

export const ItemBuild = memo(({ currentBuild, onReImport }: ItemBuildProps) => {
    return (
        <div className="p-3.5 bg-bg-warm/30 border border-border-warm/50 rounded-sm tech-corners h-full flex flex-col justify-between gap-2.5">
            <div className="space-y-2.5">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <h4 className="text-[11px] text-purple-accent font-black uppercase tracking-[0.3em] italic">
                            Build Recomendada
                        </h4>
                        {currentBuild?.isAdapted && (
                            <span className="text-[9px] bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 font-bold px-2 py-0.5 rounded-sm select-none">
                                Adaptado al Matchup
                            </span>
                        )}
                    </div>
                    <button
                        onClick={onReImport}
                        className="px-4 py-1.5 bg-purple-accent hover:bg-purple-accent-hover text-white font-black uppercase text-[10px] tracking-widest rounded-sm transition-all duration-200 cursor-pointer active:scale-95 border-none shrink-0"
                    >
                        Re-Importar
                    </button>
                </div>

                {/* Fila del Core Build (Starter + Boots + Core Items) */}
                <div className="flex flex-wrap gap-2 items-center justify-center bg-input-warm/30 p-3 rounded-sm border border-border-warm/40">
                    {/* Iniciales / Starter */}
                    {currentBuild?.build?.items?.starter && currentBuild.build.items.starter.length > 0 && (
                        <>
                            <div className="flex gap-2">
                                {currentBuild.build.items.starter.map((item: any, idx: number) => (
                                    <div key={`starter-${idx}`} className="relative group" title={item.name}>
                                        <img
                                            src={item.icon || `https://ddragon.leagueoflegends.com/cdn/16.9.1/img/item/${item.id}.png`}
                                            className="w-10 h-10 border border-border-warm/60 rounded-sm hover:border-purple-accent transition-colors cursor-default"
                                            alt="starter item"
                                        />
                                        <div className="absolute -top-1.5 -right-1.5 bg-input-warm border border-border-warm/60 text-[7px] font-black px-1 py-0.5 rounded-sm text-slate-400">
                                            Ini
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="h-8 w-px bg-border-warm/40 mx-1"></div>
                        </>
                    )}
                    
                    {/* Botas */}
                    {currentBuild?.build?.items?.boots && (
                        <>
                            <div className="relative" title={currentBuild.build.items.boots.name}>
                                <img
                                    src={currentBuild.build.items.boots.icon || `https://ddragon.leagueoflegends.com/cdn/16.9.1/img/item/${currentBuild.build.items.boots.id}.png`}
                                    className="w-11 h-11 border border-border-warm/60 rounded-sm hover:border-purple-accent transition-colors cursor-default"
                                    alt="boots"
                                />
                                <div className="absolute -top-1.5 -right-1.5 bg-input-warm border border-border-warm/60 text-[8px] font-black px-1 py-0.5 rounded-sm text-slate-400">
                                    B
                                </div>
                            </div>
                            <div className="h-10 w-px bg-border-warm/40 mx-1"></div>
                        </>
                    )}

                    {/* Core Items */}
                    <div className="flex gap-2.5">
                        {currentBuild?.build?.items?.core.map((item: any, idx: number) => (
                            <div key={`core-${idx}`} className="relative group" title={item.name}>
                                <img
                                    src={item.icon || `https://ddragon.leagueoflegends.com/cdn/16.9.1/img/item/${item.id}.png`}
                                    className="w-11 h-11 border border-border-warm/60 rounded-sm hover:border-purple-accent transition-colors cursor-default"
                                    alt="core item"
                                />
                                <div className="absolute -top-1.5 -right-1.5 bg-input-warm border border-border-warm/60 text-[8px] font-black px-1 py-0.5 rounded-sm text-slate-400">
                                    0{idx + 1}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Justificación de Botas y Evolución de Item de Soporte */}
                {(currentBuild?.bootsSelection || currentBuild?.supportEvolution) && (
                    <div className="flex flex-col gap-2.5 px-1">
                        {currentBuild?.bootsSelection && currentBuild?.build?.items?.boots && (
                            <div className="text-[11px] md:text-xs text-slate-300 leading-relaxed">
                                <span className="text-[#9055ff] font-bold uppercase tracking-wider block mb-0.5">Adaptación de Botas: {currentBuild.build.items.boots.name}</span>
                                <span>{currentBuild.bootsSelection.reason}</span>
                            </div>
                        )}

                        {currentBuild?.supportEvolution && (
                            <div className="text-[11px] md:text-xs text-slate-300 leading-relaxed">
                                <span className="text-[#00d2ff] font-bold uppercase tracking-wider block mb-0.5">Evolución de Soporte: {currentBuild.supportEvolution.item?.name}</span>
                                <span>{currentBuild.supportEvolution.reason}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Reemplazos de Items Core Sugeridos */}
                {currentBuild?.coreItemSwaps && currentBuild.coreItemSwaps.length > 0 && (
                    <div className="border-t border-border-warm/30 pt-3 px-1">
                        <span className="text-[10px] text-amber-500 font-black uppercase tracking-wider block mb-2">
                            Reemplazos Sugeridos (Situacionales)
                        </span>
                        <div className="space-y-2">
                            {currentBuild.coreItemSwaps.slice(0, 1).map((swap: any, idx: number) => (
                                <div key={`swap-${idx}`} className="text-xs text-slate-300 py-1 border-b border-border-warm/10 last:border-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-red-400 font-bold line-through">{swap.replaceItem.name}</span>
                                        <span className="text-slate-500 text-[10px]">➔</span>
                                        <span className="text-green-400 font-bold">{swap.withItem.name}</span>
                                    </div>
                                    <p className="text-[11px] text-slate-400 italic">"{swap.reason}"</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Bifurcaciones de Continuación */}
            {currentBuild?.build?.items?.paths && (
                <div className="grid grid-cols-3 gap-2 border-t border-border-warm/30 pt-2 shrink-0">
                    {/* Si vas bien */}
                    <div className="flex flex-col items-center bg-input-warm/10 p-2 rounded-sm border border-border-warm/20">
                        <span className="text-[8px] text-green-400 font-bold uppercase tracking-wider mb-1.5 text-center">
                            Si vas bien
                        </span>
                        <div className="flex gap-1.5">
                            {currentBuild.build.items.paths.snowball?.slice(0, 3).map((item: any, idx: number) => (
                                <div key={`snowball-${idx}`} className="relative group" title={item.name}>
                                    <img
                                        src={item.icon || `https://ddragon.leagueoflegends.com/cdn/16.9.1/img/item/${item.id}.png`}
                                        className="w-9 h-9 border border-border-warm/40 rounded-sm hover:border-green-400 transition-colors"
                                        alt="snowball item"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Si vas normal */}
                    <div className="flex flex-col items-center bg-input-warm/10 p-2 rounded-sm border border-border-warm/20">
                        <span className="text-[8px] text-[#9055ff] font-bold uppercase tracking-wider mb-1.5 text-center">
                            Si vas normal
                        </span>
                        <div className="flex gap-1.5">
                            {currentBuild.build.items.paths.neutral?.slice(0, 3).map((item: any, idx: number) => (
                                <div key={`neutral-${idx}`} className="relative group" title={item.name}>
                                    <img
                                        src={item.icon || `https://ddragon.leagueoflegends.com/cdn/16.9.1/img/item/${item.id}.png`}
                                        className="w-9 h-9 border border-border-warm/40 rounded-sm hover:border-purple-accent transition-colors"
                                        alt="neutral item"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Si vas mal */}
                    <div className="flex flex-col items-center bg-input-warm/10 p-2 rounded-sm border border-border-warm/20">
                        <span className="text-[8px] text-red-400 font-bold uppercase tracking-wider mb-1.5 text-center">
                            Si vas mal
                        </span>
                        <div className="flex gap-1.5">
                            {currentBuild.build.items.paths.behind?.slice(0, 3).map((item: any, idx: number) => (
                                <div key={`behind-${idx}`} className="relative group" title={item.name}>
                                    <img
                                        src={item.icon || `https://ddragon.leagueoflegends.com/cdn/16.9.1/img/item/${item.id}.png`}
                                        className="w-9 h-9 border border-border-warm/40 rounded-sm hover:border-red-400 transition-colors"
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
