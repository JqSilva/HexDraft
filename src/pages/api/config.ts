import type { APIRoute } from 'astro';
import { getLolPath, saveLolPath } from '../../lib/lcu';

export const GET: APIRoute = async () => {
  return new Response(JSON.stringify({ path: getLolPath() }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const { path: newPath } = await request.json();
    if (typeof newPath !== 'string') {
      return new Response(JSON.stringify({ error: 'Ruta inválida' }), { status: 400 });
    }
    const savedPath = saveLolPath(newPath);
    return new Response(JSON.stringify({ success: true, path: savedPath }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Error al procesar la ruta' }), { status: 500 });
  }
};
