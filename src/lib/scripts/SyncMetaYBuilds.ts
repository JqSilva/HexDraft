import puppeteer from 'puppeteer';
import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import assetsMap from '../data/assets-map.json';


const getBestSummoners = (arr: any[]) => {
    if (!arr || arr.length === 0) return [4, 11]; // Fallback a Flash/Smite o similar
    
    // Filtramos para asegurar que tengan estadísticas mínimas si lo deseas, 
    const valid = arr.filter(i => i.pickrate > 0.3);
    const source = valid.length > 0 ? valid : arr;
    const sorted = [...source].sort((a, b) => b.pickrate - a.pickrate);
    
    return [sorted[0].summonerId1, sorted[0].summonerId2];
};


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


const getBestCoreBuild = (coreBuilds: any) => {
    if (!coreBuilds) return [];

    // Priorizamos coreItem5 (Build completa)
    if (coreBuilds.coreItem5 && coreBuilds.coreItem5.length > 0) {
        return [...coreBuilds.coreItem5]
            .sort((a, b) => b.pickrate - a.pickrate)[0].itemIds;
    }

    // Fallback a coreItem3 si no hay suficiente data para 5
    if (coreBuilds.coreItem3 && coreBuilds.coreItem3.length > 0) {
        return [...coreBuilds.coreItem3]
            .sort((a, b) => b.pickrate - a.pickrate)[0].itemIds;
    }

    return [];
};

const getMostPopularItem = (items: any[], key: string) => {
    if (!items || items.length === 0) return 0;
    return [...items].sort((a, b) => b.pickrate - a.pickrate)[0][key];
};


const API_NAME_MAP: Record<string, string> = {
    "Wukong": "MonkeyKing",
    "Maestro Yi": "MasterYi",
    "Nunu y Willump": "Nunu",
    "Renata Glasc": "Renata",
    "Bardo": "Bard"
};

