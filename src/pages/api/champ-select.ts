import type { APIRoute } from 'astro';
import { getLockfileData } from '../../lib/services/lcu.service.js';
import { getLastExecutedChampionId } from './execute-action.js';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

export const GET: APIRoute = async () => {
  const lcu = getLockfileData();
  if (!lcu) {
    return new Response(JSON.stringify({ error: "LCU no encontrado" }), { status: 404 });
  }

  const auth = btoa(`riot:${lcu.token}`);

  try {
    const response = await fetch(
      `https://127.0.0.1:${lcu.port}/lol-champ-select/v1/session`,
      {
        method: 'GET',
        headers: { 
          'Authorization': `Basic ${auth}`, 
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.status === 404) {
      return new Response(JSON.stringify({ inDraft: false }), { status: 200 });
    }
    
    const data = await response.json();

    
    const deadline = data.timer.phaseDeadline || 0;
    const current = data.timer.internalNow || 0;
    const diff = deadline - current;

    // === DETECTOR REAL DE FASE DE BANS ===
    let isBanPhase = false;
    if (data.timer && data.timer.phase === 'BAN') {
      isBanPhase = true;
    } else if (data.actions && Array.isArray(data.actions)) {
      const activeActionGroup = data.actions.find((group: any) => 
        Array.isArray(group) && group.some((action: any) => action.isInProgress)
      );
      
      if (activeActionGroup) {
        const currentAction = activeActionGroup.find((a: any) => a.isInProgress);
        if (currentAction && currentAction.type === 'ban') {
          isBanPhase = true;
        }
      }
    }
    
    return new Response(JSON.stringify({ 
      inDraft: true, 
      myTeam: data.myTeam || [], 
      theirTeam: data.theirTeam || [],
      timer: data.timer,
      actions: data.actions || [],
      localPlayerCellId: data.localPlayerCellId,
      isBanPhase: isBanPhase,
      lastExecutedChampionId: getLastExecutedChampionId(), // <-- Enviamos esto masticado al frontend
      data: data
    }), { status: 200 });

  } catch (e) {
    console.error("Error detallado:", e);
    return new Response(JSON.stringify({ error: "Error de conexión", details: e.message }), { status: 500 });
  }
};