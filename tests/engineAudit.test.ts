import assert from 'node:assert/strict';
import { scoreEvidence100 } from '../src/lib/engine/recommendationScoring.js';
import { getProcessedRecommendations, calculateScore } from '../src/lib/engine/picks/index.js';
import { initializeEngineData, initializeItemsData } from '../src/lib/engine/core/dataProvider.js';
import { detectEnemyArchetype } from '../src/lib/engine/picks/compositionAnalyzer.js';
import { selectRunesForCluster, selectBootsForCluster, isItemCoherentWithCluster, scoreClusterInContext, getAdaptedBuild, getFallbackStaticBuild, selectSummonersForCluster, selectSupportItemEvolution, classifyItem, selectCompositionContinuation } from '../src/lib/engine/itemEngine.js';
import { isValidRunePage, chooseSecondaryPair, normalizeShards } from '../src/lib/engine/rune-validation.js';
import { itemContextFit } from '../src/lib/engine/buildContext.js';
import assets from '../src/lib/data/assets-map.json' with {type:'json'};
import { NAME_TO_ID, getIdFromName, getNameFromId } from '../src/lib/engine/core/constants.js';
const champ = (id:number,name:string,extra:any={}) => ({id,name,lane:'MIDDLE',tags:[],class:'Mage',tacticRole:'teamfight',meta:{winRate:50,tier:20},teamNeeds:[],teamProvides:[],...extra} as any);
const ap:any={pivotItem:3089,representativeCore:[3089,3157,3135],totalPickrate:10,weightedWinrate:52,games:2000,damageType:'AP'};
// Asset hydration must not reach LCU, SQLite or the background scheduler in unit tests.
(globalThis as any).window = {};
globalThis.fetch = async () => new Response(null, { status: 503 });
let failures=0;
function test(name:string,fn:()=>void){try{fn();console.log('PASS',name);}catch(e){failures++;console.error('FAIL',name,(e as Error).message);}}
initializeEngineData([champ(103,'Ahri'),champ(84,'Akali'),champ(22,'Ashe')]);
test('1% de pickrate no se convierte en 100%',()=>{assert(scoreEvidence100({pickrate:2,winrate:52,games:2000}).score>scoreEvidence100({pickrate:1,winrate:52,games:2000}).score)});
test('Naafiri y Nilah conservan IDs distintos',()=>{assert.notEqual(NAME_TO_ID.Naafiri,NAME_TO_ID.Nilah);assert.equal(NAME_TO_ID.Naafiri,950)});
test('El catálogo sincronizado registra campeones nuevos',()=>{initializeEngineData([champ(800,'Mel')]);assert.equal(getIdFromName('Mel'),800);assert.equal(getNameFromId(800),'Mel')});
test('El counter directo confirmado conserva prioridad aunque falte meta',()=>{
  const target:any = champ(7001,'Target',{buildData:{special_notes:{statsData:{header:{}}}},counters:[{name:'Counter',lane:'MIDDLE',dominanceScore:-3,count:4000}]});
  const enemy:any = champ(7002,'Counter',{lanesPickrate:{MIDDLE:100}});
  initializeEngineData([target,enemy]);
  const confirmed = calculateScore(target,[],['Counter'],[],{enemyRoles:{7002:'MIDDLE'}});
  const probable = calculateScore(target,[],['Counter'],[],{});
  assert(confirmed.score < probable.score,'Un counter confirmado baja más el pick que un rival sólo probable');
  assert(confirmed.reasons.some(reason=>reason.includes('Matchup directo confirmado')),'El ranking explica el matchup directo confirmado');
});
test('Mismo draft produce exactamente mismo ranking',()=>{assert.deepEqual(getProcessedRecommendations([],[]),getProcessedRecommendations([],[]))});
test('El pick propio no cuenta como aliado al reemplazarlo',()=>{assert.deepEqual(getProcessedRecommendations([103,22],[],[],'MIDDLE',103),getProcessedRecommendations([22],[],[],'MIDDLE'))});
test('Dos campeones de poke se reconocen como poke',()=>{assert.equal(detectEnemyArchetype([champ(1,'a',{tags:['Poke'],tacticRole:'poke'}),champ(2,'b',{tags:['Poke'],tacticRole:'poke'})]),'poke')});
test('Tener CC no equivale a poder iniciar',()=>{assert.equal(detectEnemyArchetype([champ(1,'a',{hasHardCC:true,tacticRole:'peel'}),champ(2,'b',{hasHardCC:true,tacticRole:'utility'})]),'mixed')});
test('Un protector aliado cubre la necesidad de peel del carry',()=>{initializeEngineData([champ(22,'Ashe',{teamNeeds:['peel']}),champ(201,'Braum',{teamProvides:['peel'],tacticRole:'peel'})]);assert(!calculateScore(champ(103,'Ahri',{tacticRole:'burst'}),[],['Ashe','Braum']).reasons.some(r=>r.includes('falta de peel')))});
test('Cometa con evidencia no se descarta por build AD',()=>{const page=[8229,8226,8210,8237,8304,8347];const r=selectRunesForCluster({pages:[{primaryStyleId:8200,subStyleId:8300,selections:page,shards:[5008,5008,5001],games:2000,winrate:52}]},{...ap,damageType:'AD'});assert.deepEqual(r.selections,page)});
test('No permite keystone en el árbol secundario',()=>{assert(!isValidRunePage([8112,8139,8140,8106,8229,8210],8100,8200,assets.runeToStyle));assert.equal(chooseSecondaryPair([{Id:8229},{Id:8210}],()=>1),null)});
test('Botas de armadura disponibles para AP contra AD',()=>{initializeEngineData([champ(22,'Ashe',{combat:{damageComposition:{physical:90,magic:10}}}),champ(104,'Graves',{combat:{damageComposition:{physical:90,magic:10}}}),champ(238,'Zed',{combat:{damageComposition:{physical:90,magic:10}}})]);assert.equal(selectBootsForCluster([{itemId:3047,pickrate:50,winrate:52},{itemId:3020,pickrate:5,winrate:50}],ap,['Ashe','Graves','Zed']),3047)});
test('AD combatiente puede usar Cuchilla Negra y Sterak',()=>{assert(isItemCoherentWithCluster(3071,'AD'));assert(isItemCoherentWithCluster(3053,'AD'))});
test('AP sin antiheal no recibe bono contra curadores',()=>{initializeEngineData([champ(16,'Soraka',{hasSustain:true})]);assert.equal(scoreClusterInContext({...ap},[],['Soraka'],{}),scoreClusterInContext({...ap},[],[],{}))});
test('El contexto no puede borrar una build meta por una sola heurística',()=>{const enemies=[champ(9101,'TankA',{class:'Tank',isFrontline:true}),champ(9102,'TankB',{class:'Tank',isFrontline:true}),champ(9103,'TankC',{class:'Tank',isFrontline:true}),champ(9104,'TankD',{class:'Tank',isFrontline:true})];initializeEngineData(enemies);const base=scoreClusterInContext({...ap,totalPickrate:50,games:10000},[],[],{});const contextual=scoreClusterInContext({...ap,totalPickrate:50,games:10000},[],enemies.map(e=>e.name),{});assert(contextual>=base-8.01,'La adaptación contextual queda acotada a un desplazamiento razonable')});


