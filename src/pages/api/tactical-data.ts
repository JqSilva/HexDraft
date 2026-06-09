import type { APIRoute } from 'astro';
import axios from 'axios';
import * as cheerio from 'cheerio';

export const GET: APIRoute = async ({ url }) => {
    const champion = url.searchParams.get('champion')?.toLowerCase().replace(/[^a-z0-9]/g, "");
    let role = (url.searchParams.get('role') || 'jungle').toLowerCase();

    if (!champion) return new Response(null, { status: 400 });

    // 1. Normalizar nombres de roles a los estándares de OP.GG
    const validPositions = ['top', 'jungle', 'mid', 'bot', 'support'];
    if (role === 'adc' || role === 'bottom') role = 'bot';
    if (role === 'utility' || role === 'support') role = 'support';
    if (role === 'middle') role = 'mid';

    let pos = role;
    if (!validPositions.includes(pos)) {
        // Intentamos buscar el carril principal de este campeón en la base de datos local
        try {
            const { championsRepo } = await import('../../lib/db/champions.repo.js');
            const nameMap = championsRepo.getChampionIdNameMap();
            const normChamp = champion.toLowerCase().replace(/[^a-z0-9]/g, "");
            const champId = nameMap[normChamp];
            if (champId) {
                const list = championsRepo.getAllEnrichedChampions();
                const champData = list.find(c => c.id === champId);
                if (champData && champData.lane) {
                    let dbLane = champData.lane.toLowerCase();
                    if (dbLane === 'jungle') pos = 'jungle';
                    else if (dbLane === 'middle') pos = 'mid';
                    else if (dbLane === 'top') pos = 'top';
                    else if (dbLane === 'bottom' || dbLane === 'adc') pos = 'bot';
                    else if (dbLane === 'utility' || dbLane === 'support') pos = 'support';
                }
            }
        } catch (err) {
            console.warn("No se pudo obtener el carril de la base de datos para fallback:", err);
        }

        // Fallback final si sigue sin ser válido
        if (!validPositions.includes(pos)) {
            pos = 'jungle'; 
        }
    }

    try {
        const opggUrl = `https://www.op.gg/champions/${champion}/skills/${pos}?region=global&tier=emerald_plus`;
        
        const { data: html } = await axios.get(opggUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' }
        });

        const $ = cheerio.load(html);
        const skillOptions: any[] = [];

        $('table tbody tr').each((_, tr) => {
            const row = $(tr);
            
            const pickRateText = row.find('td:nth-child(2) span.font-bold').text().replace('%', '');
            const pickRate = parseFloat(pickRateText) || 0;

            const winRateText = row.find('td:nth-child(3) strong').text().replace('%', '');
            const winRate = parseFloat(winRateText) || 0;

            const levels: string[] = [];
            row.find('td:first-child .inline-flex span strong').each((_, skill) => {
                levels.push($(skill).text().trim());
            });

            if (levels.length >= 15) {
                skillOptions.push({
                    score: pickRate + winRate,
                    levels: levels.slice(0, 15)
                });
            }
        });

        const bestOption = skillOptions.sort((a, b) => b.score - a.score)[0];

        if (!bestOption) throw new Error("No se encontraron datos de habilidades en el HTML");

        return new Response(JSON.stringify({
            skills: bestOption.levels,
            champion: champion
        }), { 
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (e: any) {
        console.error("Scraper Error:", e);

        // Fallback robusto: Generar secuencia de habilidades 1-15 inteligente según la base de datos
        try {
            const { championsRepo } = await import('../../lib/db/champions.repo.js');
            const nameMap = championsRepo.getChampionIdNameMap();
            const normChamp = champion.toLowerCase().replace(/[^a-z0-9]/g, "");
            const champId = nameMap[normChamp];
            if (champId) {
                const list = championsRepo.getAllEnrichedChampions();
                const champData = list.find(c => c.id === champId);
                const skillsObj = champData?.buildData?.skills;
                if (skillsObj) {
                    const order = [
                        { key: "Q", pos: skillsObj.skillLevelUp1 || 1 },
                        { key: "W", pos: skillsObj.skillLevelUp2 || 2 },
                        { key: "E", pos: skillsObj.skillLevelUp3 || 3 }
                    ].sort((a, b) => a.pos - b.pos);
                    
                    const priorityKeys = order.map(x => x.key);
                    
                    const fallbackLevels: string[] = Array(15).fill("");
                    fallbackLevels[5] = "R";
                    fallbackLevels[10] = "R";
                    
                    fallbackLevels[0] = priorityKeys[0];
                    fallbackLevels[1] = priorityKeys[1];
                    fallbackLevels[2] = priorityKeys[2];
                    
                    let countP1 = 1;
                    let countP2 = 1;
                    let countP3 = 1;
                    
                    for (let lvl = 3; lvl < 15; lvl++) {
                        if (lvl === 5 || lvl === 10) continue;
                        
                        if (countP1 < 5) {
                            fallbackLevels[lvl] = priorityKeys[0];
                            countP1++;
                        } else if (countP2 < 5) {
                            fallbackLevels[lvl] = priorityKeys[1];
                            countP2++;
                        } else {
                            fallbackLevels[lvl] = priorityKeys[2];
                            countP3++;
                        }
                    }
                    
                    console.log(`💡 Generada secuencia fallback para ${champion}:`, fallbackLevels);
                    return new Response(JSON.stringify({
                        skills: fallbackLevels,
                        champion: champion,
                        isFallback: true
                    }), { 
                        status: 200, 
                        headers: { 'Content-Type': 'application/json' } 
                    });
                }
            }
        } catch (fallbackErr) {
            console.error("Error al generar fallback de habilidades:", fallbackErr);
        }

        return new Response(JSON.stringify({ error: "Fallo el scraping", details: e.message }), { status: 500 });
    }
};