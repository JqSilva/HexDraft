// src/lib/scripts/sync-champions-cdrag.ts
import { db } from '../db/sqlite.js';

// Listas curadas para inferencia precisa
const CHAMPS_WITH_SHIELDS = new Set([
  "Riven", "Lee Sin", "Lux", "Karma", "Janna", "Lulu", "Shen", "Galio", "Malphite", 
  "Nautilus", "Thresh", "Sion", "Urgot", "Viktor", "Orianna", "Skarner", "Jarvan IV", 
  "Diana", "Yasuo", "Yone", "K'Sante", "Tahm Kench", "Camille", "Sett", "Rumble", 
  "Poppy", "Ivern", "Yuumi", "Sona", "Taric", "Blitzcrank", "Rakan", "Mordekaiser"
]);

const CHAMPS_WITH_SUSTAIN = new Set([
  "Aatrox", "Briar", "Vladimir", "Dr. Mundo", "Warwick", "Swain", "Nami", "Sona", 
  "Seraphine", "Soraka", "Yuumi", "Taric", "Renekton", "Volibear", "Illaoi", 
  "Fiddlesticks", "Kayn", "Nilah", "Samira", "Olaf", "Trundle", "Garen", "Cho'Gath", 
  "Ahri", "Sylas", "Master Yi", "Zac", "Rengar", "Irelia", "Nocturne", "Tryndamere", 
  "Xin Zhao", "Nidalee", "Hecarim", "Lillia", "Maokai", "Gragas", "Mordekaiser", 
  "Senna", "Alistar", "Bard", "Rakan", "Tahm Kench", "Kha'Zix", "Lee Sin"
]);

const HIGH_MOBILITY_CHAMPS = new Set([
  "Ahri", "Akali", "Bel'Veth", "Camille", "Diana", "Ekko", "Ezreal", "Fiora", "Fizz", 
  "Gnar", "Gragas", "Graves", "Hecarim", "Irelia", "Jarvan IV", "Jax", "Kassadin", 
  "Katarina", "Kayn", "Kha'Zix", "Leblanc", "Lee Sin", "Lillia", "Lucian", "Master Yi", 
  "Nidalee", "Pantheon", "Pyke", "Qiyana", "Rakan", "Reksai", "Rengar", "Riven", 
  "Shaco", "Singed", "Talon", "Tristana", "Tryndamere", "Udyr", "Vayne", "Vi", 
  "Viego", "Wukong", "Xin Zhao", "Yasuo", "Yone", "Zeri"
]);

const LOW_MOBILITY_CHAMPS = new Set([
  "Anivia", "Annie", "Aphelios", "Ashe", "Aurelion Sol", "Brand", "Caitlyn", "Cho'Gath", 
  "Darius", "Dr. Mundo", "Heimerdinger", "Illaoi", "Jhin", "Jinx", "Karthus", "Kog'Maw", 
  "Lissandra", "Lux", "Malzahar", "Mundo", "Nasus", "Nautilus", "Olaf", "Orianna", 
  "Rumble", "Senna", "Seraphine", "Sion", "Sivir", "Soraka", "Swain", "Syndra", "Taric", 
  "Teemo", "Trundle", "Varus", "Veigar", "Vel'Koz", "Viktor", "Xerath", "Yorick", 
  "Yuumi", "Zyra"
]);

const HIGH_RESOURCE_CHAMPS = new Set([
  "Anivia", "Kassadin", "Ryze", "Cassiopeia", "Karthus", "Sona", "Yuumi", "Taric", 
  "Lulu", "Lux", "Syndra", "Xerath", "Orianna", "Hecarim", "Ezreal", "Brand", 
  "Karma", "Nami", "Ziggs"
]);

const LOW_RESOURCE_CHAMPS = new Set([
  "Riven", "Yasuo", "Yone", "Aatrox", "Vlad", "Vladimir", "Dr. Mundo", "Mundo", 
  "Katarina", "Tryndamere", "Renekton", "Sett", "Gnar", "Kennan", "Kennen", 
  "Akali", "Shen", "Lee Sin", "Rumble", "Zac", "Viego", "K'Sante"
]);

function inferTacticRole(champ: any): 'engage' | 'peel' | 'poke' | 'dive' | 'burst' | 'splitpush' | 'skirmish' | 'teamfight' | 'siege' | 'utility' {
  const name = champ.name;
  const cls = champ.class;
  const tags = JSON.parse(champ.tags || '[]');
  const hasHardCC = champ.has_hard_cc === 1;

  if (cls === 'Tank' && hasHardCC) return 'engage';
  if (cls === 'Support' && hasHardCC) return 'peel';
  if (cls === 'Assassin') return 'burst';
  if (cls === 'Fighter' && champ.is_hypercarry === 1) return 'teamfight';
  if (cls === 'Fighter') return 'skirmish';
  if (cls === 'Marksman' && tags.includes('Poke')) return 'poke';
  if (tags.includes('Burst')) return 'burst';
  if (tags.includes('Poke')) return 'poke';
  if (cls === 'Support') return 'utility';
  if (cls === 'Mage' && tags.includes('Siege')) return 'siege';
  
  // Casos particulares
  const splitpushers = ["Fiora", "Jax", "Tryndamere", "Nasus", "Yorick", "Camille", "Gwen", "Trundle"];
  if (splitpushers.includes(name)) return 'splitpush';

  const pokeChamps = ["Jayce", "Xerath", "Ziggs", "Varus", "Nidalee", "Vel'Koz"];
  if (pokeChamps.includes(name)) return 'poke';

  const diveChamps = ["Kled", "Diana", "Nocturne", "Hecarim", "Vi", "Malphite"];
  if (diveChamps.includes(name)) return 'dive';

  return 'teamfight';
}

