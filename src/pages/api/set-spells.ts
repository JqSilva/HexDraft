// src/pages/api/set-spells.ts
import type { APIRoute } from 'astro';
import { getLockfileData } from '../../lib/services/lcu.service.js';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

export const POST: APIRoute = async ({ request }) => {
    const lcu = getLockfileData();
    if (!lcu) return new Response(JSON.stringify({ error: "LCU no detectado" }), { status: 404 });

    const auth = btoa(`riot:${lcu.token}`);
    const baseUrl = `https://127.0.0.1:${lcu.port}`;

    try {
        const body = await request.json();
        const { spell1Id, spell2Id } = body;

        // El endpoint de LCU para cambiar hechizos requiere un PATCH a my-selection
        const response = await fetch(`${baseUrl}/lol-champ-select/v1/session/my-selection`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                spell1Id: Number(spell1Id),
                spell2Id: Number(spell2Id)
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error LCU: ${errorText}`);
        }

        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
};