import type { APIRoute } from 'astro';
import { configRepo } from '../../lib/db/config.repo.js';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { message } = await request.json();

    if (!message) {
      return new Response(
        JSON.stringify({ error: "Mensaje vacío" }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const configs = configRepo.getAllConfigs();
    const enabled = configs.telegram_notifications_enabled === 'true';
    const botToken = configs.telegram_bot_token;
    const chatId = configs.telegram_chat_id;

    if (!enabled) {
      return new Response(
        JSON.stringify({ success: true, sent: false, reason: "Notificaciones desactivadas en configuración" }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!botToken || !chatId) {
      return new Response(
        JSON.stringify({ error: "Telegram no configurado. Falta Token o Chat ID" }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[TELEGRAM] Enviando mensaje: "${message}"`);

    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `<b>HexDraft</b>\n\n${message}`,
        parse_mode: 'HTML'
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.description || "Fallo en la petición a Telegram");
    }

    return new Response(
      JSON.stringify({ success: true, sent: true, message }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (e: any) {
    console.error("[ERROR] Error enviando mensaje a Telegram:", e.message);
    return new Response(
      JSON.stringify({ error: "Error enviando notificación a Telegram", details: e.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
