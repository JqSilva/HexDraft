import type { APIRoute } from 'astro';
import { getLockfileData } from '../../lib/services/lcu.service.js';
import { configRepo } from '../../lib/db/config.repo.js';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

export const GET: APIRoute = async () => {
  const lcu = getLockfileData();
  if (!lcu) {
    return new Response(
      JSON.stringify({ error: "LCU no encontrado", active: false }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const auth = btoa(`riot:${lcu.token}`);

  try {
    const response = await fetch(
      `https://127.0.0.1:${lcu.port}/lol-matchmaking/v1/ready-check`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.status === 404) {
      return new Response(
        JSON.stringify({ active: false, state: 'None', playerResponse: 'None' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: "Error consultando ReadyCheck", active: false }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const playerResponse = data.playerResponse || 'None';

    return new Response(
      JSON.stringify({ 
        ...data, 
        playerResponse,
        active: data.state === 'InProgress' 
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: "Error de conexión con LCU", details: e.message, active: false }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const POST: APIRoute = async () => {
  const lcu = getLockfileData();
  if (!lcu) {
    return new Response(
      JSON.stringify({ error: "LCU no encontrado" }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const auth = btoa(`riot:${lcu.token}`);

  try {
    const response = await fetch(
      `https://127.0.0.1:${lcu.port}/lol-matchmaking/v1/ready-check/accept`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      }
    );

    if (!response.ok && response.status !== 204) {
      return new Response(
        JSON.stringify({ error: "Fallo al aceptar la partida en LCU" }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: "Error al enviar la aceptación a LCU", details: e.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
