// src/lib/sources/cdragon/cdragon-champion-data.source.ts

const CDRAGON_CHAMPIONS_URL = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/es_ar/v1/champion-summary.json';

export interface RawCdragChampionSummary {
  id: number;
  name: string;
  alias: string;
  squarePortraitPath: string;
  roles: string[];
}

export async function fetchRawChampionData(): Promise<RawCdragChampionSummary[]> {
  const response = await fetch(CDRAGON_CHAMPIONS_URL);
  if (!response.ok) {
    throw new Error(`Fallo al descargar resumen de campeones de Community Dragon: ${response.statusText}`);
  }
  return response.json() as Promise<RawCdragChampionSummary[]>;
}
