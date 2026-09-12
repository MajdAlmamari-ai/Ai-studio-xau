import { SMCAnalysis } from '../types';

/**
 * Formats SMC Analysis into an institutional Telegram message with HTML formatting in Arabic
 */
export function formatTelegramReport(analysis: SMCAnalysis, customTimestamp?: string): string {
  const time = customTimestamp || new Date().toLocaleString('ar-EG');
  const biasEmoji = analysis.bias === 'BULLISH' ? '🟢 صاعد (Bullish)' : analysis.bias === 'BEARISH' ? '🔴 هابط (Bearish)' : '🟡 متذبذب (Neutral)';
  const actionEmoji = analysis.action === 'BUY' ? '🚀 شراء مؤسساتي (BUY)' : analysis.action === 'SELL' ? '🔻 بيع مؤسساتي (SELL)' : '⏳ انتظار وتجميع (WAIT)';

  return `<b>🏆 تقرير تداول الذهب المؤسساتي (XAUUSD - SMC REPORT)</b>
━━━━━━━━━━━━━━━━━━━━━━
⏱ <b>التوقيت:</b> <code>${time}</code>
💰 <b>السعر الفوري للذهب:</b> <b>$${analysis.currentPrice.toFixed(2)}</b>
📊 <b>اتجاه السوق (Market Bias):</b> ${biasEmoji}
🧱 <b>هيكل السوق (Structure):</b> <i>${analysis.structure}</i>
🎯 <b>درجة التوافق المؤسساتي:</b> <b>${analysis.confluenceScore}%</b>

<b>⚡ التوصية الفورية وخطة الدخول:</b>
🎯 <b>الإشارة:</b> <b>${actionEmoji}</b>
📍 <b>منطقة الدخول الموصى بها:</b> <code>$${analysis.entryZone.min.toFixed(2)} - $${analysis.entryZone.max.toFixed(2)}</code>
🛑 <b>وقف الخسارة (Stop Loss):</b> <code>$${analysis.stopLoss.toFixed(2)}</code>
🎯 <b>جني الأرباح (Take Profit):</b> <code>$${analysis.takeProfit.toFixed(2)}</code>
⚖️ <b>العائد للمخاطرة (RR Ratio):</b> <b>${analysis.riskRewardRatio}</b>

<b>💧 مناطق السيولة المؤسساتية (Liquidity):</b>
• <b>سيولة الشراء (BSL):</b> <code>$${analysis.bsl.toFixed(2)}</code> (أوامر وقف الشراء)
• <b>سيولة البيع (SSL):</b> <code>$${analysis.ssl.toFixed(2)}</code> (أوامر وقف البيع)
• <b>المقاومة المحورية:</b> <code>$${analysis.resistance.toFixed(2)}</code>
• <b>الدعم المحوري:</b> <code>$${analysis.support.toFixed(2)}</code>

<b>🏛️ كتل الأوامر وفجوات القيمة (OB & FVG):</b>
• <b>أوردر بلوك الطلب (Demand OB):</b> <code>$${analysis.bullishOB.min.toFixed(2)} - $${analysis.bullishOB.max.toFixed(2)}</code> ${analysis.bullishOB.freshnessScore !== undefined ? `[نضارة: ${analysis.bullishOB.freshnessScore}%]` : ''}
• <b>أوردر بلوك العرض (Supply OB):</b> <code>$${analysis.bearishOB.min.toFixed(2)} - $${analysis.bearishOB.max.toFixed(2)}</code> ${analysis.bearishOB.freshnessScore !== undefined ? `[نضارة: ${analysis.bearishOB.freshnessScore}%]` : ''}
• <b>الفاليو قاب (FVG):</b> <code>$${(analysis.currentPrice + 1.1).toFixed(2)} - $${(analysis.currentPrice + 3.2).toFixed(2)}</code>

<b>🧠 القراءة والتحليل التكتيكي:</b>
<i>${analysis.reason}</i>
━━━━━━━━━━━━━━━━━━━━━━
🤖 <i>تم التوليد تلقائياً عبر بوت الذهب المؤسساتي SMC Quant Bot (دورة 15M)</i>`;
}

/**
 * Formats a plain text / markdown version for clipboard
 */
