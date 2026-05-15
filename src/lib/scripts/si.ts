import puppeteer from 'puppeteer';
import fs from 'fs';

async function enrichWithGodMatchups() {
    const dbPath = './src/lib/data/counter-synergies.json';
    const posPath = './src/lib/data/meta-positions.json';

    if (!fs.existsSync(dbPath) || !fs.existsSync(posPath)) {
        console.error("❌ No se encontraron los archivos necesarios.");
        return;
    }

    const superDB = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    const positionsDB = JSON.parse(fs.readFileSync(posPath, 'utf-8'));
    const champions = Object.keys(superDB);

    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    
    console.log(`🚀 Iniciando extracción de God Matchups vía dpm.lol para ${champions.length} campeones...`);

    for (let i = 0; i < champions.length; i++) {
        const name = champions[i];
        // dpm.lol suele usar nombres capitalizados o específicos, asegúrate de que coincidan
        // Usualmente el nombre del objeto en tu JSON ya sirve
        const urlName = name.replace(/\s/g, ""); 
        
        const lanes = positionsDB[name] || [];
        if (lanes.length === 0) continue;

        // Tomamos la primera posición (ej: JUNGLE para Nocturne)
        const mainLane = lanes[0].toUpperCase(); 

        console.log(`[${i+1}/${champions.length}] Buscando víctimas de ${name} en ${mainLane}...`);

        try {
            // URL de la API dpm.lol (Ajusta timeframe y tier si es necesario)
            await new Promise(r => setTimeout(r, 3000));

            const apiUrl = `https://dpm.lol/v1/builds/${urlName}?lane=${mainLane.toLowerCase()}&tier=emerald_plus&timeframe=16.9&gameMode=ranked`;
            
            await page.goto(apiUrl, { waitUntil: 'networkidle2' });
            
            const apiResponse = await page.evaluate(() => JSON.parse(document.body.innerText));
            const matchupsData = apiResponse.enemyMatchups?.[mainLane] || [];

            // Delay aleatorio para no ser bloqueados (Sigilo)
            await new Promise(r => setTimeout(r, Math.random() * (4000 - 2000) + 2000));
            if (matchupsData.length > 0) {
                // Filtramos por Winrate > 53% y ordenamos de mejor a peor
                const godMatchups = matchupsData
                    .filter((m: any) => m.winrate > 0.53) // 0.53 = 53%
                    .map((m: any) => ({
                        name: m.championName,
                        winrate: (m.winrate * 100).toFixed(1) + "%",
                        goldDiff: m.goldDiffAt15?.toFixed(0) || "0",
                        xpDiff: m.xpDiffAt15?.toFixed(0) || "0"
                    }))
                    .sort((a: any, b: any) => parseFloat(b.winrate) - parseFloat(a.winrate))
                    .slice(0, 10); // Guardamos los top 10 para tener variedad

                superDB[name].godMatchups = godMatchups;
                console.log(`✅ ${name}: ${godMatchups.length} God Matchups guardados.`);
            } else {
                console.warn(`⚠️ No se encontró data de matchups para ${name} en ${mainLane}`);
            }

        } catch (err) {
            console.error(`❌ Error en ${name}:`, err);
        }

        // Guardado de seguridad cada 5 para no perder progreso
        if (i % 5 === 0) {
            fs.writeFileSync(dbPath, JSON.stringify(superDB, null, 2));
        }

        const randomDelay = Math.floor(Math.random() * (5000 - 3000 + 1) + 3000); 
        console.log(`⏳ Esperando ${randomDelay / 1000}s para disimular...`);
    }

    fs.writeFileSync(dbPath, JSON.stringify(superDB, null, 2));
    await browser.close();
    console.log("🏁 Proceso completado. Tu Super JSON ahora tiene 'godMatchups' con Gold y XP Diff.");
}

enrichWithGodMatchups();