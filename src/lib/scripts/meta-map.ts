import puppeteer from 'puppeteer';
import fs from 'fs';
import os from 'os';
import path from 'path';

export async function SyncEstructuraLanes(
    version: string,
    checkAbort: () => boolean,
    writeLog: (msg: string) => void,
    onProgress?: (current: number, total: number, phase: 'lanes' | 'done') => void
) {
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
    onProgress?.(1, 10, 'lanes');

    try {
        if (checkAbort()) {
            writeLog("🛑 CANCELACIÓN DETECTADA. Deteniendo...");
            await browser.close();
            try {
                fs.rmSync(uniqueProfileDir, { recursive: true, force: true });
            } catch (e) {}
            return;
        }
        // --- PARTE 1: ACTUALIZAR BD DIRECTAMENTE ---
        writeLog("📡 Sincronizando Carriles en la Base de Datos...");
        onProgress?.(3, 10, 'lanes');
        await page.goto(`https://dpm.lol/v1/tierlist?tier=diamond&timeframe=${version}&gameMode=ranked`);
        onProgress?.(7, 10, 'lanes');
        const tierData = JSON.parse(await page.evaluate(() => document.body.innerText));
        
        const { championsRepo } = await import('../db/champions.repo.js');
        const { db } = await import('../db/sqlite.js');
        const nameIdMap = championsRepo.getChampionIdNameMap();

        db.exec('BEGIN TRANSACTION;');
        try {
            const updateStmt = db.prepare('UPDATE champions SET lane = ? WHERE id = ?');
            let updatedCount = 0;

            tierData.champions.forEach((c: any) => {
                const normName = c.championName.toLowerCase().replace(/[^a-z0-9]/g, "");
                const champId = nameIdMap[normName];
                if (champId) {
                    const lanes = Object.entries(c.lanesPickrate)
                        .filter(([_, rate]) => (rate as number) > 40.0)
                        .map(([lane]) => lane);
                    if (lanes.length === 0) {
                        const best = Object.entries(c.lanesPickrate).reduce((a: any, b: any) => a[1] > b[1] ? a : b)[0];
                        lanes.push(best);
                    }
                    const primaryLane = lanes[0]?.toUpperCase();
                    if (primaryLane) {
                        updateStmt.run(primaryLane, champId);
                        updatedCount++;
                    }
                }
            });

            db.exec('COMMIT;');
            writeLog(`✅ Carriles actualizados directamente en base de datos: ${updatedCount} campeones.`);
        } catch (err: any) {
            db.exec('ROLLBACK;');
            writeLog(`❌ Error al actualizar base de datos con carriles: ${err.message || err}`);
            throw err;
        }
        onProgress?.(9, 10, 'lanes');
        
        try {
            const { configRepo } = await import('../db/config.repo.js');
            configRepo.setConfig('last_lane_sync_timestamp', new Date().toISOString());
        } catch (e) {}
        onProgress?.(10, 10, 'done');
    } finally {
        await browser.close();
        try {
            fs.rmSync(uniqueProfileDir, { recursive: true, force: true });
        } catch (e) {}
    }
}