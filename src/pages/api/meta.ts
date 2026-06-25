// src/pages/api/meta.ts
import { getStoredMeta } from '../../lib/metaManager';
import { configRepo } from '../../lib/db/config.repo.js';

export async function GET() {
  const meta = getStoredMeta(); // Datos de OP.GG
  const lastUpdated = configRepo.getConfig('last_meta_cache_sync') || '-';

  // Enviamos todo en un solo paquete, con spikes como null
  return new Response(JSON.stringify({ meta, spikes: null, lastUpdated }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}