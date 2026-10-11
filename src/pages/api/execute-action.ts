import type { APIRoute } from 'astro';
import { getLockfileData } from '../../lib/services/lcu.service.js';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

let lastExecutedChampionId: number | null = null;

export function getLastExecutedChampionId() {
    return lastExecutedChampionId;
}

export function resetLastExecutedChampionId() {
    lastExecutedChampionId = null;
}

export const POST: APIRoute = async ({ request }) => {
    try {
        const lcu = getLockfileData();
        if (!lcu) {
            return new Response(JSON.stringify({ success: false, error: 'LCU no disponible' }), { status: 503 });
        }
        const auth = btoa(`riot:${lcu.token}`);
        const baseUrl = `https://127.0.0.1:${lcu.port}`;
        const body = await request.json();
        const { actionId, championId, completed, championPickIntent } = body;

        // Solo actualizar el registro definitivo si la acción se completó/bloqueó efectivamente
        if (completed === true && championId) {
            lastExecutedChampionId = Number(championId);
        }

        // Caso con actionId explícito (AutoPick, AutoBan o acción directa)
        if (actionId) {
            const response = await fetch(
              `${baseUrl}/lol-champ-select/v1/session/actions/${actionId}`,
              {
                method: 'PATCH',
                headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ championId: Number(championId), completed: Boolean(completed) })
              }
            );

            return new Response(JSON.stringify({ success: response.ok }));
        }

        // Caso alternativo con championPickIntent (solo para picks)
        if (championPickIntent) {
            const response = await fetch(
              `${baseUrl}/lol-champ-select/v1/session/my-selection`,
              {
                method: 'PATCH',
                headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ championPickIntent: Number(championPickIntent) })
              }
            );

            return new Response(JSON.stringify({ success: response.ok }));
        }

        return new Response(JSON.stringify({ success: false, error: 'Parámetros insuficientes' }), { status: 400 });
    } catch (e: any) {
        return new Response(JSON.stringify({ success: false, error: e?.message || 'Error en acción LCU' }), { status: 500 });
    }
};