function inferMobility(name: string): 'low' | 'medium' | 'high' {
  if (HIGH_MOBILITY_CHAMPS.has(name)) return 'high';
  if (LOW_MOBILITY_CHAMPS.has(name)) return 'low';
  return 'medium';
}

function inferTargetPriority(cls: string, role: string): 'squishy' | 'tank' | 'any' | 'healer' {
  if (cls === 'Assassin' || role === 'burst' || role === 'dive') return 'squishy';
  if (cls === 'Marksman') return 'any';
  if (cls === 'Tank') return 'any';
  return 'any';
}

function inferResourceDependency(name: string): 'high' | 'medium' | 'low' {
  if (HIGH_RESOURCE_CHAMPS.has(name)) return 'high';
  if (LOW_RESOURCE_CHAMPS.has(name)) return 'low';
  return 'medium';
}

function inferTeamNeeds(champ: any, role: string): string[] {
  const needs: string[] = [];
  const cls = champ.class;
  const isHypercarry = champ.is_hypercarry === 1;

  if (isHypercarry || cls === 'Marksman') needs.push('peel', 'frontline');
  if (role === 'burst' || role === 'dive') needs.push('engage', 'followup');
  if (needs.length === 0) needs.push('none');
  
  return needs;
}

function inferTeamProvides(champ: any, role: string): string[] {
  const provides: string[] = [];
  const cls = champ.class;
  const hasHardCC = champ.has_hard_cc === 1;
  const name = champ.name;

  if (role === 'engage') provides.push('engage');
  if (role === 'peel' || cls === 'Support') provides.push('peel');
  if (hasHardCC) provides.push('cc');
  if (CHAMPS_WITH_SHIELDS.has(name)) provides.push('shielding');
  if (CHAMPS_WITH_SUSTAIN.has(name) && cls === 'Support') provides.push('healing');
  
  return provides;
}

function inferLanePhase(name: string, scaling: string): 'weak' | 'average' | 'strong' {
  const strongLane = ["Darius", "Renekton", "Pantheon", "Olaf", "Jayce", "Draven", "Caitlyn", "Teemo"];
  const weakLane = ["Kayle", "Kassadin", "Veigar", "Nasus", "Vayne", "Smolder"];

  if (strongLane.includes(name)) return 'strong';
  if (weakLane.includes(name)) return 'weak';

  if (scaling === 'Early') return 'strong';
  if (scaling === 'Late') return 'weak';
  return 'average';
}

export async function syncChampionsSemanticData() {
  console.log("Iniciando sincronizacion semantica de campeones...");

  try {
    const query = db.prepare('SELECT * FROM champions');
    const champions = query.all() as any[];
    
    db.exec('BEGIN TRANSACTION;');

    const updateStmt = db.prepare(`
      UPDATE champions SET
        tactic_role = ?,
        mobility = ?,
        target_priority = ?,
        team_needs = ?,
        team_provides = ?,
        has_shield = ?,
        has_sustain = ?,
        lane_phase = ?,
        resource_dependency = ?
      WHERE id = ?
    `);

    let count = 0;
    for (const champ of champions) {
      const name = champ.name;
      const role = inferTacticRole(champ);
      const mobility = inferMobility(name);
      const targetPriority = inferTargetPriority(champ.class, role);
      const resourceDependency = inferResourceDependency(name);
      const teamNeeds = JSON.stringify(inferTeamNeeds(champ, role));
      const teamProvides = JSON.stringify(inferTeamProvides(champ, role));
      
      const hasShield = CHAMPS_WITH_SHIELDS.has(name) ? 1 : 0;
      const hasSustain = CHAMPS_WITH_SUSTAIN.has(name) ? 1 : 0;
      const lanePhase = inferLanePhase(name, champ.scaling_type);

      updateStmt.run(
        role,
        mobility,
        targetPriority,
        teamNeeds,
        teamProvides,
        hasShield,
        hasSustain,
        lanePhase,
        resourceDependency,
        champ.id
      );
      count++;
    }

    db.exec('COMMIT;');
    console.log(`Sincronizacion semantica completada: ${count} campeones actualizados.`);
    return count;
  } catch (error) {
    try {
      db.exec('ROLLBACK;');
    } catch (_) {}
    console.error("Error en sincronizacion semantica de campeones:", error);
    throw error;
  }
}

// Ejecutar si se corre directamente
if (process.argv[1]?.endsWith('sync-champions-cdrag.ts') || process.argv[1]?.endsWith('sync-champions-cdrag.js')) {
  syncChampionsSemanticData()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
