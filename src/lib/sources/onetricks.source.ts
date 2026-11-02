import axios from 'axios';

export interface ItemObservation {
  Id: number;
  id: number;
  pickrate: number;
  winrate: number;
  games?: number;
}

export interface OneTricksPlaystyle {
  firstItemId: number;
  title: string;
  pickrate: number;
  winrate: number;
  games?: number;
  statsData: any;
}

const USER_AGENT = 'HexDraft/3.0 (+https://github.com/)';
const BOOT_IDS = new Set([1001, 3006, 3009, 3020, 3047, 3111, 3117, 3158, 223047, 223111]);

function numeric(value: any): number {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function percentage(value: any): number {
  const result = numeric(value);
  return result > 0 && result <= 1 ? result * 100 : result;
}

function parseIds(value: any): number[] {
  if (typeof value === 'string') {
    return value.split(/[_\s,>-]+/).map(numeric).filter(id => id > 0);
  }
  if (!Array.isArray(value)) return [];
  if (value.every(item => typeof item === 'number' || (typeof item === 'string' && /^\d+$/.test(item)))) {
    return value.map(numeric).filter(id => id > 0);
  }
  return value.flatMap(parseIds);
}

function tupleIds(value: any): number[] {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return parseIds(value.itemIds || value.items || value.ids || value.path || value.build);
  }
  if (!Array.isArray(value) || value.length === 0) return [];
  return parseIds(value[0]);
}

function isBuildTuple(value: any): boolean {
  if (!Array.isArray(value) || value.length < 2) return false;
  const ids = tupleIds(value);
  return ids.length > 0 && Number.isFinite(Number(value[1]));
}

function buildRows(value: any): Array<{ itemIds: number[]; pickrate: number; winrate: number; games: number }> {
  const rows: any[] = [];
  const visit = (node: any): void => {
    if (!node) return;
    if (Array.isArray(node)) {
      if (isBuildTuple(node)) {
        rows.push({
          itemIds: tupleIds(node).filter(id => !BOOT_IDS.has(id)),
          pickrate: percentage(node[1]),
          winrate: percentage(node[2] ?? 50),
          games: numeric(node[3])
        });
        return;
      }
      for (const child of node) visit(child);
      return;
    }
    if (typeof node === 'object') {
      const ids = tupleIds(node);
      if (ids.length) {
        rows.push({
          itemIds: ids.filter(id => !BOOT_IDS.has(id)),
          pickrate: percentage(node.playrate ?? node.pickrate ?? node.pickRate ?? node.share),
          winrate: percentage(node.winrate ?? node.winRate ?? 50),
          games: numeric(node.games ?? node.count ?? node.n)
        });
        return;
      }
      Object.values(node).forEach(visit);
    }
  };
  visit(value);
  return rows.filter(row => row.itemIds.length > 0).sort((a, b) => b.pickrate - a.pickrate);
}

function optionTuple(value: any): ItemObservation | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const id = numeric(value.itemId ?? value.id ?? value.Id);
    if (!id) return null;
    return {
      Id: id, id,
      pickrate: percentage(value.playrate ?? value.pickrate ?? value.pickRate ?? value.share),
      winrate: percentage(value.winrate ?? value.winRate ?? 50),
      games: numeric(value.games ?? value.count ?? value.n) || undefined
    };
  }
  if (!Array.isArray(value) || value.length < 2) return null;
  const id = numeric(Array.isArray(value[0]) ? value[0][0] : value[0]);
  if (!id || !Number.isFinite(Number(value[1]))) return null;
  return { Id: id, id, pickrate: percentage(value[1]), winrate: percentage(value[2] ?? 50), games: numeric(value[3]) || undefined };
}

function isOptionList(value: any): boolean {
  return Array.isArray(value) && value.length > 0 && value.every(row => optionTuple(row) !== null);
}

function collectOptionLists(value: any, output: ItemObservation[][], depth = 0): void {
  if (!value || depth > 16) return;
  if (Array.isArray(value)) {
    if (isOptionList(value)) {
      output.push(value.map(optionTuple).filter(Boolean) as ItemObservation[]);
      return;
    }
    value.forEach(child => collectOptionLists(child, output, depth + 1));
    return;
  }
  if (typeof value !== 'object') return;
  const explicitSlots = ['item4', 'item5', 'item6'].map(key => (value as any)[key]).filter(isOptionList);
  if (explicitSlots.length) {
    explicitSlots.forEach(list => output.push(list.map(optionTuple).filter(Boolean) as ItemObservation[]));
    return;
  }
  Object.values(value).forEach(child => collectOptionLists(child, output, depth + 1));
}

