import type { APIRoute } from 'astro';
import { appConfig } from '../../../lib/services/config.service.js';

export const GET: APIRoute = async () => {
  return new Response(
    JSON.stringify({
      mode: appConfig.mode,
      github_repo: appConfig.github_repo
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    }
  );
};
