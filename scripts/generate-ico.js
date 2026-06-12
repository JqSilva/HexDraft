// scripts/generate-ico.js
import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.dirname(__dirname);

const SVG_PATH = path.join(PROJECT_ROOT, 'public', 'favicon.svg');
const ICO_PATH = path.join(PROJECT_ROOT, 'public', 'favicon.ico');
const SIZES = [16, 32, 48, 64, 128, 256];

function createIcoFromPngs(pngBuffers) {
  const numImages = pngBuffers.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  const dirSize = numImages * dirEntrySize;
  
  const outBuffer = Buffer.alloc(headerSize + dirSize);
  
  // Header: Reserved (0), Type (1 = ICO), Count
  outBuffer.writeUInt16LE(0, 0);
  outBuffer.writeUInt16LE(1, 2);
  outBuffer.writeUInt16LE(numImages, 4);
  
  let currentOffset = headerSize + dirSize;
  const dataBuffers = [];
  
  for (let i = 0; i < numImages; i++) {
    const { width, height, buffer } = pngBuffers[i];
    const dataSize = buffer.length;
    const entryOffset = headerSize + i * dirEntrySize;
    
    // Directory Entry
    outBuffer.writeUInt8(width >= 256 ? 0 : width, entryOffset + 0);
    outBuffer.writeUInt8(height >= 256 ? 0 : height, entryOffset + 1);
    outBuffer.writeUInt8(0, entryOffset + 2); // Color palette
    outBuffer.writeUInt8(0, entryOffset + 3); // Reserved
    outBuffer.writeUInt16LE(1, entryOffset + 4); // Color planes
    outBuffer.writeUInt16LE(32, entryOffset + 6); // Bits per pixel
    outBuffer.writeUInt32LE(dataSize, entryOffset + 8); // Data size
    outBuffer.writeUInt32LE(currentOffset, entryOffset + 12); // Data offset
    
    dataBuffers.push(buffer);
    currentOffset += dataSize;
  }
  
  return Buffer.concat([outBuffer, ...dataBuffers]);
}

async function main() {
  const targets = [
    {
      svg: SVG_PATH,
      ico: ICO_PATH
    },
    {
      svg: path.join(PROJECT_ROOT, 'public', 'app-icon.svg'),
      ico: path.join(PROJECT_ROOT, 'public', 'app-icon.ico')
    }
  ];

  console.log(`🎨 Iniciando conversión de SVGs a ICOs...`);
  console.log(`🚀 Iniciando Puppeteer en segundo plano...`);
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    for (const target of targets) {
      if (!fs.existsSync(target.svg)) {
        console.log(`⚠️ Advertencia: No se encontró el archivo SVG en ${target.svg}. Saltando...`);
        continue;
      }
      
      console.log(`Procesando: ${path.basename(target.svg)} -> ${path.basename(target.ico)}`);
      const svgContent = fs.readFileSync(target.svg, 'utf8');

      // Configurar contenido HTML con el SVG adaptado para ocupar el viewport completo
      await page.setContent(`
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body, html {
                margin: 0;
                padding: 0;
                width: 100%;
                height: 100%;
                background: transparent;
                overflow: hidden;
              }
              svg {
                width: 100%;
                height: 100%;
                display: block;
              }
            </style>
          </head>
          <body>
            ${svgContent}
          </body>
        </html>
      `);

      const pngBuffers = [];

      for (const size of SIZES) {
        console.log(`   📸 Renderizando resolución ${size}x${size}...`);
        await page.setViewport({
          width: size,
          height: size,
          deviceScaleFactor: 1
        });

        const buffer = await page.screenshot({
          type: 'png',
          omitBackground: true
        });
        
        pngBuffers.push({ width: size, height: size, buffer });
      }

      console.log(`   📦 Empaquetando PNGs en archivo ICO...`);
      const icoBuffer = createIcoFromPngs(pngBuffers);
      
      fs.writeFileSync(target.ico, icoBuffer);
      console.log(`   ✅ ¡Éxito! ${path.basename(target.ico)} creado con éxito (${icoBuffer.length} bytes)`);
    }

  } catch (error) {
    console.error(`❌ Ocurrió un error durante la generación del icono:`, error);
  } finally {
    await browser.close();
  }
}

main();
