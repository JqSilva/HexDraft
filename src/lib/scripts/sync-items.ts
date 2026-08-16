// src/lib/scripts/sync-items.ts
import { db } from '../db/sqlite.js';
import fs from 'node:fs';
import path from 'node:path';
import { fetchRawItems } from '../sources/cdragon/cdragon-items.source.js';

export async function syncItemsFromCommunityDragon(): Promise<number> {
  console.log("Sincronizando items desde Community Dragon (ES)...");
  const ASSETS_MAP_PATH = './src/lib/data/assets-map.json';
  
  try {
    const items = await fetchRawItems();
    
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
    console.log(`Sincronizacion de items completada: ${count} items guardados en base de datos.`);

    // Actualizar assets-map.json
    try {
      let currentAssets: any = { runes: {}, items: {}, shards: {}, runeToStyle: {}, summoners: {} };
      if (fs.existsSync(ASSETS_MAP_PATH)) {
        currentAssets = JSON.parse(fs.readFileSync(ASSETS_MAP_PATH, 'utf-8'));
      }

      const itemsMap: Record<string, any> = {};
      for (const item of Object.values(items)) {
        if (!item.inStore && item.priceTotal === 0) continue;
        const id = String(item.id);
        // Normalizar la ruta del icono removiendo el prefijo /lol-game-data/assets/
        const icon = item.iconPath ? item.iconPath.replace(/^\/lol-game-data\/assets\/(v1\/)?/i, '') : '';
        
        itemsMap[id] = {
          name: item.name,
          description: item.description || '',
          gold: item.priceTotal,
          icon: icon
        };
      }

      currentAssets.items = itemsMap;
      fs.writeFileSync(ASSETS_MAP_PATH, JSON.stringify(currentAssets, null, 2));
      console.log(`assets-map.json actualizado con ${Object.keys(itemsMap).length} items.`);
    } catch (e: any) {
      console.error("Error al actualizar assets-map.json:", e);
    }

    return count;
  } catch (error) {
    try {
      db.exec('ROLLBACK;');
    } catch (_) {
      // Ignorado si falla rollback
    }
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
