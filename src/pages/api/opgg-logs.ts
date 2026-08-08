import type { APIRoute } from 'astro';
import fs from 'node:fs';
import path from 'node:path';

const LOG_FILE = path.resolve(process.cwd(), 'logs/opgg-scraper.log');

export const GET: APIRoute = async () => {
  try {
    if (!fs.existsSync(LOG_FILE)) {
      return new Response(
        JSON.stringify({ logs: [], total: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const content = fs.readFileSync(LOG_FILE, 'utf-8');
    const lines = content.split('\n').filter(Boolean);
    const last100 = lines.slice(-100);

    return new Response(
      JSON.stringify({ logs: last100, total: lines.length }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
