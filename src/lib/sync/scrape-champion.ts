// src/lib/sync/scrape-champion.ts
import { db as dbInstance } from '../db/sqlite.js';
import { championsRepo } from '../db/champions.repo.js';
import { normalizeKey } from '../domain/champion-name-resolver.js';
import { fetchLolalyticsChampionStats } from '../sources/lolalytics.source.js';
import { buildChampionRecord } from './build-champion-record.js';

export function getChampionPlayLanes(
  name: string,
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
    let fallbackLane = laneRow?.lane || "UNKNOWN";
    if (!fallbackLane || fallbackLane === "UNKNOWN") fallbackLane = "MIDDLE";
    playLanes.push(fallbackLane);
  }

  return playLanes.filter(lane => lane && lane !== "UNKNOWN");
}

export async function scrapeSingleChampionLane(
  name: string,
  lane: string,
  version: string,
  nameIdMap: Record<string, number>,
  writeLog: (msg: string) => void,
  sessionId?: string
): Promise<boolean> {
  const champId = nameIdMap[normalizeKey(name)];
  if (!champId || lane === "UNKNOWN") return false;

  writeLog(`   > Procesando carril: ${lane} para ${name}`);

  try {
    let rawData: any = null;
    let lastFetchError: unknown = null;

    // LoLalytics puede responder temporalmente con 403/5xx o HTML incompleto.
    // Reintentar aquí evita abortar toda la transacción por un fallo aislado.
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const candidate = await fetchLolalyticsChampionStats(name, lane, version, sessionId);
        if (!candidate || candidate.error || !candidate.runes) {
          throw new Error('respuesta sin build o página de runas válida');
        }
        rawData = candidate;
        writeLog('   [OK] LoLalytics: ' + name + ' ' + lane + ' (' + (rawData.sourceMetadata?.patch || version) + ')');
        break;
      } catch (error) {
        lastFetchError = error;
        if (attempt < 3) {
          const detail = error instanceof Error ? error.message : String(error);
          writeLog(`   [RETRY] ${name} ${lane}: intento ${attempt}/3 falló (${detail}).`);
          await new Promise(resolve => setTimeout(resolve, 1500 * attempt));
        }
      }
    }

    if (!rawData) {
      const detail = lastFetchError instanceof Error ? lastFetchError.message : String(lastFetchError || 'error desconocido');
      writeLog(`   [ERROR] No se pudo obtener LoLalytics para ${name} ${lane} tras 3 intentos: ${detail}`);
      return false;
    }
    const currentChampStmt = dbInstance.prepare('SELECT * FROM champions WHERE id = ?');
    const current = currentChampStmt.get(champId) as any;

    const record = buildChampionRecord(rawData, champId, lane, {
      nameIdMap,
      currentChampion: current,
      version
    });

        // Persistir cada tarea con un savepoint. Si una tarea falla, sólo ella vuelve
    // a su estado anterior y las demás tareas válidas pueden conservarse.
    const savepoint = `champion_${champId}_${lane.replace(/[^A-Za-z0-9_]/g, '_')}`;
    dbInstance.exec(`SAVEPOINT ${savepoint};`);
    try {
      championsRepo.saveChampion(record.championUpdate);
      championsRepo.clearMatchups(champId, lane);
      championsRepo.clearSynergies(champId, lane);
      record.matchups.forEach(m => championsRepo.saveMatchup(m));
      record.synergies.forEach(s => championsRepo.saveSynergy(s));
      championsRepo.clearBuilds(champId, lane);
      championsRepo.saveBuild(record.defaultBuild);
      record.candidateBuilds.forEach(b => championsRepo.saveBuild(b));
      dbInstance.exec(`RELEASE SAVEPOINT ${savepoint};`);
    } catch (error) {
      dbInstance.exec(`ROLLBACK TO SAVEPOINT ${savepoint};`);
      dbInstance.exec(`RELEASE SAVEPOINT ${savepoint};`);
      throw error;
    }
    return true;
  } catch (e: any) {
    writeLog(`   [ERROR] Error scrapeando carril ${lane} de ${name}: ${e.message || e}`);
    return false;
  }
}

export async function scrapeSingleChampion(
  name: string,
  version: string,
  nameIdMap: Record<string, number>,
  writeLog: (msg: string) => void,
  sessionId?: string
): Promise<void> {
  const playLanes = getChampionPlayLanes(name, nameIdMap);
  for (const lane of playLanes) {
    await scrapeSingleChampionLane(name, lane, version, nameIdMap, writeLog, sessionId);
    await new Promise(r => setTimeout(r, 1000));
  }
}
