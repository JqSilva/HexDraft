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
            <div className="flex flex-wrap gap-4 items-center justify-center bg-input-warm/50 p-6 md:p-8 rounded-sm border border-border-warm">
                {currentBuild?.build?.items?.core.map((item: any, idx: number) => (
                    <div key={idx} className="relative group">
                        <img
                            src={`https://ddragon.leagueoflegends.com/cdn/16.9.1/img/item/${item.id}.png`}
                            className="w-12 h-12 md:w-14 md:h-14 border border-border-warm rounded-sm hover:border-purple-accent transition-colors duration-200 cursor-default"
                            alt="item"
                        />
                        <div className="absolute -top-1.5 -right-1.5 bg-input-warm border border-border-warm text-[8px] font-black px-1 py-0.5 rounded-sm text-slate-400">
                            0{idx + 1}
                        </div>
                    </div>
                ))}
                <div className="h-10 w-px bg-border-warm mx-2 md:mx-4"></div>
                <div className="relative">
                    <img
                        src={`https://ddragon.leagueoflegends.com/cdn/16.9.1/img/item/${currentBuild?.build?.items?.boots?.id}.png`}
                        className="w-12 h-12 md:w-14 md:h-14 border border-border-warm rounded-sm cursor-default"
                        alt="boots"
                    />
                    <div className="absolute -top-1.5 -right-1.5 bg-input-warm border border-border-warm text-[8px] font-black px-1 py-0.5 rounded-sm text-slate-400">
                        B
                    </div>
                </div>
            </div>
        </div>
    );
});

export default ItemBuild;
