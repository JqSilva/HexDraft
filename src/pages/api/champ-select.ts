// src/pages/api/champ-select.ts
import type { APIRoute } from 'astro';
import { getLockfileData } from '../../lib/lcu';

// ESTO ES VITAL para conectar con el LCU local
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

export const GET: APIRoute = async () => {
  const lcu = getLockfileData();
  
  if (!lcu) {
    return new Response(JSON.stringify({ error: "LCU no encontrado" }), { status: 404 });
  }

  const auth = btoa(`riot:${lcu.token}`);

  try {
    const response = await fetch(
      `https://127.0.0.1:${lcu.port}/lol-champ-select/v1/session`,
      {
        method: 'GET',
        headers: { 
          'Authorization': `Basic ${auth}`, 
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    );

    // Si el endpoint devuelve 404, es que no estás en una fase de selección de campeones
    if (response.status === 404) {
      return new Response(JSON.stringify({ inDraft: false }), { status: 200 });
    }

    const data = await response.json();
    
    // Mapeo básico para que el frontend reciba lo que espera
    return new Response(JSON.stringify({ 
      inDraft: true, 
      myTeam: data.myTeam || [], 
      theirTeam: data.theirTeam || [],
      timer: data.timer || {}
    }), { status: 200 });
    
  } catch (e) {
    console.error("Error detallado:", e); // Esto saldrá en tu terminal de VS Code
    return new Response(JSON.stringify({ error: "Error de conexión", details: e.message }), { status: 500 });
  }
};