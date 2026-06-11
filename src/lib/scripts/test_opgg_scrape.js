import axios from 'axios';
import * as cheerio from 'cheerio';

async function testUrl(url) {
  try {
    console.log(`Fetching: ${url}`);
    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      }
    });
    const $ = cheerio.load(html);
    const rows = $('table tbody tr');
    console.log(`Success! Found ${rows.length} rows in the table.`);
    
    rows.each((i, tr) => {
      const row = $(tr);
      const pickRateText = row.find('td:nth-child(2) span.font-bold').text().trim();
      const winRateText = row.find('td:nth-child(3) strong').text().trim();
      const levels = [];
      row.find('td:first-child .inline-flex span strong').each((_, skill) => {
        levels.push($(skill).text().trim());
      });
      if (levels.length > 0) {
        console.log(`Row ${i}: Pick=${pickRateText}, Win=${winRateText}, Levels=${levels.join(', ')}`);
      }
    });
  } catch(e) {
    console.error(`Failed: ${e.message}`);
  }
}

async function run() {
  // Test 1: Current /skills/ url
  await testUrl('https://www.op.gg/champions/wukong/skills/jungle?region=global&tier=emerald_plus');
  
  // Test 2: Standard url
  await testUrl('https://www.op.gg/champions/wukong/jungle?region=global&tier=emerald_plus');
}

run();
