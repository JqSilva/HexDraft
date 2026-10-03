import type { APIRoute } from 'astro';
import { getCurrentProbuildstatsTopPicks, refreshProbuildstatsTopPicks } from '../../../lib/meta/probuildstatsTopPicks.repo.js';

export const GET: APIRoute = async ({ url }) => {
  let snapshot = getCurrentProbuildstatsTopPicks();
  let refreshError: string | undefined;

  if (url.searchParams.get('refresh') === '1') {
    try {
      snapshot = (await refreshProbuildstatsTopPicks()).snapshot;
    } catch (error) {
      refreshError = error instanceof Error ? error.message : String(error);
      console.warn('[Probuildstats] No se pudo refrescar el ranking; se conserva el último snapshot válido.', refreshError);
    }
  }

  return new Response(JSON.stringify({ ...snapshot, refreshError }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, max-age=0',
      ETag: `"${snapshot.version}"`
    }
  });
};
