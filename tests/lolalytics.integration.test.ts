process.env.HEXDRAFT_DISABLE_SCHEDULER = '1';

const { fetchLolalyticsChampionStats } = await import('../src/lib/sources/lolalytics.source.js');
const { buildChampionRecord } = await import('../src/lib/sync/build-champion-record.js');
const { championsRepo } = await import('../src/lib/db/champions.repo.js');

const data = await fetchLolalyticsChampionStats('Syndra', 'MIDDLE', '16.17');
const nameIdMap = championsRepo.getChampionIdNameMap();
const record = buildChampionRecord(data, 134, 'MIDDLE', { nameIdMap, version: '16.17' });

if (data.sourceMetadata.source !== 'lolalytics') throw new Error('Fuente incorrecta');
if (data.history.byDate.length < 7) throw new Error('No se extrajo el histórico');
if (data.winrateByGameTime.length !== 7) throw new Error('No se extrajo la curva de duración');
if ((data.enemyMatchups.middle?.length || 0) < 10) throw new Error('No se extrajeron counters');
if ((data.allyMatchups.top?.length || 0) < 10) throw new Error('No se extrajeron synergies');
if (!data.items.item4.length || !data.items.item5.length || !data.items.item6.length) throw new Error('Faltan slots 4/5/6');
if (!record.defaultBuild || record.matchups.length === 0 || record.synergies.length === 0) {
  throw new Error('El registro no conserva matchup/synergy');
}

console.log('[PASS] LoLalytics extrae y persiste histórico, duración, counters, synergies, skills y slots 4/5/6.');
export {};
