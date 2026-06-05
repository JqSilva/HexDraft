// test-lcu.js
import fs from 'node:fs';
import path from 'node:path';

const lockfilePath = 'C:\\Riot Games\\League of Legends\\lockfile';
if (!fs.existsSync(lockfilePath)) {
  console.error("Lockfile no encontrado en:", lockfilePath);
  process.exit(1);
}

const lockfileContent = fs.readFileSync(lockfilePath, 'utf8');
const [name, pid, port, token, protocol] = lockfileContent.split(':');
const auth = btoa(`riot:${token}`);
const headers = {
  'Authorization': `Basic ${auth}`,
  'Accept': 'application/json'
};

// Desactivar TLS
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function testEndpoint(urlPath) {
  const url = `https://127.0.0.1:${port}${urlPath}`;
  try {
    const res = await fetch(url, { headers });
    console.log(`URL: ${urlPath} -> Status: ${res.status}`);
    if (res.ok) {
      const data = await res.json();
      console.log(`  -> OK! Size: ${JSON.stringify(data).length} chars. Preview:`, JSON.stringify(data).slice(0, 150));
      return data;
    } else {
      const text = await res.text();
      console.log(`  -> Error:`, text);
    }
  } catch (err) {
    console.error(`  -> Excepción en ${urlPath}:`, err.message);
  }
}

async function run() {
  console.log("--- TEST LCU ---");
  console.log("Puerto:", port);
  const summoner = await testEndpoint('/lol-summoner/v1/current-summoner');
  await testEndpoint('/lol-ranked/v1/current-ranked-stats');
  await testEndpoint('/lol-collections/v1/inventories/local-player/champion-mastery');
  await testEndpoint('/lol-champion-mastery/v1/local-player/champion-mastery');
  if (summoner && summoner.summonerId) {
    await testEndpoint(`/lol-collections/v1/inventories/${summoner.summonerId}/champion-mastery`);
  }
  await testEndpoint('/lol-champion-mastery/v1/local-player/top-champions');
  await testEndpoint('/lol-champion-mastery/v1/local-player/top-champions?limit=4');
  await testEndpoint('/lol-match-history/v1/my-games');
  if (summoner && summoner.puuid) {
    await testEndpoint(`/lol-match-history/v1/products/lol/current-summoner/matches`);
  }
}

run();
