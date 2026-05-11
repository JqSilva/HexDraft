// src/pages/api/game-version.ts
import type { APIRoute } from 'astro';
import { getLockfileData } from '../../lib/lcu';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

export const GET: APIRoute = async () => {
  const lcu = getLockfileData();
  
  if (!lcu) {
    return new Response(JSON.stringify({ error: "LCU no detectado" }), { status: 404 });
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
      short: shortVersion 
    }), { status: 200 });
    
  } catch (e) {
    return new Response(JSON.stringify({ error: "No se pudo obtener la versión" }), { status: 500 });
  }
};