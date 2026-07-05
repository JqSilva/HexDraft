import React, { memo, useMemo } from 'react';
import { getTacticalDirectives } from '../../lib/engine/tacticalEngine';
import { analyzeComposition } from '../../lib/engine/compositionAnalyzer';

// =========================================================
// PANEL 1: DIRECTIVAS DE COMBATE (Estrategia, Timing, Daño)
// =========================================================
const ENEMY_WIN_COND_DETAILS: Record<string, { label: string; advice: string; color: string }> = {
    'early_pressure': {
        label: 'Presión Temprana',
        advice: 'Evita peleas tempranas. Juega defensivo y escala bajo torre.',
        color: 'text-orange-400 border-orange-500/15 bg-orange-950/10'
    },
    'teamfight': {
        label: 'Peleas de Equipo (Teamfight)',
        advice: 'Evita agruparte en pasillos. Prioriza splitpush y flanqueos.',
        color: 'text-red-400 border-red-500/15 bg-red-950/10'
    },
    'splitpush': {
        label: 'Presión Dividida (Splitpush)',
        advice: 'Mantén líneas empujadas. Inicia peleas 5v4 si se separan.',
        color: 'text-amber-400 border-amber-500/15 bg-amber-950/10'
    },
    'poke_siege': {
        label: 'Desgaste y Asedio',
        advice: 'Inicia directo (hard engage). Evita desgaste pasivo bajo torre.',
        color: 'text-cyan-400 border-cyan-500/15 bg-cyan-950/10'
    },
    'dive_backline': {
        label: 'Foco a Retaguardia (Dive)',
        advice: 'Protege a los carries. Guarda CC para los asesinos cuando salten.',
        color: 'text-purple-400 border-purple-500/15 bg-purple-950/10'
    },
    'scaling': {
        label: 'Escalado Tardío',
        advice: 'Tienen mejor juego tardío. Presiona rápido y cierra antes del min 35.',
        color: 'text-emerald-400 border-emerald-500/15 bg-emerald-950/10'
    }
};

interface CombatDirectivesPanelProps {
    scalingType: 'Early' | 'Mid' | 'Late';
    combatStyle: {
        physicalPct: number;
        magicPct: number;
        truePct: number;
        description: string;
    };
    winrateCurveAnalysis: {
        peakTime: string;
        peakWinrate: number;
        valleyTime: string;
        valleyWinrate: number;
        trendDescription: string;
    };
    generalDirectives: {
        strategy: string;
        timing: string;
    };
    enemyNames?: string[];
    myTeamAnalysis?: any;
    hideTitle?: boolean;
}

