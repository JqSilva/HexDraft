import type { APIRoute } from 'astro';
import { getLockfileData } from '../../lib/services/lcu.service.js';
import { validateAndSanitizeRunePage } from '../../lib/engine/runeValidator.js';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

export const POST: APIRoute = async ({ request }) => {
    const lcu = getLockfileData();
    if (!lcu) return new Response(JSON.stringify({ error: "LCU no encontrado" }), { status: 404 });

    const auth = btoa(`riot:${lcu.token}`);
    const baseUrl = `https://127.0.0.1:${lcu.port}`;

    try {
        const body = await request.json();

        // 1. Buscamos TODAS las páginas de runas
        const resPages = await fetch(`${baseUrl}/lol-perks/v1/pages`, {
            headers: { 'Authorization': `Basic ${auth}` }
        });
        const pages = await resPages.json();

        // 2. Buscamos la página de runas más adecuada (la actualmente seleccionada, una de HexDraft, o la primera editable)
        const editablePage = pages.find((p: any) => p.isEditable && (p.current || p.isActive || (p.name && p.name.includes('HexDraft')))) ||
                             pages.find((p: any) => p.isEditable);

        // 3. Preparamos el payload validado canónicamente
        const rawSelections = Array.isArray(body.selectedPerkIds) ? body.selectedPerkIds.map(Number) : [];
        const rawShards = rawSelections.length > 6 ? rawSelections.slice(6) : (body.shards || []);
        const cleanRunes = rawSelections.slice(0, 6);

        const sanitized = validateAndSanitizeRunePage(
            cleanRunes,
            rawShards,
            Number(body.primaryStyleId) || undefined,
            Number(body.subStyleId) || undefined
        );

        if (!editablePage) {
            // Intentar crear una nueva página si el cliente no tiene una editable
            const createRes = await fetch(`${baseUrl}/lol-perks/v1/pages`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Basic ${auth}`, 
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: body.name || "HexDraft Build",
                    primaryStyleId: sanitized.primaryStyleId,
                    subStyleId: sanitized.subStyleId,
                    selectedPerkIds: [...sanitized.selections, ...sanitized.shards],
                    current: true
                })
            });

            if (!createRes.ok) {
                return new Response(JSON.stringify({ error: "No se encontró una página de runas editable. Por favor crea o vacía una página en el cliente." }), { status: 400 });
            }
        } else {
            const updatedPage = {
                ...editablePage,
                name: body.name || "HexDraft Build",
                primaryStyleId: sanitized.primaryStyleId,
                subStyleId: sanitized.subStyleId,
                selectedPerkIds: [...sanitized.selections, ...sanitized.shards],
                current: true
            };

            // 4. Enviamos el PUT para actualizar esa página específica
            const response = await fetch(`${baseUrl}/lol-perks/v1/pages/${editablePage.id}`, {
                method: 'PUT',
                headers: { 
                    'Authorization': `Basic ${auth}`, 
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updatedPage)
            });

            if (!response.ok) {
                const errorText = await response.text();
                return new Response(JSON.stringify({ error: "Error al actualizar", details: errorText }), { status: 400 });
            }
        }

        console.log(`📤 [LCU EXPORT RUNES] ${body.name || "HexDraft Build"}`);
        console.log(`   Primary Style ID: ${body.primaryStyleId}`);
        console.log(`   Sub Style ID: ${body.subStyleId}`);
        console.log(`   Selected Perks:`, body.selectedPerkIds);

        return new Response(JSON.stringify({ success: true }), { status: 200 });

    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
};