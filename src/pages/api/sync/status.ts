import type { APIRoute } from 'astro';
import fs from 'node:fs';
import path from 'node:path';
import { appConfig } from '../../../lib/services/config.service.js';
import { configRepo } from '../../../lib/db/config.repo.js';

export const GET: APIRoute = async () => {
  try {
    // 1. Obtener parche actual local de config o meta-cache.json
    let patch = '-';
    try {
      const metaPath = path.resolve(process.cwd(), 'src/lib/data/meta-cache.json');
      if (fs.existsSync(metaPath)) {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        patch = meta.version || '-';
      }
    } catch {
      // Ignorado, se mantendrá el valor por defecto
    }

    if (patch === '-') {
      try {
        const configs = configRepo.getAllConfigs();
        patch = configs.last_sync_version || '-';
      } catch {
        // Ignorado si falla lectura de config de sincronización
      }
    }

    // 2. Obtener fecha del último sync de datos local
    let lastSyncTimestamp = '-';
    try {
      const configs = configRepo.getAllConfigs();
      lastSyncTimestamp = configs.last_sync_timestamp || '-';
    } catch {
      // Ignorado si falla lectura del timestamp en configs
    }

    // 3. Leer versión publicada de data/db-version.json
    let dbVersion = {
      version: 0,
      patch: '-',
      lastUpdate: '-',
      checksum: '',
      size: 0
    };

    if (fs.existsSync(appConfig.dbVersionPath)) {
      try {
        dbVersion = JSON.parse(fs.readFileSync(appConfig.dbVersionPath, 'utf-8'));
      } catch {
        // Ignorado si el archivo db-version.json está corrupto
      }
    }

    // 4. Determinar si hay cambios pendientes por publicar
    let pendingPublish = false;
    if (!dbVersion.lastUpdate || dbVersion.lastUpdate === '-') {
      pendingPublish = true;
    } else if (lastSyncTimestamp !== '-') {
      const localPublishDate = new Date(dbVersion.lastUpdate);
      const localSyncDate = new Date(lastSyncTimestamp);
      pendingPublish = localSyncDate.getTime() > localPublishDate.getTime() || patch !== dbVersion.patch;
    }

    return new Response(
      JSON.stringify({
        lastPublishDate: dbVersion.lastUpdate,
        lastPublishVersion: dbVersion.version,
        lastPublishPatch: dbVersion.patch,
        currentPatch: patch,
        lastSyncTimestamp,
        pendingPublish
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      }
    );
  } catch (error: any) {
    console.error('❌ Error en GET /api/sync/status:', error);
    return new Response(
      JSON.stringify({ error: 'Error al obtener estado de sincronización', details: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
