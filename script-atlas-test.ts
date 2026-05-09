import puppeteer from 'puppeteer';
import fs from 'fs';

async function extractMassiveData(testCount: number = 2) {
    const browser = await puppeteer.launch({ 
        headless: false, 
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });

    try {
        const page = await browser.newPage();

        // 1. CARGAR EL MAPA DE POSICIONES (Generado previamente)
        const metaPath = './data/meta-positions.json';
        if (!fs.existsSync(metaPath)) {
            console.error("❌ Error: No existe meta-positions.json");
            await browser.close();
            return;
        }
        const metaMap = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));

        // 2. OBTENER LISTA DE CAMPEONES A PROBAR
        const allChampions = Object.keys(metaMap);
        const championsToProcess = allChampions
        
        const superDatabase: any = {};
        const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
        for (const name of championsToProcess) {
            

            const mainLane = metaMap[name][0]; // Sacamos la posición del JSON
            console.log(`\n🚀 Procesando: ${name} en ${mainLane}...`);

            const url = `https://dpm.lol/v1/builds/${name}?lane=${mainLane.toLowerCase()}&tier=diamond&timeframe=16.9&gameMode=ranked`;
            
            await page.goto(url, { waitUntil: 'networkidle2' });
            await new Promise(r => setTimeout(r, 3000));

            const data = JSON.parse(await page.evaluate(() => document.body.innerText));

            // --- FILTRADO DE COUNTERS POR DELTA ---
            // El delta negativo más bajo indica quién "arruina" más al campeón
            const filteredCounters = (data.enemyMatchups?.[mainLane] || [])
            .sort((a: any, b: any) => a.winrate - b.winrate)
            .slice(0, 10)
            .map((c: any) => ({
                name: c.championName,
                winrate: (c.winrate * 100).toFixed(1) + "%"
            }));

            // --- FILTRADO DE SINERGIAS POR DELTA + META-CHECK ---
            const filteredSynergies: any = {};
            if (data.allyMatchups) {
                Object.keys(data.allyMatchups).forEach(lane => {
                    const validAllies = data.allyMatchups[lane]
                        .filter((aliado: any) => {
                            // Validación contra el meta-positions.json
                            return aliado.delta !== null && metaMap[aliado.championName]?.includes(lane);
                        })
                        .sort((a: any, b: any) => b.delta - a.delta) // Delta positivo más alto
                        .slice(0, 5)
                        .map((a: any) => ({
                            name: a.championName,
                            delta: a.delta.toFixed(2)
                        }));
                    
                    if (validAllies.length > 0) filteredSynergies[lane] = validAllies;
                });
            }

            // AGREGAR AL SUPER JSON
            superDatabase[name] = {
                lane: mainLane,
                counters: filteredCounters,
                synergies: filteredSynergies
            };

            console.log(`✅ ${name} integrado al Super JSON.`);
            const randomDelay = Math.floor(Math.random() * (7000 - 3000 + 1) + 3000); 
            console.log(`⏳ Esperando ${randomDelay / 1000}s para disimular...`);
            await wait(randomDelay);
        }

        // 3. GUARDAR EL ARCHIVO ÚNICO
        if (!fs.existsSync('./data')) fs.mkdirSync('./data');
        fs.writeFileSync('./data/counter-synergies.json', JSON.stringify(superDatabase, null, 2));

        console.log("\n🏁 Super JSON generado con éxito en ./data/counter-synergies.json");

    } catch (error) {
        console.error("❌ Error:", error);
    } finally {
        await browser.close();
    }
}

// Ejecutamos la prueba con los primeros 2 campeones
extractMassiveData(2);