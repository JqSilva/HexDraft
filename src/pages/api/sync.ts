import type { APIRoute } from 'astro';
import { syncMetaAndBuilds } from '../../lib/scripts/SyncMetaYBuilds';
import { SyncEstructuraLanes } from '../../lib/scripts/meta-map';
import { initializeEngineData } from '../../lib/engine/dataProvider';


let isGlobalSyncing = false;
let shouldAbort = false;
let syncLogs: string[] = [];

function writeLog(msg: string) {
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    const formatted = `[${time}] ${msg}`;
    syncLogs.push(formatted);
    if (syncLogs.length > 50) syncLogs.shift();
    console.log(formatted);
}

export const GET: APIRoute = async ({ url }) => {
    const type = url.searchParams.get('type');
    const version = url.searchParams.get('version') || '16.9';

    if (type === 'status') {
        return new Response(JSON.stringify({ 
            syncing: isGlobalSyncing,
            logs: syncLogs
        }), { status: 200 });
    }

    if (type === 'cancel') {
        shouldAbort = true;
        writeLog("🛑 SEÑAL DE CANCELACIÓN RECIBIDA. Deteniendo motores...");
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
        syncLogs = [];
        writeLog(`Motor de sincronización iniciado (Tipo: ${type}, Versión: ${version}).`);
        
        if (type === 'meta_builds') {
            syncMetaAndBuilds(version, () => shouldAbort, writeLog)
            .then(() => {
                try {
                    initializeEngineData();
                    writeLog("✅ Sincronización y recarga del motor en memoria completadas.");
                } catch (e: any) {
                    writeLog(`⚠️ Sincronización completada, pero falló la recarga en memoria: ${e.message || e}`);
                }
            })
            .catch((err) => {
                writeLog(`❌ Sincronización falló: ${err.message || err}`);
            })
            .finally(() => {
                isGlobalSyncing = false;
            });
        } else if (type === 'SyncEstructuraLanes') {
            SyncEstructuraLanes(version, () => shouldAbort, writeLog)
            .then(() => {
                try {
                    initializeEngineData();
                    writeLog("✅ Mapeo de carriles y recarga del motor en memoria completadas.");
                } catch (e: any) {
                    writeLog(`⚠️ Mapeo completado, pero falló la recarga en memoria: ${e.message || e}`);
                }
            })
            .catch((err) => {
                writeLog(`❌ Mapeo falló: ${err.message || err}`);
            })
            .finally(() => {
                isGlobalSyncing = false;
            });
        }
        return new Response(JSON.stringify({ message: "Iniciado" }), { status: 200 });
        
    } catch (e: any) {
        isGlobalSyncing = false;
        return new Response(JSON.stringify({ error: e.message || "Error" }), { status: 500 });
    }
};