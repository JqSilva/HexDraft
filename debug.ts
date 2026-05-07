import axios from 'axios';
import * as cheerio from 'cheerio';

async function scrapeLeagueMeta(role: string) {
    console.log(`\n🚀 OPGG SCRAPER 2026 - INICIANDO (ROL: ${role.toUpperCase()})`);
    
    // URL exacta de OP.GG para el rol
    const url = `https://www.op.gg/champions?region=global&tier=emerald_plus&position=${role}`;

    try {
        const { data: html } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept-Language': 'es-ES,es;q=0.9'
            }
        });

        const $ = cheerio.load(html);
        const championList: any[] = [];

        // Buscamos las filas de la tabla (excluyendo la cabecera y filas de anuncios)
        $('table tbody tr').each((_, el) => {
            const row = $(el);

            // Saltar si es una fila de publicidad (clase .ad)
            if (row.hasClass('ad')) return;

            // 1. Ranking (posición en la tabla)
            const rank = row.find('td:nth-child(1) span.w-5').text().trim();

            // 2. Nombre del Campeón (dentro del strong)
            const name = row.find('td:nth-child(2) strong').text().trim();

            // 3. Win Rate (Tasa de victoria - Columna 5)
            const winRate = row.find('td:nth-child(5)').text().trim();

            // 4. Pick Rate (Tasa de elección - Columna 6)
            const pickRate = row.find('td:nth-child(6)').text().trim();

            // 5. Counters (Columna 8 - Extraemos el nombre desde el atributo ALT de las imágenes)
            const counters: string[] = [];
            row.find('td:nth-child(8) img').each((_, img) => {
                const counterName = $(img).attr('alt');
                if (counterName) counters.push(counterName);
            });

            if (name) {
                championList.push({
                    Rank: rank || "#",
                    Name: name,
                    WinRate: winRate,
                    PickRate: pickRate,
                    Counters: counters.join(', ') || 'N/A'
                });
            }
        });

        if (championList.length === 0) {
            console.log("❌ No se pudo extraer la tabla. Los selectores podrían haber cambiado.");
        } else {
            console.log(`✅ Se encontraron ${championList.length} campeones para ${role}.`);
            console.table(championList.slice(0, 20)); // Mostramos los top 20
        }

    } catch (error: any) {
        console.error("❌ Error de red o conexión:", error.message);
    }
}

// Ejecución - Puedes cambiar 'jungle' por 'top', 'mid', 'adc', 'support'
scrapeLeagueMeta('jungle');