function candidateGroups(value: any, output: ItemObservation[][][], depth = 0): void {
  if (!value || depth > 16) return;
  if (Array.isArray(value)) {
    const lists = value.filter(isOptionList).map(list => list.map(optionTuple).filter(Boolean) as ItemObservation[]);
    if (lists.length >= 2) {
      output.push(lists.slice(-3));
      return;
    }
    value.forEach(child => candidateGroups(child, output, depth + 1));
    return;
  }
  if (typeof value !== 'object') return;
  const slotKeys = ['item4', 'item5', 'item6'];
  if (slotKeys.some(key => Array.isArray((value as any)[key]))) {
    output.push(slotKeys.map(key => (value as any)[key]).filter(isOptionList).map(list => list.map(optionTuple).filter(Boolean) as ItemObservation[]));
    return;
  }
  Object.values(value).forEach(child => candidateGroups(child, output, depth + 1));
}

function aggregateExactPaths(rows: ReturnType<typeof buildRows>, slotIndex: number): ItemObservation[] {
  const counts = new Map<number, ItemObservation>();
  for (const row of rows) {
    const id = row.itemIds[slotIndex];
    if (!id) continue;
    const existing = counts.get(id);
    if (existing) existing.pickrate += row.pickrate;
    else counts.set(id, { Id: id, id, pickrate: row.pickrate, winrate: row.winrate, games: row.games || undefined });
  }
  return [...counts.values()].sort((a, b) => b.pickrate - a.pickrate).slice(0, 12);
}

function normalizeSlots(branch: any, classicRows: ReturnType<typeof buildRows>): Record<string, ItemObservation[]> {
  const raw = branch.popPath ?? branch.paths ?? branch.itemPaths;
  let groups: ItemObservation[][][] = [];
  candidateGroups(raw, groups);
  let selected = groups[0] || [];
  if (selected.length < 3) {
    const lists: ItemObservation[][] = [];
    collectOptionLists(raw, lists);
    selected = lists.slice(-3);
  }
  const slots = {
    item4: selected[0] || [],
    item5: selected[1] || [],
    item6: selected[2] || []
  };
  for (const [index, slot] of [[3, 'item4'], [4, 'item5'], [5, 'item6']] as const) {
    if (!slots[slot].length) slots[slot] = aggregateExactPaths(classicRows, index);
  }
  return slots;
}

function runePages(value: any, defaultShards: number[] = [5008, 5008, 5002]): any[] {
  const shardIds = defaultShards.length >= 3 ? defaultShards.slice(0, 3) : [5008, 5008, 5002];
  const pages: any[] = [];
  const seen = new Set<string>();
  const visit = (node: any, depth = 0): void => {
    if (!node || depth > 12) return;
    if (Array.isArray(node)) {
      if (node.length >= 2 && Array.isArray(node[0])) {
        const ids = parseIds(node[0]);
        const trees = parseIds(node[2]);
        if (ids.length >= 6 && trees.length >= 2) {
          const selections = ids.slice(0, 6);
          const shards = ids.length >= 9 ? ids.slice(-3) : shardIds;
          const key = `${trees[0]}-${trees[1]}-${selections.join('-')}`;
          if (!seen.has(key)) {
            seen.add(key);
            pages.push({ primaryStyleId: trees[0], subStyleId: trees[1], selections, shards, pickrate: percentage(node[1]), winrate: 50, games: numeric(node[3]) || undefined });
          }
          return;
        }
      }
      node.forEach(child => visit(child, depth + 1));
      return;
    }
    if (typeof node !== 'object') return;
    const ids = parseIds(node.runeIds ?? node.runes ?? node.selections ?? node.perks);
    const trees = parseIds(node.treeIds ?? node.styles ?? node.trees);
    if (ids.length >= 6 && trees.length >= 2) {
      const selections = ids.slice(0, 6);
      const shards = ids.length >= 9 ? ids.slice(-3) : shardIds;
      const key = `${trees[0]}-${trees[1]}-${selections.join('-')}`;
      if (!seen.has(key)) {
        seen.add(key);
        pages.push({ primaryStyleId: trees[0], subStyleId: trees[1], selections, shards, pickrate: percentage(node.playrate ?? node.pickrate ?? node.share), winrate: 50, games: numeric(node.games ?? node.count) || undefined });
      }
      return;
    }
    Object.values(node).forEach(child => visit(child, depth + 1));
  };
  visit(value);
  return pages.sort((a, b) => b.pickrate - a.pickrate).slice(0, 12);
}

