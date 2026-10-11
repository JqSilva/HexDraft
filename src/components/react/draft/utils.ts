export const ROLE_TRANSLATIONS: Record<string, string> = {
    "mage": "Mago",
    "mago": "Mago",
    "assassin": "Asesino",
    "asesino": "Asesino",
    "fighter": "Luchador",
    "luchador": "Luchador",
    "tank": "Tanque",
    "tanque": "Tanque",
    "marksman": "Tirador",
    "tirador": "Tirador",
    "support": "Soporte",
    "soporte": "Soporte",
    "zonecontrol": "Mago de Control",
    "zone_control": "Mago de Control",
    "diver": "Luchador",
    "juggernaut": "Coloso",
    "skirmisher": "Duelista",
    "slayer": "Asesino",
    "warden": "Protector",
    "vanguard": "Iniciador",
    "enchanter": "Encantador",
    "catcher": "Capturador"
};

export const getFriendlyRoleName = (tag: string): string => {
    if (!tag) return "Campeón";
    const norm = tag.toLowerCase().replace(/[^a-z0-9]/g, "");
    return ROLE_TRANSLATIONS[norm] || tag;
};

export const executeLcuAction = async (actionId: number, championId: number): Promise<boolean> => {
    try {
        const res = await fetch('/api/execute-action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ actionId, championId, completed: true })
        });
        if (res.ok) {
            const data = await res.json();
            console.log(`✅ Acción ejecutada en LCU: campeón ${championId} (success: ${data.success})`);
            return data.success === true;
        }
        return false;
    } catch (e) {
        console.error("❌ Error en acción LCU:", e);
        return false;
    }
};

/**
 * Parámetros para la preselección provisional manual de un campeón.
 */
export interface PreselectChampionParams {
    championId: number;
    isBan: boolean;
    sessionData: any;
}

/**
 * Resultado estructurado devuelto por la preselección provisional.
 */
export interface PreselectChampionResult {
    success: boolean;
    championId: number;
    actionType?: 'action' | 'intent';
    isBan: boolean;
    message: string;
    reason?:
        | 'NOT_IN_DRAFT'
        | 'INVALID_CHAMPION'
        | 'CHAMPION_UNAVAILABLE'
        | 'NOT_YOUR_TURN'
        | 'ALREADY_LOCKED'
        | 'DRAFT_FINALIZED'
        | 'IN_FLIGHT'
        | 'RATE_LIMITED'
        | 'LCU_ERROR'
        | 'SUCCESS';
}

// Variables de módulo para control de peticiones en curso (in-flight request lock) y debounce
let isPreselectInFlight = false;
let lastPreselectChampId: number | null = null;
let lastPreselectIsBan: boolean | null = null;
let lastPreselectTimestamp = 0;

/**
 * Ejecuta una preselección provisional manual de campeón (hover o pick intent) en el cliente de League of Legends mediante LCU.
 *
 * Garantías críticas de funcionamiento:
 * 1. NUNCA confirma ni bloquea el campeón (completed: false).
 * 2. Si es el turno activo del jugador (pick o ban): envía PATCH a /lol-champ-select/v1/session/actions/{actionId}.
 * 3. Si no hay acción activa o durante PLANNING: envía PATCH a /lol-champ-select/v1/session/my-selection con championPickIntent SÓLO para picks.
 * 4. NUNCA envía championPickIntent para bans (si no es su turno de ban, rechaza amigablemente).
 * 5. Valida que el campeón esté disponible (no bloqueado por ningún jugador ni baneado).
 * 6. Protege contra clics rápidos duplicados mediante in-flight lock y throttling.
 */
