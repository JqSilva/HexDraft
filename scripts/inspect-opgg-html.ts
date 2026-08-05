// scripts/inspect-opgg-html.ts
import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'node:fs';

async function inspectOpgg() {
  const url = 'https://www.op.gg/summoners/las/Frikz-xoro';

  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
      }
    });

    const html = res.data;
    const $ = cheerio.load(html);

    console.log("Status:", res.status);
    console.log("HTML Length:", html.length);

    // Guardar el HTML completo para analisis
    fs.writeFileSync('scripts/opgg_response.html', html, 'utf-8');
    console.log("HTML guardado en scripts/opgg_response.html");

    // Buscar scripts con JSON
    $('script').each((i, el) => {
      const content = $(el).html() || '';
      const id = $(el).attr('id') || '';
      const type = $(el).attr('type') || '';

      if (content.includes('buildId') || content.includes('summoner') || content.includes('tier') || content.includes('props')) {
        console.log(`\n--- Script [${i}] id="${id}" type="${type}" (longitud: ${content.length}) ---`);
        console.log(content.slice(0, 500) + '...');
      }
    });

  } catch (e: any) {
    console.error("Error inspect:", e.message);
  }
}

inspectOpgg();
