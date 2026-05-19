import type { APIRoute } from 'astro';
import { syncMetaAndBuilds } from '../../lib/scripts/SyncMetaYBuilds';
import { SyncEstructuraLanes } from '../../lib/scripts/meta-map';

export const GET: APIRoute = async ({ url }) => {
    const type = url.searchParams.get('type');
    const version = url.searchParams.get('version') || '16.9';

    // Verificación de seguridad básica
    if (!type || !['short', 'long'].includes(type)) {
        return new Response(JSON.stringify({ error: "Tipo de ciclo inválido" }), { status: 400 });
    }

    try {
        // Ejecutamos de forma asíncrona pero respondemos al cliente 
        // para que la conexión no se pierda por timeout
        if (type === 'short') {
            syncMetaAndBuilds(version); 
            
        } else {
            syncLongCycle(version);
        }

        return new Response(JSON.stringify({ 
            message: `Sincronización ${type} iniciada para parche ${version}` 
        }), { status: 200 });
        
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
};