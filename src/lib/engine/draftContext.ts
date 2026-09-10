import type { EnrichedChampion } from './core/types.js';
import { normalizeRole } from './core/constants.js';

export interface DraftContext {
  allyRoles?: Record<number, string>;
  enemyRoles?: Record<number, string>;
}
export interface DraftPlayerRole { championId: number; championPickIntent?: number; assignedPosition?: string; }
export function rolesFromPlayers(players: DraftPlayerRole[] = []): Record<number, string> {
  const result: Record<number, string> = {};
  for (const p of players) {
    const id = p.championId || p.championPickIntent;
    const role = normalizeRole(p.assignedPosition, 'UNKNOWN' as never);
    if (id && role !== ('UNKNOWN' as string)) result[id] = role;
  }
  return result;
}
export function getRoleProbability(champ: EnrichedChampion, lane: string, assigned: Record<number, string> = {}): number {
  const target = normalizeRole(lane);
  if (assigned[champ.id]) return normalizeRole(assigned[champ.id]) === target ? 1 : 0;
  const occupied = new Set(Object.entries(assigned).filter(([id]) => Number(id) !== champ.id).map(([, role]) => normalizeRole(role)));
  if (occupied.has(target)) return 0;
  const rates = champ.lanesPickrate || champ.lanes_pickrate || {};
  const candidates = Object.entries(rates).map(([role, value]) => [normalizeRole(role), Math.max(0, Number(value) || 0)] as const)
    .filter(([role]) => !occupied.has(role));
  const total = candidates.reduce((sum, [, rate]) => sum + rate, 0);
  if (total > 0) return candidates.filter(([role]) => role === target).reduce((sum, [, rate]) => sum + rate, 0) / total;
  const lanes = [...new Set([champ.lane, ...(champ.playLanes || champ.play_lanes || [])].map(l => normalizeRole(l)))].filter(l => !occupied.has(l));
  return lanes.includes(target) ? 1 / lanes.length : 0;
}
export function getRoleBuild(champ: EnrichedChampion, lane: string): any {
  const target = normalizeRole(lane);
  const candidates = (champ.builds || []).filter(b => normalizeRole(b.lane, 'UNKNOWN' as never) === target);
  const patchNumber = (patch: string) => (patch || '').split('.').reduce((n, part) => n * 1000 + (Number(part) || 0), 0);
  candidates.sort((a, b) => patchNumber(b.patch) - patchNumber(a.patch) || Number(b.is_default) - Number(a.is_default));
  if (candidates.length) return candidates[0];
  return normalizeRole(champ.buildData?.lane || champ.lane) === target ? champ.buildData : undefined;
}
export function damageProfile(champ: EnrichedChampion, role = champ.lane): { physical: number; magic: number; weight: number } {
  const stats = getRoleBuild(champ, role)?.special_notes?.statsData || champ.buildData?.statsData;
  const raw = stats?.header?.damage || champ.combat?.damageComposition;
  const physical = Math.max(0, Number(raw?.physical) || (champ.damageType === 'AD' ? 80 : 20));
  const magic = Math.max(0, Number(raw?.magic) || (champ.damageType === 'AP' ? 80 : 20));
  const total = physical + magic || 1;
  const weight = normalizeRole(role) === 'UTILITY' ? (champ.class === 'Mage' ? 0.45 : 0.2) : champ.class === 'Tank' ? 0.55 : champ.isHypercarry ? 1.25 : 1;
  return {physical: physical / total, magic: magic / total, weight};
}
export function teamDamage(champs: EnrichedChampion[], roles: Record<number, string> = {}): { physical: number; magic: number } {
  let physical=0, magic=0, weight=0;
  for(const champ of champs){const d=damageProfile(champ,roles[champ.id] || champ.lane);physical+=d.physical*d.weight;magic+=d.magic*d.weight;weight+=d.weight;}
  return weight ? {physical:physical/weight,magic:magic/weight} : {physical:0.5,magic:0.5};
}
export function scalingStrength(champ: EnrichedChampion): { strength: number; observed: boolean } {
  const stats=champ.buildData?.special_notes?.statsData || champ.buildData?.statsData || champ.statsData;
  const curve=stats?.winrateByGameTime || [];
  const late=curve.filter((p: {bucket?:string;games?:number}) => ['35-40','40+'].includes(p.bucket || '') && Number(p.games)>=100);
  if(late.length){
    const n=late.reduce((sum:number,p:{games:number})=>sum+p.games,0);
    const wr=late.reduce((sum:number,p:{games:number;value:number})=>sum+p.games*p.value,0)/n;
    const baseline=Number(stats.header?.wr ?? champ.meta?.winRate ?? 50);
    if(Number.isFinite(wr))return {strength:Math.max(-1,Math.min(1,(wr-baseline)/5))*Math.min(1,n/1000),observed:true};
  }
  return {strength:champ.scalingType==='Late'?0.3:champ.scalingType==='Early'?-0.3:0,observed:false};
}
export function evidenceDelta(delta: unknown, games: unknown): number {
  const value=Number(delta);const n=Math.max(0,Number(games)||0);
  return Number.isFinite(value)?Math.max(-8,Math.min(8,value))*n/(n+250):0;
}
