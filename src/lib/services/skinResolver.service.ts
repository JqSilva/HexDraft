// src/lib/services/skinResolver.service.ts
import { getLockfileData } from './lcu.service.js';

interface ChampionSkinData {
  skins: Array<{
    id: number;
    name: string;
    isBase?: boolean;
    loadScreenPath?: string;
    chromas?: Array<{ id: number; name: string }>;
  }>;
}

const skinCache: Record<number, { timestamp: number; data: Record<number, number> }> = {};

/**
 * Resuelve el número real de skin para DDragon a partir de un SkinId o ChromaId.
 * Por ejemplo:
 * - 238038 (Empyrean Zed) -> 38
 * - 238046 (Croma de Empyrean Zed) -> 38 (Skin padre)
 */
export async function resolveSkinNumber(championId: number, rawSkinOrChromaId: number): Promise<number> {
  if (!championId || !rawSkinOrChromaId || rawSkinOrChromaId === 0) return 0;

  // 1. Si ya está en memoria caché
  if (skinCache[championId] && skinCache[championId].data[rawSkinOrChromaId] !== undefined) {
    return skinCache[championId].data[rawSkinOrChromaId];
  }

  // 2. Intentar consultar LCU local (0ms de latencia) o CommunityDragon
  try {
    const lcu = getLockfileData();
    let champJson: ChampionSkinData | null = null;

    if (lcu) {
      try {
        const auth = btoa(`riot:${lcu.token}`);
        const res = await fetch(`https://127.0.0.1:${lcu.port}/lol-game-data/assets/v1/champions/${championId}.json`, {
          headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' }
        });
        if (res.ok) {
          champJson = await res.json();
        }
      } catch (_e) {
        // Fallback a CommunityDragon
      }
    }

    if (!champJson) {
      const cdragRes = await fetch(`https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champions/${championId}.json`);
      if (cdragRes.ok) {
        champJson = await cdragRes.json();
      }
    }

    if (champJson && Array.isArray(champJson.skins)) {
      const mapping: Record<number, number> = {};

      for (const s of champJson.skins) {
        const baseSkinNum = s.id % 1000;
        mapping[s.id] = baseSkinNum;

        if (Array.isArray(s.chromas)) {
          for (const c of s.chromas) {
            mapping[c.id] = baseSkinNum;
          }
        }
      }

      skinCache[championId] = {
        timestamp: Date.now(),
        data: mapping
      };

      if (mapping[rawSkinOrChromaId] !== undefined) {
        return mapping[rawSkinOrChromaId];
      }
    }
  } catch (e) {
    console.warn(`[SkinResolver] Error resolviendo skin/croma ${rawSkinOrChromaId} para campeón ${championId}:`, e);
  }

  // Fallback por defecto si no se encontró en el árbol de cromas
  return rawSkinOrChromaId % 1000;
}
