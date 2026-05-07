// src/pages/api/champ-select.ts
import type { APIRoute } from 'astro';
import { getLockfileData } from '../../lib/lcu';

export const GET: APIRoute = async () => {
  const lcu = getLockfileData();
  if (!lcu) return new Response(JSON.stringify({ error: "LCU no encontrado" }), { status: 404 });

  const auth = btoa(`riot:${lcu.token}`);

  try {
    const response = await fetch(
      `https://127.0.0.1:${lcu.port}/lol-champ-select/v1/session`,
      {
        headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' }
      }
    );

    if (response.status === 404) {
      return new Response(JSON.stringify({ inDraft: false }), { status: 200 });
    }

    const data = await response.json();
    return new Response(JSON.stringify({ inDraft: true, ...data }), { status: 200 });
    
  } catch (e) {
    return new Response(JSON.stringify({ error: "Error de conexión" }), { status: 500 });
  }
};