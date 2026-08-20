// src/pages/api/sync.ts
import type { APIRoute } from 'astro';
import { syncMetaAndBuilds } from '../../lib/services/sync.service.js';
import { SyncEstructuraLanes } from '../../lib/scripts/meta-map.js';
import { startDockerAndFlareSolverr, stopDockerAndFlareSolverr } from '../../lib/services/docker.service.js';
import { initializeEngineData } from '../../lib/engine/core/dataProvider.js';
import { resolveCurrentPatchVersion } from '../../lib/domain/patch-version-resolver.js';

let isGlobalSyncing = false;
let shouldAbort = false;
let syncLogs: string[] = [];

let progressPercent = 0;
let progressPhase = 'idle'; // 'idle', 'starting', 'opgg', 'puppeteer', 'lanes', 'done', 'error', 'cancelled'

function writeLog(msg: string) {
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    const formatted = `[${time}] ${msg}`;
    syncLogs.push(formatted);
    if (syncLogs.length > 50) syncLogs.shift();
    console.log(formatted);
}

const updateProgress = (current: number, total: number, phase: 'opgg' | 'puppeteer' | 'lanes' | 'done') => {
    progressPhase = phase;
    if (phase === 'opgg') {
        if (total > 0) {
            progressPercent = Math.round((current / total) * 10); // 0% to 10%
        } else {
            progressPercent = 10;
        }
    } else if (phase === 'puppeteer') {
        if (total > 0) {
            progressPercent = 10 + Math.round((current / total) * 90); // 10% to 100%
        } else {
            progressPercent = 100;
        }
    } else if (phase === 'lanes') {
        if (total > 0) {
            progressPercent = Math.round((current / total) * 100);
        } else {
            progressPercent = 100;
        }
    } else if (phase === 'done') {
        progressPercent = 100;
    }
};

