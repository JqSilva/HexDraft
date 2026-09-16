import React, { useEffect, useState } from 'react';
import { useAppMode } from './useAppMode';
import type { PublishStatus } from './sync/types';
import { formatTimestamp } from './sync/utils';

interface SyncStatus {
  version: string;
  database_patch: string;
  last_sync_timestamp: string;
  last_lane_sync_timestamp: string;
  last_sync_version: string;
  last_lane_sync_version: string;
  needs_build_sync: boolean;
  needs_lane_sync: boolean;
  version_source: string;
}

type ActionState = 'idle' | 'publishing' | 'done' | 'error';

const statusLabel = (pending: boolean) => pending ? 'Pendiente' : 'Al día';

export const SyncPanel = () => {
  const { mode, isAdmin, loaded: modeLoaded } = useAppMode();
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [publishStatus, setPublishStatus] = useState<PublishStatus | null>(null);
  const [loadingPublish, setLoadingPublish] = useState(true);
  const [actionState, setActionState] = useState<ActionState>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [syncingNow, setSyncingNow] = useState(false);
  const [syncProgress, setSyncProgress] = useState('');

  const fetchSyncStatus = async () => {
    try {
      const response = await fetch('/api/sync?type=check', { cache: 'no-store' });
      if (!response.ok) throw new Error('No se pudo consultar el estado de sincronización');
      setSyncStatus(await response.json() as SyncStatus);
    } catch (error) {
      console.error('No se pudo comprobar el estado de sincronización:', error);
    } finally {
      setLoadingStatus(false);
    }
  };

  const fetchPublishStatus = async () => {
    try {
      const response = await fetch('/api/sync/status', { cache: 'no-store' });
      if (response.ok) setPublishStatus(await response.json() as PublishStatus);
    } catch (error) {
      console.error('No se pudo obtener el estado de publicación:', error);
    } finally {
      setLoadingPublish(false);
    }
  };

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void fetchSyncStatus(), 0);
    const interval = window.setInterval(() => void fetchSyncStatus(), 60_000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const handleDatabaseUpdated = () => {
      void fetchSyncStatus();
      if (isAdmin) void fetchPublishStatus();
    };

    window.addEventListener('hexdraft-db-updated', handleDatabaseUpdated);
    return () => window.removeEventListener('hexdraft-db-updated', handleDatabaseUpdated);
  }, [isAdmin]);

  useEffect(() => {
    if (!modeLoaded || !isAdmin) return;
    const initialLoad = window.setTimeout(() => void fetchPublishStatus(), 0);
    return () => window.clearTimeout(initialLoad);
  }, [modeLoaded, isAdmin]);

  const waitForManualSync = async (type: 'SyncEstructuraLanes' | 'meta_builds', label: string) => {
    const response = await fetch(`/api/sync?type=${type}`, { cache: 'no-store' });
    const data = await response.json() as { error?: string };
    if (!response.ok || data.error) throw new Error(data.error || `No se pudo iniciar ${label}`);

    for (let attempt = 0; attempt < 240; attempt += 1) {
      await new Promise(resolve => window.setTimeout(resolve, 1500));
      const statusResponse = await fetch('/api/sync?type=status', { cache: 'no-store' });
      const runtime = await statusResponse.json() as {
        syncing: boolean;
        progressPercent: number;
        progressPhase: string;
        logs?: string[];
      };
      setSyncProgress(`${label}: ${runtime.progressPercent || 0}%`);
      if (!runtime.syncing) {
        if (runtime.progressPhase === 'error') {
          const lastLog = runtime.logs?.[runtime.logs.length - 1];
          throw new Error(lastLog || `Falló ${label}`);
        }
        return;
      }
    }

    throw new Error(`Tiempo de espera agotado durante ${label}`);
  };

  const handleManualSync = async () => {
    setSyncingNow(true);
    setSyncProgress('Preparando sincronización...');
    setStatusMessage('');
    try {
      await waitForManualSync('SyncEstructuraLanes', 'Carriles');
      await waitForManualSync('meta_builds', 'Meta, builds y LoLalytics');
      setSyncProgress('Sincronización completada');
      setStatusMessage('Datos de LoLalytics actualizados correctamente.');
      await fetchSyncStatus();
      window.dispatchEvent(new Event('hexdraft-db-updated'));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      setSyncProgress('Sincronización fallida');
      setStatusMessage(message);
    } finally {
      setSyncingNow(false);
    }
  };

  const handleCancelSync = async () => {
    try {
      await fetch('/api/sync?type=cancel', { cache: 'no-store' });
      setSyncProgress('Cancelación solicitada...');
    } catch (error) {
      console.error('No se pudo cancelar la sincronización:', error);
    }
  };
  const handlePublishGithub = async () => {
    setActionState('publishing');
    setStatusMessage('Compilando base de datos y publicando...');

    try {
      const response = await fetch('/api/sync/publish', { method: 'POST' });
      const data = await response.json() as { error?: string; version?: number; patch?: string };
      if (!response.ok || data.error) throw new Error(data.error || 'Fallo en la publicación');

      setActionState('done');
      setStatusMessage(`Publicada la versión ${data.version} para el parche ${data.patch}`);
      await fetchPublishStatus();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      setActionState('error');
      setStatusMessage(message);
    }
  };

  const databasePatch = syncStatus?.database_patch || '-';
  const activePatch = syncStatus?.version || '--.--';
  const needsBuildSync = syncStatus?.needs_build_sync ?? false;
  const needsLaneSync = syncStatus?.needs_lane_sync ?? false;
  const needsPublish = publishStatus?.pendingPublish ?? false;

  return (
    <div className="w-full flex flex-col p-5 md:p-8 text-slate-200 animate-in fade-in duration-300">
      <header className="relative flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border-warm pb-5 mb-6">
        <div>
          <span className="text-xs tracking-wide font-medium text-slate-500 block mb-2">
            Mantenimiento de datos
          </span>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-white tracking-tight">
              Estado de <span className="text-purple-accent">sincronización</span>
            </h1>
            {modeLoaded && (
                <span className={`px-2.5 py-1 text-xs font-medium border rounded-md ${
                isAdmin ? 'bg-purple-accent/10 border-purple-accent/40 text-purple-accent' : 'bg-slate-900 border-slate-700 text-slate-400'
              }`}>
                Modo: {mode}
              </span>
            )}
          </div>
          <p className="max-w-2xl mt-2 text-sm text-slate-400 leading-relaxed">
            La base de datos se actualiza automáticamente mediante GitHub Actions. Esta pantalla muestra el estado local y la última publicación disponible.
          </p>
        </div>
        <span className="text-sm text-slate-500 font-mono">
          {loadingStatus ? 'Consultando estado...' : `Fuente del parche: ${syncStatus?.version_source || 'local'}`}
        </span>
      </header>

      <div className="w-full max-w-[1300px] mx-auto flex flex-col gap-5">
        <section className="bg-panel-warm border border-border-warm rounded-xl p-5 md:p-6 relative overflow-hidden shadow-sm">
          <div className="mb-5">
            <h2 className="text-base text-purple-accent font-semibold mb-1">Estado actual</h2>
            <p className="text-sm text-slate-400">Comparación entre el parche instalado, los datos locales y el calendario automático.</p>
          </div>
          <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            <div className="lg:border-r border-border-warm-hover/40 pr-4">
              <span className="block text-xs text-slate-500 tracking-wide font-medium mb-1">Parche activo</span>
              <span className="text-base font-mono font-black text-white">{activePatch}</span>
            </div>
            <div className="lg:border-r border-border-warm-hover/40 pr-4">
              <span className="block text-[9px] text-slate-500 uppercase tracking-widest font-black mb-1">Parche de datos</span>
              <span className="text-base font-mono font-black text-white">{databasePatch}</span>
            </div>
            <div className="lg:border-r border-border-warm-hover/40 pr-4">
              <span className="block text-[9px] text-slate-500 uppercase tracking-widest font-black mb-1">Meta y builds</span>
              <span className="text-xs font-mono font-bold text-slate-300">{formatTimestamp(syncStatus?.last_sync_timestamp || '-')}</span>
            </div>
            <div>
              <span className="block text-[9px] text-slate-500 uppercase tracking-widest font-black mb-1">Carriles</span>
              <span className="text-xs font-mono font-bold text-slate-300">{formatTimestamp(syncStatus?.last_lane_sync_timestamp || '-')}</span>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-5">
          <section className="bg-panel-warm border border-border-warm rounded-xl p-5 md:p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="text-sm font-black text-white">Proceso automático</h2>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                Cada ejecución procesa primero la estructura de carriles, después Meta y Builds, y finalmente publica la base resultante.
              </p>
            </div>
            <div className="divide-y divide-border-warm/50 border-y border-border-warm/50">
              <div className="flex items-center gap-3 py-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-accent/10 text-[10px] font-mono font-semibold text-purple-accent">1</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-200">Estructura de carriles</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Última ejecución: {formatTimestamp(syncStatus?.last_lane_sync_timestamp || '-')}</p>
                </div>
                <span className={`text-[9px] uppercase tracking-wider font-black ${needsLaneSync ? 'text-amber-400' : 'text-emerald-400'}`}>{statusLabel(needsLaneSync)}</span>
              </div>
              <div className="flex items-center gap-3 py-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-accent/10 text-[10px] font-mono font-semibold text-purple-accent">2</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-200">Meta y Builds</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Última ejecución: {formatTimestamp(syncStatus?.last_sync_timestamp || '-')}</p>
                </div>
                <span className={`text-[9px] uppercase tracking-wider font-black ${needsBuildSync ? 'text-amber-400' : 'text-emerald-400'}`}>{statusLabel(needsBuildSync)}</span>
              </div>
              <div className="flex items-center gap-3 py-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400/10 text-[10px] font-mono font-black text-emerald-300">3</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-200">Publicación de la base</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Última release: {publishStatus?.lastPublishDate && publishStatus.lastPublishDate !== '-' ? formatTimestamp(publishStatus.lastPublishDate) : 'Nunca'}</p>
                </div>
                <span className={`text-[9px] uppercase tracking-wider font-black ${needsPublish ? 'text-amber-400' : 'text-emerald-400'}`}>{statusLabel(needsPublish)}</span>
              </div>
            </div>
            {isAdmin && (
              <div className="mt-5 border-t border-border-warm/50 pt-4">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleManualSync}
                    disabled={syncingNow || actionState === "publishing"}
                    className={`flex-1 min-w-[220px] min-h-11 px-5 py-3 font-semibold text-sm transition-colors ${
                      syncingNow
                        ? 'bg-border-warm border-border-warm text-slate-500 cursor-not-allowed'
                        : 'btn-quiet text-slate-200 cursor-pointer'
                    }`}
                  >
                    {syncingNow ? 'Sincronizando...' : 'Sincronizar ahora'}
                  </button>
                  {syncingNow && (
                    <button
                      onClick={handleCancelSync}
                      className="min-h-11 px-4 py-3 font-semibold text-sm rounded-lg border bg-panel-warm border-rose-500/60 text-rose-300 hover:bg-rose-900/30 hover:border-rose-400 hover:text-white"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
                {syncProgress && <p className="mt-2 text-[10px] text-purple-accent font-mono">{syncProgress}</p>}
                {statusMessage && <p className="mt-2 text-[10px] text-slate-300 leading-relaxed">{statusMessage}</p>}
              </div>
            )}
            <p className="mt-4 text-[10px] text-slate-500 leading-relaxed">
              El botón ejecuta una sincronización completa de carriles, meta, builds y datos de LoLalytics.
            </p>
          </section>

          <section className="bg-[#0b0b0f] border border-border-warm rounded-sm p-5 md:p-6 flex flex-col justify-between">
            <div>
              <h2 className="text-sm font-black text-white">Distribución en GitHub</h2>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                Publica una copia de la base local para que las instalaciones de usuario puedan descargarla y verificar su checksum.
              </p>
              {!loadingPublish && publishStatus && (
                <div className="mt-5 space-y-2 border-y border-border-warm/50 py-3 text-[10px] font-mono">
                  <div className="flex justify-between gap-4"><span className="text-slate-500">Última release</span><span className="text-right font-bold text-slate-300">{publishStatus.lastPublishVersion ? `v${publishStatus.lastPublishVersion} · ${publishStatus.lastPublishPatch}` : 'Ninguna'}</span></div>
                  <div className="flex justify-between gap-4"><span className="text-slate-500">Parche local</span><span className="font-bold text-slate-300">{syncStatus?.last_sync_version || '-'}</span></div>
                </div>
              )}
            </div>
            {isAdmin && (
              <div className="mt-5">
                <button
                  onClick={handlePublishGithub}
                  disabled={actionState === 'publishing' || syncingNow}
                  className={`w-full min-h-11 px-5 py-3 font-semibold text-sm rounded-lg transition-colors border ${
                    actionState === 'publishing'
                      ? 'bg-border-warm border-border-warm text-slate-500 cursor-not-allowed'
                      : 'bg-emerald-600 border-emerald-500 hover:bg-emerald-500 text-white cursor-pointer'
                  }`}
                >
                  {actionState === 'publishing' ? 'Publicando...' : 'Publicar base de datos'}
                </button>
                {statusMessage && <p className={`mt-3 text-center text-[10px] leading-relaxed ${actionState === 'error' ? 'text-red-400' : 'text-emerald-400'}`}>{statusMessage}</p>}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
