// src/pages/api/game-version.ts
import type { APIRoute } from 'astro';
import { getLockfileData } from '../../lib/services/lcu.service.js';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

export const GET: APIRoute = async () => {
  const lcu = getLockfileData();
  
  if (!lcu) {
    // Fallback a DDragon si LCU no está ejecutándose
    try {
      const ddragonRes = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
      const versions = await ddragonRes.json();
      const latestFull = versions[0];
      const parts = latestFull.split('.');
      const shortVersion = `${parts[0]}.${parts[1]}`;
      return new Response(JSON.stringify({ 
        full: latestFull, 
        short: shortVersion,
        source: 'ddragon'
      }), { status: 200 });
    } catch (e) {
      return new Response(JSON.stringify({ error: "LCU no detectado y fallo en DDragon" }), { status: 404 });
    }
  }

  const auth = btoa(`riot:${lcu.token}`);

  try {
    const response = await fetch(
      `https://127.0.0.1:${lcu.port}/lol-patch/v1/game-version`,
      {
        headers: { 'Authorization': `Basic ${auth}` }
      }
    );

    const fullVersion = await response.json(); 
    // fullVersion suele ser algo como "14.9.581.3345"
    
    // Para dpm.lol necesitamos los dos primeros números (14.9)
    const parts = fullVersion.split('.');
    const shortVersion = `${parts[0]}.${parts[1]}`;

    return new Response(JSON.stringify({ 
      full: fullVersion, 
      short: shortVersion,
      source: 'lcu'
    }), { status: 200 });
    
  } catch (e) {
    // Si falla el LCU por algún motivo de red local, intentamos DDragon
    try {
      const ddragonRes = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
      const versions = await ddragonRes.json();
      const latestFull = versions[0];
      const parts = latestFull.split('.');
      const shortVersion = `${parts[0]}.${parts[1]}`;
      return new Response(JSON.stringify({ 
        full: latestFull, 
        short: shortVersion,
        source: 'ddragon-fallback'
      }), { status: 200 });
    } catch {
      return new Response(JSON.stringify({ error: "No se pudo obtener la versión de LCU ni DDragon" }), { status: 500 });
    }
  }
};