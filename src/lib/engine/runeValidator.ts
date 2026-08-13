// src/lib/engine/runeValidator.ts
/**
 * Validador y reparador canónico de páginas de runas para League of Legends (LCU).
 * Garantiza que cualquier conjunto de runas (proveniente de scraping de OP.GG o APIs)
 * cumpla exactamente con la jerarquía estricta que exige el cliente de Riot:
 * - 1 Keystone del árbol principal (Fila 0).
 * - 3 Runas primarias (Exactamente 1 de cada fila 1, 2 y 3 del árbol principal).
 * - 2 Runas secundarias (De 2 filas distintas del árbol secundario).
 * - 3 Fragmentos de estadísticas (Fila 1: Ofensiva, Fila 2: Flexible, Fila 3: Defensiva).
 */

export interface RuneTreeDef {
  name: string;
  id: number;
  keystones: number[];
  rows: [number[], number[], number[]];
}

export const CANONICAL_RUNE_TREES: Record<number, RuneTreeDef> = {
  8000: {
    id: 8000,
    name: 'Precision',
    keystones: [8005, 8008, 8021, 8010], // Press the Attack, Lethal Tempo, Fleet Footwork, Conqueror
    rows: [
      [9101, 9111, 8009], // Absorb Life, Triumph, Presence of Mind
      [9104, 9103, 9105], // Legend: Alacrity, Legend: Bloodline, Legend: Haste
      [8014, 8017, 8299]  // Coup de Grace, Cut Down, Last Stand
    ]
  },
  8100: {
    id: 8100,
    name: 'Domination',
    keystones: [8112, 8124, 8128, 9923], // Electrocute, Predator, Dark Harvest, Hail of Blades
    rows: [
      [8126, 8139, 8143], // Cheap Shot, Taste of Blood, Sudden Impact
      [8136, 8120, 8138, 8141, 8140], // Zombie Ward, Ghost Poro, Eyeball Collection (+ aliases)
      [8135, 8105, 8106]  // Treasure Hunter, Relentless Hunter, Ultimate Hunter
    ]
  },
  8200: {
    id: 8200,
    name: 'Sorcery',
    keystones: [8214, 8229, 8230], // Summon Aery, Arcane Comet, Phase Rush
    rows: [
      [8224, 8226, 8275], // Nullifying Orb, Manaflow Band, Nimbus Cloak
      [8210, 8234, 8233], // Transcendence, Celerity, Absolute Focus
      [8237, 8232, 8236]  // Scorch, Waterwalking, Gathering Storm
    ]
  },
  8400: {
    id: 8400,
    name: 'Resolve',
    keystones: [8437, 8439, 8465], // Grasp of the Undying, Aftershock, Guardian
    rows: [
      [8446, 8463, 8401], // Demolish, Font of Life, Shield Bash
      [8429, 8444, 8473], // Conditioning, Second Wind, Bone Plating
      [8451, 8453, 8242]  // Overgrowth, Revitalize, Unflinching
    ]
  },
  8300: {
    id: 8300,
    name: 'Inspiration',
    keystones: [8351, 8360, 8369], // Glacial Augment, Unsealed Spellbook, First Strike
    rows: [
      [8306, 8304, 8321], // Hextech Flashtraption, Magical Footwear, Cash Back
      [8313, 8345, 8352], // Triple Tonic, Time Warp Tonic, Biscuit Delivery
      [8347, 8410, 8316]  // Cosmic Insight, Approach Velocity, Jack of All Trades
    ]
  }
};

export const CANONICAL_SHARDS_ROWS = [
  [5005, 5008, 5007], // Row 1: Attack Speed (5005), Adaptive Force (5008), Ability Haste (5007)
  [5008, 5010, 5011], // Row 2: Adaptive Force (5008), Move Speed (5010), Scaling HP (5011)
  [5013, 5012, 5011]  // Row 3: Flat HP (5013), Tenacity (5012), Scaling HP (5011)
];

const DEFAULT_FALLBACK_SHARDS = [5008, 5008, 5011];

/**
 * Encuentra a qué estilo y fila pertenece una runa.
 */
export function getPerkLocation(perkId: number): { styleId: number; isKeystone: boolean; rowIndex: number } | null {
  for (const styleIdStr of Object.keys(CANONICAL_RUNE_TREES)) {
    const styleId = Number(styleIdStr);
    const tree = CANONICAL_RUNE_TREES[styleId];
    if (tree.keystones.includes(perkId)) {
      return { styleId, isKeystone: true, rowIndex: -1 };
    }
    for (let r = 0; r < tree.rows.length; r++) {
      if (tree.rows[r].includes(perkId)) {
        return { styleId, isKeystone: false, rowIndex: r };
      }
    }
  }
  return null;
}

