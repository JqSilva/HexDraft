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

  const url = 'https://dpm.lol/v1/builds/Diana?lane=jungle&tier=emerald_plus&timeframe=14.9&gameMode=ranked';
  try {
    console.log("Navigating to DPM.LOL for Diana...");
    await page.goto(url, { waitUntil: 'networkidle2' });
    const text = await page.evaluate(() => document.body.innerText);
    const data = JSON.parse(text);
    console.log("data keys:", Object.keys(data || {}));
    console.log("Full data:", JSON.stringify(data, null, 2));
  } catch(e) {
    console.error("Error:", e);
  } finally {
    await browser.close();
  }
}

run();