test('Página sin datos sigue siendo legal y no contiene ceros',()=>{const r=selectRunesForCluster({},ap);assert(isValidRunePage(r.selections,r.primaryStyleId,r.subStyleId,assets.runeToStyle));assert.deepEqual(r.shards,[5008,5008,5001])});
test('Fragmentos retirados o en ranura incorrecta se reparan',()=>{assert.deepEqual(normalizeShards([5005,5002,5003]),[5005,5008,5001]);assert.deepEqual(normalizeShards([5005,5010,5013]),[5005,5010,5013])});
test('Jungla siempre conserva Smite incluso sin estadísticas',()=>{assert(selectSummonersForCluster([],'jng').includes(11));assert(selectSummonersForCluster([{summonerId1:4,summonerId2:12,pickrate:90,winrate:55}],'JUNGLE').includes(11))});
const runePage={primaryStyleId:8100,subStyleId:8200,selections:[8112,8139,8140,8106,8226,8210],shards:[5005,5008,5001]};
test('Fallback AP conserva el fragmento de ataque observado',()=>{const r=getFallbackStaticBuild(champ(103,'Ahri',{damageType:'AP',buildData:{runes:runePage,items:{core:[3089],boots:3020},summoners:[4,12]}}),'mid');assert.equal(r.build.runes.shards[0].id,5005)});
test('Fallback soporte compra Atlas en vez del objeto retirado',()=>{const r=getFallbackStaticBuild(champ(103,'Ahri',{damageType:'AP',buildData:{runes:runePage,items:{core:[3089],boots:3020},summoners:[4,14]}}),'support');assert.deepEqual(r.build.items.starter.map((x:any)=>x.id),[3865,2003,2003])});
test('Un soporte AD de frontline prioriza engage sobre daño',()=>{initializeEngineData([champ(78,'Poppy',{damageType:'AD',class:'Tank',isFrontline:true,hasHardCC:true,tacticRole:'engage'})]);assert.equal(selectSupportItemEvolution('Poppy','support')?.itemId,3876)});
test('Un soporte AD frágil conserva una evolución ofensiva',()=>{initializeEngineData([champ(555,'Pyke',{damageType:'AD',class:'Assassin',isFrontline:false,tacticRole:'burst'})]);assert.equal(selectSupportItemEvolution('Pyke','support')?.itemId,3877)});
test('Categorías Data Dragon reconocen armadura y vida como defensa',()=>{initializeItemsData({3143:{id:3143,categories:['Armor','Health'],gold:2700}});assert.equal(classifyItem(3143),'defensive')});
test('Hullbreaker no se considera antiheal',()=>{initializeItemsData({3181:{id:3181,categories:['Health'],gold:3000},6609:{id:6609,categories:['AntiHeal'],gold:2500}});const context={enemyADCount:0,enemyAPCount:0,enemyTankCount:0,enemyCCCount:0,enemyHealerCount:2};assert.equal(itemContextFit(3181,context),50);assert(itemContextFit(6609,context)>50)});
test('La ruta principal prioriza respuesta a la composición',()=>{initializeItemsData({3089:{id:3089,categories:['AbilityPower'],gold:3000},3100:{id:3100,categories:['AbilityPower'],gold:3000},3165:{id:3165,categories:['AbilityPower','AntiHeal'],gold:3000}});const route=selectCompositionContinuation({neutral:[3089,3100],snowball:[3165],behind:[]},[3118,4645],3020,{enemyADCount:0,enemyAPCount:0,enemyTankCount:0,enemyCCCount:0,enemyHealerCount:2});assert.equal(route[0],3165)});
test('Las botas de la tripleta no se duplican dentro del core',()=>{initializeEngineData([champ(103,'Ahri',{damageType:'AP',buildData:{runes:runePage,statsData:{coreBuilds:{coreItem3:[{itemIds:[3089,3020,3157],pickrate:50,winrate:52,games:2000}]},boots:[{itemId:3020,pickrate:100,winrate:52}]}}})]);const r=getAdaptedBuild(103,[],[],'mid');assert(r.scoredClusters.length>0);assert(r.build.items.core.length===3);assert(r.build.items.buildOrder.length===5);for(const c of r.scoredClusters){assert(!c.build.items.core.some((x:any)=>x.id===3020))}});
test('Build estática del rol pedido tiene prioridad sobre estadísticas de otro rol',()=>{const mid={is_default:true,lane:'MIDDLE',runes:runePage,items:{core:[3089],boots:3020},summoners:[4,12],special_notes:{statsData:{coreBuilds:{coreItem3:[{itemIds:[3089,3020,3157],pickrate:50,winrate:52,games:2000}]}}}};const support={is_default:true,lane:'UTILITY',runes:{...runePage,shards:[5007,5008,5001]},items:{core:[6617],boots:3158},summoners:[4,14]};initializeEngineData([champ(103,'Ahri',{damageType:'AP',buildData:mid,builds:[mid,support]})]);const r=getAdaptedBuild(103,[],[],'support');assert.equal(r.build.runes.shards[0].id,5007);assert.equal(r.scoredClusters.length,0)});
if(failures)process.exitCode=1;
