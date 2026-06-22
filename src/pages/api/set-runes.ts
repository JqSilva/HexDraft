import type { APIRoute } from 'astro';
import { getLockfileData } from '../../lib/services/lcu.service.js';

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

        // 2. Buscamos la primera página que el usuario pueda editar (que no sea una predeterminada de Riot)
        const editablePage = pages.find((p: any) => p.isEditable);

        if (!editablePage) {
            return new Response(JSON.stringify({ error: "No se encontró una página de runas editable. Crea una nueva en el cliente." }), { status: 400 });
        }

        // 3. Preparamos el payload con los IDs forzados a números
        const updatedPage = {
            ...editablePage,
            name: body.name || "HexDraft Build",
            primaryStyleId: Number(body.primaryStyleId),
            subStyleId: Number(body.subStyleId),
            selectedPerkIds: body.selectedPerkIds.map((id: any) => Number(id)),
            current: true // Esto hace que el cliente la seleccione automáticamente
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

        console.log(`📤 [LCU EXPORT RUNES] ${body.name || "HexDraft Build"}`);
        console.log(`   Primary Style ID: ${body.primaryStyleId}`);
        console.log(`   Sub Style ID: ${body.subStyleId}`);
        console.log(`   Selected Perks:`, body.selectedPerkIds);

        return new Response(JSON.stringify({ success: true }), { status: 200 });

    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
};