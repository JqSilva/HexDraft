// src/pages/api/champions.ts
import type { APIRoute } from 'astro';
import { championsRepo } from '../../lib/db/champions.repo';

export const GET: APIRoute = async () => {
  try {
    const list = championsRepo.getAllEnrichedChampions();
    return new Response(JSON.stringify(list), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        // Opcional: Desactivar caché local para asegurar que la UI vea datos frescos al instante tras resincronizar
        'Cache-Control': 'no-store, max-age=0'
      }
    });
  } catch (error: any) {
    console.error("Error en API /api/champions:", error);
    return new Response(JSON.stringify({ error: "Error al consultar base de datos", details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
