import test from 'node:test';
import assert from 'node:assert/strict';
import { preselectLcuChampion, executeLcuAction } from '../src/components/react/draft/utils.ts';

test('preselectLcuChampion - Validaciones exhaustivas de preselección LCU', async (t) => {

    await t.test('1. Rechaza si no hay sesión activa de Champion Select (inDraft: false)', async () => {
        const result = await preselectLcuChampion({
            championId: 103, // Ahri
            isBan: false,
            sessionData: { inDraft: false }
        });
        assert.equal(result.success, false);
        assert.equal(result.reason, 'NOT_IN_DRAFT');
    });

    await t.test('2. Rechaza identificador de campeón inválido (<= 0)', async () => {
        const result = await preselectLcuChampion({
            championId: 0,
            isBan: false,
            sessionData: { inDraft: true, localPlayerCellId: 2 }
        });
        assert.equal(result.success, false);
        assert.equal(result.reason, 'INVALID_CHAMPION');
    });

    await t.test('3. Rechaza campeón que ya está bloqueado por otro jugador', async () => {
        const sessionData = {
            inDraft: true,
            localPlayerCellId: 0,
            myTeam: [{ cellId: 0, championId: 0 }, { cellId: 1, championId: 103 }], // 103 bloqueado
            theirTeam: [],
            actions: []
        };
        const result = await preselectLcuChampion({
            championId: 103,
            isBan: false,
            sessionData
        });
        assert.equal(result.success, false);
        assert.equal(result.reason, 'CHAMPION_UNAVAILABLE');
    });

    await t.test('4. Rechaza campeón que ya fue baneado en la sesión', async () => {
        const sessionData = {
            inDraft: true,
            localPlayerCellId: 0,
            myTeam: [{ cellId: 0, championId: 0 }],
            theirTeam: [],
            actions: [
                [{ id: 1, actorCellId: 5, championId: 84, type: 'ban', completed: true }] // Akali baneada
            ]
        };
        const result = await preselectLcuChampion({
            championId: 84,
            isBan: false,
            sessionData
        });
        assert.equal(result.success, false);
        assert.equal(result.reason, 'CHAMPION_UNAVAILABLE');
    });

    await t.test('5. Bans: NUNCA usa championPickIntent fuera de turno activo de ban', async () => {
        const sessionData = {
            inDraft: true,
            localPlayerCellId: 0,
            myTeam: [{ cellId: 0, championId: 0 }],
            theirTeam: [],
            timer: { phase: 'PLANNING' },
            actions: []
        };
        const result = await preselectLcuChampion({
            championId: 84,
            isBan: true, // intento de baneo
            sessionData
        });
        assert.equal(result.success, false);
        assert.equal(result.reason, 'NOT_YOUR_TURN');
        assert.match(result.message, /turno de bloqueo/i);
    });

    await t.test('6. Picks: Rechaza si el jugador local ya bloqueó su elección definitivamente', async () => {
        const sessionData = {
            inDraft: true,
            localPlayerCellId: 0,
            myTeam: [{ cellId: 0, championId: 99 }], // Ya tiene Lux bloqueada
            theirTeam: [],
            actions: []
        };
        const result = await preselectLcuChampion({
            championId: 103,
            isBan: false,
            sessionData
        });
        assert.equal(result.success, false);
        assert.equal(result.reason, 'ALREADY_LOCKED');
    });
});
