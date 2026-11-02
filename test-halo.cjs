const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:4321/draft', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1500));
  
  // dismiss popup
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find(b => b.textContent && b.textContent.includes('Omitir'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 800));

  // Take current
  await page.screenshot({ path: 'test_current.png' });

  // Apply variant
  await page.evaluate(() => {
    let style = document.getElementById('test-halo-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'test-halo-style';
      document.head.appendChild(style);
    }
    style.textContent = `
      .draft-panel-wrapper::before {
        inset: -42px -56px !important;
        background:
          radial-gradient(ellipse 85% 50% at 50% 0%, rgba(155, 77, 230, 0.18) 0%, rgba(108, 20, 213, 0.09) 45%, transparent 75%),
          radial-gradient(ellipse 95% 80% at 50% 50%, rgba(108, 20, 213, 0.14) 0%, rgba(79, 22, 155, 0.06) 60%, transparent 85%) !important;
        filter: blur(44px) !important;
        border-radius: 3rem !important;
      }
      .draft-central-panel {
        box-shadow:
          0 16px 40px -10px rgba(0, 0, 0, 0.55),
          0 0 45px -8px rgba(108, 20, 213, 0.10) !important;
      }
    `;
  });

  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: 'test_tuned.png' });

  await browser.close().catch(() => {});
  console.log('Test screenshots saved successfully!');
  process.exit(0);
})();
