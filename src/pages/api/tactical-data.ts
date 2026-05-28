import type { APIRoute } from 'astro';
import axios from 'axios';
import * as cheerio from 'cheerio';

export const GET: APIRoute = async ({ url }) => {
    const champion = url.searchParams.get('champion')?.toLowerCase().replace(/[^a-z0-9]/g, "");
    const role = url.searchParams.get('role') || 'top';

    if (!champion) return new Response(null, { status: 400 });

    try {
        // Mapeo de rol para la URL de OP.GG
        const pos = role === 'adc' ? 'bottom' : (role === 'utility' ? 'support' : role);
        const opggUrl = `https://www.op.gg/champions/${champion}/skills/${pos}?region=global&tier=emerald_plus`;
        
        const { data: html } = await axios.get(opggUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' }
        });

        const $ = cheerio.load(html);
        const skillOptions: any[] = [];

        // Buscamos todas las filas de la tabla de habilidades
        $('table tbody tr').each((_, tr) => {
            const row = $(tr);
            
            // 1. Extraer Tasa de Selección (ej: "83.47%")
            const pickRateText = row.find('td:nth-child(2) span.font-bold').text().replace('%', '');
            const pickRate = parseFloat(pickRateText) || 0;

            // 2. Extraer Tasa de Victoria (ej: "54.46%")
            const winRateText = row.find('td:nth-child(3) strong').text().replace('%', '');
            const winRate = parseFloat(winRateText) || 0;

            // 3. Capturar el array de 15 niveles
            const levels: string[] = [];
            row.find('td:first-child .inline-flex span strong').each((_, skill) => {
                levels.push($(skill).text().trim());
            });

            if (levels.length >= 15) {
                skillOptions.push({
                    score: pickRate + winRate, // Tu lógica de suma
                    levels: levels.slice(0, 15)
                });
            }
        });

        // Ordenar por el score más alto y tomar el primero
        const bestOption = skillOptions.sort((a, b) => b.score - a.score)[0];

        if (!bestOption) throw new Error("No se encontraron datos de habilidades");

        return new Response(JSON.stringify({
            skills: bestOption.levels,
            champion: champion
        }), { 
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (e) {
        console.error("Scraper Error:", e);
        return new Response(JSON.stringify({ error: "Fallo el scraping", details: e.message }), { status: 500 });
    }
};