// src/lib/engine/tacticalEngine.ts
import { ENRICHED_DB } from './core/dataProvider.js';
import { normalizeKey } from './core/constants.js';

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
        let maxPt: any = curve[0];
        let minPt: any = curve[0];

        curve.forEach((pt: any) => {
            const val = typeof pt === 'object' && pt !== null ? pt.value : pt;
            const maxVal = typeof maxPt === 'object' && maxPt !== null ? maxPt.value : maxPt;
            const minVal = typeof minPt === 'object' && minPt !== null ? minPt.value : minPt;

            if (val > maxVal) maxPt = pt;
            if (val < minVal) minPt = pt;
        });

        const formatTime = (seconds: number) => {
            const m = Math.floor(seconds / 60);
            const s = seconds % 60;
            return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        };

        const maxTimeSec = typeof maxPt === 'object' && maxPt?.time !== undefined ? maxPt.time : 1200;
        const maxVal = typeof maxPt === 'object' && maxPt?.value !== undefined ? maxPt.value : (Number(maxPt) || 50.0);
        const minTimeSec = typeof minPt === 'object' && minPt?.time !== undefined ? minPt.time : 1800;
        const minVal = typeof minPt === 'object' && minPt?.value !== undefined ? minPt.value : (Number(minPt) || 50.0);

        peakTime = formatTime(maxTimeSec);
        peakWinrate = parseFloat(maxVal.toFixed(1));
        valleyTime = formatTime(minTimeSec);
        valleyWinrate = parseFloat(minVal.toFixed(1));
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
    let dynamicStrategy = `Estilo: ${champ.scalingType === 'Early' ? 'Juego Temprano' : champ.scalingType === 'Late' ? 'Juego Tardío' : 'Juego Medio'}. `;
    if (threats.length > 0) {
        dynamicStrategy += `Cuidado con: ${threats.map(t => t.name).join(', ')}. `;
    }
    if (advantages.length > 0) {
        dynamicStrategy += `Pelea con: ${advantages.map(a => a.name).join(', ')}. `;
    }
    if (activeSynergies.length > 0) {
        dynamicStrategy += `Sinergia con: ${activeSynergies.map(s => s.name).join(', ')}.`;
    } else {
        dynamicStrategy += `Prioriza el mapa con tu equipo.`;
    }

    const timingRange = champ.scalingType === 'Early' ? '5-15 min' : (champ.scalingType === 'Late' ? '25+ min' : '15-25 min');
    const dynamicTiming = `Pico en min. ${peakTime.split(':')[0]} (${peakWinrate}% WR). Ventana ideal: ${timingRange}.`;

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

/**
 * Calcula dinámicamente el orden de maxeo de habilidades (Q, W, E) analizando
 * la secuencia de niveles 1 a 15 o los metadatos de prioridades.
 * 
 * @param skillsData - Array de habilidades por nivel (ej: ['Q','W','E','Q','Q','R',...]) o un objeto con prioridades.
 * @returns String con el orden de maxeo formateado (ej: 'Q > E > W').
 */
export function calculateSkillMaxOrder(skillsData: any): string {
    if (!skillsData) return 'Q > W > E';

    // 1. Caso: Array de niveles (ej: scraper de OP.GG con 15 niveles)
    if (Array.isArray(skillsData) && skillsData.length >= 3) {
        const counts: Record<string, number> = { Q: 0, W: 0, E: 0 };
        const maxReachedOrder: string[] = [];

        for (let i = 0; i < skillsData.length; i++) {
            const rawSkill = String(skillsData[i]).toUpperCase().trim();
            if (rawSkill === 'Q' || rawSkill === 'W' || rawSkill === 'E') {
                counts[rawSkill] = (counts[rawSkill] || 0) + 1;
                // Al alcanzar el 5to punto (máximo de la habilidad básica)
                if (counts[rawSkill] === 5 && !maxReachedOrder.includes(rawSkill)) {
                    maxReachedOrder.push(rawSkill);
                }
            }
        }

        // Habilidades restantes que no alcanzaron los 5 puntos ordenadas por cantidad de puntos acumulados
        const remaining = ['Q', 'W', 'E']
            .filter(k => !maxReachedOrder.includes(k))
            .sort((a, b) => (counts[b] || 0) - (counts[a] || 0));

        const finalOrder = [...maxReachedOrder, ...remaining];
        return finalOrder.join(' > ');
    }

    // 2. Caso: Objeto con skillLevelUp1, skillLevelUp2, skillLevelUp3
    if (typeof skillsData === 'object') {
        const s = skillsData.skills || skillsData;
        if (s.skillLevelUp1 !== undefined || s.skillLevelUp2 !== undefined || s.skillLevelUp3 !== undefined) {
            const order = [
                { key: 'Q', pos: typeof s.skillLevelUp1 === 'number' ? s.skillLevelUp1 : 1 },
                { key: 'W', pos: typeof s.skillLevelUp2 === 'number' ? s.skillLevelUp2 : 2 },
                { key: 'E', pos: typeof s.skillLevelUp3 === 'number' ? s.skillLevelUp3 : 3 }
            ].sort((a, b) => a.pos - b.pos);
            return order.map(x => x.key).join(' > ');
        }
    }

    // 3. Caso: String preexistente
    if (typeof skillsData === 'string' && skillsData.includes('>')) {
        return skillsData.trim();
    }

    return 'Q > W > E';
}

