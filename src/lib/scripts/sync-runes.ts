// src/lib/scripts/sync-runes.ts
// Sincroniza runas, shards y runeToStyle desde Community Dragon
import fs from 'fs';
import path from 'path';

const PERKS_URL_ES = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/es_ar/v1/perks.json';
const PERKSTYLES_URL = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perkstyles.json';
const ASSETS_MAP_PATH = './src/lib/data/assets-map.json';

interface CdragPerk {
  id: number;
  name: string;
  iconPath: string;
}

interface PerkStyle {
  id: number;
  name: string;
  iconPath: string;
  slots: { type: string; perks: number[] }[];
}

interface PerkStylesResponse {
  styles: PerkStyle[];
}

/**
 * Normaliza un iconPath de CDragon a una ruta relativa limpia para usar en el frontend.
 * Ej: "/lol-game-data/assets/v1/perk-images/Styles/Precision/Conqueror/Conqueror.png"
 *   → "perk-images/Styles/Precision/Conqueror/Conqueror.png"
 */
function normalizeIconPath(iconPath: string): string {
  // Quitar el prefijo "/lol-game-data/assets/v1/"
  return iconPath.replace(/^\/lol-game-data\/assets\/v1\//, '');
}

/**
 * Determina si un perk es un stat shard basándose en su ID (5xxx)
 */
function isShard(id: number): boolean {
  return id >= 5000 && id < 6000;
}

/**
 * Determina si un perk es un estilo (árbol principal) basándose en su ID
 * Los estilos principales son: 8000, 8100, 8200, 8300, 8400
 */
function isStyle(id: number): boolean {
  return [8000, 8100, 8200, 8300, 8400].includes(id);
}

export async function syncRunesFromCommunityDragon(): Promise<{ runesCount: number; shardsCount: number; runeToStyleCount: number }> {
  console.log("Sincronizando runas desde Community Dragon...");

  // 1. Descargar perks (en español) y perkstyles
  const [perksRes, stylesRes] = await Promise.all([
    fetch(PERKS_URL_ES),
    fetch(PERKSTYLES_URL)
  ]);

  if (!perksRes.ok) throw new Error(`Fallo al descargar perks: ${perksRes.statusText}`);
  if (!stylesRes.ok) throw new Error(`Fallo al descargar perkstyles: ${stylesRes.statusText}`);

  const perks: CdragPerk[] = await perksRes.json();
  const perkStyles: PerkStylesResponse = await stylesRes.json();

  // 2. Construir mapas
  const runesMap: Record<string, any> = {};
  const shardsMap: Record<string, any> = {};
  const runeToStyleMap: Record<string, number> = {};

  // 2a. Construir runeToStyle a partir de perkstyles.json (fuente autoritativa)
  for (const style of perkStyles.styles) {
    for (const slot of style.slots) {
      // Solo mapear slots de runas reales (no statmods)
      if (slot.type === 'kStatMod') continue;
      for (const perkId of slot.perks) {
        runeToStyleMap[String(perkId)] = style.id;
      }
    }
    // También incluir los subStyleBonus perks
    // No los mapeamos porque son perks internos (set bonuses) que se mapean a RunesIcon.png
  }

  // 2b. Procesar cada perk individual
  let runesCount = 0;
  let shardsCount = 0;

  for (const perk of perks) {
    const id = String(perk.id);
    const icon = normalizeIconPath(perk.iconPath);

    if (isShard(perk.id)) {
      // Es un shard (stat mod)
      shardsMap[id] = {
        name: perk.name,
        icon: icon
      };
      shardsCount++;
    } else {
      // Es una runa o un estilo
      const entry: any = {
        name: perk.name,
        icon: icon
      };
      if (isStyle(perk.id)) {
        entry.isStyle = true;
      }
      runesMap[id] = entry;
      runesCount++;
    }
  }

  // 3. Leer assets-map.json actual y actualizar solo las secciones de runas
  let currentAssets: any = { runes: {}, items: {}, shards: {}, runeToStyle: {}, summoners: {} };
  if (fs.existsSync(ASSETS_MAP_PATH)) {
    currentAssets = JSON.parse(fs.readFileSync(ASSETS_MAP_PATH, 'utf-8'));
  }

  currentAssets.runes = runesMap;
  currentAssets.shards = shardsMap;
  currentAssets.runeToStyle = runeToStyleMap;

  // 4. Escribir de vuelta
  fs.writeFileSync(ASSETS_MAP_PATH, JSON.stringify(currentAssets, null, 2));

  console.log(`Runas sincronizadas: ${runesCount} runas, ${shardsCount} shards, ${Object.keys(runeToStyleMap).length} mappings runeToStyle`);

  return {
    runesCount,
    shardsCount,
    runeToStyleCount: Object.keys(runeToStyleMap).length
  };
}

// Ejecutar si se corre directamente
if (process.argv[1]?.endsWith('sync-runes.ts') || process.argv[1]?.endsWith('sync-runes.js')) {
  syncRunesFromCommunityDragon()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error("Error:", e);
      process.exit(1);
    });
}
