import React, { memo } from 'react';

interface ItemBuildProps {
    currentBuild: any;
    onReImport: () => void;
}

export const ItemBuild = memo(({ currentBuild, onReImport }: ItemBuildProps) => {
    return (
        <div className="p-6 bg-bg-warm border border-border-warm rounded-sm tech-corners">
            <div className="flex justify-between items-center mb-6">
                <h4 className="text-[12px] text-purple-accent font-black uppercase tracking-[0.3em] italic">
                    Build Recomendada
                </h4>
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
                                        src={`https://ddragon.leagueoflegends.com/cdn/16.9.1/img/item/${item.id}.png`}
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
                                src={`https://ddragon.leagueoflegends.com/cdn/16.9.1/img/item/${currentBuild.build.items.boots.id}.png`}
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
                                src={`https://ddragon.leagueoflegends.com/cdn/16.9.1/img/item/${item.id}.png`}
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
                                        src={`https://ddragon.leagueoflegends.com/cdn/16.9.1/img/item/${item.id}.png`}
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
                                        src={`https://ddragon.leagueoflegends.com/cdn/16.9.1/img/item/${item.id}.png`}
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
                                        src={`https://ddragon.leagueoflegends.com/cdn/16.9.1/img/item/${item.id}.png`}
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
