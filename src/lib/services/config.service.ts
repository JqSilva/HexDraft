import fs from 'node:fs';
import path from 'node:path';

const configDir = path.resolve(process.cwd(), 'data');
const configPath = path.join(configDir, 'config.json');
const dbVersionPath = path.join(configDir, 'db-version.json');

// Asegurar que el directorio de datos existe
if (!fs.existsSync(configDir)) {
  try {
    fs.mkdirSync(configDir, { recursive: true });
  } catch (e) {
    console.error('❌ Error creando directorio data/ de configuración:', e);
  }
}

// Inicializar db-version.json con versión 0 si no existe al arrancar
if (!fs.existsSync(dbVersionPath)) {
  try {
    fs.writeFileSync(
      dbVersionPath,
      JSON.stringify(
        {
          version: 0,
          patch: '-',
          lastUpdate: '-',
          checksum: '',
          size: 0
        },
        null,
        2
      ),
      'utf-8'
    );
  } catch (e) {
    console.error('❌ Error escribiendo db-version.json inicial:', e);
  }
}

interface AppConfig {
  mode: 'admin' | 'user';
  github_repo: string;
}

let configData: AppConfig;

if (!fs.existsSync(configPath)) {
  configData = {
    mode: 'user',
    github_repo: 'JqSilva/HexDraft-Releases'
  };
  try {
    fs.writeFileSync(configPath, JSON.stringify(configData, null, 2), 'utf-8');
  } catch (e) {
    console.error('❌ Error guardando config.json inicial:', e);
  }
} else {
  try {
    configData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch (e) {
    console.error('❌ Error parseando config.json, usando valores por defecto user:', e);
    configData = {
      mode: 'user',
      github_repo: 'JqSilva/HexDraft-Releases'
    };
  }
}

function getEnvToken(): string | undefined {
  try {
    const metaEnv = (import.meta as any).env;
    if (metaEnv?.GITHUB_TOKEN) return metaEnv.GITHUB_TOKEN;
    if (metaEnv?.GITHUB_LAUNCHER_TOKEN) return metaEnv.GITHUB_LAUNCHER_TOKEN;
  } catch {}

  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  if (process.env.GITHUB_LAUNCHER_TOKEN) return process.env.GITHUB_LAUNCHER_TOKEN;

  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('#') || !trimmed.includes('=')) continue;
        const [key, ...valParts] = trimmed.split('=');
        const k = key.trim();
        if (k === 'GITHUB_TOKEN' || k === 'GITHUB_LAUNCHER_TOKEN') {
          const val = valParts.join('=').trim().replace(/^["']|["']$/g, '');
          if (val) return val;
        }
      }
    }
  } catch (e) {
    console.error('❌ Error leyendo archivo .env:', e);
  }

  return undefined;
}

export const appConfig = {
  mode: configData.mode,
  github_repo: configData.github_repo,
  get github_token() {
    return getEnvToken();
  },
  isAdmin: configData.mode === 'admin',
  configPath,
  dbVersionPath
};
