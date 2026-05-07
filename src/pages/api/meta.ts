// src/pages/api/meta.ts
import { getStoredMeta } from '../../lib/metaManager';

export async function GET() {
  const meta = getStoredMeta();
  
  if (!meta) {
    // Si esto ocurre, revisa la terminal de VS Code para ver errores de metaManager
    return new Response(JSON.stringify(null), { status: 500 });
  }

  return new Response(JSON.stringify(meta), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}