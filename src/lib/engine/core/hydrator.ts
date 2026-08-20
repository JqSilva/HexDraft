// src/lib/engine/core/hydrator.ts
import assets from '../../data/assets-map.json' with { type: 'json' };
import { getDDragonUrl } from '../../gameVersion.js';

const CD_BASE = "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/";

/**
 * Hidrata un asset (objeto, runa, fragmento o hechizo de invocador) convirtiendo su ID
 * en un objeto estructurado con nombre, descripción e URL de icono optimizada.
 */
export function hydrateAsset(type: 'runes' | 'items' | 'shards' | 'summoners', id: number | string) {
  if (id === undefined || id === null) return null;
  const idStr = id.toString();

  if (type === 'items') {
    const item = (assets.items as Record<string, any>)[idStr];
    let iconUrl = getDDragonUrl('item', `${id}.png`);
    if (item?.icon && (item.icon.includes('/') || item.icon.includes('_'))) {
      let path = item.icon.toLowerCase();
      if (path.startsWith('/')) path = path.slice(1);
      if (!path.startsWith('assets/')) path = 'assets/items/icons2d/' + path;
      iconUrl = `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/${path}`;
    }
    return {
      id: Number(id),
      name: item?.name || "Objeto Desconocido",
      description: item?.description || "",
      icon: iconUrl,
      gold: item?.gold || 0
    };
  }

  if (type === 'runes' || type === 'shards') {
    const data = (assets.runes as Record<string, any>)[idStr] || 
                 (assets.shards as Record<string, any>)[idStr];
    
    let path = data ? data.icon.toLowerCase() : "";
    if (path && !path.startsWith("perk-images/")) {
      path = "perk-images/" + path;
    }
    
    return {
      id: Number(id),
      name: data?.name || "Runa",
      icon: path ? `${CD_BASE}${path}` : ""
    };
  }

  if (type === 'summoners') {
    const spell = (assets.summoners as Record<string, any>)[idStr];
    const iconName = spell?.icon || 'SummonerFlash.png';
    return {
      id: Number(id),
      name: spell?.name || "Hechizo",
      icon: getDDragonUrl('spell', iconName)
    };
  } 

  return null;
}
