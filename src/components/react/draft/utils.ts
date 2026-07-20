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
            name: `HexDraft: ${name}`,
            primaryStyleId: build.runes.primaryStyle,
            subStyleId: build.runes.secondaryStyle,
            selectedPerkIds: [
                ...build.runes.selections.map((r: any) => r.id || r),
                ...build.runes.shards.map((s: any) => s.id || s)
            ]
        };
        await Promise.all([
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
