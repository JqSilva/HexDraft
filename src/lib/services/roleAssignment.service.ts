// src/lib/services/roleAssignment.service.ts
import metaPositionsJson from '../data/meta-positions.json';
import { getNameFromId } from '../engine/core/constants.js';

export type RoleName = 'TOP' | 'JNG' | 'MID' | 'ADC' | 'SUPP';

const ROLES: RoleName[] = ['TOP', 'JNG', 'MID', 'ADC', 'SUPP'];

const POSITION_MAP: Record<string, RoleName> = {
  'TOP': 'TOP',
  'JUNGLE': 'JNG',
  'JNG': 'JNG',
  'MIDDLE': 'MID',
  'MID': 'MID',
  'BOTTOM': 'ADC',
  'BOT': 'ADC',
  'ADC': 'ADC',
  'UTILITY': 'SUPP',
  'SUPPORT': 'SUPP',
  'SUPP': 'SUPP'
};

const metaPositions = metaPositionsJson as Record<string, string[]>;

/**
 * Normaliza una posición devuelta por Riot/LCU a 'TOP' | 'JNG' | 'MID' | 'ADC' | 'SUPP'.
 */
export function normalizePosition(pos?: string): RoleName | null {
  if (!pos || pos.trim() === '' || pos.toLowerCase() === 'none') return null;
  const upper = pos.toUpperCase().trim();
  return POSITION_MAP[upper] || null;
}

/**
 * Obtiene las posiciones recomendadas para un campeón según su nombre o ID.
 */
export function getChampionPreferredRoles(championNameOrId: string | number): RoleName[] {
  const champName = typeof championNameOrId === 'number'
    ? getNameFromId(championNameOrId)
    : championNameOrId;

  if (!champName) return ['MID'];

  const rawPositions = metaPositions[champName] || [];
  const roles: RoleName[] = [];

  for (const raw of rawPositions) {
    const norm = normalizePosition(raw);
    if (norm && !roles.includes(norm)) {
      roles.push(norm);
    }
  }

  // Fallbacks conocidos para campeones populares
  if (roles.length === 0) {
    const lower = champName.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (['zed', 'yasuo', 'yone', 'ahri', 'syndra', 'kassadin', 'veigar', 'leblanc', 'viktor', 'orianna', 'katarina', 'akali'].includes(lower)) {
      return ['MID'];
    }
    if (['riven', 'aatrox', 'darius', 'garen', 'fiora', 'jax', 'camille', 'sett', 'irelia', 'mordekaiser', 'renekton', 'gnar', 'ksante'].includes(lower)) {
      return ['TOP'];
    }
    if (['lee_sin', 'leesin', 'khazix', 'hecarim', 'graves', 'elise', 'jarvaniv', 'kayn', 'viego', 'vi', 'sejuani', 'zac'].includes(lower)) {
      return ['JNG'];
    }
    if (['jinx', 'kaisa', 'caitlyn', 'ezreal', 'vayne', 'samira', 'jhin', 'lucian', 'varus', 'tristana', 'sivir', 'smolder'].includes(lower)) {
      return ['ADC'];
    }
    if (['thresh', 'nautilus', 'blitzcrank', 'lulu', 'nami', 'yuumi', 'leona', 'morgana', 'soraka', 'pyke', 'rakan', 'milio'].includes(lower)) {
      return ['SUPP'];
    }
    return ['MID'];
  }

  return roles;
}

/**
 * Asigna de forma inteligente y sin duplicados los roles de un equipo de 5 jugadores.
 */
export function assignTeamRoles<T extends Record<string, any>>(
  team: T[]
): (T & { role: RoleName })[] {
  if (!Array.isArray(team) || team.length === 0) return [];

  // 1. Extraer posiciones preliminares
  const results = team.map((p) => {
    const rawPos = normalizePosition(p.assignedPosition);
    const spells = [p.spell1Id, p.spell2Id, ...(p.spells || [])].filter(Boolean);
    const hasSmite = spells.includes(11);

    if (hasSmite) {
      return { p, role: 'JNG' as RoleName, isLockedRole: true };
    }

    if (rawPos) {
      return { p, role: rawPos, isLockedRole: true };
    }

    return { p, role: 'MID' as RoleName, isLockedRole: false };
  });

  // 2. Si todas las posiciones fueron explícitamente dadas por Riot y son únicas, usarlas directamente
  const allHadRawPos = team.every(p => Boolean(normalizePosition(p.assignedPosition)));
  const uniqueAssigned = new Set(results.map(r => r.role));

  if (allHadRawPos && uniqueAssigned.size === team.length) {
    return results.map(r => ({ ...r.p, role: r.role }));
  }

  // 3. Asignación contextual sin conflictos
  const availableRoles: RoleName[] = [...ROLES];
  const finalAssignments: Array<RoleName | null> = Array(team.length).fill(null);

  // Paso A: Hechizo Smite (11) -> JNG
  results.forEach((item, idx) => {
    const spells = [item.p.spell1Id, item.p.spell2Id, ...(item.p.spells || [])].filter(Boolean);
    if (spells.includes(11) && availableRoles.includes('JNG')) {
      finalAssignments[idx] = 'JNG';
      const jngIdx = availableRoles.indexOf('JNG');
      if (jngIdx !== -1) availableRoles.splice(jngIdx, 1);
    }
  });

  // Paso B: Posiciones asignadas por Riot si aún están libres
  results.forEach((item, idx) => {
    if (finalAssignments[idx] === null && item.isLockedRole) {
      if (availableRoles.includes(item.role)) {
        finalAssignments[idx] = item.role;
        const rIdx = availableRoles.indexOf(item.role);
        if (rIdx !== -1) availableRoles.splice(rIdx, 1);
      }
    }
  });

  // Paso C: Posición natural del campeón (meta-positions)
  results.forEach((item, idx) => {
    if (finalAssignments[idx] === null) {
      const preferred = getChampionPreferredRoles(item.p.championName || item.p.championId || 0);
      const matched = preferred.find(r => availableRoles.includes(r));
      if (matched) {
        finalAssignments[idx] = matched;
        const rIdx = availableRoles.indexOf(matched);
        if (rIdx !== -1) availableRoles.splice(rIdx, 1);
      }
    }
  });

  // Paso D: Asignar roles restantes
  results.forEach((_item, idx) => {
    if (finalAssignments[idx] === null) {
      const fallbackRole = availableRoles.shift() || 'MID';
      finalAssignments[idx] = fallbackRole;
    }
  });

  return team.map((p, idx) => ({
    ...p,
    role: finalAssignments[idx] || 'MID'
  }));
}
