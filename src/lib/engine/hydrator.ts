import assets from '../data/assets-map.json' with { type: 'json' };

// URLs base para las imágenes
const CD_BASE = "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/";
const DD_BASE = "https://ddragon.leagueoflegends.com/cdn/14.22.1/img/item/";

export function hydrateAsset(type: 'runes' | 'items' | 'shards' | 'summoners', id: number | string) {
    
    const idStr = id.toString();

    if (type === 'items') {
        const item = assets.items[idStr as keyof typeof assets.items];
        let iconUrl = `${DD_BASE}${id}.png`;
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
        // Buscamos en ambas secciones porque a veces se mezclan en la API
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

    if (type === 'summoners'){
        const spell = assets.summoners[idStr as keyof typeof assets.summoners];
        return {
            id: Number(id),
            name: spell?.name || "Hechizo",
            icon: `https://ddragon.leagueoflegends.com/cdn/16.9.1/img/spell/${spell?.icon}`
        };
    } 

    return null;
}