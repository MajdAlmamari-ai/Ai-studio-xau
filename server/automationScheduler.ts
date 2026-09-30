/**
 * Server-Side Institutional Automation & 15-Minute Cycle Scheduler
 * ------------------------------------------------------------------------------------
 * Executes the 4-step institutional trading cycle on the Node.js backend:
 * 1. Data Ingestion (Spot Gold & CME GC Futures)
 * 2. Market Structure & SMC Analysis (Zone Freshness + Compression + Wick Filter)
 * 3. Safeguard Validation & Signal Archiving
 * 4. Automated Telegram Dispatch (with Rate Limiting & Kill Switch checks)
 */

import { fetchLiveGoldSpot, calculateFuturesQuote, getCachedSpotPrice } from './pricingService';
import { futuresEngine } from './engines/FuturesEngine';
import { candleRepository } from './candleRepository';
import { DataUnavailableError } from '../src/engine/enforcer/PriceSourceEnforcer';
import { 
  addServerSignal, 
  addServerExecutionLog, 
  getServerPlatformConfig, 
  ServerSignalRecord, 
  ServerLogEntry 
} from './signalStoreService';
import { 
  activeSafeguards, 
  isGeminiCircuitOpen, 
  checkRateLimit 
} from './safeguards';
import { dispatchToTelegram } from './telegramProxy';

interface CycleExecutionResult {
  success: boolean;
  timestamp: string;
  price: number;
  futuresPrice: number;
  analysis: any;
  savedSignal: ServerSignalRecord | null;
  telegramDispatched: boolean;
  telegramError?: string;
  logs: ServerLogEntry[];
}

let schedulerTimer: NodeJS.Timeout | null = null;
let isSchedulerRunning = true;
let lastCycleTimestamp: string | null = null;
let nextCycleTargetTimestamp: number = Date.now() + 15 * 60 * 1000;
let totalCyclesCompleted = 0;

/**
 * Execute the 4-step institutional cycle on the server
 */
