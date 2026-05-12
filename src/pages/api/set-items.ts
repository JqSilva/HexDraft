// src/pages/api/set-items.ts
import type { APIRoute } from 'astro';
import { getLockfileData } from '../../lib/lcu';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

export const POST: APIRoute = async ({ request }) => {
    const lcu = getLockfileData(); [cite: 131, 590]
    if (!lcu) return new Response(JSON.stringify({ error: "LCU no encontrado" }), { status: 404 });

    const auth = btoa(`riot:${lcu.token}`); [cite: 592, 623]
    const baseUrl = `https://127.0.0.1:${lcu.port}`;

    try {
        const body = await request.json();
        const { championId, championName, items, skillOrder } = body;

        // 1. Obtener Summoner ID (Requerido por el endpoint de items) [cite: 615]
        const resSummoner = await fetch(`${baseUrl}/lol-summoner/v1/current-summoner`, {
            headers: { 'Authorization': `Basic ${auth}` }
        });
        const summoner = await resSummoner.json();
        const summonerId = summoner.summonerId;

        // 2. Construir los bloques con tu formato específico
        const payload = {
            title: `HexDraft: ${championName} Build`,
            associatedMaps: [],
            associatedChampions: [Number(championId)], // Vincula el set al campeón
            blocks: [
                {
                    type: "Items Iniciales",
                    items: items.starter.map((id: any) => ({ id: String(id), count: 1 }))
                },
                {
                    type: "Build Recomendada",
                    items: items.core.map((i: any) => ({ id: String(i.id || i), count: 1 }))
                },
                {
                    type: "Botas Recomendadas",
                    items: [{ id: String(items.boots.id || items.boots), count: 1 }]
                },
                {
                    type: `Orden de habilidades: ${skillOrder}`,
                    items: [] // Bloque informativo
                },
                {
                    type: "Pociones y opcionales",
                    items: [
                        { id: "2003", count: 1 }, { id: "2031", count: 1 },
                        { id: "2138", count: 1 }, { id: "2139", count: 1 },
                        { id: "2140", count: 1 }, { id: "1083", count: 1 },
                        { id: "1082", count: 1 }, { id: "3175", count: 1 }
                    ]
                }
            ]
        };

        // 3. Obtener sets actuales para no borrarlos, solo actualizar los de HexDraft [cite: 625, 626]
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

        // 4. Enviar actualización al cliente [cite: 630]
        const response = await fetch(`${baseUrl}/lol-item-sets/v1/item-sets/${summonerId}/sets`, {
            method: 'PUT',
            headers: { 
                'Authorization': `Basic ${auth}`, 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(finalPayload)
        });

        if (!response.ok) throw new Error("Error LCU al guardar items");

        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
};