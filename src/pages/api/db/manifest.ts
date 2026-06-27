import type { APIRoute } from 'astro';
import fs from 'node:fs';
import { appConfig } from '../../../lib/services/config.service.js';

export const GET: APIRoute = async () => {
  try {
    // 1. Leer versión local
    let localManifest = {
      version: 0,
      patch: '-',
      lastUpdate: '-',
      checksum: '',
      size: 0
    };

    if (fs.existsSync(appConfig.dbVersionPath)) {
      try {
        localManifest = JSON.parse(fs.readFileSync(appConfig.dbVersionPath, 'utf-8'));
      } catch (e) {
        console.error('Error parseando db-version.json local, usando valores iniciales:', e);
      }
    }

    // 2. Consultar última release en GitHub
    const url = `https://api.github.com/repos/${appConfig.github_repo}/releases/latest`;
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'HexDraft-App'
    };

    if (appConfig.github_token) {
      headers['Authorization'] = `token ${appConfig.github_token}`;
    }

    const response = await fetch(url, { headers });
    
    if (response.status === 404) {
      // Si no hay ninguna release en GitHub, retornamos versión remota 0 de forma controlada sin fallar
      return new Response(
        JSON.stringify({
          local: localManifest,
          remote: {
            version: 0,
            patch: '-',
            lastUpdate: '-',
            checksum: '',
            size: 0,
            downloadUrl: ''
          },
          needsUpdate: false
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store'
          }
        }
      );
    }

    if (!response.ok) {
      throw new Error(`Fallo en la petición a GitHub API: ${response.status} ${response.statusText}`);
    }

    const release = await response.json();
    const bodyText = release.body || '';

    // 3. Extraer manifest JSON del body de la release
    let remoteManifest: any = null;
    try {
      remoteManifest = JSON.parse(bodyText);
    } catch {
      // Intentar buscar bloque de código JSON o llaves {} en el texto
      const match = bodyText.match(/\{[\s\S]*?\}/);
      if (match) {
        try {
          remoteManifest = JSON.parse(match[0]);
        } catch {}
      }
    }

    if (!remoteManifest || typeof remoteManifest.version === 'undefined') {
      throw new Error('No se pudo encontrar un manifest JSON válido en la release de GitHub');
    }

    // 4. Buscar la URL de descarga de hexdraft.db en los assets de la release
    const dbAsset = release.assets?.find((asset: any) => asset.name === 'hexdraft.db');
    if (!dbAsset) {
      throw new Error('No se encontró el asset "hexdraft.db" en la última release de GitHub');
    }

    // Completar el manifest remoto con la URL de descarga y el tamaño real del asset
    remoteManifest.downloadUrl = dbAsset.browser_download_url;
    if (!remoteManifest.size) {
      remoteManifest.size = dbAsset.size;
    }

    // 5. Comparar versiones
    const needsUpdate = remoteManifest.version > localManifest.version;

    return new Response(
      JSON.stringify({
        local: localManifest,
        remote: remoteManifest,
        needsUpdate
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
    console.error('❌ Error en el endpoint GET /api/db/manifest:', error);
    
    // Retornamos un error controlado sin crashear el servidor
    return new Response(
      JSON.stringify({
        error: 'No se pudo verificar la actualización de la base de datos',
        details: error.message || error
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};
