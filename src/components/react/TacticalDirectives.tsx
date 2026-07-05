import React, { memo, useMemo } from 'react';
import { getTacticalDirectives } from '../../lib/engine/tacticalEngine';
import { analyzeComposition } from '../../lib/engine/compositionAnalyzer';
import { getChampionCdnName } from '../../lib/championMapper';

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

const COMP_STYLE_LABELS: Record<string, string> = {
    'teamfight': 'tf (Peleas de Equipo)',
    'splitpush': 'split (Presión Lateral)',
    'poke_siege': 'poke / asedio (Desgaste)',
    'early_pressure': 'presión temprana (Early)',
    'dive_backline': 'cazar en la jg (Foco)',
    'scaling': 'escalar (Late Game)'
};

const getCompositionAdvice = (winCondition: string): string => {
    const advices: Record<string, string> = {
        'teamfight': 'Tu composición brilla en peleas agrupadas de 5v5. Aprovecha los enfrentamientos en lugares estrechos como el río o el foso de dragón. Mantén el control de visión para iniciar con ventaja.',
        'splitpush': 'Evita peleas frontales directas de 5v5. Presiona las líneas laterales (split) para forzar al enemigo a dividirse, y mantén visión profunda en su jungla para retirarte a tiempo.',
        'poke_siege': 'Tu composición es de desgaste (poke). No inicies peleas frontales antes de desgastar al enemigo a distancia. Presiona bajo torre y defiende los flancos de iniciaciones enemigas.',
        'dive_backline': 'Prioriza realizar picks y emboscadas rápidas en la jungla. Limpia los arbustos de visión enemiga y busca flanquear directamente a su backline (tirador/mago).',
        'early_pressure': 'Tienes ventaja en el juego temprano. Invade la jungla enemiga, busca escaramuzas en el río y asegura objetivos iniciales (larvas/dragones) para cerrar la partida rápido.',
        'scaling': 'Juega defensivo en fase de líneas y minimiza muertes tempranas. Prioriza el farm de súbditos y defiende las torres hasta que tu composición alcance el pico de poder en el juego tardío.'
    };
    return advices[winCondition] || 'Adapta tu estilo de juego a los objetivos del mapa. Mantén control de visión en el río y arbustos clave, y coordina las peleas grupales con tu equipo.';
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
    threats?: any[];
    synergies?: any[];
}

