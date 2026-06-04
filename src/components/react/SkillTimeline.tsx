import React, { memo } from 'react';

interface SkillTimelineProps {
    skillOrder?: string;
    tacticalData: { skills: string[] } | null;
}

export const SkillTimeline = memo(({ skillOrder, tacticalData }: SkillTimelineProps) => {
    return (
        <div className="p-6 bg-bg-warm border border-border-warm rounded-sm w-full relative tech-corners">
            <div className="flex justify-between items-center mb-6">
                <h4 className="text-[12px] text-cyan-400 font-black uppercase tracking-[0.3em] italic">
                    Evolución de Habilidades
                </h4>
                
                {/* ORDEN DE MAXEO GLOBAL (Q > E > W) */}
                {skillOrder && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-cyan-400/10 border border-cyan-400/20 rounded-sm">
                        <span className="text-[9px] text-cyan-400 font-black uppercase tracking-widest">Maxeo:</span>
                        <span className="text-[9px] text-white font-black tracking-widest uppercase">
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
    );
});

export default SkillTimeline;
