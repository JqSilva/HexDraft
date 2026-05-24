import type { APIRoute } from 'astro';
import { syncMetaAndBuilds } from '../../lib/scripts/SyncMetaYBuilds';
import { SyncEstructuraLanes } from '../../lib/scripts/meta-map';


let isGlobalSyncing = false;
let shouldAbort = false;

export const GET: APIRoute = async ({ url }) => {
    const type = url.searchParams.get('type');
    const version = url.searchParams.get('version') || '16.9';

    if (type === 'status') {
        return new Response(JSON.stringify({ syncing: isGlobalSyncing }), { status: 200 });
    }

    if (type === 'cancel') {
        shouldAbort = true;
        return new Response(JSON.stringify({ message: "Señal de cancelación enviada" }), { status: 200 });
    }

    if (isGlobalSyncing) {
        return new Response(JSON.stringify({ error: "Ya hay una sincronización en curso" }), { status: 409 });
    }

    const validTypes = ['meta_builds', 'SyncEstructuraLanes'];
    if (!type || !validTypes.includes(type)) {
        return new Response(JSON.stringify({ 
            error: `Tipo inválido. Recibido: ${type}. Esperado: ${validTypes.join(' o ')}` 
        }), { status: 400 });
    }

    try {
        isGlobalSyncing = true;
        shouldAbort = false;
        if (type === 'meta_builds') {
            syncMetaAndBuilds(version, () => shouldAbort)
            .then(() => console.log("✅ Script finalizado correctamente"))
            .catch((err) => console.error("❌ Script falló:", err))
            .finally(() => {
                isGlobalSyncing = false; // Aquí el polling de React detectará el cambio
            });
        }else if (type === 'SyncEstructuraLanes') {
            SyncEstructuraLanes(version, () => shouldAbort)
            .then(() => console.log("✅ Script finalizado correctamente"))
            .catch((err) => console.error("❌ Script falló:", err))
            .finally(() => {
                isGlobalSyncing = false; // Aquí el polling de React detectará el cambio
            });
        }
        return new Response(JSON.stringify({ message: "Iniciado" }), { status: 200 });
        
    } catch (e) {
        isGlobalSyncing = false;
        return new Response(JSON.stringify({ error: "Error" }), { status: 500 });
    }
};