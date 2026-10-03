import { configRepo } from '../db/config.repo.js';
import bundledSnapshot from '../data/probuildstats-top-picks.json';
import {
  getProbuildstatsTopPicksSnapshot,
  setProbuildstatsTopPicksSnapshot,
  validateProbuildstatsSnapshot,
  type ProbuildstatsTopPicksSnapshot
} from './probuildstatsTopPicks.js';

const SNAPSHOT_CONFIG_KEY = 'probuildstats_top_picks_snapshot';
const SNAPSHOT_URL = 'https://raw.githubusercontent.com/JqSilva/HexDraft/master/src/lib/data/probuildstats-top-picks.json';

export function getCurrentProbuildstatsTopPicks(): ProbuildstatsTopPicksSnapshot {
  const saved = validateProbuildstatsSnapshot(configRepo.getConfigObject(SNAPSHOT_CONFIG_KEY));
  const bundled = validateProbuildstatsSnapshot(bundledSnapshot);
  if (saved && bundled && saved.version !== bundled.version) {
    const savedTime = Date.parse(saved.updatedAt);
    const bundledTime = Date.parse(bundled.updatedAt);
    if (Number.isFinite(bundledTime) && (!Number.isFinite(savedTime) || bundledTime >= savedTime)) {
      configRepo.setConfig(SNAPSHOT_CONFIG_KEY, JSON.stringify(bundled));
      setProbuildstatsTopPicksSnapshot(bundled);
      return bundled;
    }
  }

  if (saved) {
    setProbuildstatsTopPicksSnapshot(saved);
    return saved;
  }

  const fallback = bundled || getProbuildstatsTopPicksSnapshot();
  setProbuildstatsTopPicksSnapshot(fallback);
  return fallback;
}

export async function refreshProbuildstatsTopPicks(): Promise<{ snapshot: ProbuildstatsTopPicksSnapshot; changed: boolean }> {
  const current = getCurrentProbuildstatsTopPicks();
  const response = await fetch(SNAPSHOT_URL, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(12_000)
  });
  if (!response.ok) throw new Error(`Snapshot remoto respondió HTTP ${response.status}`);

  const snapshot = validateProbuildstatsSnapshot(await response.json());
  if (!snapshot) throw new Error('El snapshot remoto no cumple el esquema esperado.');
  if (snapshot.version === current.version) return { snapshot: current, changed: false };

  configRepo.setConfig(SNAPSHOT_CONFIG_KEY, JSON.stringify(snapshot));
  setProbuildstatsTopPicksSnapshot(snapshot);
  return { snapshot, changed: true };
}
