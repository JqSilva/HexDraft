// src/lib/metaManager.ts
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Esta es una forma más robusta de encontrar la raíz desde src/lib/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CACHE_PATH = path.resolve(__dirname, '../data/meta-cache.json');


const spikes__filename = fileURLToPath(import.meta.url);
const spikes__dirname = path.dirname(__filename);
const SPIKES_PATH = path.resolve(__dirname, '../data/power-spikes.json');

export function getStoredMeta() {
  try {
    console.log("🔍 Intentando leer meta en:", CACHE_PATH); // Esto saldrá en tu terminal
    if (!fs.existsSync(CACHE_PATH)) {
      console.error("❌ El archivo meta-cache.json NO existe en la ruta.");
      return null;
    }
    const rawData = fs.readFileSync(CACHE_PATH, 'utf-8');
    return JSON.parse(rawData);
  } catch (error) {
    console.error("❌ Error en getStoredMeta:", error);
    return null;
  }
}

export function getStoredSpikes() {
  try {
    console.log("🔍 Intentando leer spikes en:", SPIKES_PATH); // Esto saldrá en tu terminal
    if (!fs.existsSync(SPIKES_PATH)) {
      console.error("❌ El archivo power-spikes.json NO existe en la ruta.");
      return null;
    }
    const rawData = fs.readFileSync(SPIKES_PATH, 'utf-8');
    return JSON.parse(rawData);
  } catch (error) {
    console.error("❌ Error en getStoredSpikes:", error);
    return null;
  }
}