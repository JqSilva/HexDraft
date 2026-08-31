import { syncMetaCacheOnly } from '../services/sync.service.js';

/**
 * Actualiza la estructura de carriles usando la misma fuente de meta que el
 * sincronizador principal. Se conserva el nombre público para compatibilidad
 * con la UI y el CLI, pero ya no consulta ninguna fuente antigua.
 */
export async function SyncEstructuraLanes(
  _version: string,
  checkAbort: () => boolean,
  writeLog: (msg: string) => void,
  onProgress?: (current: number, total: number, phase: 'lanes' | 'done') => void
): Promise<void> {
  if (checkAbort()) return;
  onProgress?.(1, 1, 'lanes');
  await syncMetaCacheOnly(writeLog);
  onProgress?.(1, 1, 'done');
}