export const CombatDirectivesPanel = memo(({
    scalingType,
    combatStyle,
    winrateCurveAnalysis,
    generalDirectives,
    enemyNames = [],
    myTeamAnalysis,
    hideTitle = false
}: CombatDirectivesPanelProps) => {
    const scalingColors = {
        Early: {
            bg: 'bg-red-500/10 border-red-500/20 text-red-400',
            label: 'Early Game Bully'
        },
        Mid: {
            bg: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400',
            label: 'Mid Game Spike'
        },
        Late: {
            bg: 'bg-purple-accent/10 border-purple-accent/20 text-purple-accent',
            label: 'Late Game Wincon'
        }
    };

    const scalingStyle = scalingColors[scalingType] || scalingColors.Mid;

    return (
        <div className={`p-5 md:p-6 bg-bg-warm/30 border border-border-warm/50 rounded-sm h-full tech-corners flex flex-col gap-4 ${
            hideTitle ? 'rounded-tl-none' : ''
        }`}>
            {!hideTitle && (
                <div className="flex justify-between items-center shrink-0 border-b border-border-warm/25 pb-2.5">
                    <h4 className="text-xs md:text-sm text-slate-150 font-black uppercase tracking-[0.2em] italic">
                        Directivas Tácticas
                    </h4>
                    <div className={`px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest border rounded-sm ${scalingStyle.bg}`}>
                        {scalingStyle.label}
                    </div>
                </div>
            )}

            <div className="space-y-5 flex-1 min-h-0 overflow-y-auto pr-1">
                {/* ESTRATEGIA */}
                <div className="flex flex-col gap-1 border-l-2 border-hextech-blue/50 pl-3">
                    <span className="text-hextech-blue font-black tracking-widest uppercase text-[10px] md:text-[11px]">
                        Estrategia de Combate
                    </span>
                    <p className="text-[13px] md:text-[14px] text-slate-100 leading-relaxed font-semibold">
                        {generalDirectives.strategy}
                    </p>
                </div>

                {/* TIMING */}
                <div className="flex flex-col gap-1 border-l-2 border-purple-accent/50 pl-3">
                    <span className="text-purple-accent font-black tracking-widest uppercase text-[10px] md:text-[11px]">
                        Ventana de Poder
                    </span>
                    <p className="text-[13px] md:text-[14px] text-slate-100 leading-relaxed font-semibold">
                        {generalDirectives.timing}
                    </p>
                    <p className="text-[11px] text-slate-400 font-medium italic mt-0.5">
                        {winrateCurveAnalysis.trendDescription}
                    </p>
                </div>

                {/* AMENAZA ESTRATÉGICA ENEMIGA */}
                {enemyNames && enemyNames.length > 0 ? (() => {
                    const enemyComp = analyzeComposition(enemyNames);
                    const wincon = ENEMY_WIN_COND_DETAILS[enemyComp.winCondition] || ENEMY_WIN_COND_DETAILS.teamfight;
                    return (
                        <div className="border-l-2 border-red-500/30 pl-3 space-y-1">
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] md:text-[11px] font-black text-slate-400 uppercase tracking-widest">
                                    Amenaza Enemiga
                                </span>
                                <span className="text-[10px] font-black uppercase text-red-400 tracking-wider">
                                    {wincon.label}
                                </span>
                            </div>
                            <p className="text-[13px] md:text-[14px] leading-relaxed text-slate-100 font-semibold">
                                {wincon.advice}
                            </p>
                        </div>
                    );
                })() : (
                    <div className="border-l-2 border-dashed border-border-warm/30 pl-3 py-1">
                        <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                            Esperando picks enemigos...
                        </span>
                    </div>
                )}


            </div>
        </div>
    );
});

// =========================================================
// PANEL 2: ENFRENTAMIENTOS (Counters, Ventajas, Sinergias)
// =========================================================
interface MatchupAnalysisPanelProps {
    matchups: {
        threats: Array<{
            name: string;
            winrate: string;
            goldDiff: string;
            xpDiff: string;
            csDiff: string;
            dominanceScore: number;
            laneTag: string;
            combatAdvice: string;
        }>;
        advantages: Array<{
            name: string;
            winrate: string;
            goldDiff: string;
            xpDiff: string;
            csDiff: string;
            dominanceScore: number;
            laneTag: string;
            combatAdvice: string;
        }>;
    };
    synergies: Array<{
        name: string;
        delta: number;
        advice: string;
    }>;
}

