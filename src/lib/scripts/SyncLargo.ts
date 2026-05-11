import puppeteer from 'puppeteer';
import fs from 'fs';

export async function syncLongCycle(version: string) {
    const dbPath = './src/lib/data/counter-synergies.json';
    const metaMapPath = './src/lib/data/meta-positions.json';
    
    const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    const champions = Object.keys(db);

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

        // --- PARTE 2: ADN ESTRUCTURAL ---
        for (const name of champions) {
            const urlName = name.replace(/\s/g, "");
            const lane = metaMap[name] ? metaMap[name][0] : db[name].lane;
            
            console.log(`📡 Analizando ADN: ${name}`);
            try {
                const url = `https://dpm.lol/v1/builds/${urlName}?lane=${lane.toLowerCase()}&tier=all&timeframe=${version}&gameMode=ranked`;
                await page.goto(url, { waitUntil: 'networkidle2' });
                const data = JSON.parse(await page.evaluate(() => document.body.innerText));

                // Daño Real
                if (data.damageComposition) {
                    db[name].combat.damageComposition = {
                        physical: Math.round(data.damageComposition.physical || 0),
                        magic: Math.round(data.damageComposition.magic || 0),
                        true: Math.round(data.damageComposition.true || 0)
                    };
                }

                // Scaling Analysis
                if (data.winrateByGameTime && data.winrateByGameTime.length > 0) {
                    db[name].combat.winrateCurve = data.winrateByGameTime;
                    const earlyWR = data.winrateByGameTime[0]?.value || 50;
                    const lateWR = data.winrateByGameTime[data.winrateByGameTime.length - 1]?.value || 50;
                    db[name].scalingType = lateWR > earlyWR + 1.5 ? "Late" : (earlyWR > lateWR + 1.5 ? "Early" : "Mid");
                }

                // Sinergias Históricas (Todas las líneas)
                if (data.allyMatchups) {
                    const synergies: any = {};
                    for (const pos in data.allyMatchups) {
                        synergies[pos] = data.allyMatchups[pos]
                            .filter((a: any) => a.delta > 0)
                            .sort((a: any, b: any) => b.delta - a.delta)
                            .slice(0, 5)
                            .map((a: any) => ({ name: a.championName, delta: a.delta.toFixed(2) }));
                    }
                    db[name].synergies = synergies;
                }
            } catch (e) { console.error(`Error largo en ${name}`); }
            await new Promise(r => setTimeout(r, 4000));
        }

        fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
        console.log("🏁 CICLO LARGO FINALIZADO");

    } finally {
        await browser.close();
    }
}