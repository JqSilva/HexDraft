import type { APIRoute } from 'astro';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { saveMetaCache } from '../../lib/metaManager';

async function scrapeRoleData(role: string) {
    // Mapeo de nombres de posición para la URL de OP.GG
    const pos = role;
    const url = `https://www.op.gg/champions?region=global&tier=master&position=${pos}`;

    const { data: html } = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept-Language': 'es-ES,es;q=0.9'
        }
    });

    const $ = cheerio.load(html);
    const list: any[] = [];

    $('table tbody tr').each((_, el) => {
        const row = $(el);
        if (row.hasClass('ad')) return;

        const rank = row.find('td:nth-child(1) span.w-5').text().trim();
        const name = row.find('td:nth-child(2) strong').text().trim();
        const winRate = row.find('td:nth-child(5)').text().trim();
        const pickRate = row.find('td:nth-child(6)').text().trim();

        // Lógica exacta de tus counters que sí funciona
        const counters: string[] = [];
        row.find('td:nth-child(8) img').each((_, img) => {
            const counterName = $(img).attr('alt');
            if (counterName) counters.push(counterName);
        });

        if (name) {
            list.push({
                rank: rank || "#",
                name: name,
                winRate: winRate,
                pickRate: pickRate,
                counters: counters // Guardamos el array de strings directamente
            });
        }
    });
    return list;
}

export const POST: APIRoute = async () => {
    try {
        const roles = ['top', 'jungle', 'mid', 'adc', 'support'];
        const results: Record<string, any[]> = {};

        for (const role of roles) {
            console.log(`Scrapeando meta de ${role}...`);
            results[role] = await scrapeRoleData(role);
        }

        saveMetaCache(results);

        return new Response(JSON.stringify({ message: "Sincronizado con éxito" }), { status: 200 });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}