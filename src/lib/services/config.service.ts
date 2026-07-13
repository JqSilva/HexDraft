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
  github_token?: string;
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

export const appConfig = {
  mode: configData.mode,
  github_repo: configData.github_repo,
  github_token: configData.github_token,
  isAdmin: configData.mode === 'admin',
  configPath,
  dbVersionPath
};
