import puppeteer from 'puppeteer';

async function run() {
  console.log("Launching Puppeteer with sync.service settings...");
  const browser = await puppeteer.launch({ 
    headless: true,
    pipe: true,
    ignoreDefaultArgs: ['--enable-automation'],
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ] 
  });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
    });
  });

  try {
    const url = 'https://dpm.lol/v1/builds/Kayn?lane=jungle&tier=emerald_plus&timeframe=16.11&gameMode=ranked';
    console.log("Navigating to:", url);
    await page.goto(url, { waitUntil: 'networkidle2' });
    const text = await page.evaluate(() => document.body.innerText);
    const data = JSON.parse(text);
    
    console.log("\n=== KEYSTONES ===");
    console.log(JSON.stringify(data.runes?.primaryRuneId, null, 2));

    console.log("\n=== CORE3 BUILDS ===");
    console.log(JSON.stringify(data.coreBuilds?.coreItem3, null, 2));
  } catch(e) {
    console.error("Error occurred:", e);
  } finally {
    await browser.close();
  }
}

run();
