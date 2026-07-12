import { spawn, exec } from 'child_process';
import fs from 'fs';
import path from 'path';

const url = 'http://localhost:4321/dashboard';

// Buscar un navegador compatible en Windows para abrir en modo app
function getBrowserCommand() {
  if (process.platform !== 'win32') {
    return null;
  }
  
  // 1. Intentar Brave
  const brave = "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe";
  if (fs.existsSync(brave)) {
    return `"${brave}" --app=${url}`;
  }
  
  // 2. Intentar Chrome
  const chromePaths = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
  ];
  for (const p of chromePaths) {
    if (fs.existsSync(p)) {
      return `"${p}" --app=${url}`;
    }
  }
  
  // 3. Intentar Edge
  const edge = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
  if (fs.existsSync(edge)) {
    return `"${edge}" --app=${url}`;
  }
  
  return null;
}

// Función robusta para matar procesos y sus hijos (especialmente en Windows)
function killProcess(child) {
  if (!child) return;
  if (process.platform === 'win32') {
    exec(`taskkill /pid ${child.pid} /T /F`, (err) => {
      if (err) {
        // Fallback si taskkill falla
        child.kill('SIGKILL');
      }
    });
  } else {
    child.kill('SIGINT');
  }
}

console.log('Iniciando servidor de desarrollo de Astro...');
const devServer = spawn('npm', ['run', 'dev'], { shell: true, stdio: 'inherit' });

// Manejar terminación del proceso principal
process.on('SIGINT', () => {
  console.log('\nDeteniendo servidor de desarrollo...');
  killProcess(devServer);
  process.exit(0);
});

process.on('SIGTERM', () => {
  killProcess(devServer);
  process.exit(0);
});

// Esperar 3 segundos para que Astro esté listo antes de abrir el navegador
setTimeout(() => {
  const cmd = getBrowserCommand();
  
  if (cmd) {
    console.log(`Abriendo navegador en modo app: ${cmd}`);
    const browserProcess = exec(cmd);
    
    // Al cerrar la ventana del navegador, apagar el servidor de desarrollo
    browserProcess.on('exit', () => {
      console.log('Ventana del navegador cerrada. Deteniendo servidor de desarrollo...');
      killProcess(devServer);
      process.exit(0);
    });
  } else {
    console.log('No se encontró Brave, Chrome o Edge. Abriendo en navegador predeterminado...');
    const startCmd = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
    exec(`${startCmd} ${url}`);
  }
}, 3000);
