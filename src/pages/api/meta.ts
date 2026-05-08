// src/pages/api/meta.ts
import { getStoredMeta } from '../../lib/metaManager';
import { getStoredSpikes } from '../../lib/metaManager';
import fs from 'fs';
import path from 'path';

export async function GET() {
  const meta = getStoredMeta(); // Datos de OP.GG
  const spikes = getStoredSpikes(); // Datos de spikes
  

  // Enviamos todo en un solo paquete
  return new Response(JSON.stringify({ meta, spikes }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}