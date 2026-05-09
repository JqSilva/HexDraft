// script-pulse-test.ts
import puppeteer from 'puppeteer';
import fs from 'fs';

async function scrapePulse() {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    const champion = "Nocturne";

    // Endpoint de Build actual (Runas, Items, Skills)
    const url = `https://dpm.lol/v1/builds/${champion}?lane=jungle&tier=diamond&timeframe=16.9&gameMode=ranked`;

    try {
        console.log(`📡 Pulse: Extrayendo meta y build de ${champion}...`);
        await page.goto(url, { waitUntil: 'networkidle2' });
        
        const rawData = await page.evaluate(() => document.body.innerText);
        const data = JSON.parse(rawData);

        // Extraemos lo que definimos como "Volátil"
        const pulseEntry = {
            champion: champion,
            updatedAt: new Date().toISOString(),
            currentBuild: {
                skills: data.skillLevelUp?.[0], // [cite: 180]
                runes: {
                    primary: data.runes?.primaryRuneId?.[0], // [cite: 187]
                    secondary: data.runes?.secondaryRuneId?.[0] // [cite: 217]
                },
                items: {
                    start: data.startItems?.[0], // [cite: 181]
                    core: data.coreBuilds?.coreItem3?.[0] // [cite: 298]
                }
            }
        };

        fs.writeFileSync('./test-data/test-meta-cache.json', JSON.stringify(pulseEntry, null, 2));
        console.log("✅ Pulse actualizado en test-meta-cache.json");

    } catch (e) {
        console.error("❌ Error en Pulse:", e);
    } finally {
        await browser.close();
    }
}

scrapePulse();