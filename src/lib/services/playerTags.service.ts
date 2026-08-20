// src/lib/services/playerTags.service.ts

export type TagCategory = 'session' | 'mastery' | 'combat' | 'vision' | 'warning' | 'duo' | 'general';

export interface PlayerTagItem {
  id: string;
  label: string;
  category: TagCategory;
  priority: number; // Mayor número = mayor prioridad en vistas compactas (1 - 100)
  style: string;    // Clases CSS de Tailwind
  tooltip: string;
}

// =========================================================================
// TODO: Colores y nombres tentativos - Modificar según diseño final
// Puedes editar los textos ('label'), las explicaciones ('tooltip')
// y las clases de color/borde ('style') directamente en este bloque.
// =========================================================================
export const TAG_CONFIG = {
  // --- SESIÓN DEL DÍA / ESTADO TEMPORAL ---
  COLD_START: {
    label: 'DESPERTANDO', // Alternativas: 'FRÍO (0-0)', '1ª PARTIDA DEL DÍA'
    category: 'session' as TagCategory,
    priority: 95,
    style: 'border-slate-500/50 text-slate-300 bg-slate-900/80',
    tooltip: 'Primera partida del día (0-0 en la sesión actual).'
  },
  SESSION_WIN_STREAK: (count: number) => ({
    label: `RACHA HOY ${count}W`,
    category: 'session' as TagCategory,
    priority: 92,
    style: 'border-amber-400/60 text-amber-300 bg-amber-950/40',
    tooltip: `Lleva ${count} victorias consecutivas en la sesión de hoy.`
  }),
  SESSION_LOSS_STREAK: (count: number) => ({
    label: `TILTEADO (${count}L)`,
    category: 'warning' as TagCategory,
    priority: 93,
    style: 'border-rose-500/70 text-rose-300 bg-rose-950/40',
    tooltip: `Lleva ${count} derrotas consecutivas hoy (posible estado de tilt).`
  }),

  // --- MAESTRÍA Y HABILIDAD CON EL CAMPEÓN ---
  OTP: (championName: string) => ({
    label: `OTP ${championName.toUpperCase()}`,
    category: 'mastery' as TagCategory,
    priority: 90,
    style: 'border-yellow-400/60 text-yellow-300 bg-yellow-950/30',
    tooltip: `Juega casi exclusivamente ${championName} en sus partidas recientes.`
  }),
  MAIN_CHAMPION: (championName: string, winrate?: number) => ({
    label: `MAIN ${championName.toUpperCase()}`,
    category: 'mastery' as TagCategory,
    priority: 82,
    style: 'border-purple-400/60 text-purple-200 bg-purple-950/40',
    tooltip: `Campeón principal del invocador${winrate ? ` (${winrate}% WR)` : ''}.`
  }),
  EXPERT_CHAMPION: (championName: string, winrate: number) => ({
    label: `EXPERTO ${championName.toUpperCase()}`,
    category: 'mastery' as TagCategory,
    priority: 85,
    style: 'border-emerald-400/60 text-emerald-300 bg-emerald-950/40',
    tooltip: `Gran dominio con ${championName} (${winrate}% de victorias recientes).`
  }),
  NEW_CHAMPION: {
    label: 'CAMPEÓN NUEVO',
    category: 'warning' as TagCategory,
    priority: 84,
    style: 'border-orange-500/60 text-orange-300 bg-orange-950/40',
    tooltip: 'Pocas o ninguna partida previa con este campeón en clasificatorias.'
  },
  HIGH_KDA: (kda: number) => ({
    label: `KDA ALTO (${kda.toFixed(1)})`,
    category: 'combat' as TagCategory,
    priority: 78,
    style: 'border-emerald-400/50 text-emerald-300 bg-emerald-950/30',
    tooltip: `Mantiene un promedio de KDA de ${kda.toFixed(2)} en sus partidas.`
  }),
  MVP: {
    label: 'MVP FRECUENTE',
    category: 'combat' as TagCategory,
    priority: 80,
    style: 'border-amber-400/60 text-amber-300 bg-amber-950/40',
    tooltip: 'Suele ser el jugador con mejor puntuación de rendimiento del equipo.'
  },
  ACE: {
    label: 'ACE RECIENTE',
    category: 'combat' as TagCategory,
    priority: 76,
    style: 'border-purple-400/50 text-purple-200 bg-purple-950/30',
    tooltip: 'Mejor jugador de su equipo a pesar de la derrota.'
  },

  // --- RENDIMIENTO EN PARTIDA Y FASE DE LÍNEAS ---
  EARLY_AGGRESSIVE: {
    label: 'ASESINO TEMPRANO',
    category: 'combat' as TagCategory,
    priority: 74,
    style: 'border-red-400/60 text-red-300 bg-red-950/40',
    tooltip: 'Alta frecuencia de obtención o asistencia en Primera Sangre (First Blood).'
  },
  GOOD_CS: (csPerMin: number) => ({
    label: `BUEN CS (${csPerMin.toFixed(1)}/m)`,
    category: 'combat' as TagCategory,
    priority: 72,
    style: 'border-teal-400/50 text-teal-300 bg-teal-950/30',
    tooltip: `Promedia ${csPerMin.toFixed(1)} súbditos por minuto en sus partidas.`
  }),
  BAD_CS: (csPerMin: number) => ({
    label: `BAJO CS (${csPerMin.toFixed(1)}/m)`,
    category: 'warning' as TagCategory,
    priority: 73,
    style: 'border-amber-600/60 text-amber-300 bg-amber-950/40',
    tooltip: `Promedio bajo de súbditos (${csPerMin.toFixed(1)} CS/min) para su posición.`
  }),
  TOWER_DESTROYER: {
    label: 'DESTRUCTOR TORRES',
    category: 'combat' as TagCategory,
    priority: 68,
    style: 'border-yellow-500/50 text-yellow-300 bg-yellow-950/30',
    tooltip: 'Se enfoca intensamente en el empuje dividido y daño a estructuras.'
  },
  UNDENIABLE_DAMAGE: (percentage?: number) => ({
    label: percentage ? `GRAN DAÑO (${percentage}%)` : 'GRAN DAÑO',
    category: 'combat' as TagCategory,
    priority: 70,
    style: 'border-red-400/50 text-red-300 bg-red-950/30',
    tooltip: 'Lidera regularmente las tablas de daño a campeones en sus partidas.'
  }),
  SURVIVOR: (avgDeaths: number) => ({
    label: 'SUPERVIVIENTE',
    category: 'combat' as TagCategory,
    priority: 66,
    style: 'border-emerald-400/50 text-emerald-300 bg-emerald-950/30',
    tooltip: `Promedia muy pocas muertes por partida (${avgDeaths.toFixed(1)} muertes).`
  }),
  FEEDS_OFTEN: (avgDeaths: number) => ({
    label: 'MUERE MUCHO',
    category: 'warning' as TagCategory,
    priority: 79,
    style: 'border-rose-500/60 text-rose-300 bg-rose-950/40',
    tooltip: `Alto promedio de muertes por partida (${avgDeaths.toFixed(1)} muertes).`
  }),
  LOSES_LANE: {
    label: 'PIERDE LÍNEA',
    category: 'warning' as TagCategory,
    priority: 75,
    style: 'border-rose-400/60 text-rose-300 bg-rose-950/40',
    tooltip: 'Frecuente desventaja de oro en fase de líneas temprana y bajo winrate.'
  },
  RECENTLY_UNDEFEATED: (wins: number) => ({
    label: `INVICTO (${wins}V)`,
    category: 'mastery' as TagCategory,
    priority: 81,
    style: 'border-cyan-400/60 text-cyan-300 bg-cyan-950/30',
    tooltip: `No ha perdido ninguna partida reciente con este campeón (${wins}V - 0D).`
  }),

  // --- VISIÓN Y CONTROL DEL MAPA ---
  HIGH_VISION: (visionPerMin?: number) => ({
    label: 'GRAN VISIÓN',
    category: 'vision' as TagCategory,
    priority: 64,
    style: 'border-indigo-400/50 text-indigo-300 bg-indigo-950/30',
    tooltip: `Excelente puntuación de control de visión${visionPerMin ? ` (${visionPerMin.toFixed(1)}/min)` : ''}.`
  }),
  LOW_VISION: {
    label: 'BAJA VISIÓN',
    category: 'warning' as TagCategory,
    priority: 65,
    style: 'border-slate-500/60 text-slate-400 bg-slate-900/60',
    tooltip: 'Rara vez coloca centinelas o compra centinelas de control.'
  },
  BUYS_PINKS: {
    label: 'COMPRA PINKS',
    category: 'vision' as TagCategory,
    priority: 60,
    style: 'border-pink-400/50 text-pink-300 bg-pink-950/30',
    tooltip: 'Compra regularmente Centinelas de Control (Control Wards).'
  },
  GANKABLE: {
    label: 'VULNERABLE A GANKS',
    category: 'warning' as TagCategory,
    priority: 83,
    style: 'border-rose-400/70 text-rose-300 bg-rose-950/40',
    tooltip: 'Bajo control de visión sumado a muertes frecuentes en juego temprano.'
  },

  // --- ROL Y AUTOFILL ---
  AUTOFILL: (assignedRole: string) => ({
    label: `FUERA DE ROL (${assignedRole})`,
    category: 'warning' as TagCategory,
    priority: 88,
    style: 'border-amber-500/60 text-amber-300 bg-amber-950/40',
    tooltip: `Está jugando ${assignedRole}, una posición que apenas juega en su historial.`
  }),

  // --- DÚOS Y PREMADES ---
  DUO_PARTNER: (partnerName: string, winrate?: number) => ({
    label: `DÚO CON ${partnerName.toUpperCase()}`,
    category: 'duo' as TagCategory,
    priority: 96,
    style: 'border-cyan-400/70 text-cyan-200 bg-cyan-950/40',
    tooltip: `Jugando en premade con ${partnerName}${winrate !== undefined ? ` (${winrate}% WR juntos)` : ''}.`
  }),

  // --- ESTADO GENERAL ---
  STREAMER_MODE: {
    label: 'MODO STREAMER',
    category: 'general' as TagCategory,
    priority: 50,
    style: 'border-slate-600/50 text-slate-400 bg-slate-900/70',
    tooltip: 'Nombre de invocador e información ocultos por modo streamer.'
  },
  CONSISTENT: {
    label: 'CONSISTENTE',
    category: 'general' as TagCategory,
    priority: 55,
    style: 'border-emerald-400/50 text-emerald-300 bg-emerald-950/30',
    tooltip: 'Mantiene un puntaje promedio alto en sus últimas partidas.'
  }
};

