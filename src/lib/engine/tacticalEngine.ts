// src/lib/engine/tacticalEngine.ts
import { ENRICHED_DB, normalizeKey } from './dataProvider';

export interface CombatStyle {
    physicalPct: number;
    magicPct: number;
    truePct: number;
    description: string;
}

export interface WinrateCurveAnalysis {
    peakTime: string;
    peakWinrate: number;
    valleyTime: string;
    valleyWinrate: number;
    trendDescription: string;
}

export interface MatchupAdvice {
    name: string;
    winrate: string;
    goldDiff: string;
    xpDiff: string;
    csDiff: string;
    dominanceScore: number;
    laneTag: string;
    combatAdvice: string;
}

export interface SynergyAdvice {
    name: string;
    delta: number;
    advice: string;
}

export interface TacticalDirectivesData {
    championName: string;
    scalingType: 'Early' | 'Mid' | 'Late';
    combatStyle: CombatStyle;
    winrateCurveAnalysis: WinrateCurveAnalysis;
    matchups: {
        threats: MatchupAdvice[];
        advantages: MatchupAdvice[];
    };
    synergies: SynergyAdvice[];
    generalDirectives: {
        strategy: string;
        timing: string;
    };
}

export function getTacticalDirectives(
    championName: string,
    myRole: string,
    allies: string[],
    enemies: string[]
): TacticalDirectivesData {
    const champ = ENRICHED_DB[championName];

    // Fallback por defecto si el campeón no se encuentra
    if (!champ) {
        return {
            championName: championName || 'Tu Campeón',
            scalingType: 'Mid',
            combatStyle: {
                physicalPct: 50,
                magicPct: 50,
                truePct: 0,
                description: 'Perfil de daño balanceado por defecto. Adapta tu build según los tanques del enemigo.'
            },
            winrateCurveAnalysis: {
                peakTime: '20:00',
                peakWinrate: 50.0,
                valleyTime: '35:00',
                valleyWinrate: 50.0,
                trendDescription: 'Curva de winrate estable de rango medio.'
            },
            matchups: { threats: [], advantages: [] },
            synergies: [],
            generalDirectives: {
                strategy: `Mantén un ritmo de juego constante con ${championName || 'tu campeón'}. Asegura objetivos neutrales y coordina peleas grupales con tu equipo en el juego medio.`,
                timing: '15:00 a 25:00'
            }
        };
    }

    // 1. ANÁLISIS DE ESTILO DE COMBATE (COMPOSICIÓN DE DAÑO)
    const dmg = champ.combat?.damageComposition || { physical: 50, magic: 50, true: 0 };
    const totalDmg = (dmg.physical || 0) + (dmg.magic || 0) + (dmg.true || 0) || 1;
    const physicalPct = Math.round(((dmg.physical || 0) / totalDmg) * 100);
    const magicPct = Math.round(((dmg.magic || 0) / totalDmg) * 100);
    const truePct = 100 - physicalPct - magicPct;

    let dmgDesc = '';
    if (physicalPct > 75) {
        dmgDesc = `Daño casi exclusivo Físico (${physicalPct}%). Si el enemigo acumula Armadura, prioriza penetración de armadura temprana como Cuchilla Negra o Último Suspiro.`;
    } else if (magicPct > 75) {
        dmgDesc = `Daño casi exclusivo Mágico (${magicPct}%). Excelente para castigar composiciones enemigas sin resistencia mágica. Prioriza Bastón del Vacío si acumulan RM.`;
    } else if (truePct > 20) {
        dmgDesc = `Alta proporción de Daño Verdadero (${truePct}%). Ignoras gran parte de las defensas enemigas. Escalas muy bien contra tanques.`;
    } else {
        dmgDesc = `Daño Híbrido (${physicalPct}% Físico, ${magicPct}% Mágico). Perfil difícil de itemizar en tu contra; saca provecho de las defensas desbalanceadas de tus oponentes.`;
    }

    // 2. CURVA DE WINRATE (PEAK & VALLEY)
    const curve = champ.combat?.winrateCurve || [];
    let peakTime = '20:00';
    let peakWinrate = 50.0;
    let valleyTime = '35:00';
    let valleyWinrate = 50.0;

    if (curve.length > 0) {
        let maxPt = curve[0];
        let minPt = curve[0];

        curve.forEach((pt: any) => {
            const val = typeof pt === 'object' ? pt.value : pt;
            const maxVal = typeof maxPt === 'object' ? maxPt.value : maxPt;
            const minVal = typeof minPt === 'object' ? minPt.value : minPt;

            if (val > maxVal) maxPt = pt;
            if (val < minVal) minPt = pt;
        });

        const formatTime = (seconds: number) => {
            const m = Math.floor(seconds / 60);
            const s = seconds % 60;
            return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        };

        peakTime = formatTime(maxPt.time || 1200);
        peakWinrate = parseFloat((maxPt.value || 50.0).toFixed(1));
        valleyTime = formatTime(minPt.time || 1800);
        valleyWinrate = parseFloat((minPt.value || 50.0).toFixed(1));
    }

    let trendDesc = '';
    if (champ.scalingType === 'Early') {
        trendDesc = `Fuerte presencia en juego temprano. Tu pico de poder óptimo está en el minuto ${peakTime.split(':')[0]} (${peakWinrate}% WR). Busca forzar escaramuzas y cerrar la partida antes de que decaiga al minuto ${valleyTime.split(':')[0]}.`;
    } else if (champ.scalingType === 'Late') {
        trendDesc = `Hiper-escalado hacia el juego tardío. El winrate aumenta a un pico de ${peakWinrate}% en el minuto ${peakTime.split(':')[0]}. Minimiza riesgos temprano y prioriza el farm seguro.`;
    } else {
        trendDesc = `Curva de poder estable de juego medio. El punto más fuerte es alrededor del minuto ${peakTime.split(':')[0]} (${peakWinrate}% WR). Coordina peleas por objetivos y mantén presión constante.`;
    }

    // 3. MATCHUPS (COUNTERS & ADVANTAGES)
    const threats: MatchupAdvice[] = [];
    const advantages: MatchupAdvice[] = [];

    enemies.forEach((enemyName) => {
        const normEnemy = normalizeKey(enemyName);

        // Buscar en Counters (Amenazas para nuestro campeón)
        const counterMatch = champ.counters?.find((c: any) => normalizeKey(c.name) === normEnemy);
        if (counterMatch) {
            const wr = parseFloat(counterMatch.winrate.replace('%', ''));
            const gDiff = parseInt(counterMatch.goldDiff || '0');
            const xpDiffVal = parseInt(counterMatch.xpDiff || '0');
            const csDiffVal = parseFloat(counterMatch.csDiff || '0');
            const dom = counterMatch.dominanceScore || 0;

            let advice = `Sufres contra ${enemyName}. Dominancia de ${dom} en su favor. `;
            if (gDiff < 0) {
                advice += `Tiendes a quedar detrás por ${Math.abs(gDiff)} de oro en línea. `;
            }
            if (xpDiffVal < 0) {
                advice += `Sufres déficit de ${Math.abs(xpDiffVal)} XP. `;
            }
            advice += `Juega defensivo y evita intercambios 1v1 prolongados en fase de líneas.`;

            threats.push({
                name: enemyName,
                winrate: counterMatch.winrate,
                goldDiff: counterMatch.goldDiff,
                xpDiff: counterMatch.xpDiff,
                csDiff: counterMatch.csDiff,
                dominanceScore: dom,
                laneTag: counterMatch.laneTag || 'Dificultad Alta',
                combatAdvice: advice
            });
        }

        // Buscar en GodMatchups (Ventajas para nuestro campeón)
        const godMatch = champ.godMatchups?.find((g: any) => normalizeKey(g.name) === normEnemy);
        if (godMatch) {
            const wr = parseFloat(godMatch.winrate.replace('%', ''));
            const gDiff = parseInt(godMatch.goldDiff || '0');
            const xpDiffVal = parseInt(godMatch.xpDiff || '0');
            const csDiffVal = parseFloat(godMatch.csDiff || '0');
            const dom = godMatch.dominanceScore || 0;

            let advice = `Tienes dominancia de +${dom} contra ${enemyName}. `;
            if (gDiff > 0) {
                advice += `Sueles acumular ventaja de +${gDiff} de oro. `;
            }
            if (csDiffVal > 0) {
                advice += `Diferencia a favor de +${csDiffVal} de CS. `;
            }
            advice += `Busca forzar intercambios agresivos en línea; tienes la ventaja táctica.`;

            advantages.push({
                name: enemyName,
                winrate: godMatch.winrate,
                goldDiff: godMatch.goldDiff,
                xpDiff: godMatch.xpDiff,
                csDiff: godMatch.csDiff,
                dominanceScore: dom,
                laneTag: godMatch.laneTag || 'Línea Favorable',
                combatAdvice: advice
            });
        }
    });

    // 4. SINERGIAS
    const activeSynergies: SynergyAdvice[] = [];
    allies.forEach((allyName) => {
        const normAlly = normalizeKey(allyName);
        let foundSynergy: any = null;

        // Recorrer los carriles en el objeto de sinergias
        if (champ.synergies) {
            for (const laneGroup of Object.values(champ.synergies)) {
                if (Array.isArray(laneGroup)) {
                    const match = laneGroup.find((s: any) => normalizeKey(s.name) === normAlly);
                    if (match) {
                        foundSynergy = match;
                        break;
                    }
                }
            }
        }

        if (foundSynergy) {
            const delta = parseFloat(foundSynergy.delta);
            if (delta > 0) {
                activeSynergies.push({
                    name: allyName,
                    delta: delta,
                    advice: `Sinergia de +${delta}% de winrate al jugar junto a ${allyName}. Coordine habilidades e iniciaciones con este aliado.`
                });
            }
        }
    });

    // 5. DIRECTIVAS GENERALES DE COMBATE (ESTRATEGIA & TIMING DINÁMICOS)
    let dynamicStrategy = `Como ${championName} en la posición de ${myRole.toUpperCase()}, tu perfil es de tipo ${champ.scalingType}. `;
    if (threats.length > 0) {
        dynamicStrategy += `Ten precaución extrema contra ${threats.map(t => t.name).join(', ')} en peleas de equipo. `;
    }
    if (advantages.length > 0) {
        dynamicStrategy += `Busca explotar tus ventajas de tradeo directamente sobre ${advantages.map(a => a.name).join(', ')}. `;
    }
    if (activeSynergies.length > 0) {
        dynamicStrategy += `Apóyate en combos coordinados con ${activeSynergies.map(s => s.name).join(', ')} para forzar iniciaciones limpias.`;
    } else {
        dynamicStrategy += `Juega con paciencia y prioriza el control del mapa con tu equipo.`;
    }

    const timingRange = champ.scalingType === 'Early' ? '05:00 a 15:00' : (champ.scalingType === 'Late' ? '25:00+' : '15:00 a 25:00');
    const dynamicTiming = `Tu ventana ideal está entre ${timingRange} debido a tu pico de poder máximo ubicado en el minuto ${peakTime} (con ${peakWinrate}% de winrate).`;

    return {
        championName,
        scalingType: champ.scalingType,
        combatStyle: {
            physicalPct,
            magicPct,
            truePct,
            description: dmgDesc
        },
        winrateCurveAnalysis: {
            peakTime,
            peakWinrate,
            valleyTime,
            valleyWinrate,
            trendDescription: trendDesc
        },
        matchups: {
            threats,
            advantages
        },
        synergies: activeSynergies,
        generalDirectives: {
            strategy: dynamicStrategy,
            timing: dynamicTiming
        }
    };
}