export const preselectLcuChampion = async ({
    championId,
    isBan,
    sessionData
}: PreselectChampionParams): Promise<PreselectChampionResult> => {
    const champIdNum = Number(championId);

    // 1. Validación de identificador de campeón
    if (!champIdNum || isNaN(champIdNum) || champIdNum <= 0) {
        return {
            success: false,
            championId: champIdNum || 0,
            isBan,
            reason: 'INVALID_CHAMPION',
            message: 'El campeón seleccionado no es válido.'
        };
    }

    // 2. Control de clics rápidos idénticos (prevención de spam redundante)
    const now = Date.now();
    if (
        lastPreselectChampId === champIdNum &&
        lastPreselectIsBan === isBan &&
        now - lastPreselectTimestamp < 400
    ) {
        return {
            success: true,
            championId: champIdNum,
            isBan,
            reason: 'SUCCESS',
            message: 'Campeón ya preseleccionado.'
        };
    }

    // 3. Control de peticiones concurrentes en vuelo (in-flight guard)
    if (isPreselectInFlight) {
        return {
            success: false,
            championId: champIdNum,
            isBan,
            reason: 'IN_FLIGHT',
            message: 'Preselección en progreso, por favor espera un instante.'
        };
    }

    // 4. Validación de sesión activa de Champ Select
    if (!sessionData || !sessionData.inDraft) {
        return {
            success: false,
            championId: champIdNum,
            isBan,
            reason: 'NOT_IN_DRAFT',
            message: 'No hay una sesión activa de selección de campeones.'
        };
    }

    const localCellId = sessionData.localPlayerCellId;
    if (localCellId === undefined || localCellId === null) {
        return {
            success: false,
            championId: champIdNum,
            isBan,
            reason: 'NOT_IN_DRAFT',
            message: 'No se pudo identificar tu posición de jugador local en el draft.'
        };
    }

    // 5. Validación de disponibilidad del campeón (no bloqueado ni baneado)
    const myTeam: any[] = Array.isArray(sessionData.myTeam) ? sessionData.myTeam : [];
    const theirTeam: any[] = Array.isArray(sessionData.theirTeam) ? sessionData.theirTeam : [];
    const rawActions: any[] = Array.isArray(sessionData.actions) ? sessionData.actions : [];
    const flatActions: any[] = rawActions.flat();

    // Campeones asegurados/bloqueados definitivamente por aliados o rivales
    const lockedChampIds = new Set<number>();
    myTeam.forEach((p: any) => {
        if (p && p.championId && p.championId > 0) lockedChampIds.add(Number(p.championId));
    });
    theirTeam.forEach((p: any) => {
        if (p && p.championId && p.championId > 0) lockedChampIds.add(Number(p.championId));
    });

    // Campeones bloqueados (bans)
    const bannedChampIds = new Set<number>();
    flatActions.forEach((a: any) => {
        if (a && a.type === 'ban' && a.completed && a.championId > 0) {
            bannedChampIds.add(Number(a.championId));
        }
    });

    // Verificación complementaria de bans en la estructura directa del LCU si existe
    const lcuBans = sessionData.data?.bans || sessionData.bans;
    if (lcuBans) {
        if (Array.isArray(lcuBans.myTeamBans)) {
            lcuBans.myTeamBans.forEach((id: number) => { if (id > 0) bannedChampIds.add(Number(id)); });
        }
        if (Array.isArray(lcuBans.theirTeamBans)) {
            lcuBans.theirTeamBans.forEach((id: number) => { if (id > 0) bannedChampIds.add(Number(id)); });
        }
    }

    if (isBan) {
        // En turno de ban, no se puede banear un campeón que ya está baneado
        if (bannedChampIds.has(champIdNum)) {
            return {
                success: false,
                championId: champIdNum,
                isBan: true,
                reason: 'CHAMPION_UNAVAILABLE',
                message: 'Este campeón ya ha sido bloqueado en la partida.'
            };
        }
    } else {
        // En selección de pick, no se puede elegir un campeón ya baneado ni ya bloqueado
        if (bannedChampIds.has(champIdNum)) {
            return {
                success: false,
                championId: champIdNum,
                isBan: false,
                reason: 'CHAMPION_UNAVAILABLE',
                message: 'Este campeón está bloqueado (baneado) y no puede ser seleccionado.'
            };
        }
        if (lockedChampIds.has(champIdNum)) {
            return {
                success: false,
                championId: champIdNum,
                isBan: false,
                reason: 'CHAMPION_UNAVAILABLE',
                message: 'Este campeón ya ha sido fijado por otro jugador.'
            };
        }
    }

    // 6. Detección de acción activa en progreso del jugador local
    const localActiveAction = flatActions.find(
        (a: any) => a && a.actorCellId === localCellId && a.isInProgress && !a.completed
    );

    // Preparar carga de la petición HTTP
    let requestPayload: {
        actionId?: number;
        championId: number;
        isBan: boolean;
        type?: 'action' | 'intent';
    };

    if (localActiveAction) {
        // --- CASO TURNO ACTIVO ---
        if (isBan) {
            if (localActiveAction.type !== 'ban') {
                return {
                    success: false,
                    championId: champIdNum,
                    isBan: true,
                    reason: 'NOT_YOUR_TURN',
                    message: 'No es tu turno de bloqueo en este momento.'
                };
            }
            requestPayload = {
                actionId: localActiveAction.id,
                championId: champIdNum,
                isBan: true,
                type: 'action'
            };
        } else {
            if (localActiveAction.type !== 'pick') {
                return {
                    success: false,
                    championId: champIdNum,
                    isBan: false,
                    reason: 'NOT_YOUR_TURN',
                    message: 'Debes completar tu turno de bloqueo antes de seleccionar un campeón.'
                };
            }
            requestPayload = {
                actionId: localActiveAction.id,
                championId: champIdNum,
                isBan: false,
                type: 'action'
            };
        }
    } else {
        // --- CASO FUERA DE TURNO ACTIVO ---
        if (isBan) {
            // REGLA FUNDAMENTAL: NUNCA usar championPickIntent para bans
            return {
                success: false,
                championId: champIdNum,
                isBan: true,
                reason: 'NOT_YOUR_TURN',
                message: 'No es tu turno de bloqueo en este momento.'
            };
        }

        // Para picks fuera de turno activo: verificar si ya completó su selección definitiva
        const myPlayer = myTeam.find((p: any) => p && p.cellId === localCellId);
        const alreadyLocked =
            (myPlayer?.championId && myPlayer.championId > 0) ||
            flatActions.some((a: any) => a && a.actorCellId === localCellId && a.type === 'pick' && a.completed);

        if (alreadyLocked) {
            return {
                success: false,
                championId: champIdNum,
                isBan: false,
                reason: 'ALREADY_LOCKED',
                message: 'Ya has asegurado tu campeón para esta partida.'
            };
        }

        // Verificar si la fase actual permite Pick Intent
        const phase = sessionData.timer?.phase || sessionData.data?.timer?.phase;
        if (phase === 'FINALIZATION' || phase === 'GAME_STARTING') {
            return {
                success: false,
                championId: champIdNum,
                isBan: false,
                reason: 'DRAFT_FINALIZED',
                message: 'La fase de selección ya ha concluido.'
            };
        }

        // Es fase PLANNING o esperando turno de pick: enviar intención provisional de pick
        requestPayload = {
            championId: champIdNum,
            isBan: false,
            type: 'intent'
        };
    }

    // 7. Ejecución con guardián in-flight
    isPreselectInFlight = true;
    try {
        const response = await fetch('/api/preselect-champion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestPayload)
        });

        const data = await response.json().catch(() => ({}));

        if (response.ok && data.success) {
            lastPreselectChampId = champIdNum;
            lastPreselectIsBan = isBan;
            lastPreselectTimestamp = Date.now();

            const actionType = data.actionType || (requestPayload.actionId ? 'action' : 'intent');
            const message = actionType === 'intent'
                ? 'Intención de selección registrada provisionalmente.'
                : (isBan ? 'Bloqueo preseleccionado en League of Legends.' : 'Campeón preseleccionado en League of Legends.');

            return {
                success: true,
                championId: champIdNum,
                isBan,
                actionType,
                message,
                reason: 'SUCCESS'
            };
        } else {
            return {
                success: false,
                championId: champIdNum,
                isBan,
                reason: 'LCU_ERROR',
                message: data.error || 'El cliente de LoL no admitió la preselección.'
            };
        }
    } catch (error: any) {
        console.error('❌ Error de comunicación al preseleccionar en LCU:', error);
        return {
            success: false,
            championId: champIdNum,
            isBan,
            reason: 'LCU_ERROR',
            message: 'Error de conexión con el cliente de League of Legends.'
        };
    } finally {
        isPreselectInFlight = false;
    }
};

