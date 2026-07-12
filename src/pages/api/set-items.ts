// src/pages/api/set-items.ts
import type { APIRoute } from 'astro';
import { getLockfileData } from '../../lib/services/lcu.service.js';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// buildSituationalBlock fue reemplazado por la lista estática común.

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

        // Construir la Build Principal (core recomendado)
        const mainBuildItemsSet = new Set<string>();
        const mainBuildItemsList: any[] = [];

        (coreItems || []).forEach((i: any) => {
            const id = getCleanId(i);
            if (id) {
                mainBuildItemsSet.add(id);
                mainBuildItemsList.push({ id, count: 1 });
            }
        });

        // Filtrar objetos situacionales estáticos para no repetir lo que ya está en la build principal, iniciales o botas
        const filterSet = new Set<string>(mainBuildItemsSet);
        if (boots) {
            const bootsId = getCleanId(boots);
            if (bootsId) filterSet.add(bootsId);
        }
        (starter || []).forEach((i: any) => {
            const id = getCleanId(i);
            if (id) filterSet.add(id);
        });

        const COMMON_SITUATIONAL_IDS = [
            "3165", // Morellonomicon (Anti-curación AP)
            "3033", // Recordatorio Mortal (Anti-curación AD)
            "3075", // Cota de Espinas (Anti-curación Tank)
            "3135", // Bastón del Vacío (Penetración AP)
            "3036", // Recuerdos de Lord Dominik (Penetración AD)
            "3157", // Reloj de Arena de Zhonya (Defensa/AP)
            "3026", // Ángel Guardián (Defensa/AD)
            "6657", // Rookern Kaénico (Resistencia Mágica)
            "3156"  // Fauces de Malmortius (Resistencia Mágica/AD)
        ];

        const situationalItems = COMMON_SITUATIONAL_IDS
            .filter(id => !filterSet.has(id))
            .map(id => ({ id, count: 1 }));

        // 2. Construir los bloques reorganizados
        const payload = {
            title: `HexDraft: ${championName}`,
            associatedMaps: [],
            associatedChampions: [Number(championId)], // Vincula el set al campeón
            blocks: [
                {
                    type: "Iniciales",
                    items: [
                        ...starter.map((i: any) => ({ id: String(i.id || i), count: 1 })),
                        ...(boots ? [{ id: String(boots.id || boots), count: 1 }] : [])
                    ]
                },
                {
                    type: "Build Recomendada",
                    items: mainBuildItemsList
                },
                {
                    type: "Situacionales",
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

        console.log(`📤 [LCU EXPORT ITEMS] ${championName} (ID: ${championId})`);
        console.log(`   Starter:`, starter.map((i: any) => typeof i === 'object' ? (i.id || i.itemId) : i));
        console.log(`   Boots:`, typeof boots === 'object' ? (boots.id || boots.itemId) : boots);
        console.log(`   Core:`, coreItems.map((i: any) => typeof i === 'object' ? (i.id || i.itemId) : i));

        return new Response(JSON.stringify({
            success: true
        }), { status: 200 });
    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
};
