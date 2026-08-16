// src/lib/sources/cdragon/cdragon-runes.source.ts

const PERKS_URL_ES = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/es_ar/v1/perks.json';
const PERKSTYLES_URL = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perkstyles.json';

export interface RawCdragPerk {
  id: number;
  name: string;
  iconPath: string;
}

export interface RawPerkStyle {
  id: number;
  name: string;
  iconPath: string;
  slots: { type: string; perks: number[] }[];
}

export interface RawPerkStylesResponse {
  styles: RawPerkStyle[];
}

export async function fetchRawPerks(): Promise<{ perks: RawCdragPerk[]; styles: RawPerkStyle[] }> {
  const [perksRes, stylesRes] = await Promise.all([
    fetch(PERKS_URL_ES),
    fetch(PERKSTYLES_URL)
  ]);

  if (!perksRes.ok || !stylesRes.ok) {
    throw new Error(`Fallo al descargar runas de Community Dragon: ${perksRes.statusText || stylesRes.statusText}`);
  }

  const perks = await perksRes.json() as RawCdragPerk[];
  const stylesData = await stylesRes.json() as RawPerkStylesResponse;

  return {
    perks,
    styles: stylesData.styles || []
  };
}
