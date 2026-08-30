import { resolveCurrentPatchVersion } from '../src/lib/domain/patch-version-resolver.js';
import { SyncEstructuraLanes } from '../src/lib/scripts/meta-map.js';
import { startDockerAndFlareSolverr, stopDockerAndFlareSolverr } from '../src/lib/services/docker.service.js';
import { checkpointDb, closeDb } from '../src/lib/db/sqlite.js';

async function main(): Promise<void> {
  console.log('=== INICIANDO SYNC DE CARRILES (STANDALONE) ===');

  let version: string;
  try {
    const resolution = await resolveCurrentPatchVersion();
    version = resolution.version;
    console.log(`[CLI] Versión resuelta: ${version} (fuente: ${resolution.source})`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[CLI FATAL] Error resolviendo versión de parche: ${message}`);
    process.exitCode = 1;
    return;
  }

  let dockerStarted = false;
  try {
    console.log('[CLI] Preparando contenedor de FlareSolverr para Lanes...');
    dockerStarted = await startDockerAndFlareSolverr(console.log);
    await SyncEstructuraLanes(version, () => false, console.log);
    console.log('=== SYNC DE CARRILES FINALIZADO CON ÉXITO ===');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[CLI FATAL] Error durante la sincronización de carriles: ${message}`);
    process.exitCode = 1;
  } finally {
    try {
      console.log('[CLI] Limpiando procesos de Docker y FlareSolverr...');
      await stopDockerAndFlareSolverr(console.log, dockerStarted);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[CLI WARN] Error al detener FlareSolverr: ${message}`);
    }
    checkpointDb();
    closeDb();
  }
}

void main();
