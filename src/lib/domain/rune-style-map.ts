// src/lib/domain/rune-style-map.ts
import assetsMap from '../data/assets-map.json' with { type: 'json' };


export function getStyleOfRune(runeId: number): number {
  return (assetsMap.runeToStyle as Record<string | number, number>)[runeId] || 0;
}