export const importToClient = async (buildData: any) => {
    if (!buildData) return;
    try {
        const { build, name, id, coreItemSwaps } = buildData;

        // Determinar y ordenar los Summoner Spells (Flash a la izquierda / tecla D, Smite a la derecha / tecla F)
        const s1 = build.summoners[0]?.id || build.summoners[0];
        const s2 = build.summoners[1]?.id || build.summoners[1];

        let spell1Id = Number(s1);
        let spell2Id = Number(s2);

        // 1. Si Destello (ID 4) está presente, forzarlo a la izquierda
        if (spell1Id === 4 || spell2Id === 4) {
            if (spell1Id !== 4) {
                const temp = spell1Id;
                spell1Id = 4;
                spell2Id = temp;
            }
        }

        // 2. Si Aplastar (ID 11) está presente, forzarlo a la derecha
        if (spell1Id === 11 || spell2Id === 11) {
            if (spell2Id !== 11) {
                const temp = spell2Id;
                spell2Id = 11;
                spell1Id = temp;
            }
        }

        const runePayload = {
            name: `HexDraft - ${name}`,
            primaryStyleId: build.runes.primaryStyle,
            subStyleId: build.runes.secondaryStyle,
            selectedPerkIds: [
                ...build.runes.selections.map((r: any) => r.id || r),
                ...build.runes.shards.map((s: any) => s.id || s)
            ]
        };
        const responses = await Promise.all([
            fetch('/api/set-runes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(runePayload) }),
            fetch('/api/set-items', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    championId: id,
                    championName: name,
                    items: build.items,
                    skillOrder: build.skillOrder,
                    criticalSwaps: coreItemSwaps
                })
            }),
            fetch('/api/set-spells', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ spell1Id, spell2Id })
            })
        ]);
        const failedResponse = responses.find(response => !response.ok);
        if (failedResponse) {
            throw new Error('Importación rechazada por LCU/API (HTTP ' + failedResponse.status + ')');
        }
        console.log("✅ Configuración enviada al LCU");
    } catch (e) {
        console.error("❌ Error importando:", e);
    }
};

