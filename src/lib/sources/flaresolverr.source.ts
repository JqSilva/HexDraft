import axios from 'axios';

const FLARESOLVERR_URL = 'http://127.0.0.1:8191/v1';

export async function createFlareSolverrSession(sessionId: string): Promise<string> {
  const response = await axios.post(FLARESOLVERR_URL, {
    cmd: 'sessions.create',
    session: sessionId
  }, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 70000
  });

  if (response.data?.status !== 'ok') {
    throw new Error(`FlareSolverr no pudo crear la sesión: ${response.data?.status || 'desconocido'}`);
  }

  return response.data.session || sessionId;
}

export async function destroyFlareSolverrSession(sessionId: string): Promise<void> {
  try {
    await axios.post(FLARESOLVERR_URL, {
      cmd: 'sessions.destroy',
      session: sessionId
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });
  } catch {
    // La sesión puede haber expirado o FlareSolverr puede haberse detenido.
  }
}

export function extractJsonFromHtml(htmlOrJson: string | any): any {
  if (typeof htmlOrJson === 'object') return htmlOrJson;
  try {
    return JSON.parse(htmlOrJson);
  } catch {
    const preMatch = htmlOrJson.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
    if (preMatch?.[1]) return JSON.parse(preMatch[1].trim());
    const bodyMatch = htmlOrJson.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch?.[1]) {
      return JSON.parse(bodyMatch[1].replace(/<[^>]*>/g, '').trim());
    }
    throw new Error('No se pudo extraer JSON de la respuesta renderizada.');
  }
}

export async function fetchWithFlareSolverr(url: string, sessionId?: string): Promise<any> {
  const response = await axios.post(FLARESOLVERR_URL, {
    cmd: 'request.get',
    url,
    maxTimeout: 60000,
    ...(sessionId ? { session: sessionId } : {})
  }, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 70000
  });

  if (response.data?.status === 'ok') return response.data.solution.response;
  throw new Error(`FlareSolverr falló con estado: ${response.data?.status || 'desconocido'}`);
}
