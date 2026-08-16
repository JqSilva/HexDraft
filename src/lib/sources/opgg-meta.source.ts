// src/lib/sources/opgg-meta.source.ts
import axios from 'axios';
import * as cheerio from 'cheerio';

export interface RawOpggMetaChampion {
  rank: string;
  name: string;
  winRate: string;
  pickRate: string;
  counters: string[];
}

export async function fetchOpggMetaByPosition(position: string): Promise<RawOpggMetaChampion[]> {
  const { data: html } = await axios.get(`https://www.op.gg/champions?region=global&tier=diamond&position=${position}`, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const $ = cheerio.load(html);
  const list: RawOpggMetaChampion[] = [];

  $('table tbody tr').each((_, el) => {
    const row = $(el);
    if (row.hasClass('ad')) return;
    const rank = row.find('td:first-child span.w-5').first().text().trim();

    list.push({
      rank: rank,
      name: row.find('td:nth-child(2) strong').text().trim(),
      winRate: row.find('td:nth-child(5)').text().trim(),
      pickRate: row.find('td:nth-child(6)').text().trim(),
      counters: row.find('td:nth-child(8) img').map((_, img) => $(img).attr('alt')).get() as string[]
    });
  });

  return list;
}