export async function executeInstitutionalServerCycle(
  options: {
    overridePrice?: number;
    customConfig?: Record<string, any>;
    telegramBotToken?: string;
    telegramChatId?: string;
  } = {}
): Promise<CycleExecutionResult> {
  const cycleLogs: ServerLogEntry[] = [];
  const addLog = (step: string, status: 'pending' | 'success' | 'warning' | 'error', message: string, details?: string) => {
    const entry = addServerExecutionLog({ step, status, message, details });
    cycleLogs.push(entry);
    return entry;
  };

  addLog('المرحلة 1: جلب البيانات', 'pending', 'بدء دورة الـ 15 دقيقة على خادم المؤسسات. فحص التغذية السعرية...');

  // 1. Data Ingestion
  let spotPrice = options.overridePrice || getCachedSpotPrice();
  let futuresQuote = calculateFuturesQuote(spotPrice);

  try {
    const spot = await fetchLiveGoldSpot();
    if (!options.overridePrice) {
      spotPrice = spot.price;
      futuresQuote = calculateFuturesQuote(spotPrice);
    }
    addLog(
      'المرحلة 1: جلب البيانات',
      'success',
      `تم استلام السعر الفوري: $${spotPrice.toFixed(2)} | عقود GC الآجلة: $${futuresQuote.futuresPrice.toFixed(2)} | فارق السبريد: $${futuresQuote.basisSpread.toFixed(2)}.`
    );
  } catch (err: any) {
    addLog(
      'المرحلة 1: جلب البيانات',
      'warning',
      `تم الاعتماد على ذاكرة الخادم اللحظية: $${spotPrice.toFixed(2)} دولار.`
    );
  }

  // Check Spread Safeguard
  const spreadDelta = Math.abs(futuresQuote.basisSpread);
  if (spreadDelta > activeSafeguards.maxSpreadThresholdUsd) {
    addLog(
      'المرحلة 1: فحص الأمان',
      'warning',
      `تنبيه انزلاق سبريد: الفارق بين الفوري والآجل ($${spreadDelta}) أعلى من الحد الأقصى ($${activeSafeguards.maxSpreadThresholdUsd}).`
    );
  }

  // 2. Structural & Quantitative SMC Analysis via FuturesEngine (COMEX:GC1!)
  const futuresCandles = candleRepository.getFuturesCandles('15m', 100);
  if (!futuresCandles || futuresCandles.length < 30) {
    throw new DataUnavailableError('INSUFFICIENT_CANDLES', `Need 30+ candles, got ${futuresCandles?.length ?? 0}`);
  }
  const analysis = futuresEngine.analyzeCandles(futuresCandles);
  const recommendation = futuresEngine.getRecommendation(analysis);

  const bias = analysis.direction === 'LONG' ? 'BULLISH' : analysis.direction === 'SHORT' ? 'BEARISH' : 'NEUTRAL';
  const action = analysis.direction === 'LONG' ? 'BUY_LIMIT' : analysis.direction === 'SHORT' ? 'SELL_LIMIT' : 'WAIT';
  const currentPriceVal = analysis.currentPrice ?? spotPrice;
  const entryVal = recommendation.entry ?? currentPriceVal;
  const stopLossVal = recommendation.sl ?? (analysis.direction === 'LONG' ? currentPriceVal - 10 : currentPriceVal + 10);
  const takeProfitVal = recommendation.tp1 ?? (analysis.direction === 'LONG' ? currentPriceVal + 20 : currentPriceVal - 20);
  const rrVal = recommendation.rr ?? 2.0;

  addLog(
    'المرحلة 2: التحليل الهيكلي',
    'success',
    `اكتمل تحليل SMC: الاتجاه [${analysis.direction}] | النقاط [${analysis.score}/100] | CVD: ${analysis.cvd?.cumulativeDelta ?? 0} | التوافق: ${analysis.confluence?.join(', ') || 'N/A'}`
  );

  // 3. Safeguard Validation & Signal Archiving
  let savedSignal: ServerSignalRecord | null = null;
  let isKillSwitchActive = activeSafeguards.emergencyKillSwitch;

  if (isKillSwitchActive) {
    addLog(
      'المرحلة 3: قاطع الطوارئ',
      'warning',
      '⚠️ قاطع التداول الطارئ (Emergency Kill Switch) مفعّل من الإدارة. تم تجميد توليد الإشارات وبث التوصيات.'
    );
    return {
      success: false,
      timestamp: new Date().toISOString(),
      price: spotPrice,
      futuresPrice: futuresQuote.futuresPrice,
      analysis,
      savedSignal: null,
      telegramDispatched: false,
      logs: cycleLogs,
    };
  }

  // R:R Floor Check
  if (rrVal < activeSafeguards.riskRewardMinRatio || action === 'WAIT') {
    addLog(
      'المرحلة 3: إدارة المخاطر',
      'warning',
      `تم إلغاء الصفقة تلقائياً لعدم استيفاء الحد الأدنى لنسبة العائد للمخاطرة 1:${activeSafeguards.riskRewardMinRatio} أو حالة الانتظار (R:R: 1:${rrVal}).`
    );
  } else {
    // Save to server signal store
    savedSignal = addServerSignal({
      bias,
      action,
      currentPrice: currentPriceVal,
      entryMin: entryVal - 1.0,
      entryMax: entryVal + 1.0,
      stopLoss: stopLossVal,
      takeProfit: takeProfitVal,
      riskReward: `1:${rrVal.toFixed(2)}`,
      rrNumeric: rrVal,
      confluenceScore: analysis.score,
      structure: analysis.direction === 'LONG' ? 'BOS_CONFIRMED' : 'CHOCH_DETECTED',
      reason: recommendation.reasoning.join(' | '),
      status: 'ACTIVE',
      origin: 'server_cycle',
    });

    addLog(
      'المرحلة 3: حفظ الإشارة',
      'success',
      `تم اعتماد وتوثيق الإشارة المؤسساتية #${savedSignal.id}: ${action} بسعر الدخول $${entryVal} وهدف $${takeProfitVal} مع وقف خسارة محمي $${stopLossVal}.`
    );
  }

  // 4. Telegram Dispatch
  let telegramDispatched = false;
  let telegramError: string | undefined;

  const platformConfig = getServerPlatformConfig();
  const token = options.telegramBotToken || platformConfig.telegramConfig?.botToken || process.env.TELEGRAM_BOT_TOKEN;
  const chat = options.telegramChatId || platformConfig.telegramConfig?.chatId || process.env.TELEGRAM_CHAT_ID;

  if (token && chat && savedSignal) {
    const reportHtml = `
<b>🔔 توصية XAU/USD مؤسساتية مؤكدة (دورة الـ 15 دقيقة)</b>

<b>🧭 الإشارة:</b> <code>${action}</code>
<b>📊 الاتجاه العام:</b> <code>${bias === 'BULLISH' ? 'صاعد مؤسساتي 🟢' : 'هابط تصحيحي 🔴'}</code>
<b>💰 السعر الفوري:</b> <code>$${currentPriceVal.toFixed(2)}</code>

<b>🎯 خطة الدخول والأهداف:</b>
• <b>نطاق الدخول:</b> <code>$${(entryVal - 1.0).toFixed(2)} - $${(entryVal + 1.0).toFixed(2)}</code>
• <b>وقف الخسارة المحمي:</b> <code>$${stopLossVal.toFixed(2)}</code>
• <b>الهدف المؤسساتي (TP):</b> <code>$${takeProfitVal.toFixed(2)}</code>
• <b>العائد للمخاطرة (R:R):</b> <code>1:${rrVal.toFixed(2)}</code>

<b>🏛️ بيانات تدفق العقود والـ CVD:</b>
• <b>دلتا تدفق الأوامر CVD:</b> <code>${analysis.cvd?.cumulativeDelta ?? 0}</code>
• <b>درجة التوافق والمصداقية:</b> <code>${analysis.score}%</code>

<b>🧠 القراءة والتحليل:</b>
${recommendation.reasoning.join('\n• ')}

<i>⏱️ تم التوليد بواسطة محرك SMC Quant المؤسساتي السحابي (FuturesEngine)</i>
    `.trim();

    try {
      const dispatchRes = await dispatchToTelegram('server-scheduler', token, chat, reportHtml);
      if (dispatchRes.success) {
        telegramDispatched = true;
        addLog(
          'المرحلة 4: البث لتيليجرام',
          'success',
          `تم بنجاح بث التوصية إلى قناة تيليجرام (معرف الرسالة #${dispatchRes.messageId}).`
        );
      } else {
        telegramError = dispatchRes.error;
        addLog(
          'المرحلة 4: البث لتيليجرام',
          'error',
          `فشل البث إلى تيليجرام: ${dispatchRes.error}`
        );
      }
    } catch (err: any) {
      telegramError = err.message;
      addLog('المرحلة 4: البث لتيليجرام', 'error', `خطأ استدعاء بروتوكول تيليجرام: ${err.message}`);
    }
  } else if (!token || !chat) {
    addLog(
      'المرحلة 4: البث لتيليجرام',
      'pending',
      'لم يتم ضبط بيانات بوت تيليجرام في إعدادات المنصة. تم تخطي البث الخارجي والاحتفاظ بالإشارة محلياً.'
    );
  }

  lastCycleTimestamp = new Date().toISOString();
  nextCycleTargetTimestamp = Date.now() + 15 * 60 * 1000;
  totalCyclesCompleted += 1;

  return {
    success: true,
    timestamp: lastCycleTimestamp,
    price: spotPrice,
    futuresPrice: futuresQuote.futuresPrice,
    analysis,
    savedSignal,
    telegramDispatched,
    telegramError,
    logs: cycleLogs,
  };
}

/**
 * Start the 15-minute background auto-scheduler on the server
 */
export function startServerScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
  }
  isSchedulerRunning = true;
  nextCycleTargetTimestamp = Date.now() + 15 * 60 * 1000;

  // Run automatically every 15 minutes (900,000 ms)
  schedulerTimer = setInterval(() => {
    console.log('[Institutional Scheduler]: Running scheduled 15-minute background cycle...');
    executeInstitutionalServerCycle().catch((err) => {
      console.error('[Institutional Scheduler Error]:', err);
    });
  }, 15 * 60 * 1000);

  console.log('[Institutional Scheduler]: Server 15-minute background scheduler started.');
}

/**
 * Pause the server background scheduler
 */
export function stopServerScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
  isSchedulerRunning = false;
  console.log('[Institutional Scheduler]: Server background scheduler paused.');
}

export function getSchedulerStatus() {
  const remainingSeconds = Math.max(0, Math.round((nextCycleTargetTimestamp - Date.now()) / 1000));
  return {
    isSchedulerRunning,
    intervalMinutes: 15,
    remainingSeconds,
    lastCycleTimestamp,
    totalCyclesCompleted,
  };
}
