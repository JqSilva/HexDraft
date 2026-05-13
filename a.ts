import axios from 'axios';
import fs from 'fs';

async function updateSummonerAssets() {
    const VERSION = "16.9.1"; // Manteniendo la versión que ya usas 
    const URL = `https://ddragon.leagueoflegends.com/cdn/${VERSION}/data/es_AR/summoner.json`;

    try {
        console.log("📡 Obteniendo Hechizos de Invocador...");
        const res = await axios.get(URL);
        const summonerData = res.data.data;
        
        const summonerMap: Record<string, any> = {};

        // Iteramos sobre los objetos (SummonerBarrier, SummonerFlash, etc.)
        Object.values(summonerData).forEach((spell: any) => {
            // Guardamos usando la 'key' (ej: "21") como índice principal
            summonerMap[spell.key] = {
                name: spell.name,
                // Guardamos el nombre del archivo para generar la URL en el hydrator 
                icon: spell.image.full 
            };
        });

        // Aquí podrías leer tu assets-map.json actual y solo actualizar la propiedad 'summoners'
        const path = './src/lib/data/assets-map.json';
        let currentAssets = { runes: {}, items: {}, shards: {}, runeToStyle: {}, summoners: {} };

        if (fs.existsSync(path)) {
            currentAssets = JSON.parse(fs.readFileSync(path, 'utf-8'));
        }

        currentAssets.summoners = summonerMap;

        fs.writeFileSync(path, JSON.stringify(currentAssets, null, 2)); 
        console.log(`✅ Se han mapeado ${Object.keys(summonerMap).length} hechizos con éxito.`);

    } catch (e) {
        console.error("❌ Error en el mapeo de summoners:", e);
    }
}

updateSummonerAssets();