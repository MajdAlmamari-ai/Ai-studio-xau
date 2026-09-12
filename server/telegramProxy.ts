import { activeSafeguards, checkRateLimit } from './safeguards';

export interface TelegramDispatchResult {
  success: boolean;
  messageId?: number;
  error?: string;
}

/**
 * Proxy dispatch to Telegram Bot API with rate limiting and kill-switch checks
 */
export async function dispatchToTelegram(
  clientIp: string,
  botToken: string,
  chatId: string,
  messageHtml: string
): Promise<TelegramDispatchResult> {
  // 1. Check emergency kill switch
  if (activeSafeguards.emergencyKillSwitch) {
    return {
      success: false,
      error: '⚠️ تم تفعيل قاطع التداول الطارئ (Emergency Kill Switch). تم تعليق إرسال رسائل وتوصيات تيليجرام لحماية رأس المال.',
    };
  }

  // 2. Check rate limit (10 dispatches per minute)
  if (!checkRateLimit(`tg_${clientIp}`, 10, 60000)) {
    return {
      success: false,
      error: 'تم تجاوز معدل الإرسال المسموح (10 رسائل في الدقيقة). يرجى الانتظار دقيقة واحدة.',
    };
  }

  const cleanToken = String(botToken || '').trim();
  const cleanChatId = String(chatId || '').trim();
  const cleanHtml = String(messageHtml || '').slice(0, 4096);

  if (!cleanToken || !cleanChatId || !cleanHtml) {
    return {
      success: false,
      error: 'البيانات غير مكتملة (botToken, chatId, messageHtml مطلوبة)',
    };
  }

  try {
    const telegramEndpoint = `https://api.telegram.org/bot${cleanToken}/sendMessage`;
    const tgRes = await fetch(telegramEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: cleanChatId,
        text: cleanHtml,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    const tgData = await tgRes.json();
    if (!tgRes.ok || !tgData.ok) {
      return {
        success: false,
        error: tgData.description || 'فشل إيصال الرسالة إلى قناة تيليجرام',
      };
    }

    return {
      success: true,
      messageId: tgData.result?.message_id,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'خطأ غير متوقع أثناء الاتصال بخوادم تيليجرام',
    };
  }
}
