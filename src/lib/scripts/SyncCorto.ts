import puppeteer from 'puppeteer';
import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';

export async function syncShortCycle(version: string) {
    const dbPath = './src/lib/data/counter-synergies.json';
    const cachePath = './src/lib/data/meta-cache.json';
    
    const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    const champions = Object.keys(db);

    console.log(`🚀 INICIANDO CICLO CORTO - Versión: ${version}`);

    // --- PARTE 1: OP.GG (Meta Cache) ---
    const roles = ['top', 'jungle', 'mid', 'adc', 'support'];
    const metaCache: Record<string, any[]> = {};

    for (const role of roles) {
        console.log(`🔍 Scrapeando OP.GG: ${role}`);
        const pos = role === 'support' ? 'utility' : (role === 'adc' ? 'bottom' : role);
        try {
            const { data: html } = await axios.get(`https://www.op.gg/champions?region=global&tier=master&position=${pos}`, {
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            const $ = cheerio.load(html);
            const list: any[] = [];

            $('table tbody tr').each((_, el) => {
                const row = $(el);
                if (row.hasClass('ad')) return;
                list.push({
                    rank: row.find('td:nth-child(1)').text().trim(),
                    name: row.find('td:nth-child(2) strong').text().trim(),
                    winRate: row.find('td:nth-child(5)').text().trim(),
                    pickRate: row.find('td:nth-child(6)').text().trim(),
                    counters: row.find('td:nth-child(8) img').map((_, img) => $(img).attr('alt')).get()
                });
            });
            metaCache[role] = list;
        } catch (e) { console.error(`Error OP.GG ${role}:`, e); }
    }
    fs.writeFileSync(cachePath, JSON.stringify(metaCache, null, 2));

    // --- PARTE 2: DPM.LOL (Builds & GodMatchups) ---
    const browser = await puppeteer.launch({ 
        headless: false, 
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    const page = await browser.newPage();

    for (const name of champions) {
        const lane = db[name].lane;
        const urlName = name.replace(/\s/g, "");
        console.log(`⚡ Actualizando Build/Meta: ${name}`);

        try {
            const url = `https://dpm.lol/v1/builds/${urlName}?lane=${lane.toLowerCase()}&tier=emerald_plus&timeframe=${version}&gameMode=ranked`;
            await page.goto(url, { waitUntil: 'networkidle2' });
            const data = JSON.parse(await page.evaluate(() => document.body.innerText));

            // God Matchups (Data para el motor)
            db[name].godMatchups = (data.enemyMatchups?.[lane] || [])
                .filter((m: any) => m.winrate > 0.52)
                .slice(0, 10)
                .map((m: any) => ({
                    name: m.championName,
                    winrate: (m.winrate * 100).toFixed(1) + "%",
                    goldDiff: m.goldDiffAt15?.toFixed(0) || "0",
                    xpDiff: m.xpDiffAt15?.toFixed(0) || "0"
                }));

            // Build Atómica (Para la UI)
            db[name].buildData = {
                patch: version,
                runes: {
                    primaryId: data.runes?.primaryRuneId?.[0]?.Id || 0,
                    primarySlots: [
                        data.runes?.primaryRuneId2?.[0]?.Id || 0,
                        data.runes?.primaryRuneId3?.[0]?.Id || 0,
                        data.runes?.primaryRuneId4?.[0]?.Id || 0
                    ],
                    secondaryId: data.runes?.secondaryRuneId?.[0]?.Id || 0,
                    secondarySlots: [
                        data.runes?.secondaryRuneId?.[1]?.Id || 0,
                        data.runes?.secondaryRuneId?.[2]?.Id || 0
                    ],
                    shards: [
                        data.runes?.perksStat1?.[0]?.Id || 0,
                        data.runes?.perksStat2?.[0]?.Id || 0,
                        data.runes?.perksStat3?.[0]?.Id || 0
                    ]
                },
                items: {
                    starter: data.startItems?.[0]?.startItems || [],
                    boots: data.boots?.[0]?.itemId || 0,
                    core: [
                        data.items?.item1?.[0]?.Id || 0,
                        data.items?.item2?.[0]?.Id || 0,
                        data.items?.item3?.[0]?.Id || 0
                    ]
                },
                skills: [
                    data.skillLevelUp?.[0]?.skillLevelUp1,
                    data.skillLevelUp?.[0]?.skillLevelUp2,
                    data.skillLevelUp?.[0]?.skillLevelUp3
                ]
            };
        } catch (e) { console.error(`Error DPM ${name}:`, e); }
        await new Promise(r => setTimeout(r, 2000));
    }

    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
    await browser.close();
    console.log("🏁 CICLO CORTO FINALIZADO");
}