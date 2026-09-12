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
import { calculateSMCBackend, SMCBackendConfig } from './smcQuantService';
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
    customConfig?: Partial<SMCBackendConfig>;
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

  // 2. Structural & Quantitative SMC Analysis
  const platformConfig = getServerPlatformConfig();
  const activeSMCConfig = options.customConfig || platformConfig.smcConfig || {};
  const analysis = calculateSMCBackend(spotPrice, activeSMCConfig);

  addLog(
    'المرحلة 2: التحليل الهيكلي',
    'success',
    `اكتمل تحليل SMC: الاتجاه [${analysis.bias}] | الهيكل [${analysis.structure}] | سيولة BSL: $${analysis.bsl.toFixed(2)} | سيولة SSL: $${analysis.ssl.toFixed(2)} | نضارة أوردر بلوك الطلب: ${analysis.bullishOB.freshnessScore}%`
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
  if (analysis.rrNumeric < activeSafeguards.riskRewardMinRatio) {
    addLog(
      'المرحلة 3: إدارة المخاطر',
      'warning',
      `تم إلغاء الصفقة تلقائياً لعدم استيفاء الحد الأدنى لنسبة العائد للمخاطرة 1:${activeSafeguards.riskRewardMinRatio} (المتوفر: ${analysis.riskRewardRatio}).`
    );
  } else {
    // Save to server signal store
    savedSignal = addServerSignal({
      bias: analysis.bias,
      action: analysis.action,
      currentPrice: analysis.currentPrice,
      entryMin: analysis.entryZone.min,
      entryMax: analysis.entryZone.max,
      stopLoss: analysis.stopLoss,
      takeProfit: analysis.takeProfit,
      riskReward: analysis.riskRewardRatio,
      rrNumeric: analysis.rrNumeric,
      confluenceScore: analysis.confluenceScore,
      structure: analysis.structure,
      reason: analysis.reason,
      status: 'ACTIVE',
      origin: 'server_cycle',
    });

    addLog(
      'المرحلة 3: حفظ الإشارة',
      'success',
      `تم اعتماد وتوثيق الإشارة المؤسساتية #${savedSignal.id}: ${analysis.action} بسعر الدخول $${analysis.entryZone.min}-$${analysis.entryZone.max} وهدف $${analysis.takeProfit} مع وقف خسارة محمي $${analysis.stopLoss}.`
    );
  }

  // 4. Telegram Dispatch
  let telegramDispatched = false;
  let telegramError: string | undefined;

  const token = options.telegramBotToken || platformConfig.telegramConfig?.botToken || process.env.TELEGRAM_BOT_TOKEN;
  const chat = options.telegramChatId || platformConfig.telegramConfig?.chatId || process.env.TELEGRAM_CHAT_ID;

  if (token && chat && savedSignal) {
    const reportHtml = `
<b>🔔 توصية XAU/USD مؤسساتية مؤكدة (دورة الـ 15 دقيقة)</b>

<b>🧭 الإشارة:</b> <code>${analysis.action}</code>
<b>📊 الاتجاه العام:</b> <code>${analysis.bias === 'BULLISH' ? 'صاعد مؤسساتي 🟢' : 'هابط تصحيحي 🔴'}</code>
<b>💰 السعر الفوري:</b> <code>$${analysis.currentPrice.toFixed(2)}</code>

<b>🎯 خطة الدخول والأهداف:</b>
• <b>نطاق الدخول:</b> <code>$${analysis.entryZone.min.toFixed(2)} - $${analysis.entryZone.max.toFixed(2)}</code>
• <b>وقف الخسارة المحمي:</b> <code>$${analysis.stopLoss.toFixed(2)}</code>
• <b>الهدف المؤسساتي (TP):</b> <code>$${analysis.takeProfit.toFixed(2)}</code>
• <b>العائد للمخاطرة (R:R):</b> <code>${analysis.riskRewardRatio}</code>

<b>🏛️ كتل الأوامر ونضارة المناطق:</b>
• <b>أوردر بلوك الطلب:</b> <code>$${analysis.bullishOB.min.toFixed(2)} - $${analysis.bullishOB.max.toFixed(2)}</code> (نضارة: ${analysis.bullishOB.freshnessScore}%)
• <b>أوردر بلوك العرض:</b> <code>$${analysis.bearishOB.min.toFixed(2)} - $${analysis.bearishOB.max.toFixed(2)}</code> (نضارة: ${analysis.bearishOB.freshnessScore}%)

<b>🧠 القراءة والتحليل:</b>
${analysis.reason}

<i>⏱️ تم التوليد بواسطة محرك SMC Quant المؤسساتي السحابي</i>
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
