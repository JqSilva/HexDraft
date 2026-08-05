import assets from '../data/assets-map.json' with { type: 'json' };
import { getDDragonUrl } from '../gameVersion.js';

// URL base para assets de CommunityDragon
const CD_BASE = "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/";

/**
 * Hidrata un asset (objeto, runa, fragmento o hechizo de invocador) convirtiendo su ID
 * en un objeto estructurado con nombre, descripción e URL de icono optimizada (vía DDragon o CommunityDragon).
 * 
 * @param type - Tipo de recurso a hidratar ('items' | 'runes' | 'shards' | 'summoners').
 * @param id - Identificador numérico o en cadena del recurso.
 * @returns Objeto hidratado con datos del recurso o null si el tipo no es soportado.
 */
export function hydrateAsset(type: 'runes' | 'items' | 'shards' | 'summoners', id: number | string) {
    const idStr = id.toString();

    if (type === 'items') {
        const item = assets.items[idStr as keyof typeof assets.items];
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
        const data = assets.runes[idStr as keyof typeof assets.runes] || 
                     assets.shards[idStr as keyof typeof assets.shards];
        
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
        const spell = assets.summoners[idStr as keyof typeof assets.summoners];
        const iconName = spell?.icon || 'SummonerFlash.png';
        return {
            id: Number(id),
            name: spell?.name || "Hechizo",
            icon: getDDragonUrl('spell', iconName)
        };
    } 

    return null;
}