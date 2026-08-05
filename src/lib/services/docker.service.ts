import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);
const FLARESOLVERR_PING_URL = 'http://127.0.0.1:8191/v1';

async function isFlareSolverrRunning(): Promise<boolean> {
  try {
    const res = await fetch('http://127.0.0.1:8191/', { signal: AbortSignal.timeout(2000) });
    return res.status === 200 || res.status === 404;
  } catch {
    return false;
  }
}

async function isDockerDaemonRunning(): Promise<boolean> {
  try {
    await execAsync('docker info');
    return true;
  } catch {
    return false;
  }
}

/**
 * Arranca Docker Desktop y levanta el contenedor de FlareSolverr si es necesario.
 * @returns true si Docker Desktop tuvo que ser iniciado por este script.
 */
export async function startDockerAndFlareSolverr(writeLog: (msg: string) => void): Promise<boolean> {
  writeLog('[DOCKER] Comprobando si FlareSolverr ya está activo en http://127.0.0.1:8191...');
  if (await isFlareSolverrRunning()) {
    writeLog('[DOCKER] FlareSolverr ya está respondiendo. No se requiere acción.');
    return false;
  }

  writeLog('[DOCKER] FlareSolverr no responde. Verificando estado de Docker...');
  let dockerReady = await isDockerDaemonRunning();
  let dockerDesktopStarted = false;

  if (!dockerReady) {
    writeLog('[DOCKER] El daemon de Docker no está activo. Levantando Docker Desktop...');
    const dockerDesktopPath = 'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe';
    try {
      await execAsync(`start "" "${dockerDesktopPath}"`);
      dockerDesktopStarted = true;
    } catch (err: any) {
      writeLog(`[DOCKER] Advertencia al ejecutar Docker Desktop: ${err.message}. Intentando continuar...`);
    }

    writeLog('[DOCKER] Esperando a que el daemon de Docker esté listo (hasta 45 segundos)...');
    for (let i = 0; i < 15; i++) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      if (await isDockerDaemonRunning()) {
        dockerReady = true;
        writeLog('[DOCKER] Daemon de Docker detectado y activo.');
        break;
      }
    }

    if (!dockerReady) {
      throw new Error('No se pudo iniciar el servicio de Docker. Por favor, abre Docker Desktop manualmente.');
    }
  }

  writeLog('[DOCKER] Iniciando contenedor "flaresolverr"...');
  try {
    await execAsync('docker start flaresolverr');
    writeLog('[DOCKER] Contenedor "flaresolverr" levantado.');
  } catch (err: any) {
    writeLog('[DOCKER] El contenedor "flaresolverr" no existe o falló al iniciar. Intentando crearlo...');
    try {
      await execAsync('docker run -d --name flaresolverr -p 8191:8191 ghcr.io/flaresolverr/flaresolverr:latest');
      writeLog('[DOCKER] Contenedor "flaresolverr" creado y levantado exitosamente.');
    } catch (runErr: any) {
      throw new Error(`Fallo al levantar el contenedor de FlareSolverr: ${runErr.message}`);
    }
  }

  writeLog('[DOCKER] Esperando a que el puerto de FlareSolverr responda (hasta 20 segundos)...');
  for (let i = 0; i < 10; i++) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    if (await isFlareSolverrRunning()) {
      writeLog('[DOCKER] FlareSolverr está activo y en línea en el puerto 8191.');
      return dockerDesktopStarted;
    }
  }

  throw new Error('El contenedor se inició pero FlareSolverr no respondió en http://127.0.0.1:8191.');
}

/**
 * Apaga el contenedor y detiene Docker Desktop si fue levantado por la app.
 */
export async function stopDockerAndFlareSolverr(writeLog: (msg: string) => void, stopDaemon: boolean): Promise<void> {
  writeLog('[DOCKER] Deteniendo contenedor "flaresolverr" para liberar memoria...');
  try {
    await execAsync('docker stop flaresolverr');
    writeLog('[DOCKER] Contenedor "flaresolverr" detenido.');
  } catch (err: any) {
    writeLog(`[DOCKER] Advertencia al detener contenedor: ${err.message}`);
  }

  if (stopDaemon) {
    writeLog('[DOCKER] Apagando Docker Desktop para liberar recursos del sistema...');
    try {
      await execAsync('taskkill /F /IM "Docker Desktop.exe" /IM "com.docker.backend.exe" /T');
      writeLog('[DOCKER] Docker Desktop apagado.');
    } catch (err: any) {
      writeLog(`[DOCKER] Advertencia al detener Docker Desktop: ${err.message}`);
    }
  }
}