// =========================================================================
// Interfaz de Entrada para el Motor de Etiquetas
// =========================================================================
export interface PlayerTagContext {
  puuid?: string;
  summonerName?: string;
  championId: number;
  championName: string;
  role?: string;
  isMain?: boolean;
  isStreamerMode?: boolean;
  
  // Sesión de hoy
  todayRecord?: {
    wins: number;
    losses: number;
    totalGames?: number;
    winrate: number | null;
    streak?: {
      type: 'win' | 'loss' | null;
      count: number;
    };
  };

  // Histórico y Estadísticas
  ranked?: {
    tier: string;
    wins: number;
    losses: number;
    winrate: number;
  };
  topChampions?: Array<{
    name: string;
    wins: number;
    losses: number;
    winrate: number;
  }>;
  opScoreAvg?: number;
  recentMatches?: Array<{
    championId: number;
    championName?: string;
    win: boolean;
    kills: number;
    deaths: number;
    assists: number;
    cs: number;
    gameDurationMinutes: number;
    visionScore: number;
    visionWardsBought: number;
    damageShare?: number;
    turretDamage?: number;
    firstBlood?: boolean;
    role?: string;
  }>;

  // Dúos detectados
  duoPartner?: {
    name: string;
    gamesTogether: number;
    winrate: number;
  };
}