export async function syncMetaAndBuilds(version: string, checkAbort: () => boolean, writeLog: (msg: string) => void) {
    const dbPath = './src/lib/data/counter-synergies.json';
    const cachePath = './src/lib/data/meta-cache.json';
    const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    
    const champions = Object.keys(db);

    writeLog(`🚀 INICIANDO SINCRONIZACIÓN GENERAL - Versión Parche: ${version}`);

    // --- PARTE 1: OP.GG (Sin Puppeteer - Rápido) ---
    const roles = ['top', 'jungle', 'mid', 'adc', 'support'];
    const metaCache: Record<string, any[]> = {};

    for (const role of roles) {
        writeLog(`🔍 Scrapeando OP.GG: ${role}`);
        const pos = role === 'utility' ? 'support' : (role === 'adc' ? 'bottom' : role);
        try {
            const { data: html } = await axios.get(`https://www.op.gg/champions?region=global&tier=emerald_plus&position=${pos}`, {
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            const $ = cheerio.load(html);
            const list: any[] = [];

            $('table tbody tr').each((_, el) => {
                const row = $(el);
                if (row.hasClass('ad')) return;
                const rank = row.find('td:first-child span.w-5').first().text().trim();

                list.push({
                    rank: rank,
                    name: row.find('td:nth-child(2) strong').text().trim(),
                    winRate: row.find('td:nth-child(5)').text().trim(),
                    pickRate: row.find('td:nth-child(6)').text().trim(),
                    counters: row.find('td:nth-child(8) img').map((_, img) => $(img).attr('alt')).get()
                });
            });
            metaCache[role] = list;
        } catch (e: any) { writeLog(`Error OP.GG ${role}: ${e.message || e}`); }
    }
    fs.writeFileSync(cachePath, JSON.stringify(metaCache, null, 2));

    // --- PARTE 2: DPM.LOL (Una sola pestaña de Puppeteer por Campeón para TODO) ---
    const browser = await puppeteer.launch({ 
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    const page = await browser.newPage();

    for (const name of champions) {


        if (checkAbort()) {
            writeLog("🛑 CANCELACIÓN DETECTADA. Cerrando motores de scraping...");
            await browser.close();
            return "Cancelado por el usuario";
        }

        const lane = db[name].lane;
        const internalName = API_NAME_MAP[name] || name;
        const urlName = internalName.replace(/\s/g, "");

        writeLog(`⚡ Extrayendo Datos Completos (Build + Matchups): ${name}`);

        try {
            const url = `https://dpm.lol/v1/builds/${urlName}?lane=${lane.toLowerCase()}&tier=emerald_plus&timeframe=${version}&gameMode=ranked`;
            await page.goto(url, { waitUntil: 'networkidle2' });
            const data = JSON.parse(await page.evaluate(() => document.body.innerText));

            // === 1. EXTRAER GOD MATCHUPS (Ventajas a minuto 15) ===
            db[name].godMatchups = (data.enemyMatchups?.[lane] || [])
                .filter((m: any) => m.count > 160)
                .map((m: any) => {
                    const goldValue = m.goldDiffAt15 || 0;
                    const xpValue = m.xpDiffAt15 || 0;
                    const winrateValue = m.winrate || 0.50;
                    const countValue = m.count || 0;

                    // 1. Determinar la etiqueta de la línea basándonos en oro y XP
                    const isGoodLane = (goldValue + xpValue) > 200;
                    const laneTag = isGoodLane ? "Good Lane" : "Bad Lane";

                    // 2. SUAVIZADO BAYESIANO (El secreto del peso de 'count')
                    // Añadimos un peso de 120 partidas ficticias al 50% de Winrate para neutralizar muestras chicas
                    const K = 120; 
                    const bayesianWinrate = ((winrateValue * countValue) + (0.50 * K)) / (countValue + K);

                    // 3. Calculamos el delta final con respecto al 50% neutro
                    // Esto nos dará números como +7.5, +5.6, -7.2, etc.
                    const deltaScore = (bayesianWinrate - 0.50) * 100;

                    return {
                        name: m.championName,
                        winrate: (winrateValue * 100).toFixed(1) + "%",
                        goldDiff: goldValue.toFixed(0),
                        xpDiff: xpValue.toFixed(0),
                        csDiff: (m.csDiffAt15 || 0).toFixed(1),
                        count: countValue,
                        laneTag: laneTag,
                        dominanceScore: parseFloat(deltaScore.toFixed(1)) // Mantenemos esta variable para tu motor
                    };
                })
                // Separamos en dos listas para que puedas analizar los extremos si quieres, 
                // pero para guardarlo ordenamos como la web de mayor a menor (de Bueno a Malo)
                .sort((a: any, b: any) => b.dominanceScore - a.dominanceScore);

            // Guardamos solo los campeones significativos (puedes truncar a los top 15 o dejar la lista útil)
            db[name].godMatchups = db[name].godMatchups.slice(0, 15);

            // === 2. EXTRAER ENEMY MATCHUPS (Counters estructurales del campeón) ===
            db[name].counters = (data.enemyMatchups?.[lane] || [])
                // Mismo filtro estricto de volumen para eliminar el ruido estadístico de SoloQ
                .filter((m: any) => m.count > 160)
                .map((m: any) => {
                    const goldValue = m.goldDiffAt15 || 0;
                    const xpValue = m.xpDiffAt15 || 0;
                    const winrateValue = m.winrate || 0.50;
                    const countValue = m.count || 0;

                    // Clasificamos si la línea es cómoda o es una pesadilla
                    const isGoodLane = (goldValue + xpValue) > 200;
                    const laneTag = isGoodLane ? "Good Lane" : "Bad Lane";

                    // Suavizado Bayesiano idéntico con K = 100
                    const K = 100;
                    const bayesianWinrate = ((winrateValue * countValue) + (0.50 * K)) / (countValue + K);
                    
                    // Calculamos el delta (nos dará negativo en los counters reales)
                    const deltaScore = (bayesianWinrate - 0.50) * 100;

                    return {
                        name: m.championName,
                        winrate: (winrateValue * 100).toFixed(1) + "%",
                        goldDiff: goldValue.toFixed(0),
                        xpDiff: xpValue.toFixed(0),
                        csDiff: (m.csDiffAt15 || 0).toFixed(1),
                        count: countValue,
                        laneTag: laneTag,
                        dominanceScore: parseFloat(deltaScore.toFixed(1))
                    };
                })
                // Condición para filtrar solo donde el campeón analizado sufre (Deltas negativos o neutrales-bajos)
                // Esto asegura que si juegas Aatrox, solo guarde campeones que representen una amenaza real
                .filter((m: any) => m.dominanceScore < 1.0)
                // ORDENAMIENTO DE COUNTERS: Ordenamos de menor a mayor (los números más negativos primero, ej: -7.2 antes que -3.2)
                .sort((a: any, b: any) => a.dominanceScore - b.dominanceScore)
                // Truncamos a los 10 peores counters históricos para el motor
                .slice(0, 10);

            // === 3. EXTRAER ALLY MATCHUPS (Sinergias de dúo estables) ===
            if (data.allyMatchups) {
                const synergies: any = {};
                
                for (const pos in data.allyMatchups) {
                    synergies[pos] = (data.allyMatchups[pos] || [])
                        // Filtramos por volumen mínimo para no emparejar anomalías de pocas partidas
                        .filter((a: any) => a.count > 100)
                        .map((a: any) => {
                            const rawDelta = a.delta || 0;
                            const countValue = a.count || 0;

                            // FACTOR BAYESIANO PARA DELTAS:
                            // Atenúa el delta si el volumen es bajo. A partir de ~250 partidas, el impacto del castigo es nulo.
                            const bayesianFactor = countValue / (countValue + 80);
                            const smoothedDelta = rawDelta * bayesianFactor;

                            return {
                                name: a.championName,
                                count: countValue,
                                // Guardamos el delta en formato de porcentaje limpio (ej: +4.1)
                                delta: parseFloat((smoothedDelta * 100).toFixed(2))
                            };
                        })
                        // Solo nos interesan combinaciones que de verdad sumen al equipo (deltas positivos)
                        .filter((a: any) => a.delta > 0)
                        // Ordenamos de mayor beneficio a menor beneficio
                        .sort((a: any, b: any) => b.delta - a.delta)
                        // Limitamos estrictamente a las 5 mejores sinergias por rol para mantener el JSON ligero
                        .slice(0, 5);
                }
                db[name].synergies = synergies;
            }

            // === 4. EXTRAER ADN DE COMBATE Y SCALING ===
            if (data.damageComposition) {
                db[name].combat.damageComposition = {
                    physical: Math.round(data.damageComposition.physical || 0),
                    magic: Math.round(data.damageComposition.magic || 0),
                    true: Math.round(data.damageComposition.true || 0)
                };
            }
            if (data.winrateByGameTime && data.winrateByGameTime.length > 0) {
                db[name].combat.winrateCurve = data.winrateByGameTime;
                const earlyWR = data.winrateByGameTime[0]?.value || 50;
                const lateWR = data.winrateByGameTime[data.winrateByGameTime.length - 1]?.value || 50;
                db[name].scalingType = lateWR > earlyWR + 1.5 ? "Late" : (earlyWR > lateWR + 1.5 ? "Early" : "Mid");
            }

            // === 5. EXTRAER BUILD (Runas, Spells, Habilidades e Ítems) ===
            const r = data.runes;
            const bestKeystone = getBestRuneSlot(r.primaryRuneId);
            const secondaryRunes = getBestSecondaryRunes(r.secondaryRuneId);
            const primaryStyleId = getStyleOfRune(bestKeystone);
            const subStyleId = getStyleOfRune(secondaryRunes[0]);

            const bestStarter = data.startItems?.sort((a: any, b: any) => b.pickrate - a.pickrate)[0]?.startItems || [];   
            const bestBootsId = getMostPopularItem(data.boots, 'itemId');
            const bestCoreItems = getBestCoreBuild(data.coreBuilds);
            const bestSummoners = getBestSummoners(data.summoners);

            db[name].buildData = {
                patch: version,
                lastUpdate: new Date().toISOString(),
                summoners: bestSummoners,
                runes: {
                    primaryStyleId: primaryStyleId,
                    subStyleId: subStyleId,
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
                    starter: bestStarter,
                    boots: { id: bestBootsId },
                    coreSlots: bestCoreItems.map((id: number) => ({ id }))
                },
                skills: data.skillLevelUp?.sort((a:any, b:any) => b.winrate - a.winrate)[0] || null
            };

        } catch (e: any) { 
            writeLog(`❌ Error procesando ${name}: ${e.message || e}`); 
            if (checkAbort()) break;
        }
        
        // Guardado preventivo cada 10 campeones por si se corta la luz o hay error de red
        if (champions.indexOf(name) % 10 === 0) {
            fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
        }
        
        await new Promise(r => setTimeout(r, 2000));
    }

    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
    await browser.close();
    if (checkAbort()) {
        writeLog("🛑 CANCELACIÓN PROCESADA. Motores apagados.");
        return "Cancelado por el usuario";
    }
    writeLog("🏁 SINCRONIZACIÓN MASIVA COMPLETA");
    return "Script Finalizado";
}