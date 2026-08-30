// src/lib/sync/scrape-champion.ts
import { db as dbInstance } from '../db/sqlite.js';
import { championsRepo } from '../db/champions.repo.js';
import { normalizeKey } from '../domain/champion-name-resolver.js';
import { fetchDpmChampionStats } from '../sources/dpm-champion-stats.source.js';
import { buildChampionRecord } from './build-champion-record.js';

export function getChampionPlayLanes(
  name: string,
  dbMemory: any,
  nameIdMap: Record<string, number>
): string[] {
  const champId = nameIdMap[normalizeKey(name)];
  if (!champId) return [];

  const laneRow = dbInstance.prepare('SELECT lane, play_lanes FROM champions WHERE id = ?').get(champId) as { lane: string, play_lanes: string } | undefined;
  let playLanes: string[] = [];

  try {
    playLanes = JSON.parse(laneRow?.play_lanes || '[]');
  } catch {
    playLanes = [];
  }

  if (playLanes.length === 0) {
    let fallbackLane = laneRow?.lane || dbMemory[name]?.lane || "UNKNOWN";
    if (!fallbackLane || fallbackLane === "UNKNOWN") fallbackLane = "MIDDLE";
    playLanes.push(fallbackLane);
  }

  return playLanes.filter(lane => lane && lane !== "UNKNOWN");
}

export async function scrapeSingleChampionLane(
  name: string,
  lane: string,
  version: string,
  dbMemory: any,
  nameIdMap: Record<string, number>,
  writeLog: (msg: string) => void,
  sessionId?: string
): Promise<void> {
  const champId = nameIdMap[normalizeKey(name)];
  if (!champId || lane === "UNKNOWN") return;

  writeLog(`   > Procesando carril: ${lane} para ${name}`);

  try {
    const rawData = await fetchDpmChampionStats(name, lane, version, sessionId);

    if (!rawData || rawData.error || !rawData.runes) {
      writeLog(`   [WARN] dpm.lol no tiene builds para ${name} en ${lane}`);
      return;
    }

    const currentChampStmt = dbInstance.prepare('SELECT * FROM champions WHERE id = ?');
    const current = currentChampStmt.get(champId) as any;

    const record = buildChampionRecord(rawData, champId, lane, {
      nameIdMap,
      currentChampion: current,
      version
    });

    // Persistir en SQLite. Cada tarea solo modifica la combinación campeón/carril.
    championsRepo.saveChampion(record.championUpdate);
    record.matchups.forEach(m => championsRepo.saveMatchup(m));
    record.synergies.forEach(s => championsRepo.saveSynergy(s));
    championsRepo.clearBuilds(champId, lane);
    championsRepo.saveBuild(record.defaultBuild);
    record.candidateBuilds.forEach(b => championsRepo.saveBuild(b));

    // El JSON es un snapshot secundario; SQLite conserva los datos por carril.
    const cData = { ...(dbMemory[name] || {}) };
    cData.godMatchups = record.cDataSnapshot.godMatchups;
    cData.counters = record.cDataSnapshot.counters;
    cData.synergies = record.cDataSnapshot.synergies;
    cData.buildData = record.cDataSnapshot.buildData;
    if (record.cDataSnapshot.combat) cData.combat = record.cDataSnapshot.combat;
    if (record.cDataSnapshot.scalingType) cData.scalingType = record.cDataSnapshot.scalingType;
    dbMemory[name] = cData;
  } catch (e: any) {
    writeLog(`   [ERROR] Error scrapeando carril ${lane} de ${name}: ${e.message || e}`);
  }
}

export async function scrapeSingleChampion(
  name: string,
  version: string,
  dbMemory: any,
  nameIdMap: Record<string, number>,
  writeLog: (msg: string) => void,
  sessionId?: string
): Promise<void> {
  const playLanes = getChampionPlayLanes(name, dbMemory, nameIdMap);

  for (const lane of playLanes) {
    await scrapeSingleChampionLane(name, lane, version, dbMemory, nameIdMap, writeLog, sessionId);

    // Delay entre carriles para respetar Cloudflare.
    await new Promise(r => setTimeout(r, 1000));
  }
}
