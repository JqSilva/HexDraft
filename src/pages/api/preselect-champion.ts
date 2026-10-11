// src/pages/api/preselect-champion.ts
import type { APIRoute } from 'astro';
import { getLockfileData } from '../../lib/services/lcu.service.js';

// Permitir certificados autofirmados de Riot LCU en conexiones locales HTTPS
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

export interface PreselectRequestBody {
  actionId?: number;
  championId: number;
  isBan?: boolean;
  type?: 'action' | 'intent';
}

/**
 * Endpoint dedicado a la preselección provisional manual de campeones (hover / pick intent).
 * 
 * Reglas de seguridad:
 * 1. NUNCA confirma ni bloquea el campeón (completed siempre es false para acciones de turno).
 * 2. Durante turnos activos de pick o ban: PATCH a /lol-champ-select/v1/session/actions/{actionId} con completed: false.
 * 3. Fuera de turno o durante fase PLANNING: PATCH a /lol-champ-select/v1/session/my-selection con championPickIntent.
 * 4. NUNCA utiliza championPickIntent para bans.
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const lcu = getLockfileData();
    if (!lcu) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Cliente de League of Legends no detectado o LCU no disponible.' 
      }), { 
        status: 503, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    const body: PreselectRequestBody = await request.json();
    const { actionId, championId, isBan, type } = body;

    const champIdNum = Number(championId);
    if (!champIdNum || isNaN(champIdNum) || champIdNum <= 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Identificador de campeón inválido.' 
      }), { 
        status: 400, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    const auth = btoa(`riot:${lcu.token}`);
    const baseUrl = `https://127.0.0.1:${lcu.port}`;

    // Caso 1: Turno activo de pick o ban con actionId identificado
    if (actionId && Number(actionId) > 0) {
      // IMPORTANTE: completed siempre se fuerza a false para garantizar preselección provisional
      const response = await fetch(`${baseUrl}/lol-champ-select/v1/session/actions/${actionId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          championId: champIdNum,
          completed: false
        })
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.warn(`[preselect-champion] LCU rechazó acción ${actionId} (HTTP ${response.status}): ${errorText}`);
        return new Response(JSON.stringify({ 
          success: false, 
          error: `Error de LCU al preseleccionar (${response.status}): ${errorText}` 
        }), { 
          status: response.status, 
          headers: { 'Content-Type': 'application/json' } 
        });
      }

      return new Response(JSON.stringify({ 
        success: true, 
        actionType: 'action',
        actionId: Number(actionId),
        championId: champIdNum,
        isBan: Boolean(isBan)
      }), { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    // Caso 2: Intención de selección (Pick Intent) en fase de planificación o fuera de turno activo
    // REGLA ESTRICTA: NUNCA usar championPickIntent para bans
    if (isBan) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'No es posible preseleccionar un bloqueo fuera de tu turno activo de baneo.' 
      }), { 
        status: 400, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    // Enviar PATCH a /lol-champ-select/v1/session/my-selection con championPickIntent
    const response = await fetch(`${baseUrl}/lol-champ-select/v1/session/my-selection`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        championPickIntent: champIdNum
      })
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.warn(`[preselect-champion] LCU rechazó intención de pick (HTTP ${response.status}): ${errorText}`);
      return new Response(JSON.stringify({ 
        success: false, 
        error: `Error de LCU al establecer intención de pick (${response.status}): ${errorText}` 
      }), { 
        status: response.status, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      actionType: 'intent',
      championId: champIdNum,
      isBan: false
    }), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' } 
    });

  } catch (error: any) {
    console.error('[preselect-champion] Excepción no controlada:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error?.message || 'Error interno del servidor al procesar la preselección.' 
    }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
};
