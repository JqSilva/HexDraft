// src/lib/domain/rune-style-map.ts
import assetsMap from '../data/assets-map.json' with { type: 'json' };

// TODO: Este mapeo debería generarse automáticamente desde Community Dragon en vez de mantenerse en assets-map.json a mano.
export function getStyleOfRune(runeId: number): number {
  return (assetsMap.runeToStyle as Record<string | number, number>)[runeId] || 0;
}
