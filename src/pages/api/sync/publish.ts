import type { APIRoute } from 'astro';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { dbPath } from '../../../lib/db/sqlite.js';
import { appConfig } from '../../../lib/services/config.service.js';
import { configRepo } from '../../../lib/db/config.repo.js';

export const POST: APIRoute = async () => {
  try {
    const githubToken = appConfig.github_token;
    if (!githubToken) {
      return new Response(
        JSON.stringify({ error: 'Token de GitHub no configurado en el entorno (.env). No se puede publicar.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!fs.existsSync(dbPath)) {
      return new Response(
        JSON.stringify({ error: `No se encuentra la base de datos local en la ruta: ${dbPath}` }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 1. Calcular SHA256 y tamaño de hexdraft.db
    const fileBuffer = fs.readFileSync(dbPath);
    const hash = crypto.createHash('sha256');
    hash.update(fileBuffer);
    const checksum = hash.digest('hex');
    const size = fileBuffer.length;

    // 2. Leer versión del parche actual (patch)
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
        // Ignorado si falla al recuperar la versión guardada en configs
      }
    }

    // 3. Consultar la última release en GitHub para saber la última versión numérica
    const gitHeaders: Record<string, string> = {
      'Authorization': `Bearer ${githubToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'HexDraft-App'
    };

    let latestVersion = 0;
    try {
      const latestRes = await fetch(
        `https://api.github.com/repos/${appConfig.github_repo}/releases/latest`,
        { headers: gitHeaders }
      );
      if (latestRes.ok) {
        const latestRelease = await latestRes.json();
        const bodyText = latestRelease.body || '';
        let remoteManifest: any = null;
        try {
          remoteManifest = JSON.parse(bodyText);
        } catch {
          const match = bodyText.match(/\{[\s\S]*?\}/);
          if (match) {
            try { remoteManifest = JSON.parse(match[0]); } catch {
              // Ignorado si falla lectura alternativa de manifest JSON
            }
          }
        }
        if (remoteManifest && typeof remoteManifest.version === 'number') {
          latestVersion = remoteManifest.version;
        }
      }
    } catch (e) {
      console.warn('No se pudo determinar la versión remota anterior, se asumirá v0 como base:', e);
    }

    const newVersion = latestVersion + 1;
    const lastUpdate = new Date().toISOString();

    // 4. Crear el manifest JSON
    const manifest = {
      patch,
      lastUpdate,
      version: newVersion,
      checksum,
      size
    };

    // 5. Crear la Release en GitHub
    // Usamos 'master' ya que es la rama del repositorio local actual
    const createReleaseRes = await fetch(
      `https://api.github.com/repos/${appConfig.github_repo}/releases`,
      {
        method: 'POST',
        headers: {
          ...gitHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tag_name: `db-v${newVersion}`,
          name: `v${newVersion} - Parche ${patch}`,
          body: JSON.stringify(manifest, null, 2),
          draft: false,
          prerelease: false
        })
      }
    );

    if (!createReleaseRes.ok) {
      const errText = await createReleaseRes.text();
      throw new Error(`Error creando la release en GitHub: ${createReleaseRes.status} - ${errText}`);
    }

    const releaseData = await createReleaseRes.json();

    // 6. Subir hexdraft.db como asset binario
    const uploadUrlTemplate = releaseData.upload_url;
    const uploadUrl = uploadUrlTemplate.replace(/\{.*?\}/, '') + '?name=hexdraft.db';

    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(size),
        'User-Agent': 'HexDraft-App'
      },
      body: fileBuffer
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`Error subiendo el asset hexdraft.db a GitHub: ${uploadRes.status} - ${errText}`);
    }

    // 7. Borrar releases y tags anteriores para no acumular basura
    try {
      console.log('>>> Limpiando releases y tags antiguos en GitHub...');
      const listRes = await fetch(
        `https://api.github.com/repos/${appConfig.github_repo}/releases?per_page=100`,
        { headers: gitHeaders }
      );
      if (listRes.ok) {
        const releases = await listRes.json();
        if (Array.isArray(releases)) {
          for (const rel of releases) {
            // No borrar la release que acabamos de crear
            if (rel.id === releaseData.id) {
              continue;
            }
            
            console.log(`  Borrando release antigua ID: ${rel.id} (${rel.tag_name})`);
            // 1. Borrar la release
            await fetch(
              `https://api.github.com/repos/${appConfig.github_repo}/releases/${rel.id}`,
              { method: 'DELETE', headers: gitHeaders }
            );
            
            // 2. Borrar el tag asociado
            if (rel.tag_name) {
              await fetch(
                `https://api.github.com/repos/${appConfig.github_repo}/git/refs/tags/${rel.tag_name}`,
                { method: 'DELETE', headers: gitHeaders }
              );
            }
          }
        }
      }
    } catch (cleanErr: any) {
      console.warn('⚠️ No se pudieron limpiar las releases antiguas:', cleanErr.message || cleanErr);
    }

    // 8. Guardar la versión publicada en data/db-version.json local
    fs.writeFileSync(appConfig.dbVersionPath, JSON.stringify(manifest, null, 2), 'utf-8');

    return new Response(
      JSON.stringify({
        success: true,
        version: newVersion,
        patch,
        releaseUrl: releaseData.html_url
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('❌ Error en POST /api/sync/publish:', error);
    return new Response(
      JSON.stringify({ error: 'Fallo al publicar base de datos en GitHub', details: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
