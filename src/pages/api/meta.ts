// src/pages/api/meta.ts
import { getStoredMeta } from '../../lib/metaManager';
import { getStoredSpikes } from '../../lib/metaManager';
import { configRepo } from '../../lib/db/config.repo.js';

export async function GET() {
  const meta = getStoredMeta(); // Datos de OP.GG
  const spikes = getStoredSpikes(); // Datos de spikes
  const lastUpdated = configRepo.getConfig('last_meta_cache_sync') || '-';

  // Enviamos todo en un solo paquete
  return new Response(JSON.stringify({ meta, spikes, lastUpdated }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}