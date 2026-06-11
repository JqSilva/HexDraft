// inspect_dpm_runes.js
import puppeteer from 'puppeteer';

async function run() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
    });
  });

  const url = 'https://dpm.lol/v1/builds/Diana?lane=jungle&tier=emerald_plus&timeframe=16.11&gameMode=ranked';
  try {
    console.log("Navigating to DPM.LOL for Diana...");
    await page.goto(url, { waitUntil: 'networkidle2' });
    const text = await page.evaluate(() => document.body.innerText);
    const data = JSON.parse(text);
    
    console.log("data.runes keys:", Object.keys(data.runes || {}));
    if (data.runes) {
      // Print first items of each array to see structure
      Object.keys(data.runes).forEach(k => {
        const arr = data.runes[k];
        if (Array.isArray(arr)) {
          console.log(`Key: ${k}, length: ${arr.length}, sample:`, JSON.stringify(arr.slice(0, 1), null, 2));
        } else {
          console.log(`Key: ${k}, type: ${typeof arr}`);
        }
      });
    }
  } catch(e) {
    console.error("Error:", e);
  } finally {
    await browser.close();
  }
}

run();
