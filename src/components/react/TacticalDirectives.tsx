import React, { memo, useMemo } from 'react';
import { getTacticalDirectives } from '../../lib/engine/tacticalEngine';
import { analyzeComposition } from '../../lib/engine/compositionAnalyzer';

// =========================================================
// PANEL 1: DIRECTIVAS DE COMBATE (Estrategia, Timing, Daño)
// =========================================================
const ENEMY_WIN_COND_DETAILS: Record<string, { label: string; advice: string; color: string }> = {
    'early_pressure': {
        label: 'Presión Temprana',
        advice: 'El enemigo buscará tomar ventajas rápidas. Juega seguro bajo torre, evita escaramuzas en río y escala con calma. No regales muertes por dragones tempranos.',
        color: 'text-orange-400 border-orange-500/15 bg-orange-950/10'
    },
    'teamfight': {
        label: 'Peleas de Equipo (Teamfight)',
        advice: 'El rival brilla agrupado 5v5. Evita agruparse en pasillos estrechos de la jungla y usa el splitpush para forzar enfrentamientos en desventaja numérica.',
        color: 'text-red-400 border-red-500/15 bg-red-950/10'
    },
    'splitpush': {
        label: 'Presión Dividida (Splitpush)',
        advice: 'Tienen duelistas fuertes en líneas laterales. Mantén oleadas empujadas, asegura visión lateral y fuerza peleas 5v4 en el medio cuando se separen.',
        color: 'text-amber-400 border-amber-500/15 bg-amber-950/10'
    },
    'poke_siege': {
        label: 'Desgaste y Asedio',
        advice: 'Evita recibir daño pasivo bajo torre. Prioriza iniciaciones directas fuertes (hard engage) y flanqueos rápidos. Compra sustain temprano.',
        color: 'text-cyan-400 border-cyan-500/15 bg-cyan-950/10'
    },
    'dive_backline': {
        label: 'Foco a Retaguardia (Dive)',
        advice: 'Poseen campeones asesinos muy móviles. Quédate cerca de tu frontline y guarda el CC defensivo para cuando salten hacia tus carries.',
        color: 'text-purple-400 border-purple-500/15 bg-purple-950/10'
    },
    'scaling': {
        label: 'Escalado Tardío',
        advice: 'Tienen mejor juego tardío. El reloj corre en tu contra: toma la iniciativa, presiona carriles agresivamente y cierra el mapa antes del minuto 35.',
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
}

export const CombatDirectivesPanel = memo(({
    scalingType,
    combatStyle,
    winrateCurveAnalysis,
    generalDirectives,
    enemyNames = []
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
        <div className="p-3.5 bg-bg-warm/30 border border-border-warm/50 rounded-sm h-full tech-corners flex flex-col gap-2.5">
            <div className="flex justify-between items-center shrink-0">
                <h4 className="text-[10px] text-slate-200 font-black uppercase tracking-[0.3em] italic">
                    Directivas
                </h4>
                <div className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-widest border rounded-sm ${scalingStyle.bg}`}>
                    {scalingStyle.label}
                </div>
            </div>

            <div className="space-y-2.5 flex-1 min-h-0 overflow-hidden">
                {/* ESTRATEGIA */}
                <div className="flex flex-col gap-0.5 border-l-2 border-hextech-blue/50 pl-2.5">
                    <span className="text-hextech-blue font-black tracking-wider uppercase text-[8px]">
                        Estrategia de Combate
                    </span>
                    <p className="text-[10px] text-slate-200 leading-snug font-medium">
                        {generalDirectives.strategy}
                    </p>
                </div>

                {/* TIMING */}
                <div className="flex flex-col gap-0.5 border-l-2 border-purple-accent/50 pl-2.5">
                    <span className="text-purple-accent font-black tracking-wider uppercase text-[8px]">
                        Ventana de Poder
                    </span>
                    <p className="text-[10px] text-slate-200 leading-snug font-medium">
                        {generalDirectives.timing}
                    </p>
                    <p className="text-[9px] text-slate-500 font-mono">
                        {winrateCurveAnalysis.trendDescription}
                    </p>
                </div>

                {/* PERFIL DE DAÑO */}
                <div className="pl-2.5 border-l-2 border-slate-500/50 space-y-1">
                    <span className="text-[8px] text-slate-400 font-black uppercase tracking-wider block">
                        Distribución de Daño
                    </span>
                    
                    <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden flex border border-border-warm/20">
                        {combatStyle.physicalPct > 0 && (
                            <div 
                                style={{ width: `${combatStyle.physicalPct}%` }} 
                                className="bg-gradient-to-r from-red-600 to-orange-500 h-full"
                            />
                        )}
                        {combatStyle.magicPct > 0 && (
                            <div 
                                style={{ width: `${combatStyle.magicPct}%` }} 
                                className="bg-gradient-to-r from-cyan-600 to-blue-500 h-full"
                            />
                        )}
                        {combatStyle.truePct > 0 && (
                            <div 
                                style={{ width: `${combatStyle.truePct}%` }} 
                                className="bg-gradient-to-r from-slate-300 to-white h-full"
                            />
                        )}
                    </div>
                    
                    <div className="flex justify-between text-[8px] font-mono text-slate-500">
                        <span>AD: {combatStyle.physicalPct}%</span>
                        <span>AP: {combatStyle.magicPct}%</span>
                        <span>TRUE: {combatStyle.truePct}%</span>
                    </div>
                </div>

                {/* AMENAZA ESTRATÉGICA ENEMIGA */}
                {enemyNames && enemyNames.length > 0 ? (() => {
                    const enemyComp = analyzeComposition(enemyNames);
                    const wincon = ENEMY_WIN_COND_DETAILS[enemyComp.winCondition] || ENEMY_WIN_COND_DETAILS.teamfight;
                    return (
                        <div className="border-l-2 border-red-500/30 pl-2.5 space-y-0.5">
                            <div className="flex justify-between items-center">
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider">
                                    Amenaza Enemiga
                                </span>
                                <span className="text-[8px] font-black uppercase text-red-400">
                                    {wincon.label}
                                </span>
                            </div>
                            <p className="text-[10px] leading-snug text-slate-300">
                                {wincon.advice}
                            </p>
                        </div>
                    );
                })() : (
                    <div className="border-l-2 border-dashed border-border-warm/30 pl-2.5">
                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">
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