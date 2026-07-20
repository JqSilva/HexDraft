// src/pages/api/app-version.ts
import type { APIRoute } from 'astro';
import { APP_VERSION, GITHUB_LAUNCHER_REPO } from '../../config/version.js';

function parseVersion(vStr: string): number[] {
  const clean = vStr.replace(/[^\d.]/g, '');
  return clean.split('.').map(x => parseInt(x, 10) || 0);
}

function isNewerVersion(remoteStr: string, localStr: string): boolean {
  const remote = parseVersion(remoteStr);
  const local = parseVersion(localStr);
  const maxLen = Math.max(remote.length, local.length);
  for (let i = 0; i < maxLen; i++) {
    const r = remote[i] || 0;
    const l = local[i] || 0;
    if (r > l) return true;
    if (r < l) return false;
  }
  return false;
}

export const GET: APIRoute = async () => {
  try {
    const launcherRepo = GITHUB_LAUNCHER_REPO;
    const apiUrl = `https://api.github.com/repos/${launcherRepo}/releases/latest`;
    
    const res = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'HexDraft-App',
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ 
        hasUpdate: false, 
        currentVersion: APP_VERSION,
        error: `GitHub API HTTP ${res.status}`
      }), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
    }

    const data = await res.json();
    const remoteTag = data.tag_name || '';
    const releaseUrl = data.html_url || `https://github.com/${launcherRepo}/releases/latest`;
    const releaseName = data.name || remoteTag;

    const hasUpdate = isNewerVersion(remoteTag, APP_VERSION);

    return new Response(JSON.stringify({
      hasUpdate,
      currentVersion: APP_VERSION,
      latestVersion: remoteTag.replace(/^v/, ''),
      releaseUrl,
      releaseName,
      body: data.body || ''
    }), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

  } catch (e: any) {
    return new Response(JSON.stringify({ 
      hasUpdate: false, 
      currentVersion: APP_VERSION,
      error: e.message 
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
};
