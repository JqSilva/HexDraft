// src/lib/sync/scrape-champion.ts
import { db as dbInstance } from '../db/sqlite.js';
import { championsRepo } from '../db/champions.repo.js';
import { normalizeKey } from '../domain/champion-name-resolver.js';
import { fetchDpmChampionStats } from '../sources/dpm-champion-stats.source.js';
import { buildChampionRecord } from './build-champion-record.js';

export async function scrapeSingleChampion(
  name: string,
  version: string,
  dbMemory: any,
  nameIdMap: Record<string, number>,
  writeLog: (msg: string) => void
): Promise<void> {
  const champId = nameIdMap[normalizeKey(name)];
  if (!champId) return;

  // Obtener carriles jugables desde la base de datos
  const laneRow = dbInstance.prepare('SELECT lane, play_lanes FROM champions WHERE id = ?').get(champId) as { lane: string, play_lanes: string } | undefined;
  const playLanes = JSON.parse(laneRow?.play_lanes || '[]');
  if (playLanes.length === 0) {
    let fallbackLane = laneRow?.lane || dbMemory[name]?.lane || "UNKNOWN";
    if (!fallbackLane || fallbackLane === "UNKNOWN") {
      fallbackLane = "MIDDLE";
    }
    playLanes.push(fallbackLane);
  }

  const cData = dbMemory[name] || {};

  for (const lane of playLanes) {
    if (lane === "UNKNOWN") continue;
    writeLog(`   > Procesando carril: ${lane} para ${name}`);

    try {
      const rawData = await fetchDpmChampionStats(name, lane, version);

      if (!rawData || rawData.error || !rawData.runes) {
        writeLog(`   [WARN] dpm.lol no tiene builds para ${name} en ${lane}`);
        continue;
      }

      const currentChampStmt = dbInstance.prepare('SELECT * FROM champions WHERE id = ?');
      const current = currentChampStmt.get(champId) as any;

      const record = buildChampionRecord(rawData, champId, lane, {
        nameIdMap,
        currentChampion: current,
        version
      });

      // Persistir en SQLite
      championsRepo.saveChampion(record.championUpdate);
      record.matchups.forEach(m => championsRepo.saveMatchup(m));
      record.synergies.forEach(s => championsRepo.saveSynergy(s));
      championsRepo.clearBuilds(champId, lane);
      championsRepo.saveBuild(record.defaultBuild);
      record.candidateBuilds.forEach(b => championsRepo.saveBuild(b));

      // Actualizar snapshot de memoria
      cData.godMatchups = record.cDataSnapshot.godMatchups;
      cData.counters = record.cDataSnapshot.counters;
      cData.synergies = record.cDataSnapshot.synergies;
      cData.buildData = record.cDataSnapshot.buildData;
      if (record.cDataSnapshot.combat) cData.combat = record.cDataSnapshot.combat;
      if (record.cDataSnapshot.scalingType) cData.scalingType = record.cDataSnapshot.scalingType;

    } catch (e: any) {
      writeLog(`   [ERROR] Error scrapeando carril ${lane} de ${name}: ${e.message || e}`);
    }

    // Delay entre carriles para respetar Cloudflare
    await new Promise(r => setTimeout(r, 1000));
  }

  dbMemory[name] = cData;
}
