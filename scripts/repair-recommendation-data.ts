// Resumable, lane-scoped data repair. No catalog/meta refresh or background scheduler.
export {};
process.env.HEXDRAFT_DISABLE_SCHEDULER = '1';
const { db, closeDb } = await import('../src/lib/db/sqlite.js');
const { championsRepo } = await import('../src/lib/db/champions.repo.js');
const { getChampionPlayLanes, scrapeSingleChampionLane } = await import('../src/lib/sync/scrape-champion.js');
const { normalizeRole } = await import('../src/lib/engine/core/constants.js');
const version = process.argv[2] || '16.17';
const maxTasks = Number(process.argv[3]) || Infinity;
const nameIds = championsRepo.getChampionIdNameMap();
const rows = db.prepare('SELECT id, name, lane FROM champions ORDER BY id').all() as { id:number; name:string; lane:string }[];
const tasks = rows.flatMap(c => [...new Set([c.lane,...getChampionPlayLanes(c.name,nameIds)].map(l => normalizeRole(l)))].map(lane=>({...c,lane})))
  .filter(c => !db.prepare(`SELECT 1 FROM builds WHERE champion_id=? AND lane=? AND patch=? AND is_default=1
    AND json_extract(special_notes,'$.statsData.header.n') > 0
    AND json_extract(special_notes,'$.statsData.sourceMetadata.roleEvidenceVersion') = 2`).get(c.id,c.lane,version)).slice(0,maxTasks);
let done=0, failed=0, next=0;
console.log(JSON.stringify({event:'start',version,total:tasks.length}));
try {
  await Promise.all([0,1,2].map(async()=>{
    while(next<tasks.length){
      const task=tasks[next++];
      const ok=await scrapeSingleChampionLane(task.name,task.lane,version,nameIds,msg=>{if(msg.includes('[ERROR]'))console.error(msg)});
      if(ok)done++;else failed++;
      console.log(JSON.stringify({event:'progress',champion:task.name,lane:task.lane,ok,done,failed,total:tasks.length}));
    }
  }));
  console.log(JSON.stringify({event:'complete',done,failed,total:tasks.length}));
  process.exitCode=failed?1:0;
} finally { closeDb(); }
process.exit(process.exitCode || 0);
