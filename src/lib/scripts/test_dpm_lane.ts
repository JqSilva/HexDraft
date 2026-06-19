import puppeteer from 'puppeteer';

async function main() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Primero veamos qué devuelve DPM para una URL que sabemos funciona (Nasus jungle funcionó antes)
  const tests = [
    // Probar distintos timeframes
    { champ: 'Thresh', lane: 'support', tf: '16.12' },
    { champ: 'Thresh', lane: 'support', tf: '16.11' },
    { champ: 'Thresh', lane: 'support', tf: '' },   // sin timeframe
    // Probar sin gameMode
    { champ: 'Nasus', lane: 'jungle', tf: '16.12' }, // control - debería funcionar
  ];

  for (const t of tests) {
    let url = `https://dpm.lol/v1/builds/${t.champ}?lane=${t.lane}&tier=emerald_plus&gameMode=ranked`;
    if (t.tf) url += `&timeframe=${t.tf}`;
    console.log(`\nURL: ${url}`);
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
      const text = await page.evaluate(() => document.body.innerText);
      // Mostrar primeros 200 chars si no es JSON válido
      try {
        const data = JSON.parse(text);
        console.log(`  OK! hasRunes: ${!!data.runes}, keys: ${Object.keys(data).slice(0,8).join(',')}`);
      } catch {
        console.log(`  NOT JSON. Body text (first 300): "${text.substring(0, 300)}"`);
      }
    } catch (e: any) {
      console.log(`  TIMEOUT/ERROR: ${e.message.substring(0, 150)}`);
    }
  }

  await browser.close();
}

main();
