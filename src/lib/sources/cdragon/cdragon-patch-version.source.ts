// src/lib/sources/cdragon/cdragon-patch-version.source.ts

const DDRAGON_VERSIONS_URL = 'https://ddragon.leagueoflegends.com/api/versions.json';

export async function fetchLatestPatchVersion(): Promise<string> {
  const response = await fetch(DDRAGON_VERSIONS_URL);
  if (!response.ok) {
    throw new Error(`Fallo al consultar versiones de Riot DDragon: ${response.statusText}`);
  }
  const versions = await response.json() as string[];
  if (!Array.isArray(versions) || versions.length === 0) {
    throw new Error("No se encontraron versiones en la respuesta de DDragon.");
  }
  return versions[0];
}
