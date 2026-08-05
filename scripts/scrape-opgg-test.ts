// scripts/scrape-opgg-test.ts
import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'node:fs';
import path from 'node:path';

async function scrapeOpggProfile(gameName: string = 'Frikz', tagLine: string = 'xoro', region: string = 'las') {
  const profileSlug = `${gameName}-${tagLine}`;
  const opggUrl = `https://www.op.gg/summoners/${region}/${profileSlug}`;

  const logLines: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    logLines.push(msg);
  };

  log(`===================================================================`);
  log(`[OP.GG SCRAPER V2 OUTPUT DUMP]`);
  log(`Invocador: ${gameName}#${tagLine} | Región: ${region.toUpperCase()}`);
  log(`URL de Perfil: ${opggUrl}`);
  log(`Fecha y Hora: ${new Date().toISOString()}`);
  log(`===================================================================\n`);

  try {
    const response = await axios.get(opggUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache'
      },
      timeout: 10000
    });

    log(`[HTTP STATUS]: ${response.status} OK\n`);

    const html = response.data;
    const $ = cheerio.load(html);

    // 1. METADATOS Y RESUMEN DEL HEAD HTML
    const titleText = $('title').text().trim();
    const metaDescription = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '';

    log(`-------------------------------------------------------------------`);
    log(`[1] METADATOS Y RESUMEN DEL HEAD HTML`);
    log(`-------------------------------------------------------------------`);
    log(`Título: ${titleText}`);
    log(`Meta Description: ${metaDescription}\n`);

    // 2. DATOS ESTRUCTURADOS SCHEMA.ORG (JSON-LD)
    let schemaJson: any = null;
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const content = $(el).html() || '';
        const parsed = JSON.parse(content);
        if (parsed['@graph'] || parsed.description || parsed.name) {
          schemaJson = parsed;
        }
      } catch (e) {}
    });

    log(`-------------------------------------------------------------------`);
    log(`[2] DATOS ESTRUCTURADOS JSON-LD (SCHEMA.ORG)`);
    log(`-------------------------------------------------------------------`);
    if (schemaJson) {
      log(JSON.stringify(schemaJson, null, 2));
    } else {
      log(`[!] No se encontraron metadatos JSON-LD estructurados.`);
    }
    log(`\n`);

    // 3. DATOS CHUNKS DE NEXT.JS (self.__next_f)
    log(`-------------------------------------------------------------------`);
    log(`[3] CHUNKS DE NEXT.JS CON DATOS DE PARTICIPANTES, OP SCORE Y PARTIDAS`);
    log(`-------------------------------------------------------------------`);

    const rscChunks: string[] = [];
    $('script').each((_, el) => {
      const scriptText = $(el).html() || '';
      if (scriptText.includes('self.__next_f.push')) {
        rscChunks.push(scriptText);
      }
    });

    rscChunks.forEach((chunk, index) => {
      if (
        chunk.includes('SOLORANKED') ||
        chunk.includes('FLEXRANKED') ||
        chunk.includes('win_rate') ||
        chunk.includes('league_points') ||
        chunk.includes('opScore') ||
        chunk.includes('mastery') ||
        chunk.includes('schema.org')
      ) {
        log(`\n--- CHUNK RELEVANTE [${index}] (Longitud: ${chunk.length}) ---`);
        log(chunk);
      }
    });

    log(`\n===================================================================`);
    log(`[SCRAPING COMPLETADO CON ÉXITO]`);
    log(`===================================================================`);

    // Guardar salida en archivo
    const outputPath = path.resolve(process.cwd(), 'scripts/opgg-scrape-output.txt');
    fs.writeFileSync(outputPath, logLines.join('\n'), 'utf-8');
    console.log(`\n[ARCHIVO GENERADO CON ÉXITO]: ${outputPath}`);

  } catch (error: any) {
    console.error(`[OP.GG SCRAPER TEST] Error ejecutando la petición:`, error.message);
  }
}

scrapeOpggProfile('Frikz', 'xoro', 'las');
