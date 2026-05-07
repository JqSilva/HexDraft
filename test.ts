import { CHAMPIONS_DB } from './src/lib/data';
import * as fs from 'fs';

// Listas de referencia para asignar propiedades automáticamente
const HYPERCARRIES = ["Jinx", "Vayne", "Kog'Maw", "Kayle", "Master Yi", "Kassadin", "Smolder", "Bel'Veth", "Gwen"];
const HARD_CC_TAGS = ["Leona", "Nautilus", "Zac", "Sejuani", "Alistar", "Malphite", "Amumu", "Lissandra", "Thresh"];
const KNOCKUP_CHAMPS = ["Yasuo", "Yone", "Zac", "Malphite", "Alistar", "Lee Sin", "Rek'Sai", "Vi", "Wukong", "Cho'Gath"];

const enrichedDb: any = {};

Object.keys(CHAMPIONS_DB).forEach((id: any) => {
  const champ = (CHAMPIONS_DB as any)[id];
  
  // 1. Determinar si es Frontline (Tanques y la mayoría de Luchadores)
  const isFrontline = champ.class === 'Tank' || (champ.class === 'Fighter' && !["Yasuo", "Yone", "Master Yi"].includes(champ.name));

  // 2. Determinar si es Hypercarry
  const isHypercarry = HYPERCARRIES.includes(champ.name) || (champ.class === 'Marksman' && champ.scaling === 'Late');

  // 3. Determinar si tiene Hard CC (Stuns/Knockups)
  const hasHardCC = champ.class === 'Tank' || champ.class === 'Support' || HARD_CC_TAGS.includes(champ.name);

  // 4. Agregar Tags de Sinergia
  const tags = [];
  if (KNOCKUP_CHAMPS.includes(champ.name)) tags.push("Knockup");
  if (champ.class === 'Assassin') tags.push("Burst");
  if (["Ezreal", "Jayce", "Zoe", "Nidalee"].includes(champ.name)) tags.push("Poke");

  enrichedDb[id] = {
    ...champ,
    isFrontline,
    isHypercarry,
    hasHardCC,
    tags
  };
});

// Guardar el nuevo archivo
const fileContent = `export const CHAMPIONS_DB = ${JSON.stringify(enrichedDb, null, 2)};`;
fs.writeFileSync('./src/lib/data-new.ts', fileContent);

console.log("✅ Data enriquecida con éxito en data-new.ts");