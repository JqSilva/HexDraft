import type { APIRoute } from 'astro';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import axios from 'axios';
import { dbPath, closeDb, reopenDb, checkpointDb } from '../../../lib/db/sqlite.js';
import { appConfig } from '../../../lib/services/config.service.js';

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

async function swapDbFilesWithRetry(tempPath: string, targetPath: string, maxRetries = 3, delayMs = 200) {
  let lastError: any = null;
  const backupPath = `${targetPath}.bak`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Limpiar backup anterior si existe
      if (fs.existsSync(backupPath)) {
        try { fs.unlinkSync(backupPath); } catch {}
      }

      // Si el archivo destino existe, intentar eliminarlo o moverlo a backup
      if (fs.existsSync(targetPath)) {
        try {
          fs.unlinkSync(targetPath);
        } catch {
          fs.renameSync(targetPath, backupPath);
        }
      }

      // Mover archivo temporal a la ruta destino
      fs.renameSync(tempPath, targetPath);

      // Limpiar archivos WAL/SHM satélite del destino
      const targetWal = `${targetPath}-wal`;
      const targetShm = `${targetPath}-shm`;
      if (fs.existsSync(targetWal)) { try { fs.unlinkSync(targetWal); } catch {} }
      if (fs.existsSync(targetShm)) { try { fs.unlinkSync(targetShm); } catch {} }

      return; // Swap exitoso
    } catch (err: any) {
      lastError = err;
      console.warn(`[DB-UPDATE] Intento ${attempt}/${maxRetries} de swap falló con error ${err?.code || err?.name}: ${err?.message}`);
      if (attempt < maxRetries) {
        await sleep(delayMs);
      }
    }
  }

  throw lastError || new Error('Fallo al reemplazar el archivo de base de datos tras reintentos');
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const { downloadUrl, expectedChecksum, manifest } = await request.json();

    if (!downloadUrl || !expectedChecksum || !manifest) {
      return new Response(
        JSON.stringify({ error: 'Faltan parámetros requeridos: downloadUrl, expectedChecksum o manifest' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const tempDbPath = `${dbPath}.tmp`;

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: any) => {
          try {
            controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
          } catch (e) {
            // El canal de transmisión podría haberse cerrado
          }
        };

        let writer: fs.WriteStream | null = null;

        try {
          sendEvent({ status: 'starting', progress: 0, message: 'Iniciando descarga de la base de datos...' });

          // Asegurar que no quede un archivo temporal corrupto anterior ni sus satélites
          const initialTempWal = `${tempDbPath}-wal`;
          const initialTempShm = `${tempDbPath}-shm`;
          if (fs.existsSync(tempDbPath)) { try { fs.unlinkSync(tempDbPath); } catch {} }
          if (fs.existsSync(initialTempWal)) { try { fs.unlinkSync(initialTempWal); } catch {} }
          if (fs.existsSync(initialTempShm)) { try { fs.unlinkSync(initialTempShm); } catch {} }

          // Descargar usando Axios
          writer = fs.createWriteStream(tempDbPath);
          const response = await axios({
            url: downloadUrl,
            method: 'GET',
            responseType: 'stream',
            timeout: 60000 // 60 segundos de timeout de conexión
          });

          const totalBytes = parseInt(String(response.headers['content-length'] || '0'), 10);
          let downloadedBytes = 0;
          let lastProgressPercent = -1;

          response.data.on('data', (chunk: any) => {
            downloadedBytes += chunk.length;
            const progress = totalBytes ? Math.round((downloadedBytes / totalBytes) * 100) : 0;
            
            // Reducir la cantidad de eventos emitidos al cliente enviando solo si cambia el entero del progreso
            if (progress !== lastProgressPercent) {
              lastProgressPercent = progress;
              sendEvent({
                status: 'downloading',
                progress,
                message: `Descargando: ${progress}% (${(downloadedBytes / 1024 / 1024).toFixed(1)}MB / ${(totalBytes / 1024 / 1024).toFixed(1)}MB)`
              });
            }
          });

          response.data.pipe(writer);

          // Esperar a que la escritura termine
          await new Promise<void>((resolve, reject) => {
            if (!writer) return reject(new Error('El escritor no fue inicializado'));
            writer.on('finish', () => resolve());
            writer.on('error', (err: any) => reject(err));
            response.data.on('error', (err: any) => reject(err));
          });

          sendEvent({ status: 'verifying', progress: 100, message: 'Descarga finalizada. Verificando checksum SHA256...' });

          // Calcular checksum SHA256
          const hash = crypto.createHash('sha256');
          const fileReadStream = fs.createReadStream(tempDbPath);
          await new Promise<void>((resolve, reject) => {
            fileReadStream.on('data', (data: any) => hash.update(data));
            fileReadStream.on('end', () => resolve());
            fileReadStream.on('error', (err: any) => reject(err));
          });
          const calculatedChecksum = hash.digest('hex');

          if (calculatedChecksum.toLowerCase() !== expectedChecksum.toLowerCase()) {
            const actualFileSizeOnDisk = fs.existsSync(tempDbPath) ? fs.statSync(tempDbPath).size : 0;
            console.error(`[DB-UPDATE-ERROR] Checksum SHA256 mismatch. URL: ${downloadUrl} | Esperado: ${expectedChecksum} | Calculado: ${calculatedChecksum} | Tamaño: ${actualFileSizeOnDisk} bytes (Header: ${totalBytes})`);
            throw new Error(`El checksum SHA256 no coincide. Esperado: ${expectedChecksum}, Calculado: ${calculatedChecksum}`);
          }

          sendEvent({ status: 'installing', progress: 100, message: 'Checksum correcto. Instalando base de datos...' });

          // 1. Ejecutar checkpoint WAL para persistir transacciones y vaciar buffers satélite
          checkpointDb();

          // 2. Cerrar y reemplazar con reintentos y reapertura garantizada
          try {
            closeDb();
            await swapDbFilesWithRetry(tempDbPath, dbPath, 3, 200);
          } finally {
            // CRÍTICO: Garantizar SIEMPRE que la base de datos se reabre, incluso si el swap falló
            reopenDb();
          }

          // 3. Guardar manifest en data/db-version.json
          fs.writeFileSync(appConfig.dbVersionPath, JSON.stringify(manifest, null, 2), 'utf-8');

          sendEvent({ status: 'done', message: '¡Base de datos actualizada con éxito!' });
          controller.close();

        } catch (error: any) {
          console.error('❌ Error durante la actualización de la base de datos:', error);
          
          // Limpiar archivo temporal y sus archivos satélite en caso de error
          if (writer) {
            try { writer.close(); } catch {
              // Ignorado si el flujo ya está cerrado
            }
          }
          const tempWal = `${tempDbPath}-wal`;
          const tempShm = `${tempDbPath}-shm`;
          const dbBak = `${dbPath}.bak`;

          if (fs.existsSync(tempDbPath)) {
            try { fs.unlinkSync(tempDbPath); } catch {}
          }
          if (fs.existsSync(tempWal)) {
            try { fs.unlinkSync(tempWal); } catch {}
          }
          if (fs.existsSync(tempShm)) {
            try { fs.unlinkSync(tempShm); } catch {}
          }

          // Si dbPath principal quedó ausente pero existe el .bak tras un fallo en swap, restaurarlo
          if (!fs.existsSync(dbPath) && fs.existsSync(dbBak)) {
            try {
              fs.renameSync(dbBak, dbPath);
              console.log('[DB-UPDATE] Se restauró hexdraft.db desde backup tras fallo de instalación.');
            } catch (restoreErr) {
              console.error('[DB-UPDATE] Error al restaurar backup:', restoreErr);
            }
          }

          sendEvent({ status: 'error', message: error.message || 'Error desconocido durante la actualización.' });
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });

  } catch (error: any) {
    console.error('❌ Error de inicialización en POST /api/db/update:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor al iniciar la actualización', details: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
