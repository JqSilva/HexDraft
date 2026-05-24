import puppeteer from 'puppeteer';
import fs from 'fs';

export async function SyncEstructuraLanes(version: string, checkAbort: () => boolean) {
    const dbPath = './src/lib/data/counter-synergies.json';
    const metaMapPath = './src/lib/data/meta-positions.json';
    
    const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    
    //const champions = Object.keys(db);
    const champions = ['Aatrox'];


    const browser = await puppeteer.launch({ 
        headless: false, 
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    const page = await browser.newPage();

    console.log("🐘 INICIANDO CICLO LARGO - Análisis Estructural");

    try {
        // --- PARTE 1: GENERAR META-MAP (Lanes) ---
        console.log("📡 Generando Mapa de Posiciones...");
        await page.goto(`https://dpm.lol/v1/tierlist?tier=diamond&timeframe=${version}&gameMode=ranked`);
        const tierData = JSON.parse(await page.evaluate(() => document.body.innerText));
        
        const metaMap: Record<string, string[]> = {};
        tierData.champions.forEach((c: any) => {
            const lanes = Object.entries(c.lanesPickrate)
                .filter(([_, rate]) => (rate as number) > 40.0)
                .map(([lane]) => lane);
            if (lanes.length === 0) {
                const best = Object.entries(c.lanesPickrate).reduce((a: any, b: any) => a[1] > b[1] ? a : b)[0];
                lanes.push(best);
            }
            metaMap[c.championName] = lanes;
        });
        fs.writeFileSync(metaMapPath, JSON.stringify(metaMap, null, 2));
    } finally {
        await browser.close();
    }
}