function itemSets(value: any): any[] {
  return buildRows(value).map(row => ({ startItems: row.itemIds, pickrate: row.pickrate, winrate: row.winrate || 50, games: row.games }));
}

function bootOptions(value: any): ItemObservation[] {
  const options: ItemObservation[] = [];
  const visit = (node: any, depth = 0): void => {
    if (!node || depth > 12) return;
    const tuple = optionTuple(node);
    if (tuple && BOOT_IDS.has(tuple.id)) { options.push(tuple); return; }
    if (Array.isArray(node)) node.forEach(child => visit(child, depth + 1));
    else if (typeof node === 'object') Object.values(node).forEach(child => visit(child, depth + 1));
  };
  visit(value);
  return [...new Map(options.map(option => [option.id, option])).values()].sort((a, b) => b.pickrate - a.pickrate);
}

function summonerOptions(value: any): any[] {
  const options: any[] = [];
  const visit = (node: any, depth = 0): void => {
    if (!node || depth > 12) return;
    if (Array.isArray(node)) {
      if (node.length >= 2) {
        const ids = parseIds(node[0]);
        if (ids.length >= 2 && ids.length <= 3 && ids.every(id => id < 100)) {
          options.push({ summonerId1: ids[0], summonerId2: ids[1], pickrate: percentage(node[1]), winrate: 50, games: numeric(node[2]) || undefined });
          return;
        }
      }
      node.forEach(child => visit(child, depth + 1));
    } else if (typeof node === 'object') {
      Object.values(node).forEach(child => visit(child, depth + 1));
    }
  };
  visit(value);
  return options.sort((a, b) => b.pickrate - a.pickrate).slice(0, 8);
}

function skillLevelOrder(branch: any): string[] | null {
  const direct = branch?.skillLevelUp || branch?.skillOrder;
  if (Array.isArray(direct) && direct.length) return direct.map((skill: any) => String(skill).toUpperCase()).filter(Boolean);
  const maxOrders = Array.isArray(branch?.maxSkillOrders) ? branch.maxSkillOrders : [];
  const bestMaxOrder = [...maxOrders].sort((a, b) => percentage(b?.playrate ?? b?.pickrate) - percentage(a?.playrate ?? a?.pickrate))[0];
  if (Array.isArray(bestMaxOrder?.order)) {
    const order = bestMaxOrder.order.map((slot: any) => ({ '0': 'Q', '1': 'W', '2': 'E' } as Record<string, string>)[String(slot)] || '').filter(Boolean);
    if (order.length) return order;
  }
  const rows = Array.isArray(branch?.skillPaths) ? branch.skillPaths
    : Array.isArray(branch?.maxSkillOrders) ? branch.maxSkillOrders
      : [];
  const candidates = rows.map((row: any) => {
    const sequence = Array.isArray(row) ? row[0] : row?.order || row?.skills;
    if (!Array.isArray(sequence)) return null;
    const order = sequence.map((step: any) => {
      const rawSlot = Array.isArray(step) ? step[0]?.skillSlot : step?.skillSlot;
      return ({ '1': 'Q', '2': 'W', '3': 'E', '4': 'R' } as Record<string, string>)[String(rawSlot)] || '';
    }).filter(Boolean);
    return { order, pickrate: percentage(Array.isArray(row) ? row[1] : row?.playrate ?? row?.pickrate) };
  }).filter((candidate: any) => candidate?.order?.length);
  candidates.sort((a: any, b: any) => b.pickrate - a.pickrate);
  return candidates[0]?.order || null;
}

function findProperty(root: any, property: string): any[] {
  const matches: any[] = [];
  const visit = (node: any, depth = 0): void => {
    if (!node || typeof node !== 'object' || depth > 24) return;
    if (Object.prototype.hasOwnProperty.call(node, property)) matches.push(node[property]);
    if (Array.isArray(node)) node.forEach(child => visit(child, depth + 1));
    else Object.values(node).forEach(child => visit(child, depth + 1));
  };
  visit(root);
  return matches;
}

