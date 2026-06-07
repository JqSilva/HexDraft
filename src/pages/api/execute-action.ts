import type { APIRoute } from 'astro';
import { getLockfileData } from '../../lib/services/lcu.service.js';

export const POST: APIRoute = async ({ request }) => {
    const lcu = getLockfileData();
    const auth = btoa(`riot:${lcu.token}`);
    const { actionId, championId, completed } = await request.json();

    const response = await fetch(
      `https://127.0.0.1:${lcu.port}/lol-champ-select/v1/session/actions/${actionId}`,
      {
        method: 'PATCH',
        headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ championId, completed }) // completed: true hace el 'Lock-in'
      }
    );

    return new Response(JSON.stringify({ success: response.ok }));
};