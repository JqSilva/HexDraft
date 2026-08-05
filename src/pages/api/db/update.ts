import type { APIRoute } from 'astro';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import axios from 'axios';
import { dbPath, closeDb, reopenDb } from '../../../lib/db/sqlite.js';
import { appConfig } from '../../../lib/services/config.service.js';

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

          // Asegurar que no quede un archivo temporal corrupto anterior
          if (fs.existsSync(tempDbPath)) {
            try {
              fs.unlinkSync(tempDbPath);
            } catch {
              // Ignorado de forma segura si el archivo temporal no existe o está bloqueado
            }
          }

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
            throw new Error(`El checksum SHA256 no coincide. Esperado: ${expectedChecksum}, Calculado: ${calculatedChecksum}`);
          }

          sendEvent({ status: 'installing', progress: 100, message: 'Checksum correcto. Instalando base de datos...' });

          // 1. Cerrar conexión SQLite actual
          closeDb();

          // 2. Reemplazar archivo .db atómicamente
          if (fs.existsSync(dbPath)) {
            try {
              fs.unlinkSync(dbPath);
            } catch (err) {
              // Si falla eliminar por bloqueo en Windows, intentaremos renombrar el original
              const backupPath = `${dbPath}.bak`;
              if (fs.existsSync(backupPath)) {
                try { fs.unlinkSync(backupPath); } catch {
                  // Ignorado de forma segura si el backup está bloqueado
                }
              }
              fs.renameSync(dbPath, backupPath);
            }
          }
          fs.renameSync(tempDbPath, dbPath);

          // 3. Reabrir conexión SQLite
          reopenDb();

          // 4. Guardar manifest en data/db-version.json
          fs.writeFileSync(appConfig.dbVersionPath, JSON.stringify(manifest, null, 2), 'utf-8');

          sendEvent({ status: 'done', message: '¡Base de datos actualizada con éxito!' });
          controller.close();

        } catch (error: any) {
          console.error('❌ Error durante la actualización de la base de datos:', error);
          
          // Limpiar archivo temporal en caso de error
          if (writer) {
            try { writer.close(); } catch {
              // Ignorado si el flujo ya está cerrado
            }
          }
          if (fs.existsSync(tempDbPath)) {
            try { fs.unlinkSync(tempDbPath); } catch {
              // Ignorado si falla la eliminación del temporal
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
