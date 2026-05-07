import puppeteer from 'puppeteer';

export interface TierItem {
  id?: number;
  name: string;
  tier: string;
  winRate: number;
  role: string;
}

export async function getTierListByRole(role: string): Promise<TierItem[]> {
  // Mapeo para la URL (top, jungle, middle, adc, support)
  const roleUrl = role.toLowerCase() === 'mid' ? 'middle' : role.toLowerCase();
  const url = `https://www.metasrc.com/lol/5v5/tier-list/${roleUrl}`;

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.setUserAgent('Mozilla/5.0 ...');
    await page.goto(url, { waitUntil: 'networkidle2' });

    const data = await page.evaluate((currentRole) => {
      const rows = Array.from(document.querySelectorAll('table tbody tr'));
      return rows.map(row => {
        const name = row.querySelector('td:nth-child(2)')?.textContent?.trim() || "";
        const tier = row.querySelector('td:nth-child(1)')?.textContent?.trim() || "B";
        const wrText = row.querySelector('td:nth-child(5)')?.textContent?.replace('%', '') || "50";
        
        return {
          name,
          tier,
          winRate: parseFloat(wrText),
          role: currentRole
        };
      });
    }, role);

    return data;
  } finally {
    await browser.close();
  }
}