export const GET: APIRoute = async ({ url }) => {
    const type = url.searchParams.get('type');
    const force = url.searchParams.get('force') === 'true';

    let version = url.searchParams.get('version');
    if (!version) {
        try {
            version = (await resolveCurrentPatchVersion()).version;
        } catch (e: any) {
            return new Response(JSON.stringify({ 
                error: "No se pudo determinar la versión del parche para la sincronización", 
                details: e.message 
            }), { status: 500 });
        }
    }

    if (type === 'status') {
        return new Response(JSON.stringify({ 
            syncing: isGlobalSyncing,
            logs: syncLogs,
            progressPercent,
            progressPhase
        }), { 
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
        });
    }

    if (type === 'cancel') {
        shouldAbort = true;
        progressPhase = 'cancelled';
        writeLog("🛑 SEÑAL DE CANCELACIÓN RECIBIDA. Deteniendo motores...");
        return new Response(JSON.stringify({ message: "Señal de cancelación enviada" }), { status: 200 });
    }

    if (type === 'check') {
        try {
            const { configRepo } = await import('../../lib/db/config.repo.js');
            const configs = configRepo.getAllConfigs();
            
            const syncPeriodDays = parseInt(configs.sync_period_days || '3') || 3;
            const laneSyncPeriodDays = parseInt(configs.lane_sync_period_days || '21') || 21;
            const lastSyncTimestamp = configs.last_sync_timestamp || '-';
            const lastLaneSyncTimestamp = configs.last_lane_sync_timestamp || '-';
            const lastSyncVersion = configs.last_sync_version || '-';

            // Obtener versión de LoL resolviendo con el resolver de dominio
            const patchResolution = await resolveCurrentPatchVersion();
            const shortVersion = patchResolution.version;

            const isOutdated = (timestampStr: string, limitDays: number): boolean => {
                if (timestampStr === '-' || !timestampStr) return true;
                try {
                    const lastDate = new Date(timestampStr);
                    if (isNaN(lastDate.getTime())) return true;
                    const diffMs = Date.now() - lastDate.getTime();
                    const diffDays = diffMs / (1000 * 60 * 60 * 24);
                    return diffDays >= limitDays;
                } catch {
                    return true;
                }
            };

            const isNewPatch = lastSyncVersion !== '-' && lastSyncVersion !== '0' && shortVersion !== lastSyncVersion;
            const needsBuildSync = isOutdated(lastSyncTimestamp, syncPeriodDays) || isNewPatch;
            const needsLaneSync = isOutdated(lastLaneSyncTimestamp, laneSyncPeriodDays);

            return new Response(JSON.stringify({
                needs_build_sync: needsBuildSync,
                needs_lane_sync: needsLaneSync,
                last_sync_timestamp: lastSyncTimestamp,
                last_lane_sync_timestamp: lastLaneSyncTimestamp,
                last_sync_version: lastSyncVersion,
                sync_period_days: syncPeriodDays,
                lane_sync_period_days: laneSyncPeriodDays,
                version: shortVersion,
                version_source: patchResolution.source,
                is_new_patch: isNewPatch
            }), { 
                status: 200,
                headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
            });
        } catch (error: any) {
            return new Response(JSON.stringify({ error: "Fallo al verificar el estado de sync", details: error.message }), { status: 500 });
        }
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
        progressPercent = 0;
        progressPhase = 'starting';
        writeLog(`Motor de sincronización iniciado (Tipo: ${type}, Versión: ${version}, Fuerza: ${force}).`);
        
        const runSyncFlow = async () => {
            let dockerDesktopStarted = false;
            try {
                // 1. Levantar Docker y FlareSolverr de fondo
                dockerDesktopStarted = await startDockerAndFlareSolverr(writeLog);

                // 2. Ejecutar la sincronización correspondiente
                if (type === 'meta_builds') {
                    const resStatus = await syncMetaAndBuilds(version, () => shouldAbort, writeLog, force, updateProgress);
                    try {
                        initializeEngineData();
                        if (resStatus === "Cancelado por el usuario") {
                            progressPhase = 'cancelled';
                            writeLog("[ABORT] Sincronizacion cancelada por el usuario.");
                        } else {
                            progressPhase = 'done';
                            progressPercent = 100;
                            writeLog("[OK] Sincronizacion y recarga del motor en memoria completadas.");
                        }
                    } catch (e: any) {
                        writeLog(`[WARN] Sincronizacion completada, pero fallo la recarga en memoria: ${e.message || e}`);
                    }
                } else if (type === 'SyncEstructuraLanes') {
                    await SyncEstructuraLanes(version, () => shouldAbort, writeLog, updateProgress);
                    try {
                        initializeEngineData();
                        if (shouldAbort) {
                            progressPhase = 'cancelled';
                            writeLog("[ABORT] Mapeo cancelado por el usuario.");
                        } else {
                            progressPhase = 'done';
                            progressPercent = 100;
                            writeLog("[OK] Mapeo de carriles y recarga del motor en memoria completadas.");
                        }
                    } catch (e: any) {
                        writeLog(`[WARN] Mapeo completado, pero fallo la recarga en memoria: ${e.message || e}`);
                    }
                }
            } catch (err: any) {
                progressPhase = 'error';
                writeLog(`[ERROR] Sincronizacion fallo: ${err.message || err}`);
            } finally {
                // 3. Detener FlareSolverr y apagar Docker Desktop de fondo si se inició en este flujo
                try {
                    await stopDockerAndFlareSolverr(writeLog, dockerDesktopStarted);
                } catch (dockerStopErr: any) {
                    writeLog(`[WARN] No se pudo detener Docker/FlareSolverr: ${dockerStopErr.message}`);
                }
                isGlobalSyncing = false;
            }
        };

        runSyncFlow();
        return new Response(JSON.stringify({ message: "Iniciado" }), { status: 200 });
        
    } catch (e: any) {
        isGlobalSyncing = false;
        progressPhase = 'error';
        return new Response(JSON.stringify({ error: e.message || "Error" }), { status: 500 });
    }
};