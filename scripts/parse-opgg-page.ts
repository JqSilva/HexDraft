// scripts/parse-opgg-page.ts
import axios from 'axios';
import * as cheerio from 'cheerio';

async function parseOpggProfile(summonerTag: string = 'Frikz-xoro', region: string = 'las') {
  const url = `https://www.op.gg/summoners/${region}/${summonerTag}`;
  console.log(`==================================================`);
  console.log(`[OP.GG SCRAPER] Solicitando página de perfil: ${url}`);
  console.log(`==================================================`);

  const res = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
  });

  const html = res.data;
  const $ = cheerio.load(html);

  // 1. Extraer Metadatos y Descripción Corta
  const title = $('title').text();
  const metaDesc = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '';

  console.log(`\n--- METADATOS BÁSICOS ---`);
  console.log(`Título: ${title}`);
  console.log(`Descripción Meta: ${metaDesc}`);

  // 2. Extraer Schema.org JSON-LD
  let schemaData: any = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const raw = $(el).html() || '';
      schemaData = JSON.parse(raw);
    } catch (e) {}
  });

  if (schemaData) {
    console.log(`\n--- SCHEMA.ORG JSON-LD ENCONTRADO ---`);
    console.log(JSON.stringify(schemaData, null, 2));
  }

  // 3. Extraer Bloques JSON de Next.js App Router (self.__next_f.push)
  console.log(`\n--- BUSCANDO ESTRUCTURA DE DATOS EN CHUNKS DE NEXT.JS ---`);
  const nextChunks: string[] = [];
  $('script').each((_, el) => {
    const text = $(el).html() || '';
    if (text.includes('self.__next_f.push')) {
      nextChunks.push(text);
    }
  });

  console.log(`Total de scripts RSC encontrados: ${nextChunks.length}`);

  // Buscar fragmentos con información de SoloQ, Flex, Champions, Matches
  const extractedInfo: any = {
    summoner: summonerTag,
    region,
    rawDataSnippets: []
  };

  nextChunks.forEach((chunk, idx) => {
    // Buscar menciones de datos clave como tier, lp, winRate, champion, etc.
    if (
      chunk.includes('SOLORANKED') ||
      chunk.includes('FLEXRANKED') ||
      chunk.includes('win_rate') ||
      chunk.includes('champion') ||
      chunk.includes('league_points')
    ) {
      console.log(`\nChunk relevante [${idx}] (Longitud: ${chunk.length}):`);
      console.log(chunk.slice(0, 1000) + '...');
      extractedInfo.rawDataSnippets.push(chunk.slice(0, 2000));
    }
  });

  // 4. Extracción de Texto Completo del DOM (Limpio)
  console.log(`\n==================================================`);
  console.log(`[5] IMPRESIÓN COMPLETA DE CONTENIDO EXTRAÍDO DEL PERFIL DE OP.GG`);
  console.log(`==================================================\n`);

  console.log(`Invocador: Frikz#xoro (${region.toUpperCase()})`);
  console.log(`Resumen de la página:\n${metaDesc}`);

}

parseOpggProfile('Frikz-xoro', 'las');