function getVersionBucket(firstItemStats: any, desiredPatch: string): { patch: string; stats: any } | null {
  if (!firstItemStats || typeof firstItemStats !== 'object') return null;
  const exact = firstItemStats[desiredPatch];
  if (exact && typeof exact === 'object') return { patch: desiredPatch, stats: exact };
  const versions = Object.keys(firstItemStats).filter(key => /^\d+\.\d+$/.test(key)).sort((a, b) => {
    const [aMajor, aMinor] = a.split('.').map(Number);
    const [bMajor, bMinor] = b.split('.').map(Number);
    return bMajor - aMajor || bMinor - aMinor;
  });
  const desired = desiredPatch.split('.').map(Number);
  const patch = versions.find(key => {
    const [major, minor] = key.split('.').map(Number);
    return major < desired[0] || (major === desired[0] && minor <= desired[1]);
  }) || versions[0];
  return patch ? { patch, stats: firstItemStats[patch] } : null;
}

function parsePageProps(html: string): any {
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const match of scripts) {
    const text = match[1].trim();
    if (!text.includes('firstItemStats')) continue;
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) continue;
    try { return JSON.parse(text.slice(start, end + 1)); } catch { /* Try the next SSR JSON block. */ }
  }
  throw new Error('OneTricks no entregó datos SSR de firstItemStats');
}

function normalizeBranch(firstItemId: number, branch: any): OneTricksPlaystyle | null {
  if (!branch || typeof branch !== 'object') return null;
  const classicRows = buildRows(branch.popClassicPath ?? branch.classicPaths ?? branch.popPath);
  const coreRows = buildRows(branch.popCore ?? branch.core ?? branch.coreItems);
  const preferredCore = coreRows[0]?.itemIds || [];
  const bestClassic = classicRows.find(row => row.itemIds.includes(firstItemId) && row.itemIds.length >= 3)
    || classicRows.find(row => row.itemIds.length >= 3);
  const coreLimit = preferredCore.length >= 3 ? 3 : 2;
  let coreIds = preferredCore.length
    ? (preferredCore.includes(firstItemId) ? preferredCore : [firstItemId, ...preferredCore])
    : [firstItemId];
  if (coreIds.length < 2 && bestClassic) coreIds = bestClassic.itemIds.slice(0, 2);
  coreIds = [...new Set(coreIds.filter(id => id > 0 && !BOOT_IDS.has(id)))].slice(0, coreLimit);
  if (!coreIds.includes(firstItemId)) coreIds = [firstItemId, ...coreIds].slice(0, coreLimit);
  if (coreIds.length < 2) return null;

  const slots = normalizeSlots(branch, classicRows);
  const allPathLists: ItemObservation[][] = [];
  collectOptionLists(branch.popPath ?? branch.paths ?? branch.itemPaths, allPathLists);
  const optionalItemIds = [...new Set([
    ...allPathLists.flat().filter(item => item.id === 3041).map(item => item.id),
    ...(classicRows.some(row => row.itemIds.includes(3041)) ? [3041] : [])
  ])];
  const runes = runePages(branch.popRunes ?? branch.runes ?? branch.runeSets, parseIds(branch.popStat));
  const starters = itemSets(branch.startingItems ?? branch.startItems ?? branch.starters);
  const boots = bootOptions(branch.boots ?? branch.popBoots);
  const summoners = summonerOptions(branch.sSpells ?? branch.summoners ?? branch.spells);
  const playrate = percentage(branch.playrate ?? branch.pickrate ?? branch.pickRate ?? branch.share)
    || coreRows[0]?.pickrate || bestClassic?.pickrate || 0;
  const winrate = percentage(branch.winrate ?? branch.winRate ?? 0)
    || coreRows[0]?.winrate || bestClassic?.winrate || 50;
  const games = numeric(branch.games ?? branch.count ?? branch.n) || coreRows[0]?.games || bestClassic?.games || undefined;

  const items: Record<string, ItemObservation[]> = { item4: slots.item4, item5: slots.item5, item6: slots.item6 };
  coreIds.forEach((id, index) => { items[`item${index + 1}`] = [{ Id: id, id, pickrate: playrate, winrate, games }]; });
  if (firstItemId === 3041) {
    // Mejai's is retained as an optional signal, not a normal continuation.
    for (const slot of Object.keys(items)) items[slot] = items[slot].filter(item => item.id !== 3041);
  }

  const skills = skillLevelOrder(branch) || branch.skills || null;
  const statsData = {
    sourceMetadata: {
      source: 'onetricks',
      pathModel: 'slot-options',
      coreMode: coreIds.length >= 3 ? 'three-items' : 'two-items',
      playstyleItem: firstItemId
    },
    header: { patch: '', lane: '' },
    coreBuilds: coreIds.length >= 3
      ? { coreItem3: [{ itemIds: coreIds, pickrate: playrate, winrate, games }] }
      : { coreItem2: [{ itemIds: coreIds, pickrate: playrate, winrate, games }] },
    items,
    optionalItems: optionalItemIds,
    runes: { pages: runes },
    boots,
    startItems: starters,
    summoners,
    skills
  };
  return { firstItemId, title: '', pickrate: playrate, winrate, games, statsData };
}

