// src/lib/scripts/sync-items.ts
import { db } from '../db/sqlite.js';

export async function syncItemsFromCommunityDragon(): Promise<number> {
  console.log("Sincronizando items desde Community Dragon...");
  const url = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/items.json';
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Fallo al descargar items: ${response.statusText}`);
    }
    const items = await response.json() as Record<string, any>;
    
    // Iniciar transacción
    db.exec('BEGIN TRANSACTION;');
    
    const insertStmt = db.prepare(`
      INSERT INTO items (id, name, gold, epicness, categories, icon_path)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,
        gold=excluded.gold,
        epicness=excluded.epicness,
        categories=excluded.categories,
        icon_path=excluded.icon_path
    `);
    
    let count = 0;
    for (const item of Object.values(items)) {
      // Filtrar items que no estén en la tienda o no tengan precio
      if (!item.inStore && item.priceTotal === 0) continue;
      
      let epicness = 'basic';
      if (item.priceTotal < 500) {
        epicness = 'starter';
      } else if (item.from && item.from.length > 0) {
        if (item.to && item.to.length > 0) {
          epicness = 'epic';
        } else {
          epicness = 'legendary';
        }
      }
      
      const categoriesJson = JSON.stringify(item.categories || []);
      
      insertStmt.run(
        item.id,
        item.name,
        item.priceTotal,
        epicness,
        categoriesJson,
        item.iconPath
      );
      count++;
    }
    
    db.exec('COMMIT;');
    console.log(`Sincronizacion de items completada: ${count} items guardados.`);
    return count;
  } catch (error) {
    try {
      db.exec('ROLLBACK;');
    } catch (_) {}
    console.error("Error al sincronizar items:", error);
    throw error;
  }
}

// Ejecutar si se corre directamente
if (process.argv[1]?.endsWith('sync-items.ts') || process.argv[1]?.endsWith('sync-items.js')) {
  syncItemsFromCommunityDragon()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
