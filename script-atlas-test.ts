import puppeteer from 'puppeteer';
import fs from 'fs';

async function runMassiveTest() {
    const browser = await puppeteer.launch({ 
        headless: false, 
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });

    const page = await browser.newPage();
    
    // Lista de prueba con sus líneas ideales (esto vendría de la API 1 en el futuro)
    const championsToScrape = [
        { name: "Nocturne", defaultLane: "jungle" },
        { name: "Hwei", defaultLane: "middle" }
    ];

    const metaCacheResults: any[] = [];
    const championDbResults: any[] = [];

    for (const champ of championsToScrape) {
        try {
            console.log(`\n--- 🔍 PROCESANDO: ${champ.name} en ${champ.defaultLane} ---`);

            // --- 1. CAPTURA API 3 (META-CACHE) con línea dinámica ---
            const urlBuild = `https://dpm.lol/v1/builds/${champ.name}?lane=${champ.defaultLane}&tier=diamond&timeframe=16.9&gameMode=ranked`;
            await page.goto(urlBuild, { waitUntil: 'networkidle2' });
            await new Promise(r => setTimeout(r, 5000)); 

            const jsonBuildRaw = await page.evaluate(() => document.body.innerText);
            const api3Data = JSON.parse(jsonBuildRaw);

            // --- 2. CAPTURA API 4 (CHAMPION-DB) con línea dinámica ---
            const urlVariants = `https://dpm.lol/v1/builds/${champ.name}/variants?lane=${champ.defaultLane}&tier=diamond&timeframe=16.9&gameMode=ranked`;
            await page.goto(urlVariants, { waitUntil: 'networkidle2' });
            await new Promise(r => setTimeout(r, 5000)); 

            const jsonVariantsRaw = await page.evaluate(() => document.body.innerText);
            const api4Data = JSON.parse(jsonVariantsRaw);

            // --- 3. PROCESAMIENTO ---
            metaCacheResults.push({
                champion: champ.name,
                lane: champ.defaultLane,
                winrate: api3Data.summoners?.[0]?.winrate || 0,
                runes: api3Data.runes,
                equipment: {
                    coreBuild: api3Data.coreBuilds?.coreItem3?.[0]
                },
                efficiency: {
                    jungleFullClearTimestamp: api3Data.jungleFullClearTimestamp || null // 0 si no es jg
                }
            });

            championDbResults.push({
                name: champ.name,
                damageType: api3Data.championStats?.physicalDamage > api3Data.championStats?.magicDamage ? "AD" : "AP",
                counters: api3Data.enemyMatchups, 
                bestSynergies: api4Data.allyMatchups || api4Data.variants?.[0]?.allyMatchups,
            });

            console.log(`✅ ${champ.name} (${champ.defaultLane}) completado.`);

        } catch (error) {
            console.error(`❌ Error con ${champ.name}:`, error);
        }
    }

    if (!fs.existsSync('./test-data')) fs.mkdirSync('./test-data');
    fs.writeFileSync('./test-data/test-meta-cache.json', JSON.stringify(metaCacheResults, null, 2));
    fs.writeFileSync('./test-data/test-champion-db.json', JSON.stringify(championDbResults, null, 2));

    await browser.close();
}

runMassiveTest();