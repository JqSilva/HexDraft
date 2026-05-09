import puppeteer from 'puppeteer';
import fs from 'fs';

async function generateMetaMap() {
    console.log("📡 Generando Mapa de Posiciones del Meta...");
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    try {
        await page.goto('https://dpm.lol/v1/tierlist?tier=diamond&timeframe=16.9&gameMode=ranked');
        await new Promise(r => setTimeout(r, 4000));
        const data = JSON.parse(await page.evaluate(() => document.body.innerText));

        const metaMap: Record<string, string[]> = {};

        data.champions.forEach((c: any) => {
            const name = c.championName;
            const lanes = [];

            // REGLA: Si tiene > 40% de pickrate, la posición es válida/real
            for (const [lane, rate] of Object.entries(c.lanesPickrate)) {
                if ((rate as number) > 40.0) {
                    lanes.push(lane);
                }
            }

            // Si es un champ muy nuevo o raro y no tiene ninguna > 40%, 
            // asignamos la que tenga más pickrate por defecto.
            if (lanes.length === 0) {
                const best = Object.entries(c.lanesPickrate).reduce((a: any, b: any) => a[1] > b[1] ? a : b)[0];
                lanes.push(best);
            }

            metaMap[name] = lanes;
        });

        if (!fs.existsSync('./data')) fs.mkdirSync('./data');
        fs.writeFileSync('./data/meta-positions.json', JSON.stringify(metaMap, null, 2));
        
        console.log(`✅ Mapa generado con ${Object.keys(metaMap).length} campeones.`);
    } catch (e) {
        console.error("❌ Error generando Meta Map:", e);
    } finally {
        await browser.close();
    }
}

generateMetaMap();