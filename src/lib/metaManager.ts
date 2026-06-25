// src/lib/metaManager.ts
import fs from 'fs';
import path from 'path';

// Ruta compatible tanto para desarrollo como para producción (carpeta release)
const CACHE_PATH = path.resolve(process.cwd(), 'src/lib/data/meta-cache.json');

export function getStoredMeta() {
  try {
    console.log("Intentando leer meta en:", CACHE_PATH);
    if (!fs.existsSync(CACHE_PATH)) {
      console.error("El archivo meta-cache.json NO existe en la ruta.");
      return null;
    }
    const rawData = fs.readFileSync(CACHE_PATH, 'utf-8');
    return JSON.parse(rawData);
  } catch (error) {
    console.error("Error en getStoredMeta:", error);
    return null;
  }
}

export function saveMetaCache(data: any) {
  try {
    fs.writeFileSync(CACHE_PATH, JSON.stringify(data, null, 2), 'utf-8');
    console.log("meta-cache.json actualizado correctamente.");
  } catch (error) {
    console.error("Error al guardar meta-cache.json:", error);
  }
}