export interface ValidatedRunePage {
  primaryStyleId: number;
  subStyleId: number;
  selections: number[]; // Exactamente 6 runas
  shards: number[];     // Exactamente 3 shards
}

/**
 * Sanitiza y repara cualquier selección de runas para que sea 100% aceptada por el cliente de Riot.
 */
export function validateAndSanitizeRunePage(
  rawSelections: number[] = [],
  rawShards: number[] = [],
  preferredPrimaryStyle?: number,
  preferredSubStyle?: number
): ValidatedRunePage {
  const cleanRawSelections = (rawSelections || []).filter(id => typeof id === 'number' && id > 0);
  const cleanRawShards = (rawShards || []).filter(id => typeof id === 'number' && id > 0);

  // 1. Determinar Keystone y PrimaryStyleId
  let primaryKeystone: number | null = null;
  let primaryStyleId = preferredPrimaryStyle && CANONICAL_RUNE_TREES[preferredPrimaryStyle] ? preferredPrimaryStyle : 0;

  for (const perk of cleanRawSelections) {
    const loc = getPerkLocation(perk);
    if (loc && loc.isKeystone) {
      primaryKeystone = perk;
      primaryStyleId = loc.styleId;
      break;
    }
  }

  // Fallback si no se encontró Keystone
  if (!primaryStyleId || !CANONICAL_RUNE_TREES[primaryStyleId]) {
    primaryStyleId = 8000; // Precisión por defecto
  }
  const primaryTree = CANONICAL_RUNE_TREES[primaryStyleId];
  if (!primaryKeystone || !primaryTree.keystones.includes(primaryKeystone)) {
    primaryKeystone = primaryTree.keystones[0];
  }

  // 2. Extraer o completar exactamente 1 runa de cada una de las 3 filas primarias
  const primaryPerks: number[] = [];
  for (let rowIdx = 0; rowIdx < 3; rowIdx++) {
    const validInRow = primaryTree.rows[rowIdx];
    const found = cleanRawSelections.find(id => validInRow.includes(id));
    if (found) {
      primaryPerks.push(found);
    } else {
      primaryPerks.push(validInRow[0]); // Runa por defecto de esa fila
    }
  }

  // 3. Determinar SubStyleId
  let subStyleId = preferredSubStyle && CANONICAL_RUNE_TREES[preferredSubStyle] && preferredSubStyle !== primaryStyleId
    ? preferredSubStyle
    : 0;

  if (!subStyleId) {
    for (const perk of cleanRawSelections) {
      if (perk === primaryKeystone || primaryPerks.includes(perk)) continue;
      const loc = getPerkLocation(perk);
      if (loc && !loc.isKeystone && loc.styleId !== primaryStyleId) {
        subStyleId = loc.styleId;
        break;
      }
    }
  }

  if (!subStyleId || subStyleId === primaryStyleId || !CANONICAL_RUNE_TREES[subStyleId]) {
    const availableStyles = [8000, 8100, 8200, 8400, 8300].filter(s => s !== primaryStyleId);
    subStyleId = availableStyles[0];
  }

  const subTree = CANONICAL_RUNE_TREES[subStyleId];

  // 4. Extraer o completar exactamente 2 runas secundarias de 2 filas distintas
  const secondaryPerks: number[] = [];
  const usedSubRows = new Set<number>();

  for (const perk of cleanRawSelections) {
    if (perk === primaryKeystone || primaryPerks.includes(perk)) continue;
    const loc = getPerkLocation(perk);
    if (loc && loc.styleId === subStyleId && !loc.isKeystone) {
      if (!usedSubRows.has(loc.rowIndex) && secondaryPerks.length < 2) {
        secondaryPerks.push(perk);
        usedSubRows.add(loc.rowIndex);
      }
    }
  }

  // Si faltan secundarias, rellenar de filas no usadas
  for (let r = 0; r < 3 && secondaryPerks.length < 2; r++) {
    if (!usedSubRows.has(r)) {
      secondaryPerks.push(subTree.rows[r][0]);
      usedSubRows.add(r);
    }
  }

  // 5. Validar y limpiar Shards (3 exactamente)
  const shards: number[] = [];
  for (let row = 0; row < 3; row++) {
    const validShards = CANONICAL_SHARDS_ROWS[row];
    const candidate = cleanRawShards[row];
    if (candidate && (validShards.includes(candidate) || (candidate >= 5000 && candidate < 6000))) {
      shards.push(candidate);
    } else {
      shards.push(DEFAULT_FALLBACK_SHARDS[row] || validShards[0]);
    }
  }

  return {
    primaryStyleId,
    subStyleId,
    selections: [primaryKeystone, ...primaryPerks, ...secondaryPerks],
    shards
  };
}