export const MatchupAnalysisPanel = memo(({
    matchups,
    synergies
}: MatchupAnalysisPanelProps) => {
    const hasContent = synergies.length > 0 || matchups.threats.length > 0 || matchups.advantages.length > 0;

    return (
        <div className="p-3.5 bg-bg-warm/30 border border-border-warm/50 rounded-sm h-full tech-corners flex flex-col gap-2.5">
            <h4 className="text-[10px] text-slate-200 font-black uppercase tracking-[0.3em] italic shrink-0">
                Enfrentamientos
            </h4>

            <div className="space-y-2.5 flex-1 min-h-0 overflow-hidden">
                {/* SINERGIAS */}
                {synergies.length > 0 && (
                    <div className="space-y-1.5">
                        <span className="text-[8px] text-slate-500 font-black uppercase tracking-wider block">
                            Sinergias Activas
                        </span>
                        {synergies.slice(0, 2).map((syn, idx) => (
                            <div key={idx} className="flex items-start gap-2 pl-2.5 border-l-2 border-green-500/30">
                                <div className="text-[10px] leading-snug">
                                    <span className="text-white font-bold">{syn.name}: </span>
                                    <span className="text-slate-300">{syn.advice}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* AMENAZAS */}
                {matchups.threats.length > 0 && (
                    <div className="space-y-1.5">
                        <span className="text-[8px] text-red-400 font-black uppercase tracking-widest block">
                            Amenazas
                        </span>
                        {matchups.threats.slice(0, 1).map((threat, idx) => (
                            <div key={idx} className="pl-2.5 border-l-2 border-red-500/30 space-y-1">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-black text-white">{threat.name}</span>
                                    <span className="text-[8px] font-mono font-bold text-red-400">
                                        WR: {threat.winrate}
                                    </span>
                                </div>
                                <div className="grid grid-cols-3 gap-1 text-[8px] font-mono text-slate-500">
                                    <span>Oro: <span className={parseInt(threat.goldDiff) < 0 ? 'text-red-400' : 'text-green-400'}>{threat.goldDiff}</span></span>
                                    <span>XP: <span className={parseInt(threat.xpDiff) < 0 ? 'text-red-400' : 'text-green-400'}>{threat.xpDiff}</span></span>
                                    <span>CS: <span className={parseFloat(threat.csDiff) < 0 ? 'text-red-400' : 'text-green-400'}>{threat.csDiff}</span></span>
                                </div>
                                <p className="text-[10px] text-slate-300 leading-snug">
                                    {threat.combatAdvice}
                                </p>
                            </div>
                        ))}
                    </div>
                )}

                {/* VENTAJAS */}
                {matchups.advantages.length > 0 && (
                    <div className="space-y-1.5">
                        <span className="text-[8px] text-cyan-400 font-black uppercase tracking-widest block">
                            Ventajas
                        </span>
                        {matchups.advantages.slice(0, 1).map((adv, idx) => (
                            <div key={idx} className="pl-2.5 border-l-2 border-cyan-500/30 space-y-1">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-black text-white">{adv.name}</span>
                                    <span className="text-[8px] font-mono font-bold text-cyan-400">
                                        WR: {adv.winrate}
                                    </span>
                                </div>
                                <div className="grid grid-cols-3 gap-1 text-[8px] font-mono text-slate-500">
                                    <span>Oro: <span className={parseInt(adv.goldDiff) < 0 ? 'text-red-400' : 'text-green-400'}>+{adv.goldDiff}</span></span>
                                    <span>XP: <span className={parseInt(adv.xpDiff) < 0 ? 'text-red-400' : 'text-green-400'}>+{adv.xpDiff}</span></span>
                                    <span>CS: <span className={parseFloat(adv.csDiff) < 0 ? 'text-red-400' : 'text-green-400'}>+{adv.csDiff}</span></span>
                                </div>
                                <p className="text-[10px] text-slate-300 leading-snug">
                                    {adv.combatAdvice}
                                </p>
                            </div>
                        ))}
                    </div>
                )}

                {!hasContent && (
                    <p className="text-[10px] text-slate-500 italic">
                        No hay sinergias ni enfrentamientos activos detectados.
                    </p>
                )}
            </div>
        </div>
    );
});

// =========================================================
// WRAPPER / COMPONENTE POR DEFECTO (Para retrocompatibilidad)
// =========================================================
interface TacticalDirectivesProps {
    championName: string;
    myRole: string;
    allies: string[];
    enemies: string[];
}

export const TacticalDirectives = memo(({ championName, myRole, allies, enemies }: TacticalDirectivesProps) => {
    const directives = useMemo(() => {
        return getTacticalDirectives(championName, myRole, allies, enemies);
    }, [championName, myRole, allies, enemies]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
            <CombatDirectivesPanel
                scalingType={directives.scalingType}
                combatStyle={directives.combatStyle}
                winrateCurveAnalysis={directives.winrateCurveAnalysis}
                generalDirectives={directives.generalDirectives}
                enemyNames={enemies}
            />
            <MatchupAnalysisPanel
                matchups={directives.matchups}
                synergies={directives.synergies}
            />
        </div>
    );
});

export default TacticalDirectives;