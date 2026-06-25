import { getAdaptedBuild } from '../src/lib/engine/itemEngine.ts';
import { initializeEngineData, initializeItemsData } from '../src/lib/engine/dataProvider.ts';
import { championsRepo } from '../src/lib/db/champions.repo.ts';

// Inicializar base de datos del motor cargando de SQLite
const enrichedChamps = championsRepo.getAllEnrichedChampions();
initializeEngineData(enrichedChamps);
await initializeItemsData();

// Simulamos una partida de Shaco Jungle
const buildData = getAdaptedBuild(35, [164, 120, 110, 53], [266, 60, 517, 51, 16], 'jungle');

console.log("Scored clusters count:", buildData?.scoredClusters?.length);
buildData?.scoredClusters?.forEach((c, idx) => {
  console.log(`\nCluster ${idx}: ${c.title} (Damage Type: ${c.damageType}, Score: ${c.score.toFixed(2)})`);
  console.log("Core items:", c.build?.items?.core?.map(item => item?.name));
  console.log("Runes selected:");
  console.log("  Primary Style:", c.build?.runes?.primaryStyle);
  console.log("  Secondary Style:", c.build?.runes?.secondaryStyle);
  console.log("  Selections:", c.build?.runes?.selections?.map(s => `${s?.name} (ID: ${s?.id})`));
});