export function normalizeOneTricksPage(html: string, role: string, patch: string): { patch: string; playstyles: OneTricksPlaystyle[] } {
  const data = parsePageProps(html);
  const filterNodes = findProperty(data, 'filters');
  const pageRole = filterNodes.map(filters => String(filters?.role || '').toLowerCase()).find(Boolean);
  if (pageRole && pageRole !== role.toLowerCase()) {
    throw new Error(`OneTricks respondió el rol ${pageRole} para la solicitud ${role}`);
  }
  const statsCandidates = findProperty(data, 'firstItemStats');
  const bucket = statsCandidates.map(candidate => getVersionBucket(candidate, patch)).find(Boolean);
  if (!bucket) throw new Error(`OneTricks no tiene firstItemStats para el parche ${patch}`);
  const branches = Object.entries(bucket.stats)
    .filter(([key, value]) => /^\d+$/.test(key) && Number(key) > 0 && value && typeof value === 'object')
    .map(([key, value]) => normalizeBranch(Number(key), value))
    .filter(Boolean) as OneTricksPlaystyle[];
  const playstyles = branches.sort((a, b) => b.pickrate - a.pickrate).slice(0, 3);
  if (playstyles.length < 2) throw new Error('OneTricks no entregó al menos dos ramas de objetos iniciales válidas');
  return { patch: bucket.patch, playstyles };
}

function normalizeChampionSlug(championName: string): string {
  const aliases: Record<string, string> = { MonkeyKing: 'Wukong' };
  return (aliases[championName] || championName).replace(/[^a-zA-Z0-9]/g, '');
}

export async function fetchOneTricksChampionBuild(
  championName: string,
  role: string,
  patch: string
): Promise<{ patch: string; url: string; playstyles: OneTricksPlaystyle[] }> {
  const slug = normalizeChampionSlug(championName);
  const url = `https://www.onetricks.gg/es/champions/builds/${encodeURIComponent(slug)}?role=${encodeURIComponent(role)}`;
  const response = await axios.get(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
    timeout: 20000
  });
  const normalized = normalizeOneTricksPage(String(response.data), role, patch);
  normalized.playstyles.forEach(style => {
    style.statsData.sourceMetadata.patch = normalized.patch;
    style.statsData.header.patch = normalized.patch;
    style.statsData.header.lane = role;
  });
  return { ...normalized, url, playstyles: normalized.playstyles };
}

export function normalizeLolalyticsPlaystyles(statsData: any): OneTricksPlaystyle[] {
  const candidates = Array.isArray(statsData?.coreBuilds?.coreItem3) ? statsData.coreBuilds.coreItem3 : [];
  const byFirstItem = new Map<number, any>();
  for (const candidate of candidates) {
    const itemIds = parseIds(candidate.itemIds).filter(id => !BOOT_IDS.has(id));
    if (itemIds.length < 3) continue;
    const firstItemId = itemIds[0];
    const previous = byFirstItem.get(firstItemId);
    if (!previous || numeric(candidate.pickrate ?? candidate.pickRate) > numeric(previous.pickrate ?? previous.pickRate)) {
      byFirstItem.set(firstItemId, { ...candidate, itemIds });
    }
  }
  const itemOneStats = Array.isArray(statsData?.items?.item1) ? statsData.items.item1 : [];
  return [...byFirstItem.entries()].map(([firstItemId, candidate]) => {
    const playrate = numeric(itemOneStats.find((item: any) => Number(item.Id || item.id) === firstItemId)?.pickrate)
      || numeric(candidate.pickrate ?? candidate.pickRate);
    const branchStats = {
      ...statsData,
      sourceMetadata: { ...(statsData.sourceMetadata || {}), source: 'lolalytics', pathModel: 'slot-options', playstyleItem: firstItemId },
      coreBuilds: { ...statsData.coreBuilds, coreItem3: [{ ...candidate, pickrate: playrate }] },
      items: { ...(statsData.items || {}), item1: [{ Id: firstItemId, id: firstItemId, pickrate: playrate }] }
    };
    return { firstItemId, title: '', pickrate: playrate, winrate: numeric(candidate.winrate ?? candidate.winRate) || 50, games: numeric(candidate.games ?? candidate.count) || undefined, statsData: branchStats };
  }).sort((a, b) => b.pickrate - a.pickrate).slice(0, 3);
}