export const PHASE_TRANSLATIONS: Record<string, string> = {
    'Offline': 'Desconectado',
    'None': 'Fuera de Partida',
    'Lobby': 'Lobby de Espera',
    'Matchmaking': 'Buscando Partida',
    'ReadyCheck': 'Aceptar Partida',
    'ChampSelect': 'Selección de Campeón',
    'InProgress': 'En Partida',
    'Reconnect': 'Reconectando',
    'WaitingForStats': 'Esperando Estadísticas',
    'PreEndOfGame': 'Fin de Partida',
    'EndOfGame': 'Partida Finalizada'
};

export const GAP_TRANSLATIONS: Record<string, string> = {
    'engage': 'Iniciación',
    'peel': 'Protección (Peel)',
    'frontline': 'Línea Frontal (Tanque)',
    'hypercarry': 'Daño Continuo (Carry)',
    'cc': 'Control de Masas (CC)',
    'healing': 'Sustento/Curación',
    'splitpush': 'Empuje Dividido (Splitpush)'
};

export const WIN_COND_TRANSLATIONS: Record<string, string> = {
    'early_pressure': 'Presión en Juego Temprano',
    'teamfight': 'Peleas de Equipo (Teamfight)',
    'splitpush': 'Presión en Paralelo (Splitpush)',
    'poke_siege': 'Desgaste y Asedio (Poke/Siege)',
    'dive_backline': 'Foco a la Retaguardia (Dive)',
    'scaling': 'Escalado Tardío'
};

// Mapeos de imágenes de posición de League of Legends
export const POS_BASE = "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/";

export const posMapping: Record<string, string> = {
    "TOP": "icon-position-top.png",
    "JUNGLE": "icon-position-jungle.png",
    "JNG": "icon-position-jungle.png",
    "MIDDLE": "icon-position-middle.png",
    "MID": "icon-position-middle.png",
    "BOTTOM": "icon-position-bottom.png",
    "BOT": "icon-position-bottom.png",
    "ADC": "icon-position-bottom.png",
    "UTILITY": "icon-position-utility.png",
    "SUP": "icon-position-utility.png",
    "SUPPORT": "icon-position-utility.png"
};

// Traducciones legibles de posiciones
export const posLabels: Record<string, string> = {
    "TOP": "Top",
    "JUNGLE": "Jungla",
    "JNG": "Jungla",
    "MIDDLE": "Mid",
    "MID": "Mid",
    "BOTTOM": "ADC",
    "BOT": "ADC",
    "ADC": "ADC",
    "UTILITY": "Soporte",
    "SUP": "Soporte",
    "SUPPORT": "Soporte"
};
