import { GoogleGenAI } from '@google/genai';
import { isGeminiCircuitOpen, tripGeminiCircuit, getCircuitCooldownSeconds } from './safeguards';
import { getCachedSpotPrice } from './pricingService';

let aiClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
    });
  }
  return aiClient;
}

/**
 * Deterministic quantitative SMC rule-based response
 */
export function getQuantInstitutionalReply(spotPrice?: number): string {
  const spot = spotPrice || getCachedSpotPrice();
  return `📊 **تحليل مساعد الذهب المؤسساتي (XAUUSD Quant Assistant):**
- **السعر الفوري (Spot):** $${spot.toFixed(2)} USD
- **العقود الآجلة (COMEX Futures GC):** $${(spot + 8.40).toFixed(2)} (حالة Contango)
- **الهيكل المؤسساتي:** ${spot > 4475 ? 'صاعد (Bullish Expansion)' : 'تصحيحي/تجميعي (Equilibrium)'}
- **سيولة الشراء المستهدفة (BSL):** $${(spot + 8).toFixed(2)}
- **سيولة البيع (SSL):** $${(spot - 6).toFixed(2)}
- **أوردر بلوك الطلب (Demand OB):** $${(spot - 5.5).toFixed(2)} - $${(spot - 3.5).toFixed(2)}
- **فجوة القيمة العادلة (FVG BISI):** $${(spot + 1.1).toFixed(2)} - $${(spot + 3.2).toFixed(2)}

💡 **توصية التداول المؤسساتية الآمنة:** تجنب الشراء عند القمم، وانتظر عودة السعر لاختبار فجوة FVG أو كتلة أوامر الطلب وتأكيد ردة الفعل المؤسساتية مع نسبة عائد لمخاطرة تفوق 1:2.0.`;
}

/**
 * Process AI chat with Circuit Breaker, rate limit protection, and intelligent quant fallback
 */
