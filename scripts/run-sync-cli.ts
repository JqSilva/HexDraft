// scripts/run-sync-cli.ts
import { resolveCurrentPatchVersion } from '../src/lib/domain/patch-version-resolver.js';
import { syncMetaAndBuilds } from '../src/lib/services/sync.service.js';
import { startDockerAndFlareSolverr, stopDockerAndFlareSolverr } from '../src/lib/services/docker.service.js';
import { initializeEngineData } from '../src/lib/engine/core/dataProvider.js';

async function main() {
  console.log("=== INICIANDO SYNC CLI (STANDALONE) ===");
  const args = process.argv.slice(2);
  let version = args[0];

  if (version) {
    console.log(`[CLI] Versión de parche recibida por parámetro: ${version}`);
  } else {
    console.log("[CLI] Resolviendo versión de parche automáticamente...");
    try {
      const resolution = await resolveCurrentPatchVersion();
      version = resolution.version;
      console.log(`[CLI] Versión resuelta: ${version} (fuente: ${resolution.source})`);
    } catch (e: any) {
      console.error(`[CLI FATAL] Error resolviendo versión de parche: ${e.message || e}`);
      process.exit(1);
    }
  }

  let dockerStarted = false;

  try {
    // 1. Iniciar Docker / FlareSolverr si es necesario
    console.log("[CLI] Preparando contenedor de FlareSolverr...");
    dockerStarted = await startDockerAndFlareSolverr(console.log);

    // 2. Ejecutar sincronización forzada (forceSync = true para CI / CLI)
    console.log(`[CLI] Iniciando sync completo para parche ${version} (force=true)...`);
    const summary = await syncMetaAndBuilds(
      version,
      () => false,
      console.log,
      true // forceSync: siempre completo en CI/CLI
    );

    console.log(`[CLI OK] Sincronización completada exitosamente:\n${summary}`);

    // 3. Inicializar datos del engine en memoria para verificar integridad
    console.log("[CLI] Verificando datos del motor de draft...");
    try {
      initializeEngineData();
      console.log("[CLI OK] Motor de datos inicializado correctamente.");
    } catch (engineErr: any) {
      console.warn(`[CLI WARN] No se pudo inicializar engine en memoria: ${engineErr.message || engineErr}`);
    }

    console.log("=== SYNC CLI FINALIZADO CON ÉXITO ===");
  } catch (err: any) {
    console.error(`[CLI FATAL] Error durante la sincronización: ${err.message || err}`);
    process.exitCode = 1;
  } finally {
    // 4. Detener FlareSolverr / Docker si fue iniciado en este proceso
    try {
      console.log("[CLI] Limpiando procesos de Docker y FlareSolverr...");
      await stopDockerAndFlareSolverr(console.log, dockerStarted);
    } catch (stopErr: any) {
      console.warn(`[CLI WARN] Error al detener FlareSolverr: ${stopErr.message || stopErr}`);
    }
  }

  if (process.exitCode === 1) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main();
