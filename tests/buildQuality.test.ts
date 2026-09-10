import { detectBuildClusters, selectRunesForCluster } from '../src/lib/engine/itemEngine.js';
import { scoreContextualRunePage } from '../src/lib/engine/buildContext.js';
import { initializeEngineData } from '../src/lib/engine/core/dataProvider.js';
import { evidenceScore } from '../src/lib/engine/statisticalScoring.js';
import { chooseSecondaryPair, isValidRunePage } from '../src/lib/engine/rune-validation.js';
import assetsMap from '../src/lib/data/assets-map.json' with { type: 'json' };

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error('[FAIL] ' + message);
  console.log('[PASS] ' + message);
}

const runeToStyle = (assetsMap as any).runeToStyle || {};

// Una variante de 12 partidas al 100% no debe ganar a una build meta estable.
{
  const sparse = evidenceScore({ pickrate: 0.2, winrate: 100, games: 12 });
  const mature = evidenceScore({ pickrate: 12, winrate: 52, games: 1800 });
  assert(mature > sparse, 'El scoring prioriza evidencia madura sobre WR extremo con pocas partidas');
}

// El detector descarta variantes con muestras insuficientes cuando hay conteos.
{
  const clusters = detectBuildClusters({
    coreBuilds: {
      coreItem3: [
        { itemIds: [2503, 3020, 3100], pickrate: 0.2, winrate: 100, games: 12 },
        { itemIds: [3118, 3020, 4645], pickrate: 12, winrate: 52, games: 1800 }
      ]
    }
  });
  assert(clusters.length === 1, 'El detector elimina la variante de build con muestra insuficiente');
  assert(clusters[0].representativeCore[0] === 3118, 'El cluster ganador conserva la build estable');

// Cuando solo existe coreItem2, el tercer objeto debe salir del slot observado.
{
  const pairClusters = detectBuildClusters({
    coreBuilds: { coreItem2: [{ itemIds: [3118, 4645], pickrate: 35, winrate: 52, games: 4000 }] },
    items: { item3: [{ id: 3157, pickrate: 20, winrate: 55, games: 2000 }] }
  });
  assert(pairClusters[0].representativeCore.length === 3, 'El fallback de coreItem2 completa el tercer objeto');
  assert(pairClusters[0].representativeCore[2] === 3157, 'El tercer objeto proviene del slot observado');
}
}

// Las p�ginas completas se conservan y deben ser v�lidas por �rbol y por fila.
{
  const page = [8112, 8139, 8140, 8106, 8226, 8210];
  const selected = selectRunesForCluster({
    pages: [{
      primaryStyleId: 8100,
      subStyleId: 8200,
      selections: page,
      shards: [5005, 5008, 5001],
      winrate: 53.2,
      games: 12000
    }]
  }, {
    pivotItem: 3020,
    representativeCore: [3118, 3020, 4645],
    totalPickrate: 10,
    weightedWinrate: 52,
    games: 1800,
    damageType: 'AP'
  });
  assert(JSON.stringify(selected.selections) === JSON.stringify(page), 'El selector conserva una pagina completa coherente');
  assert(isValidRunePage(selected.selections, selected.primaryStyleId, selected.subStyleId, runeToStyle), 'La pagina seleccionada no repite filas ni arboles');
}

// Dos runas del mismo renglon no se pueden usar como secundaria.
{
  const pair = chooseSecondaryPair([
    { Id: 8304, pickrate: 9, winrate: 52 },
    { Id: 8321, pickrate: 8, winrate: 52 },
    { Id: 8352, pickrate: 4, winrate: 51 }
  ], evidenceScore);
  assert(Boolean(pair), 'Existe un par secundario valido');
  assert(pair ? pair.some(r => Number(r.Id) === 8352) : false, 'El par secundario evita dos runas de la misma fila');
}

initializeEngineData([{id:9001,name:'PokeEnemy',lane:'MIDDLE',tags:['Poke'],tacticRole:'poke',lanesPickrate:{MIDDLE:20,TOP:80}}] as any);
const runeContextPage = { selections: [8112,8139,8140,8444,8226,8210], pickrate: 10, winrate: 52, games: 1000 };
const runeChampion = { id: 9002, lane: 'MIDDLE' } as any;
const lowProbability = scoreContextualRunePage(runeContextPage, [3089], runeChampion, { enemies: ['PokeEnemy'] });
assert(!lowProbability.reasons.some(r => r.includes('Segundo aire')), 'Una posibilidad remota de poke no cambia las runas');
const assignedProbability = scoreContextualRunePage(runeContextPage, [3089], runeChampion, { enemies: ['PokeEnemy'], enemyRoles: { 9001: 'MIDDLE' } });
assert(assignedProbability.reasons.some(r => r.includes('Segundo aire')), 'Un rival confirmado de poke sí adapta las runas');
console.log('Pruebas de calidad de builds completadas.');