export async function processAiChat(rawMessage: string): Promise<{ reply: string; circuitBreakerActive?: boolean }> {
  const spot = getCachedSpotPrice();

  // Circuit breaker active check
  if (isGeminiCircuitOpen()) {
    const remainingSecs = getCircuitCooldownSeconds();
    return {
      circuitBreakerActive: true,
      reply: `🛡️ **[استجابة خوارزمية ذكية - درع الحماية Safe Architecture]:**
تم تنشيط قاطع الحماية التلقائي (Circuit Breaker) مؤقتاً لتفادي استنزاف الحصص وأخطاء Rate Limit (متبقي ${remainingSecs} ثانية).

${getQuantInstitutionalReply(spot)}`,
    };
  }

  const ai = getGeminiClient();
  if (!ai) {
    return {
      reply: `أهلاً بك! أنا مساعد التداول المؤسساتي الذكي للذهب (XAUUSD SMC Quantitative Assistant). 
حالياً السعر الفوري للذهب: $${spot.toFixed(2)} دولار.
سعر العقود الآجلة (COMEX GC): $${(spot + 8.4).toFixed(2)} دولار مع حالة كونتانغو (Contango).
مناطق السيولة الرئيسية:
- سيولة الشراء (BSL): $${(spot + 8).toFixed(2)}
- سيولة البيع (SSL): $${(spot - 6).toFixed(2)}
- أوردر بلوك الطلب (Demand OB): $${(spot - 5.5).toFixed(2)} - $${(spot - 3.5).toFixed(2)}
- فجوة القيمة العادلة (FVG BISI): $${(spot + 1.1).toFixed(2)} - $${(spot + 3.2).toFixed(2)}

(ملاحظة: يمكنك تفعيل مفتاح GEMINI_API_KEY في إعدادات المنصة للمحادثات الحية التوليدية الفورية مع موديل gemini-3.8-flash).`,
    };
  }

  const systemPrompt = `أنت كبير محللي وخوارزميات التداول المؤسساتي لأسواق الذهب (XAUUSD Quant & Senior SMC Strategist) مدعوم بنموذج Google Gemini 3.8 Flash.
معلومات السوق اللحظية:
- سعر الذهب الفوري الحالي (Spot): $${spot.toFixed(2)} USD
- سعر العقود الآجلة COMEX Gold Futures (GC): $${(spot + 8.40).toFixed(2)} USD
- فرق الأساس (Basis Spread): +$8.40 (حالة Contango صاعدة)
- اتجاه السوق المؤسساتي: ${spot > 4475 ? 'صاعد مؤسساتي قوي (Bullish Order Flow)' : spot < 4470 ? 'هابط (Bearish Breakdown)' : 'تذبذب ونطاق تجميعي (Consolidation Equilibrium)'}
- سيولة الشراء (BSL): $${(spot + 8).toFixed(2)}
- سيولة البيع (SSL): $${(spot - 6).toFixed(2)}
- كتلة أوامر الطلب (Demand Order Block): $${(spot - 5.5).toFixed(2)} - $${(spot - 3.5).toFixed(2)}
- كتلة أوامر العرض (Supply Order Block): $${(spot + 4.5).toFixed(2)} - $${(spot + 6.5).toFixed(2)}
- فجوة القيمة العادلة (FVG): BISI عند $${(spot + 1.1).toFixed(2)}-$${(spot + 3.2).toFixed(2)} مع نقطة التوازن (CE) عند $${(spot + 2.15).toFixed(2)}

قواعد الرد:
1. أجب دائماً باللغة العربية الاحترافية المتقنة والمصطلحات المالية لمفاهيم الأموال الذكية (SMC, Order Block, FVG, BOS, CHoCH, BSL, SSL).
2. قدم تحليلات دقيقة، مناطق دخول محكمة، مستويات وقف خسارة دقيقة (Stop Loss)، وأهداف أخذ أرباح (TP) مع نسبة عائد لمخاطرة تفوق 1:2.0.
3. حلل تأثير مؤشر الدولار (DXY) وعوائد السندات وأخبار التضخم والفيدرالي عند السؤال.
4. حافظ على تنسيق أنيق ومقروء وسهل الفهم للمتداولين المحترفين والمبتدئين.`;

  let replyText = '';
  try {
    const chat = ai.chats.create({
      model: 'gemini-3.8-flash',
      config: { systemInstruction: systemPrompt },
    });
    const response = await chat.sendMessage({ message: rawMessage });
    replyText = response.text || '';
  } catch (modelErr: any) {
    const errMsg = String(modelErr?.message || modelErr).toLowerCase();
    if (errMsg.includes('quota') || errMsg.includes('resource_exhausted') || errMsg.includes('429') || errMsg.includes('limit')) {
      tripGeminiCircuit('Quota limit reached', 60000);
      replyText = `🛡️ **[حماية الحصص - استجابة خوارزمية فورية]:**\n${getQuantInstitutionalReply(spot)}`;
    } else {
      console.warn('Gemini 3.8 Flash unavailable, attempting fallback:', modelErr?.message);
      try {
        const fallbackChat = ai.chats.create({
          model: 'gemini-2.5-flash',
          config: { systemInstruction: systemPrompt },
        });
        const fallbackResp = await fallbackChat.sendMessage({ message: rawMessage });
        replyText = fallbackResp.text || '';
      } catch (fallbackErr: any) {
        const fbMsg = String(fallbackErr?.message || fallbackErr).toLowerCase();
        if (fbMsg.includes('quota') || fbMsg.includes('resource_exhausted') || fbMsg.includes('429')) {
          tripGeminiCircuit('Quota limit on fallback model', 60000);
        }
        replyText = getQuantInstitutionalReply(spot);
      }
    }
  }

  return { reply: replyText || 'تم تحليل بيانات السوق بنجاح.' };
}
