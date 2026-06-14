// src/pages/api/personal-stats.ts
import type { APIRoute } from 'astro';
import { db } from '../../lib/db/sqlite.js';

export const GET: APIRoute = async () => {
  try {
    const statsQuery = db.prepare(`
      SELECT 
        champion_id as championId,
        COUNT(*) as gamesPlayed,
        CAST(SUM(win) AS REAL) * 100.0 / COUNT(*) as winRate
      FROM player_history
      GROUP BY champion_id
    `);
    const stats = statsQuery.all() as any[];

    return new Response(JSON.stringify(stats), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, max-age=0'
      }
    });
  } catch (error: any) {
    console.error("Error en API /api/personal-stats:", error);
    return new Response(JSON.stringify({ error: "Error al obtener estadísticas personales", details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
