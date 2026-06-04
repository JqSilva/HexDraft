import React, { memo } from 'react';

interface TacticalDirectivesProps {
    championName: string;
    scalingType?: 'Early' | 'Mid' | 'Late';
    reasons?: string[];
}

const getDynamicDirectives = (champName: string, scalingType?: 'Early' | 'Mid' | 'Late') => {
    const type = scalingType || 'Mid';

    const directives = {
        Early: {
            strategy: `Juega extremadamente agresivo en los primeros niveles. Invade o busca escaramuzas tempranas; tu oponente directo sufre contra el enorme pico de poder inicial de ${champName}.`,
            timing: "05:00 a 15:00"
        },
        Mid: {
            strategy: `Mantén un ritmo constante y asegura tus campamentos u objetivos. Busca forzar peleas grupales o emboscadas coordinadas en la zona media del mapa con el kit balanceado de ${champName}.`,
            timing: "15:00 a 25:00"
        },
        Late: {
            strategy: `Juega con paciencia y prioriza la supervivencia o el escalado seguro. Evita riesgos innecesarios en el juego temprano; ${champName} se convierte en una condición de victoria absoluta al avanzar la partida.`,
            timing: "30:00+"
        }
    };

    return directives[type];
};

export const TacticalDirectives = memo(({ championName, scalingType, reasons = [] }: TacticalDirectivesProps) => {
    const directives = getDynamicDirectives(championName, scalingType);

    return (
        <div className="p-6 md:p-8 bg-panel-warm border border-border-warm rounded-sm h-full tech-corners">
            <h4 className="text-[12px] text-slate-200 font-black uppercase tracking-[0.3em] mb-6 italic">
                <span className="text-purple-accent mr-2">//</span>Directivas de Combate
            </h4>
            
            <div className="space-y-6">
                {/* ESTRATEGIA DINÁMICA */}
                <div className="flex gap-4 p-4 bg-hextech-blue/5 border-l-2 border-hextech-blue rounded-r-sm animate-in fade-in duration-300">
                    <p className="text-xs text-slate-200 leading-relaxed italic">
                        <span className="text-hextech-blue font-black not-italic tracking-wider uppercase mr-2">Estrategia:</span>
                        {directives.strategy}
                    </p>
                </div>

                {/* TIMING DINÁMICO */}
                <div className="flex gap-4 p-4 bg-purple-accent/5 border-l-2 border-purple-accent rounded-r-sm animate-in fade-in duration-300">
                    <p className="text-xs text-slate-200 leading-relaxed italic">
                        <span className="text-purple-accent font-black not-italic tracking-wider uppercase mr-2">Timing:</span>
                        Poder máximo detectado e ideal para forzar objetivos en la ventana de tiempo <span className="text-white font-bold not-italic px-2 py-0.5 bg-purple-accent/10 border border-purple-accent/20 rounded-sm">{directives.timing}</span> debido al perfil de escalado del campeón.
                    </p>
                </div>

                {/* FACTORES DE COMPOSICIÓN */}
                <div className="pt-4 space-y-3">
                    <span className="text-[11px] text-slate-500 font-black uppercase tracking-[0.2em] block">Factores de Composición:</span>
                    {reasons.length > 0 ? (
                        reasons.map((r, i) => (
                            <div key={i} className="flex items-start gap-3 text-[11px] mt-2 text-slate-400 group animate-in slide-in-from-left-2 duration-150">
                                <span className="text-purple-accent mt-1 text-[8px] group-hover:scale-125 transition-transform duration-200">◆</span> 
                                {r}
                            </div>
                        ))
                    ) : (
                        <p className="text-[11px] text-slate-600 italic">No hay factores de composición adicionales registrados.</p>
                    )}
                </div>
            </div>
        </div>
    );
});