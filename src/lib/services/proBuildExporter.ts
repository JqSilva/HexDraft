import type { ProBuildData } from '../../hooks/useProBuild.js';
import { validateAndSanitizeRunePage } from '../engine/runeValidator.js';

export async function exportProBuildToClient(data: ProBuildData): Promise<boolean> {
  if (!data) return false;

  try {
    let spell1Id = Number(data.summoners[0] || 4);
    let spell2Id = Number(data.summoners[1] || 12);

    // Destello (ID 4) a la izquierda (tecla D)
    if (spell1Id === 4 || spell2Id === 4) {
      if (spell1Id !== 4) {
        const temp = spell1Id;
        spell1Id = 4;
        spell2Id = temp;
      }
    }

    // Aplastar / Smite (ID 11) a la derecha (tecla F)
    if (spell1Id === 11 || spell2Id === 11) {
      if (spell2Id !== 11) {
        const temp = spell2Id;
        spell2Id = 11;
        spell1Id = temp;
      }
    }

    const sanitizedRunes = validateAndSanitizeRunePage(
      data.runes.selections,
      data.runes.shards,
      data.runes.primaryStyleId,
      data.runes.subStyleId
    );

    const runePayload = {
      name: `HexDraft Pro: ${data.championName}`,
      primaryStyleId: sanitizedRunes.primaryStyleId,
      subStyleId: sanitizedRunes.subStyleId,
      selectedPerkIds: [
        ...sanitizedRunes.selections,
        ...sanitizedRunes.shards
      ]
    };

    const starterList = (data.starterItems || []).map((id: number) => ({ id }));
    const earlyList = data.earlyBuy ? [{ id: data.earlyBuy }] : [];
    const coreList = (data.coreItems || []).map((id: number) => ({ id }));

    const itemPayload = {
      championName: data.championName,
      items: {
        starter: [...starterList, ...earlyList],
        boots: { id: data.boots },
        core: coreList
      }
    };

    const spellPayload = {
      spell1Id,
      spell2Id
    };

    const baseUrl = typeof window !== 'undefined' ? '' : (process.env.APP_BASE_URL || 'http://localhost:4321');

    console.log(`[LCU EXPORT] Exportando automáticamente runas, objetos e invocadores para ${data.championName}...`);

    await Promise.all([
      fetch(`${baseUrl}/api/set-runes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(runePayload)
      }).catch(err => console.warn('[LCU EXPORT] Advertencia al exportar runas:', err)),

      fetch(`${baseUrl}/api/set-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itemPayload)
      }).catch(err => console.warn('[LCU EXPORT] Advertencia al exportar items:', err)),

      fetch(`${baseUrl}/api/set-spells`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(spellPayload)
      }).catch(err => console.warn('[LCU EXPORT] Advertencia al exportar invocadores:', err))
    ]);

    console.log(`[LCU EXPORT] Exportación automática completada exitosamente para ${data.championName}.`);
    return true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[LCU EXPORT] Error durante la exportación a LCU: ${msg}`);
    return false;
  }
}
