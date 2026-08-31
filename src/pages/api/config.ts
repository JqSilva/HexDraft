// src/pages/api/config.ts
import type { APIRoute } from 'astro';
import { configRepo } from '../../lib/db/config.repo.js';

export const GET: APIRoute = async () => {
  try {
    const rawConfigs = configRepo.getAllConfigs();
    
    // Parsear campos complejos para retornar tipos de datos adecuados al cliente
    const parsedConfigs = {
      lol_path: rawConfigs.lol_path || 'C:\\Riot Games\\League of Legends\\lockfile',
      auto_pick: rawConfigs.auto_pick === 'true',
      auto_ban: rawConfigs.auto_ban === 'true',
      auto_execute_seconds: parseFloat(rawConfigs.auto_execute_seconds || '3.5') || 3.5,
      puppeteer_concurrency: parseInt(rawConfigs.puppeteer_concurrency || '3') || 3,
      last_sync_timestamp: rawConfigs.last_sync_timestamp || '-',
      last_lane_sync_timestamp: rawConfigs.last_lane_sync_timestamp || '-',
      meta_sync_frequency: rawConfigs.meta_sync_frequency !== undefined ? parseFloat(rawConfigs.meta_sync_frequency) : 2,
      auto_accept_enabled: rawConfigs.auto_accept_enabled === 'true',
      auto_accept_delay_pct: parseFloat(rawConfigs.auto_accept_delay_pct || '80') || 80,
      telegram_notifications_enabled: rawConfigs.telegram_notifications_enabled === 'true',
      telegram_bot_token: rawConfigs.telegram_bot_token || '',
      telegram_chat_id: rawConfigs.telegram_chat_id || '',
      telegram_deduplicate_enabled: rawConfigs.telegram_deduplicate_enabled !== 'false',
      engine_weights: JSON.parse(rawConfigs.engine_weights || '{}')
    };

    return new Response(JSON.stringify(parsedConfigs), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: 'Fallo al obtener configuraciones', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const payload = await request.json();
    const updates: Record<string, string> = {};

    // Mapeamos los campos del cliente hacia strings para guardarlos en SQLite
    if (payload.lol_path !== undefined) updates.lol_path = String(payload.lol_path);
    if (payload.auto_pick !== undefined) updates.auto_pick = payload.auto_pick ? 'true' : 'false';
    if (payload.auto_ban !== undefined) updates.auto_ban = payload.auto_ban ? 'true' : 'false';
    
    if (payload.auto_execute_seconds !== undefined) {
      const seconds = parseFloat(payload.auto_execute_seconds);
      if (!isNaN(seconds)) updates.auto_execute_seconds = String(seconds);
    }
    
    if (payload.puppeteer_concurrency !== undefined) {
      const concurrency = parseInt(payload.puppeteer_concurrency);
      if (!isNaN(concurrency)) updates.puppeteer_concurrency = String(concurrency);
    }
    
    if (payload.last_sync_timestamp !== undefined) {
      updates.last_sync_timestamp = String(payload.last_sync_timestamp);
    }

    if (payload.last_lane_sync_timestamp !== undefined) {
      updates.last_lane_sync_timestamp = String(payload.last_lane_sync_timestamp);
    }

    if (payload.meta_sync_frequency !== undefined) {
      const val = parseFloat(payload.meta_sync_frequency);
      if (!isNaN(val)) updates.meta_sync_frequency = String(val);
    }

    if (payload.auto_accept_enabled !== undefined) {
      updates.auto_accept_enabled = payload.auto_accept_enabled ? 'true' : 'false';
    }

    if (payload.auto_accept_delay_pct !== undefined) {
      const val = parseFloat(payload.auto_accept_delay_pct);
      if (!isNaN(val)) updates.auto_accept_delay_pct = String(val);
    }

    if (payload.telegram_notifications_enabled !== undefined) {
      updates.telegram_notifications_enabled = payload.telegram_notifications_enabled ? 'true' : 'false';
    }

    if (payload.telegram_bot_token !== undefined) {
      updates.telegram_bot_token = String(payload.telegram_bot_token).trim();
    }

    if (payload.telegram_chat_id !== undefined) {
      updates.telegram_chat_id = String(payload.telegram_chat_id).trim();
    }

    if (payload.telegram_deduplicate_enabled !== undefined) {
      updates.telegram_deduplicate_enabled = payload.telegram_deduplicate_enabled ? 'true' : 'false';
    }
    
    if (payload.engine_weights !== undefined) {
      updates.engine_weights = JSON.stringify(payload.engine_weights);
    }

    if (Object.keys(updates).length > 0) {
      configRepo.saveAllConfigs(updates);
    }

    return new Response(JSON.stringify({ success: true, message: 'Configuraciones guardadas' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: 'Error procesando configuraciones', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
