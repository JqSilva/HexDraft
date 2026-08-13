// src/pages/api/pro-build.ts
import type { APIRoute } from 'astro';
import { processProBuildRequest } from '../../lib/services/proBuildService.js';

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const champion = url.searchParams.get('champion');
  const opponent = url.searchParams.get('opponent') || '';
  const role = url.searchParams.get('role') || 'top';
  const patch = url.searchParams.get('patch') || '16.15';
  const alliesParam = url.searchParams.get('allies') || '';
  const enemiesParam = url.searchParams.get('enemies') || '';

  const allies = alliesParam ? alliesParam.split(',').filter(Boolean) : [];
  const enemies = enemiesParam ? enemiesParam.split(',').filter(Boolean) : [];

  if (!champion) {
    return new Response(
      JSON.stringify({ error: 'Parámetro champion es requerido' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const result = await processProBuildRequest(champion, opponent, role, patch, allies, enemies);

  return new Response(
    JSON.stringify(result),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};
