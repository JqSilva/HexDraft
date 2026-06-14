// src/pages/api/items.ts
import type { APIRoute } from 'astro';
import { db } from '../../lib/db/sqlite.js';

export const GET: APIRoute = async () => {
  try {
    const query = db.prepare('SELECT * FROM items');
    const rows = query.all() as any[];
    
    const itemsMap: Record<number, { id: number; name: string; gold: number; epicness: string; categories: string[]; iconPath: string }> = {};
    
    rows.forEach(r => {
      itemsMap[r.id] = {
        id: r.id,
        name: r.name,
        gold: r.gold,
        epicness: r.epicness,
        categories: JSON.parse(r.categories || '[]'),
        iconPath: r.icon_path
      };
    });

    return new Response(JSON.stringify(itemsMap), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, max-age=0'
      }
    });
  } catch (error: any) {
    console.error("Error en API /api/items:", error);
    return new Response(JSON.stringify({ error: "Error al consultar base de datos", details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
