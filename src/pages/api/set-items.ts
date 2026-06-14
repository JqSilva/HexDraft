// src/pages/api/set-items.ts
import type { APIRoute } from 'astro';
import { getLockfileData } from '../../lib/services/lcu.service.js';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

function buildSituationalBlock(
    snowball: any[] = [],
    neutral: any[] = [],
    behind: any[] = [],
    mainBuildItems: any[] = [], // Excluidos de situacionales
    criticalSwaps: any[] = []
): any[] {
    const itemsSet = new Set<string>();
    const result: any[] = [];

    const getCleanId = (item: any): string | null => {
        if (!item) return null;
        if (typeof item === 'object') {
            const id = item.id || item.itemId || item.Id;
            return id ? String(id) : null;
        }
        return String(item);
    };

    const mainBuildSet = new Set<string>();
    (mainBuildItems || []).forEach(i => {
        const id = getCleanId(i);
        if (id) mainBuildSet.add(id);
    });

    // 1. Agregar swaps críticos (como Morellonomicón si se adapta)
    (criticalSwaps || []).forEach((swap: any) => {
        const withId = getCleanId(swap?.withItem);
        if (withId && !mainBuildSet.has(withId)) {
            itemsSet.add(withId);
        }
    });

    // 2. Agregar ítems de las 3 rutas
    const allPaths = [...(behind || []), ...(neutral || []), ...(snowball || [])];
    allPaths.forEach(item => {
        const id = getCleanId(item);
        if (id && !mainBuildSet.has(id)) {
            itemsSet.add(id);
        }
    });

    itemsSet.forEach(id => {
        result.push({ id, count: 1 });
    });

    return result;
}

export const POST: APIRoute = async ({ request }) => {
    const lcu = getLockfileData(); 
    if (!lcu) return new Response(JSON.stringify({ error: "LCU no encontrado" }), { status: 404 });

    const auth = btoa(`riot:${lcu.token}`); 
    const baseUrl = `https://127.0.0.1:${lcu.port}`;

    try {
        const body = await request.json();
        const { championId, championName, items, skillOrder, criticalSwaps } = body;

        // 1. Obtener Summoner ID (Requerido por el endpoint de items)
        const resSummoner = await fetch(`${baseUrl}/lol-summoner/v1/current-summoner`, {
            headers: { 'Authorization': `Basic ${auth}` }
        });
        const summoner = await resSummoner.json();
        const summonerId = summoner.summonerId;

        const snowball = items.paths?.snowball || [];
        const neutral = items.paths?.neutral || [];
        const behind = items.paths?.behind || [];
        const coreItems = items.core || [];
        const starter = items.starter || [];
        const boots = items.boots;

        const getCleanId = (item: any): string | null => {
            if (!item) return null;
            if (typeof item === 'object') {
                const id = item.id || item.itemId || item.Id;
                return id ? String(id) : null;
            }
            return String(item);
        };

        // Construir la Build Principal (core completo: core + items del neutral path) de-duplicados
        const mainBuildItemsSet = new Set<string>();
        const mainBuildItemsList: any[] = [];

        (coreItems || []).forEach((i: any) => {
            const id = getCleanId(i);
            if (id) {
                mainBuildItemsSet.add(id);
                mainBuildItemsList.push({ id, count: 1 });
            }
        });

        (neutral || []).forEach((i: any) => {
            const id = getCleanId(i);
            if (id && !mainBuildItemsSet.has(id)) {
                mainBuildItemsSet.add(id);
                mainBuildItemsList.push({ id, count: 1 });
            }
        });

        // Los situacionales serán la combinación de snowball, neutral, y defensive, excluyendo lo que ya está en la Build Principal
        const situationalItems = buildSituationalBlock(
            snowball,
            neutral,
            behind,
            mainBuildItemsList.map(x => x.id),
            criticalSwaps || items.coreItemSwaps || []
        );

        // 2. Construir los bloques reorganizados
        const payload = {
            title: `HexDraft: ${championName} Build`,
            associatedMaps: [],
            associatedChampions: [Number(championId)], // Vincula el set al campeón
            blocks: [
                {
                    type: "Inicio",
                    items: [
                        ...starter.map((i: any) => ({ id: String(i.id || i), count: 1 })),
                        ...(boots ? [{ id: String(boots.id || boots), count: 1 }] : [])
                    ]
                },
                {
                    type: "Build Principal",
                    items: mainBuildItemsList
                },
                {
                    type: "Situacionales — Ajusta según la partida",
                    items: situationalItems
                },
                {
                    type: `Habilidades: ${skillOrder} | Consumibles y Elíxires`,
                    items: [
                        { id: "2003", count: 1 },
                        { id: "2031", count: 1 },
                        { id: "2138", count: 1 },
                        { id: "2139", count: 1 },
                        { id: "2140", count: 1 },
                        { id: "1083", count: 1 },
                        { id: "1082", count: 1 },
                        { id: "3175", count: 1 }
                    ]
                }
            ]
        };

        // 3. Obtener sets actuales para no borrarlos, solo actualizar los de HexDraft
        const resSets = await fetch(`${baseUrl}/lol-item-sets/v1/item-sets/${summonerId}/sets`, {
            headers: { 'Authorization': `Basic ${auth}` }
        });
        const currentData = await resSets.json();
        
        // Filtramos para reemplazar el anterior de HexDraft si existe
        const otherSets = (currentData.itemSets || []).filter((s: any) => !s.title.startsWith("HexDraft:"));
        
        const finalPayload = {
            ...currentData,
            itemSets: [...otherSets, payload]
        };

        // 4. Enviar actualización al cliente
        const response = await fetch(`${baseUrl}/lol-item-sets/v1/item-sets/${summonerId}/sets`, {
            method: 'PUT',
            headers: { 
                'Authorization': `Basic ${auth}`, 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(finalPayload)
        });

        if (!response.ok) throw new Error("Error LCU al guardar items");

        return new Response(JSON.stringify({
            success: true
        }), { status: 200 });
    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
};