/**
 * Genera el conjunto de etiquetas completas para un jugador según sus datos y su sesión.
 */
export function generatePlayerTags(ctx: PlayerTagContext): PlayerTagItem[] {
  const tags: PlayerTagItem[] = [];

  if (ctx.isStreamerMode) {
    tags.push({ id: 'streamer_mode', ...TAG_CONFIG.STREAMER_MODE });
    return tags;
  }

  // 1. DÚO / PREMADE (Máxima Prioridad)
  if (ctx.duoPartner && ctx.duoPartner.gamesTogether >= 2) {
    tags.push({
      id: 'duo_partner',
      ...TAG_CONFIG.DUO_PARTNER(ctx.duoPartner.name, ctx.duoPartner.winrate)
    });
  }

  // 2. SESIÓN DEL DÍA / RACHAS
  const todayWins = ctx.todayRecord?.wins || 0;
  const todayLosses = ctx.todayRecord?.losses || 0;
  const todayGames = todayWins + todayLosses;

  if (todayGames === 0) {
    // Si no ha jugado ninguna partida hoy, marcar como 'DESPERTANDO' / 'FRÍO'
    tags.push({ id: 'cold_start', ...TAG_CONFIG.COLD_START });
  } else {
    // Si ha jugado hoy, evaluar racha sobre la sesión actual
    const sessionStreak = ctx.todayRecord?.streak;
    if (sessionStreak?.type === 'win' && sessionStreak.count >= 3) {
      tags.push({
        id: 'session_win_streak',
        ...TAG_CONFIG.SESSION_WIN_STREAK(sessionStreak.count)
      });
    } else if (sessionStreak?.type === 'loss' && sessionStreak.count >= 3) {
      tags.push({
        id: 'session_loss_streak',
        ...TAG_CONFIG.SESSION_LOSS_STREAK(sessionStreak.count)
      });
    }
  }

  // 3. MAESTRÍA Y DOMINIO CON EL CAMPEÓN ACTUAL
  const champName = ctx.championName || 'Campeón';
  const matches = ctx.recentMatches || [];
  const champMatches = matches.filter(m => m.championId === ctx.championId || (m.championName && m.championName.toLowerCase() === champName.toLowerCase()));

  const mainEntry = ctx.topChampions?.find(c => c.name.toLowerCase() === champName.toLowerCase());

  if (champMatches.length >= 10 && champMatches.length / Math.max(1, matches.length) >= 0.6) {
    tags.push({ id: 'otp', ...TAG_CONFIG.OTP(champName) });
  } else if (mainEntry || ctx.isMain) {
    const wr = mainEntry?.winrate;
    if (mainEntry && mainEntry.wins + mainEntry.losses >= 5 && wr && wr >= 65) {
      tags.push({ id: 'expert_champion', ...TAG_CONFIG.EXPERT_CHAMPION(champName, wr) });
    } else {
      tags.push({ id: 'main_champion', ...TAG_CONFIG.MAIN_CHAMPION(champName, wr) });
    }
  } else if (matches.length >= 5 && champMatches.length <= 1) {
    tags.push({ id: 'new_champion', ...TAG_CONFIG.NEW_CHAMPION });
  }

  // Invicto reciente con el campeón
  if (champMatches.length >= 3 && champMatches.every(m => m.win)) {
    tags.push({
      id: 'recently_undefeated',
      ...TAG_CONFIG.RECENTLY_UNDEFEATED(champMatches.length)
    });
  }

  // 4. RENDIMIENTO DE COMBATE & FASE DE LÍNEAS
  if (matches.length > 0) {
    const totalKills = matches.reduce((acc, m) => acc + m.kills, 0);
    const totalDeaths = matches.reduce((acc, m) => acc + m.deaths, 0);
    const totalAssists = matches.reduce((acc, m) => acc + m.assists, 0);
    const avgDeaths = totalDeaths / matches.length;
    const avgKda = totalDeaths === 0 ? (totalKills + totalAssists) : (totalKills + totalAssists) / totalDeaths;

    if (avgKda >= 3.8) {
      tags.push({ id: 'high_kda', ...TAG_CONFIG.HIGH_KDA(avgKda) });
    }

    if (avgDeaths <= 2.5 && matches.length >= 4) {
      tags.push({ id: 'survivor', ...TAG_CONFIG.SURVIVOR(avgDeaths) });
    } else if (avgDeaths >= 6.5 && matches.length >= 4) {
      tags.push({ id: 'feeds_often', ...TAG_CONFIG.FEEDS_OFTEN(avgDeaths) });
    }

    // First blood
    const fbCount = matches.filter(m => m.firstBlood).length;
    if (matches.length >= 5 && fbCount / matches.length >= 0.3) {
      tags.push({ id: 'early_aggressive', ...TAG_CONFIG.EARLY_AGGRESSIVE });
    }

    // CS por minuto (aplicable a Top, Mid, ADC, Jungla)
    const isSupport = (ctx.role || '').toUpperCase() === 'SUPP' || (ctx.role || '').toUpperCase() === 'SUPPORT' || (ctx.role || '').toUpperCase() === 'UTILITY';
    if (!isSupport) {
      const validCsMatches = matches.filter(m => m.gameDurationMinutes > 5);
      if (validCsMatches.length > 0) {
        const totalCs = validCsMatches.reduce((acc, m) => acc + m.cs, 0);
        const totalMin = validCsMatches.reduce((acc, m) => acc + m.gameDurationMinutes, 0);
        const avgCsPerMin = totalMin > 0 ? totalCs / totalMin : 0;

        if (avgCsPerMin >= 7.5) {
          tags.push({ id: 'good_cs', ...TAG_CONFIG.GOOD_CS(avgCsPerMin) });
        } else if (avgCsPerMin < 5.0 && validCsMatches.length >= 3) {
          tags.push({ id: 'bad_cs', ...TAG_CONFIG.BAD_CS(avgCsPerMin) });
        }
      }
    }

    // Visión
    const validVisionMatches = matches.filter(m => m.gameDurationMinutes > 5);
    if (validVisionMatches.length > 0) {
      const totalVision = validVisionMatches.reduce((acc, m) => acc + m.visionScore, 0);
      const totalMin = validVisionMatches.reduce((acc, m) => acc + m.gameDurationMinutes, 0);
      const avgVisionPerMin = totalMin > 0 ? totalVision / totalMin : 0;
      const totalPinks = validVisionMatches.reduce((acc, m) => acc + m.visionWardsBought, 0);
      const avgPinks = totalPinks / validVisionMatches.length;

      const visionThreshold = isSupport ? 2.0 : 1.3;
      const lowVisionThreshold = isSupport ? 0.9 : 0.5;

      if (avgVisionPerMin >= visionThreshold) {
        tags.push({ id: 'high_vision', ...TAG_CONFIG.HIGH_VISION(avgVisionPerMin) });
      } else if (avgVisionPerMin < lowVisionThreshold && validVisionMatches.length >= 3) {
        tags.push({ id: 'low_vision', ...TAG_CONFIG.LOW_VISION });

        if (avgDeaths >= 5.5) {
          tags.push({ id: 'gankable', ...TAG_CONFIG.GANKABLE });
        }
      }

      if (avgPinks >= 1.8) {
        tags.push({ id: 'buys_pinks', ...TAG_CONFIG.BUYS_PINKS });
      }
    }
  }

  // 5. AUTOFILL / FUERA DE ROL
  if (ctx.role && matches.length >= 6) {
    const currentRole = ctx.role.toUpperCase();
    const roleMatches = matches.filter(m => (m.role || '').toUpperCase() === currentRole);
    if (roleMatches.length / matches.length < 0.15) {
      tags.push({ id: 'autofill', ...TAG_CONFIG.AUTOFILL(ctx.role) });
    }
  }

  // 6. CONSISTENCIA / OP SCORE
  if (ctx.opScoreAvg && ctx.opScoreAvg >= 7.5) {
    tags.push({ id: 'consistent', ...TAG_CONFIG.CONSISTENT });
  }

  // Ordenar por prioridad descendente
  return tags.sort((a, b) => b.priority - a.priority);
}

/**
 * Filtra las etiquetas según el modo de visualización o tamaño de pantalla.
 * @param tags Lista completa de etiquetas calculadas.
 * @param mode 'normal' (3 a 6 etiquetas) o 'compact' (2 a 3 etiquetas prioritarias).
 */
export function filterTagsByMode(tags: PlayerTagItem[], mode: 'normal' | 'compact' | number = 'normal'): PlayerTagItem[] {
  let maxCount = 5;

  if (typeof mode === 'number') {
    maxCount = mode;
  } else if (mode === 'compact') {
    maxCount = 3;
  } else {
    maxCount = 6;
  }

  return tags.slice(0, maxCount);
}