export function formatMarkdownReport(analysis: SMCAnalysis, customTimestamp?: string): string {
  const time = customTimestamp || new Date().toLocaleString('ar-EG');
  const biasEmoji = analysis.bias === 'BULLISH' ? '🟢 صاعد' : analysis.bias === 'BEARISH' ? '🔴 هابط' : '🟡 متذبذب';
  const actionEmoji = analysis.action === 'BUY' ? '🚀 شراء (BUY)' : analysis.action === 'SELL' ? '🔻 بيع (SELL)' : '⏳ انتظار (WAIT)';

  return `🏆 تقرير تداول الذهب المؤسساتي (XAUUSD - SMC REPORT)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏱ التوقيت: ${time}
💰 السعر الفوري الحالي: $${analysis.currentPrice.toFixed(2)}
📊 اتجاه السوق: ${biasEmoji}
🧱 هيكل السوق: ${analysis.structure}
🎯 قوة التوافق: ${analysis.confluenceScore}%

⚡ خطة التداول والتنفيذ:
🎯 الإشارة: ${actionEmoji}
📍 منطقة الدخول: $${analysis.entryZone.min.toFixed(2)} - $${analysis.entryZone.max.toFixed(2)}
🛑 وقف الخسارة (SL): $${analysis.stopLoss.toFixed(2)}
🎯 جني الأرباح (TP): $${analysis.takeProfit.toFixed(2)}
⚖️ نسبة العائد للمخاطرة: ${analysis.riskRewardRatio}

💧 مناطق السيولة الرئيسية:
• سيولة الشراء (BSL): $${analysis.bsl.toFixed(2)}
• سيولة البيع (SSL): $${analysis.ssl.toFixed(2)}
• مقاومة مؤسساتية: $${analysis.resistance.toFixed(2)}
• دعم مؤسساتي: $${analysis.support.toFixed(2)}

🏛️ كتل الأوامر (Order Blocks):
• كتلة الطلب (Demand OB): $${analysis.bullishOB.min.toFixed(2)} - $${analysis.bullishOB.max.toFixed(2)} ${analysis.bullishOB.freshnessScore !== undefined ? `(نضارة: ${analysis.bullishOB.freshnessScore}%)` : ''}
• كتلة العرض (Supply OB): $${analysis.bearishOB.min.toFixed(2)} - $${analysis.bearishOB.max.toFixed(2)} ${analysis.bearishOB.freshnessScore !== undefined ? `(نضارة: ${analysis.bearishOB.freshnessScore}%)` : ''}

🧠 التحليل والسببية:
${analysis.reason}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 بوت الذهب المؤسساتي SMC • تحديث دوري كل 15 دقيقة`;
}

export interface TelegramDispatchResult {
  success: boolean;
  messageId?: number;
  error?: string;
}

/**
 * Sends message to Telegram channel or bot chat through backend proxy or direct API
 */
export async function sendTelegramMessage(
  token: string,
  chatId: string,
  messageHtml: string
): Promise<TelegramDispatchResult> {
  const trimmedToken = token.trim();
  const trimmedChatId = chatId.trim();

  if (!trimmedToken) {
    return { success: false, error: 'رمز البوت BOT_TOKEN مفقود. يرجى إدخال التوكن من @BotFather.' };
  }

  if (!trimmedChatId) {
    return { success: false, error: 'معرف الدردشة CHAT_ID مفقود. يرجى إدخال معرف القناة أو الشات الخاص بك.' };
  }

  // Attempt 1: Via local backend proxy
  try {
    const proxyRes = await fetch('/api/telegram/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        botToken: trimmedToken,
        chatId: trimmedChatId,
        messageHtml,
      }),
    });

    if (proxyRes.ok) {
      const pData = await proxyRes.json();
      if (pData.success) {
        return { success: true, messageId: pData.messageId };
      }
    }
  } catch (err) {
    // Proceed to direct fallback
  }

  // Attempt 2: Direct Telegram API
  const url = `https://api.telegram.org/bot${trimmedToken}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: trimmedChatId,
        text: messageHtml,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      let friendlyError = data.description || 'فشل إرسال الرسالة إلى تيليجرام';
      if (response.status === 401 || data.error_code === 401) {
        friendlyError = 'رمز البوت غير صالح (Unauthorized). يرجى التحقق من التوكن الصادر من @BotFather.';
      } else if (response.status === 400 && data.description?.includes('chat not found')) {
        friendlyError = `لم يتم العثور على الدردشة: يرجى التأكد من إرسال رسالة (/start) للبوت أولاً، أو إضافة البوت كمسؤول (Admin) في القناة.`;
      }
      return { success: false, error: friendlyError };
    }

    return { success: true, messageId: data.result?.message_id };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'خطأ في الاتصال بخوادم تيليجرام',
    };
  }
}
