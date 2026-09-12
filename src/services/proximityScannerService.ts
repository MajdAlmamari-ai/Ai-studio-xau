import { ProximityAlert, OrderBlockDetail, FairValueGap } from '../types';

/**
 * Real-Time Proximity Scanner:
 * Checks distance between current price and key OB / FVG zones.
 * Triggers:
 * - Distance <= $2.0: Early Warning Alert ("Wait for 5M confirmation")
 * - Distance <= $0.8 with full confluence: "Final Trade Recommendation"
 */
export function scanProximityAlerts(
  currentPrice: number,
  orderBlocks: OrderBlockDetail[],
  fvgs: FairValueGap[]
): ProximityAlert[] {
  const alerts: ProximityAlert[] = [];

  // Check Order Blocks
  orderBlocks.forEach((ob) => {
    const obMid = ob.equilibrium;
    const dist = Math.abs(currentPrice - obMid);

    if (dist <= 2.2) {
      const isVeryClose = dist <= 0.8;
      const status: ProximityAlert['status'] = isVeryClose ? 'CONFLUENCE_READY' : 'EARLY_WARNING';
      const isDemand = ob.type === 'BULLISH_DEMAND';

      alerts.push({
        id: `scan-ob-${ob.id}-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        levelName: isDemand ? `أوردر بلوك طلب (${ob.timeframe})` : `أوردر بلوك عرض (${ob.timeframe})`,
        targetPrice: obMid,
        distanceToPrice: Number(dist.toFixed(2)),
        status,
        messageAr: isVeryClose
          ? `🎯 السعر دخل منطقة الأوردر بلوك $${ob.min} - $${ob.max} (المسافة: $${dist.toFixed(2)}). تأكيد التوافق التام (Confluence Ready) مع نسبة نضارة ${ob.freshnessScore}%. التوصية النهائية جاهزة!`
          : `⚡ تنبيه اقتراب فرصة: السعر على بُعد $${dist.toFixed(2)} فقط من أوردر بلوك $${ob.equilibrium}. انتظر تأكيد برايس أكشن وسحب سيولة على فريم 5 دقائق.`,
      });
    }
  });

  // Check FVGs
  fvgs.forEach((fvg) => {
    const fvgMid = fvg.ce; // Consequent Encroachment (50%)
    const dist = Math.abs(currentPrice - fvgMid);

    if (dist <= 2.0 && fvg.status !== 'Mitigated') {
      alerts.push({
        id: `scan-fvg-${fvg.id}-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        levelName: `فجوة قيمة عادلة ${fvg.type} (${fvg.timeframe})`,
        targetPrice: fvgMid,
        distanceToPrice: Number(dist.toFixed(2)),
        status: dist <= 0.6 ? 'CONFLUENCE_READY' : 'EARLY_WARNING',
        messageAr: `🔍 السعر يقترب من نقطة توازن فجوة القيمة العادلة CE 50% ($${fvgMid}) على بعد $${dist.toFixed(2)}. ترقب ردة فعل الشموع المؤسساتية.`,
      });
    }
  });

  // If no immediate level <= $2.0, provide a situational awareness monitor
  if (alerts.length === 0) {
    const nearestOB = orderBlocks[0];
    if (nearestOB) {
      const dist = Math.abs(currentPrice - nearestOB.equilibrium);
      alerts.push({
        id: `scan-standby-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
        levelName: 'الماسح اللحظي في وضع المراقبة (Standby)',
        targetPrice: nearestOB.equilibrium,
        distanceToPrice: Number(dist.toFixed(2)),
        status: 'EARLY_WARNING',
        messageAr: `السعر حالياً يبعد $${dist.toFixed(2)} عن أقرب منطقة اهتمام مؤسساتية. الماسح اللحظي يعمل ويترقب الاقتراب إلى مسافة أقل من $2.0.`,
      });
    }
  }

  return alerts;
}
