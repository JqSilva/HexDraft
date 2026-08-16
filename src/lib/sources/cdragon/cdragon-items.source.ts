// src/lib/sources/cdragon/cdragon-items.source.ts

const CD_ITEMS_URL = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/es_ar/v1/items.json';

export async function fetchRawItems(): Promise<Record<string, any>> {
  const response = await fetch(CD_ITEMS_URL);
  if (!response.ok) {
    throw new Error(`Fallo al descargar items de Community Dragon: ${response.statusText}`);
  }
  return response.json() as Promise<Record<string, any>>;
}
