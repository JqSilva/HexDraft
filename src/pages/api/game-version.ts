// src/pages/api/game-version.ts
import type { APIRoute } from 'astro';
import { fetchLatestGameVersion, getGameVersion } from '../../lib/gameVersion.js';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

export const GET: APIRoute = async () => {
  const version = await fetchLatestGameVersion();
  const parts = version.split('.');
  const shortVersion = `${parts[0]}.${parts[1]}`;

  return new Response(
    JSON.stringify({
      full: version,
      short: shortVersion,
      source: 'dynamic-version-service'
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};