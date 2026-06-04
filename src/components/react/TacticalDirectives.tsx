import React, { memo, useMemo } from 'react';
import { getTacticalDirectives } from '../../lib/engine/tacticalEngine';

// =========================================================
// PANEL 1: DIRECTIVAS DE COMBATE (Estrategia, Timing, Daño)
// =========================================================
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
}

export const CombatDirectivesPanel = memo(({
    scalingType,
    combatStyle,
    winrateCurveAnalysis,
    generalDirectives
}: CombatDirectivesPanelProps) => {
    const scalingColors = {
        Early: {
            bg: 'bg-red-500/10 border-red-500/30 text-red-400',
            label: 'Early Game Bully'
        },
        Mid: {
            bg: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400',
            label: 'Mid Game Spike'
        },
        Late: {
            bg: 'bg-purple-accent/10 border-purple-accent/30 text-purple-accent',
            label: 'Late Game Wincon'
        }
    };

    const scalingStyle = scalingColors[scalingType] || scalingColors.Mid;

    return (
        <div className="p-5 md:p-6 bg-panel-warm border border-border-warm rounded-sm h-full tech-corners flex flex-col justify-between space-y-5">
            <div className="flex justify-between items-center">
                <h4 className="text-[12px] text-slate-200 font-black uppercase tracking-[0.3em] italic">
                    <span className="text-purple-accent mr-2">//</span>Directivas
                </h4>
                <div className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-widest border rounded-sm ${scalingStyle.bg}`}>
                    {scalingStyle.label}
                </div>
            </div>

            <div className="space-y-4 flex-1">
                {/* ESTRATEGIA */}
                <div className="flex flex-col gap-1 p-3 bg-hextech-blue/5 border-l-2 border-hextech-blue rounded-r-sm">
                    <span className="text-hextech-blue font-black tracking-wider uppercase text-[9px]">
                        Estrategia
                    </span>
                    <p className="text-[11px] text-slate-200 leading-relaxed italic">
                        {generalDirectives.strategy}
                    </p>
                </div>

                {/* TIMING */}
                <div className="flex flex-col gap-1 p-3 bg-purple-accent/5 border-l-2 border-purple-accent rounded-r-sm">
                    <span className="text-purple-accent font-black tracking-wider uppercase text-[9px]">
                        Ventana de Poder
                    </span>
                    <p className="text-[11px] text-slate-200 leading-relaxed italic">
                        {generalDirectives.timing}
                    </p>
                    <p className="text-[9px] text-slate-400 font-mono mt-0.5">
                        {winrateCurveAnalysis.trendDescription}
                    </p>
                </div>

                {/* PERFIL DE DAÑO */}
                <div className="p-3 bg-input-warm border border-border-warm rounded-sm space-y-2">
                    <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider block">
                        ADN de Daño
                    </span>
                    
                    <div className="h-2 w-full bg-slate-950 rounded-sm overflow-hidden flex border border-border-warm">
                        {combatStyle.physicalPct > 0 && (
                            <div 
                                style={{ width: `${combatStyle.physicalPct}%` }} 
                                className="bg-gradient-to-r from-red-600 to-orange-500 h-full"
                                title={`Físico: ${combatStyle.physicalPct}%`}
                            />
                        )}
                        {combatStyle.magicPct > 0 && (
                            <div 
                                style={{ width: `${combatStyle.magicPct}%` }} 
                                className="bg-gradient-to-r from-cyan-600 to-blue-500 h-full"
                                title={`Mágico: ${combatStyle.magicPct}%`}
                            />
                        )}
                        {combatStyle.truePct > 0 && (
                            <div 
                                style={{ width: `${combatStyle.truePct}%` }} 
                                className="bg-gradient-to-r from-slate-300 to-white h-full"
                                title={`Verdadero: ${combatStyle.truePct}%`}
                            />
                        )}
                    </div>
                    
                    <div className="flex justify-between text-[8px] font-mono text-slate-500">
                        <span>AD: {combatStyle.physicalPct}%</span>
                        <span>AP: {combatStyle.magicPct}%</span>
                        <span>TRUE: {combatStyle.truePct}%</span>
                    </div>

                    <p className="text-[10px] text-slate-300 leading-relaxed font-sans mt-1">
                        {combatStyle.description}
                    </p>
                </div>
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
        <div className="p-5 md:p-6 bg-panel-warm border border-border-warm rounded-sm h-full tech-corners overflow-y-auto max-h-[420px] flex flex-col space-y-4">
            <h4 className="text-[12px] text-slate-200 font-black uppercase tracking-[0.3em] italic">
                <span className="text-purple-accent mr-2">//</span>Enfrentamientos LCU
            </h4>

            <div className="space-y-4 flex-1">
                {/* SINERGIAS */}
                {synergies.length > 0 && (
                    <div className="space-y-1.5">
                        <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider block">
                            Sinergias Activas
                        </span>
                        <div className="space-y-1.5">
                            {synergies.map((syn, idx) => (
                                <div key={idx} className="p-2.5 bg-green-500/5 border border-green-500/20 rounded-sm flex items-start gap-2.5">
                                    <span className="text-green-400 font-bold text-[10px] mt-0.5">✔</span>
                                    <div className="text-[10px] leading-relaxed">
                                        <span className="text-white font-bold">{syn.name}: </span>
                                        <span className="text-slate-300">{syn.advice}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* AMENAZAS */}
                {matchups.threats.length > 0 && (
                    <div className="space-y-1.5">
                        <span className="text-[9px] text-red-400 font-black uppercase tracking-widest block">
                            Amenazas Detectadas
                        </span>
                        {matchups.threats.map((threat, idx) => (
                            <div key={idx} className="p-2.5 bg-red-950/20 border border-red-900/30 rounded-sm space-y-1.5">
                                <div className="flex justify-between items-center">
                                    <span className="text-[11px] font-black text-white">{threat.name}</span>
                                    <span className="text-[8px] font-mono font-bold px-1 py-0.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-sm">
                                        WR vs: {threat.winrate}
                                    </span>
                                </div>
                                <div className="grid grid-cols-3 gap-1 text-[8px] font-mono text-slate-400 border-b border-border-warm pb-1">
                                    <span>Oro: <span className={parseInt(threat.goldDiff) < 0 ? 'text-red-400' : 'text-green-400'}>{threat.goldDiff}</span></span>
                                    <span>XP: <span className={parseInt(threat.xpDiff) < 0 ? 'text-red-400' : 'text-green-400'}>{threat.xpDiff}</span></span>
                                    <span>CS: <span className={parseFloat(threat.csDiff) < 0 ? 'text-red-400' : 'text-green-400'}>{threat.csDiff}</span></span>
                                </div>
                                <p className="text-[9px] text-slate-300 font-sans leading-relaxed">
                                    {threat.combatAdvice}
                                </p>
                            </div>
                        ))}
                    </div>
                )}

                {/* VENTAJAS */}
                {matchups.advantages.length > 0 && (
                    <div className="space-y-1.5">
                        <span className="text-[9px] text-cyan-400 font-black uppercase tracking-widest block">
                            Ventajas Tácticas
                        </span>
                        {matchups.advantages.map((adv, idx) => (
                            <div key={idx} className="p-2.5 bg-cyan-950/20 border border-cyan-900/30 rounded-sm space-y-1.5">
                                <div className="flex justify-between items-center">
                                    <span className="text-[11px] font-black text-white">{adv.name}</span>
                                    <span className="text-[8px] font-mono font-bold px-1 py-0.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-sm">
                                        WR vs: {adv.winrate}
                                    </span>
                                </div>
                                <div className="grid grid-cols-3 gap-1 text-[8px] font-mono text-slate-400 border-b border-border-warm pb-1">
                                    <span>Oro: <span className={parseInt(adv.goldDiff) < 0 ? 'text-red-400' : 'text-green-400'}>+{adv.goldDiff}</span></span>
                                    <span>XP: <span className={parseInt(adv.xpDiff) < 0 ? 'text-red-400' : 'text-green-400'}>+{adv.xpDiff}</span></span>
                                    <span>CS: <span className={parseFloat(adv.csDiff) < 0 ? 'text-red-400' : 'text-green-400'}>+{adv.csDiff}</span></span>
                                </div>
                                <p className="text-[9px] text-slate-300 font-sans leading-relaxed">
                                    {adv.combatAdvice}
                                </p>
                            </div>
                        ))}
                    </div>
                )}

                {!hasContent && (
                    <p className="text-[10px] text-slate-500 italic">
                        No se detectan enfrentamientos directos ni sinergias para esta composición.
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
            />
            <MatchupAnalysisPanel
                matchups={directives.matchups}
                synergies={directives.synergies}
            />
        </div>
    );
});

export default TacticalDirectives;