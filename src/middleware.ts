import { defineMiddleware } from 'astro:middleware';
import { appConfig } from './lib/services/config.service.js';

export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);
  
  // Protegemos únicamente los endpoints administrativos que están bajo /api/sync/
  // por ejemplo /api/sync/status y /api/sync/publish.
  // El endpoint general /api/sync?type=check sigue siendo accesible para usuarios comunes.
  if (url.pathname.startsWith('/api/sync/')) {
    if (appConfig.mode !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Acceso denegado: Se requiere modo administrador' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  }
  
  return next();
});
