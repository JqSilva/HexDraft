import axios from 'axios';
import fs from 'fs';

async function generateAssetsMap() {
    console.log("📥 Iniciando descarga de diccionarios de Riot...");
    const VERSION = "16.9.1"; 
    const BASE_URL = `https://ddragon.leagueoflegends.com/cdn/${VERSION}/data/es_AR`;

    try {
        const assets = { 
            runes: {}, 
            items: {}, 
            shards: {},
            runeToStyle: {} // <--- NUEVO: Diccionario de relación Runa -> Estilo
        };

        // 1. MAPEAR RUNAS Y SUS RELACIONES
        const runesRes = await axios.get(`${BASE_URL}/runesReforged.json`);
        
        runesRes.data.forEach((style) => {
            // Guardamos la información del estilo (rama)
            assets.runes[style.id] = { 
                name: style.name, 
                icon: style.icon,
                isStyle: true 
            };

            style.slots.forEach((slot) => {
                slot.runes.forEach((rune) => {
                    // Guardamos info de la runa
                    assets.runes[rune.id] = { 
                        name: rune.name, 
                        icon: rune.icon 
                    };
                    // GUARDAMOS LA RELACIÓN: Esta runa pertenece a este ID de estilo
                    assets.runeToStyle[rune.id] = style.id;
                });
            });
        });

        // 2. MAPEAR ÍTEMS (Igual que antes)
        const itemsRes = await axios.get(`${BASE_URL}/item.json`);
        Object.entries(itemsRes.data.data).forEach(([id, data]) => {
            assets.items[id] = {
                name: data.name,
                description: data.plaintext,
                gold: data.gold.total,
                icon: data.image.full // Guardamos el nombre del archivo para ddragon
            };
        });

        // 3. MAPEAR SHARDS
        assets.shards = {
            5001: { name: "Armadura", icon: "StatMods/StatModsArmorIcon.png" },
            5002: { name: "Armadura", icon: "StatMods/StatModsArmorIcon.png" },
            5003: { name: "Resistencia Mágica", icon: "StatMods/StatModsMagicResIcon.png" },
            5005: { name: "Velocidad de Ataque", icon: "StatMods/StatModsAttackSpeedIcon.png" },
            5007: { name: "Aceleración de Habilidad", icon: "StatMods/StatModsCDRIcon.png" },
            5008: { name: "Fuerza Adaptable", icon: "StatMods/StatModsAdaptiveForceIcon.png" },
            5011: { name: "Vida", icon: "StatMods/StatModsHealthScalingIcon.png" },
            5013: { name: "Tenacidad y Vida", icon: "StatMods/StatModsHealthScalingIcon.png" }
        };

        fs.writeFileSync('./src/lib/data/assets-map.json', JSON.stringify(assets, null, 2));
        console.log("✅ assets-map.json generado con el mapa de relaciones.");
    } catch (e) {
        console.error("❌ Error generando mapa de assets:", e);
    }
}

generateAssetsMap();