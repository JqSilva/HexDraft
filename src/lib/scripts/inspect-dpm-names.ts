// src/lib/scripts/inspect-dpm-names.ts
import axios from 'axios';

const FLARESOLVERR_URL = 'http://localhost:8191/v1';
const url = 'https://dpm.lol/v1/tierlist?tier=diamond&timeframe=16.12&gameMode=ranked';

function extractJsonFromHtml(htmlOrJson: string): any {
  try {
    return JSON.parse(htmlOrJson);
  } catch (e) {
    const preMatch = htmlOrJson.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
    if (preMatch && preMatch[1]) {
      return JSON.parse(preMatch[1].trim());
    }
    const bodyMatch = htmlOrJson.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch && bodyMatch[1]) {
      const text = bodyMatch[1].replace(/<[^>]*>/g, '').trim();
      return JSON.parse(text);
    }
    throw new Error("No se pudo extraer JSON puro.");
  }
}

async function run() {
  console.log("Fetching dpm.lol tierlist...");
  try {
    const response = await axios.post(FLARESOLVERR_URL, {
      cmd: "request.get",
      url: url,
      maxTimeout: 60000
    });
    
    if (response.data && response.data.status === 'ok') {
      const data = extractJsonFromHtml(response.data.solution.response);
      console.log("Tierlist fetched successfully. Champions list:");
      const names = data.champions.map((c: any) => c.championName);
      console.log(JSON.stringify(names.sort()));
    } else {
      console.log("Failed to fetch:", response.data);
    }
  } catch (err: any) {
    console.error("Error:", err.message);
  }
}

run();
