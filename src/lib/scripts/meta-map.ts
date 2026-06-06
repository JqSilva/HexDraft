import puppeteer from 'puppeteer';
import fs from 'fs';
import os from 'os';
import path from 'path';

export async function SyncEstructuraLanes(version: string, checkAbort: () => boolean, writeLog: (msg: string) => void) {
    const dbPath = './src/lib/data/counter-synergies.json';
    const metaMapPath = './src/lib/data/meta-positions.json';
    
    const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    
    //const champions = Object.keys(db);
    const champions = ['Aatrox'];


    const profilesDir = path.join(process.cwd(), '.puppeteer_profiles');
    if (!fs.existsSync(profilesDir)) {
        fs.mkdirSync(profilesDir, { recursive: true });
    }
    const uniqueProfileDir = path.join(profilesDir, `profile_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);
    const browser = await puppeteer.launch({ 
        headless: true, 
        userDataDir: uniqueProfileDir,
        pipe: true,
        ignoreDefaultArgs: ['--enable-automation'],
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled'
        ] 
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
            get: () => false,
        });
    });

    writeLog("🐘 INICIANDO CICLO LARGO - Análisis Estructural");

    try {
        if (checkAbort()) {
            writeLog("🛑 CANCELACIÓN DETECTADA. Deteniendo...");
            await browser.close();
            try {
                fs.rmSync(uniqueProfileDir, { recursive: true, force: true });
            } catch (e) {}
            return;
        }
        // --- PARTE 1: GENERAR META-MAP (Lanes) ---
        writeLog("📡 Generando Mapa de Posiciones...");
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
        try {
            fs.rmSync(uniqueProfileDir, { recursive: true, force: true });
        } catch (e) {}
    }
}