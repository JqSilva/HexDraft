import type { APIRoute } from 'astro';
import { getLockfileData } from '../../lib/services/lcu.service.js';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

export const GET: APIRoute = async () => {
  const lcu = getLockfileData();
  if (!lcu) return new Response(JSON.stringify({ phase: 'Offline' }), { status: 200 });

  const auth = btoa(`riot:${lcu.token}`);

  try {
    const response = await fetch(`https://127.0.0.1:${lcu.port}/lol-gameflow/v1/session`, {
      headers: { 'Authorization': `Basic ${auth}` }
    });
    
    if (!response.ok) return new Response(JSON.stringify({ phase: 'None' }), { status: 200 });
    
    const data = await response.json();
    return new Response(JSON.stringify({ phase: data.phase }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ phase: 'None' }), { status: 200 });
  }
};