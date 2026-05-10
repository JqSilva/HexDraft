import puppeteer from 'puppeteer';
import fs from 'fs';

async function enrichExistingData() {
    // 1. CARGAMOS TU ARCHIVO ACTUAL (El de las 23k líneas)
    const filePath = './src/lib/data/counter-synergies.json';
    if (!fs.existsSync(filePath)) {
        console.error("❌ No se encontró el archivo original.");
        return;
    }
    
    const superDB = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const champions = Object.keys(superDB);

    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    console.log(`🚀 Iniciando enriquecimiento de ${champions.length} campeones sin borrar counters/sinergias...`);

    for (let i = 0; i < champions.length; i++) {
        const name = champions[i];
        console.log(`[${i+1}/${champions.length}] Procesando: ${name}`);

        try {
            // --- PASO A: TAGS DE DATADRAGON (Sin Puppeteer, es más rápido) ---
            // Solo lo hacemos si el campeón no tiene tags ya
            if (!superDB[name].tags) {
                const ddRes = await fetch(`https://ddragon.leagueoflegends.com/cdn/14.9.1/data/en_US/champion/${name}.json`);
                const ddData = await ddRes.json();
                superDB[name].tags = ddData.data[name].tags;
            }

            // --- PASO B: DATOS DE COMBATE (API 3) ---
            await new Promise(r => setTimeout(r, 3000));
            const lane = superDB[name].lane.toLowerCase();
            const url = `https://dpm.lol/v1/builds/${name}?lane=${lane}&tier=diamond&timeframe=16.9&gameMode=ranked`;
            

            await page.goto(url, { waitUntil: 'networkidle2' });
            // Delay aleatorio para no ser bloqueados (Sigilo)
            await new Promise(r => setTimeout(r, Math.random() * (4000 - 2000) + 2000));

            const apiData = JSON.parse(await page.evaluate(() => document.body.innerText));

            // ASIGNAMOS LA NUEVA DATA SIN TOCAR 'COUNTERS' NI 'SYNERGIES'
            superDB[name].combat = {
                damageComposition: {
                    physical: apiData.championStats?.physicalDamage || 0,
                    magic: apiData.championStats?.magicDamage || 0,
                    true: apiData.championStats?.trueDamage || 0
                },
                winrateCurve: apiData.winrateOverTime || []
            };

            console.log(`✅ ${name} actualizado con éxito.`);

        } catch (err) {
            console.error(`❌ Error en ${name}:`, err);
        }

        // --- GUARDADO DE SEGURIDAD ---
        // Escribe el archivo cada 5 campeones por si hay un crash
        if (i % 5 === 0) {
            fs.writeFileSync(filePath, JSON.stringify(superDB, null, 2));
        }

        const randomDelay = Math.floor(Math.random() * (5000 - 3000 + 1) + 3000); 
        console.log(`⏳ Esperando ${randomDelay / 1000}s para disimular...`);
    }

    // GUARDADO FINAL
    fs.writeFileSync(filePath, JSON.stringify(superDB, null, 2));
    console.log("🏁 ¡Proceso terminado! Tu Super JSON ahora es mucho más inteligente.");
    await browser.close();
}

enrichExistingData();