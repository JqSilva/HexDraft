/**
 * Servicio de notificaciones Telegram para enviar alertas desde componentes React o servicios del cliente.
 * 
 * @param message - El contenido del mensaje de texto a enviar al bot de Telegram.
 * @returns Promise<boolean> - Devuelve true si la notificación fue aceptada exitosamente.
 */
export const notifyTelegram = async (message: string): Promise<boolean> => {
  try {
    const res = await fetch('/api/telegram-notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    return res.ok;
  } catch (e) {
    console.error('[TelegramService] Error al enviar notificación por Telegram:', e);
    return false;
  }
};
