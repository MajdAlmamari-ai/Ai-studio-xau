import { useState, useEffect, useCallback } from 'react';
import { ExecutionLog, SMCConfig, TelegramConfig } from '../types';
import { fetchGoldPrice } from '../services/goldApiService';
import { fetchLiveGoldFutures } from '../services/futuresService';
import { calculateSMC } from '../services/smcEngine';
import { formatTelegramReport, sendTelegramMessage } from '../services/telegramService';
import { saveSignalToFirestore, saveExecutionLogToFirestore } from '../services/firestoreService';

const FIFTEEN_MINUTES_SECS = 15 * 60;

export function useTradingAutomation(
  smcConfig: SMCConfig,
  telegramConfig: TelegramConfig,
  onPriceUpdate?: (price: number) => void
) {
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [nextCycleSeconds, setNextCycleSeconds] = useState<number>(FIFTEEN_MINUTES_SECS);
  const [isTriggering, setIsTriggering] = useState<boolean>(false);

  // Sync initial server execution logs on mount
  useEffect(() => {
    fetch('/api/smc/logs')
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.logs) && data.logs.length > 0) {
          setLogs(data.logs);
        }
      })
      .catch(() => {});
  }, []);

  const runExecutionCycle = useCallback(async () => {
    setIsTriggering(true);
    const now = () => new Date().toLocaleTimeString('ar-EG');

    // Attempt Server-Side Execution Cycle First
    try {
      const srvRes = await fetch('/api/smc/cycle/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: smcConfig,
          telegramBotToken: telegramConfig.botToken,
          telegramChatId: telegramConfig.chatId,
        }),
      });

      if (srvRes.ok) {
        const srvData = await srvRes.json();
        if (srvData && Array.isArray(srvData.logs) && srvData.logs.length > 0) {
          if (srvData.price && onPriceUpdate) {
            onPriceUpdate(srvData.price);
          }
          setLogs((prev) => [...srvData.logs, ...prev.slice(0, 35)]);
          if (srvData.analysis) {
            saveSignalToFirestore(srvData.analysis).catch(() => {});
          }
          setIsTriggering(false);
          setNextCycleSeconds(FIFTEEN_MINUTES_SECS);
          return;
        }
      }
    } catch (err) {
      // Backend request unreachable or timed out, fall back seamlessly to client engine
    }

    // Client-Side Fallback Engine
    // Step 1: Data Ingestion
    setLogs((prev) => [
      {
        id: Math.random().toString(),
        timestamp: now(),
        step: 'جمع البيانات',
        status: 'pending',
        message: 'بدء دورة الـ 15 دقيقة (المحرك المحلي الاحتياطي). جلب السعر الفوري...',
      },
      ...prev.slice(0, 49),
    ]);

    let currentSpot = 4478.50;
    try {
      const fetched = await fetchGoldPrice();
      currentSpot = fetched.price;
      if (onPriceUpdate) {
        onPriceUpdate(currentSpot);
      }
      const fut = await fetchLiveGoldFutures(currentSpot);

      setLogs((prev) => [
        {
          id: Math.random().toString(),
          timestamp: now(),
          step: 'جمع البيانات',
          status: 'success',
          message: `تم جلب السعر الفوري بنجاح: $${currentSpot.toFixed(2)} والعقود الآجلة GC: $${fut.futuresPrice.toFixed(2)}.`,
        },
        ...prev,
      ]);
    } catch (e) {
      setLogs((prev) => [
        {
          id: Math.random().toString(),
          timestamp: now(),
          step: 'جمع البيانات',
          status: 'warning',
          message: `تم الانتقال للذاكرة الاحتياطية للخادم: $${currentSpot.toFixed(2)} دولار.`,
        },
        ...prev,
      ]);
    }

    // Step 2: Market Structural Analysis
    const freshAnalysis = await calculateSMC(currentSpot, smcConfig);
    setLogs((prev) => [
      {
        id: Math.random().toString(),
        timestamp: now(),
        step: 'التحليل الهيكلي',
        status: 'success',
        message: `اكتمل تحليل SMC: الاتجاه [${freshAnalysis.bias}] | الهيكل [${freshAnalysis.structure}] | سيولة BSL: $${freshAnalysis.bsl.toFixed(2)} | سيولة SSL: $${freshAnalysis.ssl.toFixed(2)}.`,
      },
      ...prev,
    ]);

    // Step 3: Report & Signal Generation
    const reportHtml = formatTelegramReport(freshAnalysis);
    // Persist signal to Firestore
    saveSignalToFirestore(freshAnalysis).catch(() => {});

    setLogs((prev) => [
      {
        id: Math.random().toString(),
        timestamp: now(),
        step: 'توليد التوصية',
        status: 'success',
        message: `تم بناء الإشارة المؤسساتية وحفظها في Firestore: ${freshAnalysis.action} في نطاق $${freshAnalysis.entryZone.min}-$${freshAnalysis.entryZone.max} مع هدف $${freshAnalysis.takeProfit} (عائد لمخاطرة ${freshAnalysis.riskRewardRatio}).`,
      },
      ...prev,
    ]);

    // Step 4: Secure Delivery
    if (telegramConfig.botToken && telegramConfig.chatId) {
      const dispatchResult = await sendTelegramMessage(telegramConfig.botToken, telegramConfig.chatId, reportHtml);
      if (dispatchResult.success) {
        setLogs((prev) => [
          {
            id: Math.random().toString(),
            timestamp: now(),
            step: 'البث لتيليجرام',
            status: 'success',
            message: `تم البث بنجاح إلى قناة تيليجرام! معرف الرسالة #${dispatchResult.messageId}.`,
          },
          ...prev,
        ]);
      } else {
        setLogs((prev) => [
          {
            id: Math.random().toString(),
            timestamp: now(),
            step: 'البث لتيليجرام',
            status: 'error',
            message: `تعذر البث إلى تيليجرام: ${dispatchResult.error}`,
          },
          ...prev,
        ]);
      }
    } else {
      setLogs((prev) => [
        {
          id: Math.random().toString(),
          timestamp: now(),
          step: 'البث لتيليجرام',
          status: 'warning',
          message: 'التقرير جاهز للبث. (يرجى إدخال BOT_TOKEN و CHAT_ID في تبويب تيليجرام للتفعيل الآلي).',
        },
        ...prev,
      ]);
    }

    setIsTriggering(false);
    setNextCycleSeconds(FIFTEEN_MINUTES_SECS);
  }, [smcConfig, telegramConfig, onPriceUpdate]);

  // 15-Minute Automation Timer Loop
  useEffect(() => {
    const timer = setInterval(() => {
      setNextCycleSeconds((prev) => {
        if (prev <= 1) {
          runExecutionCycle();
          return FIFTEEN_MINUTES_SECS;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [runExecutionCycle]);

  const addLog = (log: Omit<ExecutionLog, 'id' | 'timestamp'>) => {
    setLogs((prev) => [
      {
        ...log,
        id: Math.random().toString(),
        timestamp: new Date().toLocaleTimeString('ar-EG'),
      },
      ...prev,
    ]);
  };

  return {
    logs,
    nextCycleSeconds,
    isTriggering,
    runExecutionCycle,
    addLog,
  };
}
