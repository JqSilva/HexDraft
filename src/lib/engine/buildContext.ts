import { ENRICHED_DB, ITEMS_DB } from './core/dataProvider.js';
import { getRoleProbability, type DraftContext } from './draftContext.js';
import type { EnrichedChampion } from './core/types.js';
import { scoreRunePage } from './recommendationScoring.js';

// Unique item families: alternatives within a family are not cumulative purchases.
const EXCLUSIVE_GROUPS = [[3035,3036,3033,6694],[3135,3137],[3053,3155,3156,6673],[3003,3040,3004,3042,3119,3121]];
export function canAddItem(id: number, existing: number[]): boolean {
  return id > 0 && !existing.includes(id) && !EXCLUSIVE_GROUPS.some(group => group.includes(id) && existing.some(other => group.includes(other)));
}
export function cleanInventory(ids: number[], maxItems=5): number[] {
  const result: number[]=[];
  for(const id of ids.map(Number)) if(result.length<maxItems && canAddItem(id,result)) result.push(id);
  return result;
}
export interface ItemThreatContext {
  enemyADCount: number; enemyAPCount: number; enemyTankCount: number;
  enemyCCCount: number; enemyHealerCount: number;
  physicalShare?: number; magicShare?: number; reducibleCCCount?: number;
}
export function itemContextFit(id: number, context: ItemThreatContext): number {
  const cats=ITEMS_DB[id]?.categories || [];
  let fit=50;
  const physical=context.physicalShare ?? context.enemyADCount/Math.max(1,context.enemyADCount+context.enemyAPCount);
  const magic=context.magicShare ?? context.enemyAPCount/Math.max(1,context.enemyADCount+context.enemyAPCount);
  if(cats.includes('GivesArmor') || cats.includes('Armor')) fit+=Math.max(-8,(physical-0.45)*30);
  if(cats.includes('GivesMagicResist') || cats.includes('SpellBlock')) fit+=Math.max(-8,(magic-0.45)*30);
  if([3033,3165,3075,6609,3011,3123].includes(id)) fit+=Math.min(12,context.enemyHealerCount*6);
  if([3036,3033,6694,3071,3135,3137].includes(id)) fit+=Math.min(14,context.enemyTankCount*7);
  if(cats.includes('Tenacity')) fit+=Math.min(8,(context.reducibleCCCount || 0)*3);
  return Math.max(0,Math.min(100,fit));
}
export interface RuneContext extends DraftContext { enemies?: string[]; }
export function scoreContextualRunePage(page: { selections:number[]; games?:number;pickrate?:number;winrate?:number }, core: number[], champion?: EnrichedChampion, context: RuneContext = {}): {score:number; reasons:string[]} {
  const base=scoreRunePage(page);let fit=0;const reasons:string[]=[];
  const enemies=(context.enemies || []).map(name=>ENRICHED_DB[name]).filter(Boolean);
  let poke=0,burst=0;
  for(const enemy of enemies){
    const probability=champion ? getRoleProbability(enemy,champion.lane,context.enemyRoles) : 0;
    if(enemy.tags?.includes('Poke') || enemy.tacticRole==='poke') poke+=probability;
    if(enemy.tacticRole==='burst' || enemy.tacticRole==='dive') burst+=probability;
  }
  if(page.selections.includes(8444) && poke>=0.45){fit+=6*Math.min(1,poke);reasons.push('Segundo aire: respuesta al desgaste del rival de línea probable');}
  if(page.selections.includes(8473) && burst>=0.45){fit+=6*Math.min(1,burst);reasons.push('Revestimiento de huesos: respuesta a intercambios de ráfaga');}
  if(core.some(id=>[3115,3124,3153].includes(id)) && [8005,8008,8010,9923].includes(page.selections[0])){fit+=3;reasons.push('Página observada compatible con ataques repetidos del core');}
  // Context is a modest tie-breaker between observed pages, not invented joint statistics.
  return {score:Math.min(100,base.score+fit*Math.max(0.2,base.confidence)),reasons};
}
export function reducibleControlCount(enemies: string[]): number {
  return enemies.map(name=>ENRICHED_DB[name]).filter(c=>c?.tags?.some(t=>['Stun','Root','Snare','Charm','Fear','Taunt','Silence'].includes(t))).length;
}
