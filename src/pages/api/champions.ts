// src/pages/api/champions.ts
import type { APIRoute } from 'astro';
import { championsRepo } from '../../lib/db/champions.repo';
import fs from 'fs';
import path from 'path';

const normalizeKey = (name: string) => name.toLowerCase()
  .replace(/\s+&\s+/g, ' y ')
  .replace(/\s+and\s+/g, ' y ')
  .replace(/[^a-z0-9]/g, "");

export const GET: APIRoute = async ({ url }) => {
  try {
    const idParam = url.searchParams.get('id');
    const nameParam = url.searchParams.get('name');

    if (idParam || nameParam) {
      let champId: number | null = null;
      if (idParam) {
        champId = parseInt(idParam);
      } else if (nameParam) {
        const nameIdMap = championsRepo.getChampionIdNameMap();
        const normName = nameParam.toLowerCase().replace(/[^a-z0-9]/g, "");
        champId = nameIdMap[normName] || null;
      }

      if (champId !== null) {
        const champData = championsRepo.getSingleEnrichedChampion(champId);
        if (champData) {
          return new Response(JSON.stringify(champData), {
            status: 200,
            headers: { 
              'Content-Type': 'application/json',
              'Cache-Control': 'no-store, max-age=0'
            }
          });
        }
      }
      return new Response(JSON.stringify({ error: "Campeón no encontrado" }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Retornar lista completa de campeones altamente optimizada (agrupación en memoria en <20ms)
    const enrichedList = championsRepo.getAllEnrichedChampions();

    return new Response(JSON.stringify(enrichedList), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
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
