// src/lib/scripts/test-engine.ts
import { db } from '../db/sqlite.js';
import { championsRepo } from '../db/champions.repo.js';
import { initializeEngineData, initializeItemsData } from '../engine/dataProvider.js';
import { getProcessedRecommendations, getProcessedBans, getSingleChampionBuild } from '../engine/engine.js';
import { analyzeComposition } from '../engine/compositionAnalyzer.js';
import { NAME_TO_ID } from '../engine/constants.js';

async function runTests() {
  console.log("🧪 [TEST] Iniciando validación del Motor de Recomendación y Adaptación...");

  // 1. Inicializar datos del motor
  console.log("🔌 Obteniendo datos enriquecidos de campeones desde SQLite...");
  const enrichedChamps = championsRepo.getAllEnrichedChampions();
  initializeEngineData(enrichedChamps);

  console.log("🔌 Obteniendo items desde SQLite...");
  const itemsRows = db.prepare('SELECT * FROM items').all() as any[];
  const itemsMap: Record<number, any> = {};
  itemsRows.forEach(r => {
    itemsMap[r.id] = {
      id: r.id,
      name: r.name,
      gold: r.gold,
      epicness: r.epicness,
      categories: JSON.parse(r.categories || '[]'),
      iconPath: r.icon_path
    };
  });
  initializeItemsData(itemsMap);

  // 2. Definir escenarios de prueba
  console.log("\n--- ESCENARIO 1: Nuestra comp carece de Frontline y CC vs Comp enemiga con mucha curación (Aatrox, Soraka) ---");
  const alliedPicks = ["Ashe", "Lulu", "Kassadin"]; // ADC sin movilidad, Support enchanter, Mid scaling
  const enemyPicks = ["Aatrox", "Soraka", "Katarina"]; // Top Juggernaut con sustain, Support healer, Mid assassin

  const alliedIds = alliedPicks.map(name => NAME_TO_ID[name]).filter(Boolean) as number[];
  const enemyIds = enemyPicks.map(name => NAME_TO_ID[name]).filter(Boolean) as number[];
  const bannedIds: number[] = [];

  // Analizar composición aliada
  const allyComp = analyzeComposition(alliedPicks);
  console.log("📊 Composición Aliada:");
  console.log(`  - Gaps identificados: ${allyComp.gaps.join(', ')}`);
  console.log(`  - Win Condition: ${allyComp.winCondition}`);
  console.log(`  - Balance de daño: AD ${allyComp.damageProfile.physicalPct}% / AP ${allyComp.damageProfile.magicPct}%`);

  // Obtener recomendaciones para la Jungla (deberían priorizar CC/Frontline debido a los gaps)
  console.log("\n🔍 Buscando recomendaciones para rol: JUNGLE...");
  const recs = getProcessedRecommendations(alliedIds, enemyIds, bannedIds, "jungle");
  console.log("Top 5 Recomendaciones de Selección:");
  recs.slice(0, 5).forEach((rec, idx) => {
    console.log(`  ${idx + 1}. ${rec.name} (Score: ${rec.score})`);
    console.log(`     Razones: ${rec.reasons.slice(0, 2).join(' | ')}`);
  });

  // Validar que se sugiera al menos un iniciador/frontline
  const hasEngageOrTank = recs.slice(0, 5).some(r => r.reasons.some(reason => reason.includes("Frontline") || reason.includes("táctico")));
  if (hasEngageOrTank) {
    console.log("✅ ÉXITO: El motor detectó la falta de Frontline/CC y recomendó picks acordes.");
  } else {
    console.log("❌ FALLO: El motor no recomendó picks protectores o frontline.");
  }

  // 3. Recomendación de Bans
  console.log("\n🔍 Calculando recomendaciones de Baneo...");
  const bans = getProcessedBans(recs, null, "jungle", alliedPicks, enemyPicks, [], Object.keys(NAME_TO_ID));
  console.log("Top 5 Recomendaciones de Baneo:");
  bans.slice(0, 5).forEach((b, idx) => {
    console.log(`  ${idx + 1}. ${b.name} (Ban Score: ${b.score})`);
    if ((b as any).reasons) {
      console.log(`     Razones: ${(b as any).reasons.join(' | ')}`);
    }
  });

  // 4. Adaptación de Builds (Anti-curación y botas situacionales)
  console.log("\n--- ESCENARIO 2: Adaptación de Items y Botas (Nidalee vs Aatrox/Soraka/Katarina) ---");
  const nidaleeId = NAME_TO_ID["Nidalee"];
  if (nidaleeId) {
    const adaptedBuild = getSingleChampionBuild(nidaleeId, alliedIds, enemyIds, "jungle");
    console.log(`Campeón: ${adaptedBuild.name}`);
    console.log(`¿Está la build adaptada?: ${adaptedBuild.isAdapted}`);
    console.log(`Botas recomendadas: ${adaptedBuild.build.items.boots.name} (${adaptedBuild.build.items.boots.id})`);
    console.log(`  - Razón botas: ${adaptedBuild.bootsSelection?.reason}`);
    
    console.log("Swaps Core Items recomendados:");
    if (adaptedBuild.coreItemSwaps && adaptedBuild.coreItemSwaps.length > 0) {
      adaptedBuild.coreItemSwaps.forEach((swap: any) => {
        console.log(`  - Reemplazar [${swap.replaceItem.name}] por [${swap.withItem.name}]`);
        console.log(`    Prioridad: ${swap.priority.toUpperCase()}`);
        console.log(`    Explicación: ${swap.reason}`);
      });
      // Validar si recomendó heridas graves (Thornmail/Cota de Espinas/antiheal/Morellonomicon)
      const hasGrievousSwap = adaptedBuild.coreItemSwaps.some((s: any) => s.reason.toLowerCase().includes("heridas graves") || s.reason.toLowerCase().includes("curación") || s.reason.toLowerCase().includes("fuentes de curación"));
      if (hasGrievousSwap) {
        console.log("✅ ÉXITO: El motor de items recomendó Heridas Graves dinámicamente frente al sustain enemigo.");
      } else {
        console.log("❌ FALLO: No se recomendó swap de anti-curación.");
      }
    } else {
      console.log("  - Ningún reemplazo sugerido.");
      console.log("❌ FALLO: No se recomendó swap de anti-curación.");
    }
  } else {
    console.log("⚠️ Advertencia: No se encontró Nidalee en NAME_TO_ID.");
  }

  // 5. ESCENARIO 3: Soporte (Lulu)
  console.log("\n--- ESCENARIO 3: Adaptación de Items y Botas para Soporte (Lulu vs Naut/Kata/Aatrox/Soraka) ---");
  const luluId = NAME_TO_ID["Lulu"];
  if (luluId) {
    // Escenario con mucho CC (Nautilus) y AP/Sustain (Soraka/Aatrox/Katarina)
    const alliedIdsLulu = ["Ashe", "Kassadin", "Sejuani"].map(name => NAME_TO_ID[name]).filter(Boolean) as number[];
    const enemyIdsLulu = ["Aatrox", "Soraka", "Katarina", "Nautilus", "Ezreal"].map(name => NAME_TO_ID[name]).filter(Boolean) as number[];

    const luluBuild = getSingleChampionBuild(luluId, alliedIdsLulu, enemyIdsLulu, "utility");
    console.log(`Soporte: ${luluBuild.name}`);
    console.log(`¿Tiene item de soporte inicial en Starter?:`);
    const hasSuppItem = luluBuild.build.items.starter.some((item: any) => 
      item.name.toLowerCase().includes("atlas") || 
      item.name.toLowerCase().includes("support") ||
      item.name.toLowerCase().includes("recompensa") ||
      item.name.toLowerCase().includes("brújula") ||
      item.name.toLowerCase().includes("reliquia") ||
      item.id === 3858 || item.id === 3862 || item.id === 3865
    );
    if (hasSuppItem) {
      const suppItemName = luluBuild.build.items.starter.find((i: any) => i.id === 3858 || i.id === 3862 || i.id === 3865 || i.name.toLowerCase().includes("reliquia"))?.name;
      console.log(`  ✅ SÍ: Contiene el item inicial de soporte [${suppItemName || 'Atlas Mundial / Escudo Reliquia'}]`);
    } else {
      console.log("  ❌ NO: No se detectó item de soporte en iniciales.");
    }

    console.log(`Botas recomendadas para Soporte: ${luluBuild.build.items.boots.name} (${luluBuild.build.items.boots.id})`);
    console.log(`  - Razón botas: ${luluBuild.bootsSelection?.reason}`);

    // Verificar si se recomienda Mercurio por el CC pesado de Nautilus y el AP del enemigo, o Jonia
    if (luluBuild.build.items.boots.id === 3111) {
      console.log("  ✅ SÍ: Seleccionó Botas de Mercurio (3111) por el CC y AP enemigo.");
    } else {
      console.log(`  ℹ️ INFO: Seleccionó ${luluBuild.build.items.boots.name} (${luluBuild.build.items.boots.id}) por clase/configuración.`);
    }

    console.log("Swaps Core Items recomendados para Soporte:");
    if (luluBuild.coreItemSwaps && luluBuild.coreItemSwaps.length > 0) {
      luluBuild.coreItemSwaps.forEach((swap: any) => {
        console.log(`  - Reemplazar [${swap.replaceItem.name}] por [${swap.withItem.name}]`);
        console.log(`    Prioridad: ${swap.priority.toUpperCase()}`);
        console.log(`    Explicación: ${swap.reason}`);
      });
    } else {
      console.log("  - Ningún reemplazo sugerido.");
    }

    console.log("Evolución de Soporte recomendada:");
    if (luluBuild.supportEvolution) {
      console.log(`  - Item: ${luluBuild.supportEvolution.item?.name} (${luluBuild.supportEvolution.item?.id})`);
      console.log(`    Razón: ${luluBuild.supportEvolution.reason}`);
      if ([3869, 3870].includes(luluBuild.supportEvolution.item?.id)) {
        console.log("  ✅ SÍ: Se recomendó una evolución de soporte adecuada (utilidad / encantadora).");
      } else {
        console.log(`  ❌ FALLO: Se recomendó una evolución inesperada para Lulu (ID: ${luluBuild.supportEvolution.item?.id}).`);
      }
    } else {
      console.log("  ❌ FALLO: No se recomendó evolución de soporte.");
    }
  } else {
    console.log("⚠️ Advertencia: No se encontró Lulu en NAME_TO_ID.");
  }

  // 5. Escenario 4: Capa 2.5 y Doble Análisis (Allies: Karma, Ezreal; Enemies: Jayce, Ryze, Ziggs)
  console.log("\n--- ESCENARIO 4: Capa 2.5 y Doble Análisis de Arquetipos (Karma+Ezreal vs Jayce+Ryze+Ziggs) ---");
  const compAllies = ["Karma", "Ezreal"];
  const compEnemies = ["Jayce", "Ryze", "Ziggs"];
  const compAlliedIds = compAllies.map(name => NAME_TO_ID[name]).filter(Boolean) as number[];
  const compEnemyIds = compEnemies.map(name => NAME_TO_ID[name]).filter(Boolean) as number[];

  console.log("\n🔍 Buscando recomendaciones para rol: MIDDLE...");
  const compRecs = getProcessedRecommendations(compAlliedIds, compEnemyIds, [], "middle");
  console.log("Top 5 Recomendaciones de Selección en MID:");
  compRecs.slice(0, 5).forEach((rec, idx) => {
    console.log(`  ${idx + 1}. ${rec.name} (Score: ${rec.score})`);
    console.log(`     Razones: ${rec.reasons.filter(r => r.includes("Respuesta:")).join(' | ') || "Ninguna razón de Capa 2.5"}`);
  });

  const aniviaRec = compRecs.find(r => r.name === "Anivia");
  if (aniviaRec) {
    console.log(`\nAnivia - Score: ${aniviaRec.score}`);
    console.log(`Razones Anivia: ${aniviaRec.reasons.join(' | ')}`);
    const hasIntersectionBonus = aniviaRec.reasons.some(r => r.includes("Respuesta:") && r.includes("SIEGE"));
    if (hasIntersectionBonus) {
      console.log("✅ ÉXITO: Se detectó el bonus de intersección de la Capa 2.5 para Anivia.");
    } else {
      console.log("❌ FALLO: No se aplicó el bonus de intersección de la Capa 2.5 para Anivia.");
    }
  } else {
    console.log("⚠️ Advertencia: No se encontró Anivia en las recomendaciones.");
  }

  console.log("\n🧪 [TEST] Finalizado.");
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Error en pruebas:", err);
    process.exit(1);
  });
