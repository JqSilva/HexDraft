// src/pages/api/me.ts
import type { APIRoute } from 'astro';
import { getLockfileData } from '../../lib/lcu';

export const GET: APIRoute = async () => {
  const lcu = getLockfileData();

  if (!lcu) {
    return new Response(JSON.stringify({ error: "Abre el LoL primero" }), { status: 404 });
  }

  const auth = btoa(`riot:${lcu.token}`);

  try {
    // Probamos con /lol-summoner/v1/current-summoner que es un endpoint seguro
    const response = await fetch(
      `https://127.0.0.1:${lcu.port}/lol-summoner/v1/current-summoner`,
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json'
        }
      }
    );

    const data = await response.json();
    return new Response(JSON.stringify({
      summoner: data.gameName
    }), { status: 200 });
    
  } catch (e) {
    return new Response(JSON.stringify({ 
        error: "Error de conexión", 
        ayuda: "Asegúrate de correr Astro con NODE_TLS_REJECT_UNAUTHORIZED=0" 
    }), { status: 500 });
  }
};