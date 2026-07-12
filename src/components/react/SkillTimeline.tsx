import React, { memo } from 'react';

interface SkillTimelineProps {
    skillOrder?: string;
    tacticalData: { skills: string[] } | null;
}

export const SkillTimeline = memo(({ skillOrder, tacticalData }: SkillTimelineProps) => {
    return (
        <div className="p-3 bg-bg-warm/30 border border-border-warm/50 rounded-sm w-full relative tech-corners flex flex-col gap-2">
            <div className="flex justify-between items-center">
                <h4 className="text-[11px] text-cyan-400 font-black uppercase tracking-[0.3em] italic">
                    Evolución de Habilidades
                </h4>
                
                {/* ORDEN DE MAXEO GLOBAL */}
                {skillOrder && (
                    <div className="flex items-center gap-2 px-3 py-1">
                        <span className="text-[10px] text-cyan-400 font-black uppercase tracking-widest">Maxeo:</span>
                        <span className="text-[10px] text-white font-black tracking-widest uppercase">
                            {skillOrder}
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
                                <span className="text-[9px] md:text-[10px] font-bold text-slate-500">{lvl}</span>
                                <div className={`w-full aspect-square max-w-[42px] border flex items-center justify-center font-black text-sm md:text-base rounded-sm transition-all
                                    ${isUlt
                                        ? 'bg-purple-accent/15 border-purple-accent text-purple-accent'
                                        : 'bg-input-warm border-border-warm/60 text-slate-200'}
                                `}>
                                    {skill}
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="w-full py-3 text-center">
                        <p className="text-slate-400 text-xs tracking-widest uppercase animate-pulse">
                            Obteniendo orden de habilidades...
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
});

export default SkillTimeline;
