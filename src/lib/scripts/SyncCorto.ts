import puppeteer from 'puppeteer';
import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import assetsMap from '../data/assets-map.json';

// --- UTILIDADES DE MAPEÓ (Mantenerlas aquí para lógica de negocio) ---
function getStyleOfRune(runeId: number) {
    // Buscamos directamente en el mapa de relaciones que nos dio Riot
    return assetsMap.runeToStyle[runeId] || 0;
}

const getBestRuneSlot = (arr: any[]) => {
    if (!arr || arr.length === 0) return 0;
    
    // Filtrar basura (0 pickrate)
    const valid = arr.filter(i => i.pickrate > 0.1);
    const source = valid.length > 0 ? valid : arr;

    // Criterio: La más jugada (Pickrate) manda, siempre que tenga un WR decente
    const sorted = [...source].sort((a, b) => b.pickrate - a.pickrate);

    return sorted[0].Id;
};

const getBestSecondaryRunes = (arr: any[]) => {
    if (!arr || arr.length < 2) return [0, 0];

    // 1. Filtro inicial: Solo runas con estadísticas válidas
    const validRunes = arr.filter(r => r.winrate > 0 && r.pickrate > 0);
    if (validRunes.length < 2) return [0, 0];

    // 2. Agrupamos por Rama (Style) usando el assets-map si ya lo generaste
    const groups: Record<number, any[]> = {};
    validRunes.forEach(rune => {
        const styleId = getStyleOfRune(rune.Id); // Tu nueva función del assets-map
        if (styleId === 0) return;
        if (!groups[styleId]) groups[styleId] = [];
        groups[styleId].push(rune);
    });

    let bestStyleId = 0;
    let maxStylePower = -1;

    // 3. Evaluar la "Potencia de Rama"
    Object.keys(groups).forEach(styleKey => {
        const styleId = Number(styleKey);
        const runesInStyle = groups[styleId];

        // Solo consideramos runas "principales" de la rama (>15% pickrate) para el puntaje de rama
        const mainRunes = runesInStyle.filter(r => r.pickrate >= 15);
        
        // Sumamos (Winrate + Pickrate) de todas las runas populares de esta rama
        const stylePower = mainRunes.reduce((acc, r) => acc + (r.winrate + r.pickrate), 0);

        if (stylePower > maxStylePower && runesInStyle.length >= 2) {
            maxStylePower = stylePower;
            bestStyleId = styleId;
        }
    });

    // 4. Seleccionar las 2 mejores runas de la rama ganadora
    // Si ninguna rama cumplió el criterio de >15% de pickrate, usamos la rama más popular en general
    if (bestStyleId === 0) {
        const fallbackGroups = Object.keys(groups).sort((a, b) => {
            const sumA = groups[Number(a)].reduce((acc, r) => acc + r.pickrate, 0);
            const sumB = groups[Number(b)].reduce((acc, r) => acc + r.pickrate, 0);
            return sumB - sumA;
        });
        bestStyleId = Number(fallbackGroups[0]);
    }

    // De la rama elegida, tomamos las 2 con mayor (Winrate + Pickrate)
    const finalRunes = groups[bestStyleId].sort((a, b) => 
        (b.winrate + b.pickrate) - (a.winrate + a.pickrate)
    );

    return [finalRunes[0].Id, finalRunes[1].Id];
};

// Función genérica para items/botas
const getBestSelection = (arr: any[], idKey: string, minPick: number = 1.5, limit: number = 1) => {
    if (!arr || arr.length === 0) return limit === 1 ? { id: 0 } : [];
    const sorted = arr.filter(i => (i.pickrate || 0) >= minPick).sort((a, b) => b.winrate - a.winrate);
    const source = sorted.length > 0 ? sorted : [...arr].sort((a, b) => b.winrate - a.winrate);
    const results = source.slice(0, limit).map(i => ({ id: i[idKey], winrate: i.winrate }));
    return limit === 1 ? results[0] : results;
};

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
        console.log(`API: https://dpm.lol/v1/builds/${urlName}?lane=${lane.toLowerCase()}&tier=emerald_plus&timeframe=${version}&gameMode=ranked`)

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

            
            
            // Runas y Builds (Para la UI)
            const r = data.runes;
            const bestKeystone = getBestRuneSlot(r.primaryRuneId);
            const secondaryRunes = getBestSecondaryRunes(r.secondaryRuneId);

            const primaryStyleId = getStyleOfRune(bestKeystone);
            const subStyleId = getStyleOfRune(secondaryRunes[0]);


            db[name].buildData = {
                patch: version,
                lastUpdate: new Date().toISOString(),
                
                runes: {
                    primaryStyleId: primaryStyleId,
                    subStyleId: subStyleId,
                    // Para los slots, guardamos el que tenga más WR (índice 0 después del sort)
                    selections: [
                        bestKeystone,
                        getBestRuneSlot(r.primaryRuneId2),
                        getBestRuneSlot(r.primaryRuneId3),
                        getBestRuneSlot(r.primaryRuneId4),
                        ...secondaryRunes
                    ],
                    shards: [
                        getBestRuneSlot(r.perksStat1),
                        getBestRuneSlot(r.perksStat2),
                        getBestRuneSlot(r.perksStat3)
                    ]
                },
                items: {
                    starter: data.startItems?.sort((a:any, b:any) => b.winrate - a.winrate)[0]?.startItems || [],
                    boots: getBestSelection(data.boots, 'itemId', 2),
                    coreSlots: [
                        getBestSelection(data.items?.item1, 'Id', 2.0, 1),
                        getBestSelection(data.items?.item2, 'Id', 2.0, 1),
                        getBestSelection(data.items?.item3, 'Id', 2.0, 1)
                    ]
                },

                skills: data.skillLevelUp?.sort((a:any, b:any) => b.winrate - a.winrate)[0] || null
            };
        } catch (e) { console.error(`Error DPM ${name}:`, e); }
        await new Promise(r => setTimeout(r, 2000));
    }

    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
    await browser.close();
    console.log("🏁 CICLO CORTO FINALIZADO");
}