import {
  scoreBuildVariant,
  scoreEvidence100,
  scoreItemOption,
  scorePickRecommendation,
  scoreRunePage
} from '../src/lib/engine/recommendationScoring.js';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
  console.log(`[PASS] ${message}`);
}

const mature = scoreEvidence100({ pickrate: 12, winrate: 52, games: 5000 });
const inflated = scoreEvidence100({ pickrate: 1, winrate: 65, games: 12 });
assert(mature.score > inflated.score, 'La evidencia madura supera al WR inflado de una muestra pequeña');

const normalBuild = scoreBuildVariant(
  { pickrate: 10, winrate: 52, games: 2500 },
  { matchupFit: 50, compositionFit: 50, coherence: 100 }
);
const contextualBuild = scoreBuildVariant(
  { pickrate: 7, winrate: 51.5, games: 1800 },
  { matchupFit: 90, compositionFit: 85, coherence: 100 }
);
assert(contextualBuild.score > normalBuild.score, 'El contexto puede superar una build ligeramente más popular');

const completePage = scoreRunePage({ pickrate: 18, winrate: 52.5, games: 9000 });
const marginalRunes = scoreEvidence100({ pickrate: 25, winrate: 53, games: 300 });
assert(completePage.score > 0 && completePage.confidence > 0.9, 'Una página completa con mucha evidencia obtiene alta confianza');
assert(marginalRunes.score < completePage.score, 'Una combinación marginal no supera automáticamente una página consolidada');

const antiTank = scoreItemOption(
  { pickrate: 4, winrate: 51, games: 1200 },
  { matchupFit: 95, compositionFit: 90, coherence: 100 }
);
const genericItem = scoreItemOption(
  { pickrate: 10, winrate: 52, games: 6000 },
  { matchupFit: 50, compositionFit: 50, coherence: 100 }
);
assert(antiTank.score > genericItem.score, 'Un item situacional puede superar al popular cuando responde al draft');

const earlyPick = scorePickRecommendation(
  { pickrate: 10, winrate: 52, games: 5000 },
  { phase: 'pick1', matchupFit: 50, compositionFit: 50 }
);
const latePick = scorePickRecommendation(
  { pickrate: 10, winrate: 52, games: 5000 },
  { phase: 'pick5', matchupFit: 90, compositionFit: 80 }
);
assert(latePick.score > earlyPick.score, 'El último pick aprovecha más la información de matchup y composición');

console.log('Pruebas de recommendation scoring completadas.');