export const CombatDirectivesPanel = memo(({
    scalingType,
    combatStyle,
    winrateCurveAnalysis,
    generalDirectives,
    enemyNames = [],
    myTeamAnalysis,
    hideTitle = false,
    threats = [],
    synergies = []
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
            <div className="space-y-4.5 flex-1 min-h-0 overflow-y-auto scrollbar-tactical pr-2.5 pb-4">
                {/* 1. ESTILO DE COMPOSICIÓN Y BALANCE DE DAÑO */}
                {myTeamAnalysis && (
                    <div className="flex flex-col gap-2.5 border-l-2 border-[#a855f7]/50 pl-3">
                        <div className="flex items-center gap-2">
                            <svg className="w-3.5 h-3.5 text-[#a855f7]/80 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                            <span className="text-[#a855f7] font-black tracking-widest uppercase text-[10px] md:text-[11px]">
                                Estilo Comp
                            </span>
                        </div>
                        <div className="space-y-2">
                            <span className="text-[12px] font-black text-slate-100 uppercase tracking-wide block">
                                {COMP_STYLE_LABELS[myTeamAnalysis.winCondition] || myTeamAnalysis.winCondition}
                            </span>
                            
                            {/* Barra de Daño Aliado */}
                            <div className="flex items-center gap-2.5 max-w-[280px]">
                                <span className="text-[9px] font-bold text-red-400/80 shrink-0">AD {myTeamAnalysis.damageProfile?.physicalPct ?? 50}%</span>
                                <div className="h-1.5 flex-1 bg-slate-950 rounded-sm overflow-hidden flex border border-border-warm/15">
                                    <div style={{ width: `${myTeamAnalysis.damageProfile?.physicalPct ?? 50}%` }} className="bg-gradient-to-r from-red-600 to-orange-500 h-full" />
                                    <div style={{ width: `${myTeamAnalysis.damageProfile?.magicPct ?? 50}%` }} className="bg-gradient-to-r from-cyan-600 to-blue-500 h-full" />
                                </div>
                                <span className="text-[9px] font-bold text-cyan-400/80 shrink-0">AP {myTeamAnalysis.damageProfile?.magicPct ?? 50}%</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. PELIGRO (AMENAZAS / COUNTERS) */}
                {threats && threats.length > 0 && (
                    <div className="flex flex-col gap-2 border-l-2 border-red-500/50 pl-3">
                        <div className="flex items-center gap-2 text-red-400">
                            <svg className="w-3.5 h-3.5 text-red-500/80 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <span className="text-[10px] md:text-[11px] font-black uppercase tracking-widest">
                                Peligro
                            </span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap mt-0.5">
                            {threats.map((t: any, idx: number) => (
                                <div key={`threat-${idx}`} className="relative group select-none cursor-help" title={`${t.name} (Amenaza)`}>
                                    <img 
                                        src={`https://ddragon.leagueoflegends.com/cdn/14.22.1/img/champion/${getChampionCdnName(t.name)}.png`}
                                        className="w-[34px] h-[34px] rounded-sm border border-red-950/70 hover:border-red-500 transition-all duration-150 cursor-pointer"
                                        alt={t.name}
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = "/favicon.svg";
                                        }}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 3. SINERGIAS FUERTES */}
                {synergies && synergies.length > 0 && (
                    <div className="flex flex-col gap-2 border-l-2 border-cyan-500/50 pl-3">
                        <div className="flex items-center gap-2 text-cyan-400">
                            <svg className="w-3.5 h-3.5 text-cyan-400/80 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                            </svg>
                            <span className="text-[10px] md:text-[11px] font-black uppercase tracking-widest">
                                Sinergias Fuertes
                            </span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap mt-0.5">
                            {synergies.map((s: any, idx: number) => (
                                <div key={`synergy-${idx}`} className="relative group select-none cursor-help" title={`${s.name} (Sinergia)`}>
                                    <img 
                                        src={`https://ddragon.leagueoflegends.com/cdn/14.22.1/img/champion/${getChampionCdnName(s.name)}.png`}
                                        className="w-[34px] h-[34px] rounded-sm border border-cyan-950/70 hover:border-cyan-400 transition-all duration-150 cursor-pointer"
                                        alt={s.name}
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = "/favicon.svg";
                                        }}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 4. VENTANA DE PODER */}
                <div className="flex flex-col gap-2.5 border-l-2 border-purple-accent/50 pl-3">
                    <div className="flex items-center gap-2 text-purple-accent">
                        <svg className="w-3.5 h-3.5 text-purple-400/80 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-purple-accent font-black tracking-widest uppercase text-[10px] md:text-[11px]">
                            Ventana de Poder
                        </span>
                    </div>
                    <p className="text-[12.5px] md:text-[13px] text-slate-200 leading-relaxed font-semibold">
                        {generalDirectives.timing}
                    </p>
                </div>

                {/* 5. CONSEJO */}
                {myTeamAnalysis && (
                    <div className="flex flex-col gap-2.5 border-l-2 border-amber-500/50 pl-3">
                        <div className="flex items-center gap-2 text-amber-500/90">
                            <svg className="w-3.5 h-3.5 text-amber-500/80 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 .364l-.707 .707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                            <span className="text-amber-500/90 font-black tracking-widest uppercase text-[10px] md:text-[11px]">
                                Consejo Táctico
                            </span>
                        </div>
                        <p className="text-[12.5px] md:text-[13px] text-slate-200 leading-relaxed font-semibold">
                            {getCompositionAdvice(myTeamAnalysis.winCondition)}
                        </p>
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