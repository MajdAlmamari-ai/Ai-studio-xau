/**
 * @file spotRecommendationRoutes.ts
 * @description مسار Fastify لتوفير توصيات السعر الفوري (Spot XAUUSD) اللحظية.
 * يدمج بين محركات التحليل المتعدد ومحرك توقيت السيولة ICT وحالة المزامنة الآمنة.
 */

import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { getCandlesForTimeframe } from '../candlesService';
import { generateSpotRecommendation } from '../../src/services/spotRecommendationEngine';
import { resolveBasisAndSyncHealth } from '../basisSyncGuardService';
import { getCachedSpotPrice } from '../pricingService';

export async function spotRecommendationRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions
) {
  /**
   * نقطة النهاية: GET /api/spot/recommendation
   * الغرض: إرجاع أحدث توصية تداول للذهب الفوري مع الشرح الفني وحالة النظام
   */
  fastify.get('/api/spot/recommendation', async (request, reply) => {
    try {
      // 1. جلب بيانات الشموع الحقيقية للأطر الزمنية المختلفة
      const [weeklyRes, dailyRes, h4Res, h1Res, m15Res] = await Promise.all([
        getCandlesForTimeframe('1W').catch(() => ({ candles: [] })),
        getCandlesForTimeframe('1D').catch(() => ({ candles: [] })),
        getCandlesForTimeframe('4H').catch(() => ({ candles: [] })),
        getCandlesForTimeframe('4H').catch(() => ({ candles: [] })), // Fallback to 4H for 1H/m15 if needed
        getCandlesForTimeframe('4H').catch(() => ({ candles: [] })),
      ]);

      // 2. التحقق من توفر البيانات الأساسية للتحليل
      if (!dailyRes.candles.length || !m15Res.candles.length) {
        return reply.status(503).send({
          ok: false,
          messageAr: 'بيانات الشموع اللحظية للذهب الفوري قيد الاكتمال والتحديث.',
        });
      }

      // 3. تشغيل محرك التوصيات المدمج (SMC + ICT)
      const recommendation = generateSpotRecommendation({
        weekly: weeklyRes.candles,
        daily: dailyRes.candles,
        h4: h4Res.candles,
        h1: h1Res.candles,
        m15: m15Res.candles,
      });

      // 4. فحص حالة سلامة المزامنة والفارق السعري
      const currentSpot = getCachedSpotPrice();
      const syncStatus = resolveBasisAndSyncHealth(currentSpot, null);

      // 5. إرجاع الاستجابة النهائية المهيكلة
      return reply.send({
        ok: true,
        timestamp: new Date().toISOString(),
        data: {
          recommendation,
          systemHealth: {
            state: syncStatus.healthState,
            messageAr: syncStatus.healthMessageAr,
            positionMultiplier: syncStatus.positionSizeMultiplier,
          },
        },
      });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({
        ok: false,
        messageAr: 'حدث خطأ غير متوقع أثناء معالجة توصيات السعر الفوري.',
        details: error?.message || 'Unknown error',
      });
    }
  });
}
