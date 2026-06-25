import { initializeEngineData, ENRICHED_DB } from '../src/lib/engine/dataProvider.ts';
import { viabilityScore } from '../src/lib/engine/itemEngine.ts';

// Load JSON backup runes
await initializeEngineData();
const jsonChamp = ENRICHED_DB['Shaco'];
const jsonRunes = jsonChamp?.buildData?.dpmData?.runes || jsonChamp?.dpmData?.runes || {};

const playstyle = 'AD Letalidad';
const preferredKeystones = [9923, 8112, 8128, 8369];

console.log("\n--- JSON Primary Runes Scoring Trace for playstyle 'AD Letalidad' ---");
if (jsonRunes.primaryRuneId) {
  jsonRunes.primaryRuneId.forEach(r => {
    const id = Number(r.Id || r.id);
    const wr = r.winrate || 50.0;
    const pr = r.pickrate || 0;
    const viability = viabilityScore(wr, pr);
    let bonus = 0;
    if (preferredKeystones.includes(id)) {
      bonus = 15.0;
    }
    const total = viability + bonus;
    console.log(`Rune ID: ${id}, WR: ${wr}, PR: ${pr}, Viability: ${viability.toFixed(3)}, Bonus: ${bonus}, Total: ${total.toFixed(3)}`);
  });
}



