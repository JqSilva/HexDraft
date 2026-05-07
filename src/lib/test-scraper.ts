// test-scraper.ts
import { scrapeMetaTierList } from './scraper';

async function test() {
  console.log("🚀 Iniciando prueba de scraping...");
  
  const champions = await scrapeMetaTierList();
  
  if (champions.length === 0) {
    console.log("❌ No se obtuvieron campeones. Revisa la URL o los selectores.");
    return;
  }

  console.log(`✅ ¡Éxito! Se encontraron ${champions.length} campeones.`);
  
  // Mostramos los primeros 5 para verificar el formato
  console.log("--- Muestra de datos ---");
  console.table(champions.slice(0, 10)); 
}

test();