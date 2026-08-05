// scripts/test-opgg-api.ts
import axios from 'axios';

async function testOpggApi() {
  const summonerName = 'Frikz';
  const tagLine = 'xoro';
  const region = 'las';

  // 1. Probar la API interna de OP.GG
  const apiUrls = [
    `https://www.op.gg/api/v1.0/internal/bypass/summoners/${region}/name/${encodeURIComponent(summonerName)}?tag=${encodeURIComponent(tagLine)}`,
    `https://op.gg/api/v1.0/internal/bypass/summoners/${region}/v2/Frikz-xoro`,
    `https://www.op.gg/api/v1.0/internal/bypass/games/${region}/summoners/Frikz-xoro`
  ];

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
  };

  for (const url of apiUrls) {
    console.log(`\n--------------------------------------------------`);
    console.log(`Probando endpoint: ${url}`);
    try {
      const res = await axios.get(url, { headers, timeout: 5000 });
      console.log(`HTTP Status: ${res.status}`);
      console.log(`Respuesta JSON (primeros 1500 chars):`);
      console.log(JSON.stringify(res.data, null, 2).slice(0, 1500));
    } catch (e: any) {
      console.log(`HTTP Status: ${e.response?.status || 'Error'}`);
      console.log(`Mensaje: ${e.message}`);
    }
  }
}

testOpggApi();
