import React, { useState, useEffect } from 'react';
import { Header, ActiveTabType } from './components/Header';
import { SetupGuideModal } from './components/SetupGuideModal';
import { SignalsArchiveModal } from './components/SignalsArchiveModal';
import { DownloadProjectModal } from './components/DownloadProjectModal';
import { TabContentRenderer } from './components/TabContentRenderer';

import { 
  SMCConfig, 
  SMCAnalysis, 
  TelegramConfig, 
} from './types';
import { calculateSMC, DEFAULT_SMC_CONFIG } from './services/smcEngine';
import { sendTelegramMessage } from './services/telegramService';
import { useMarketData } from './hooks/useMarketData';
import { useTradingAutomation } from './hooks/useTradingAutomation';
import { loadPlatformConfigFromFirestore, savePlatformConfigToFirestore } from './services/firestoreService';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTabType>('terminal');
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState<boolean>(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState<boolean>(false);

  const [smcConfig, setSmcConfig] = useState<SMCConfig>(() => {
    const saved = localStorage.getItem('xauusd_smc_config');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return DEFAULT_SMC_CONFIG;
      }
    }
    return DEFAULT_SMC_CONFIG;
  });

  const [telegramConfig, setTelegramConfig] = useState<TelegramConfig>(() => {
    return {
      botToken: localStorage.getItem('xauusd_bot_token') || '',
      chatId: localStorage.getItem('xauusd_chat_id') || '',
    };
  });

  // Modern Data Architecture: Market Data Hook
  const {
    priceData,
    futuresData,
    newsData,
    mlData,
    isLoadingPrice,
    activeScenario,
    currentPrice,
    loadMarketData,
    setCustomPrice,
  } = useMarketData('BULLISH');

  // Compute live SMC analysis dynamically based on active price
  const analysis: SMCAnalysis = calculateSMC(currentPrice, smcConfig);

  // Modern Automation Architecture: 15-minute Loop & 4-Step Execution Cycle Hook
  const {
    logs,
    nextCycleSeconds,
    isTriggering,
    runExecutionCycle,
    addLog,
  } = useTradingAutomation(smcConfig, telegramConfig, (p) => {
    setCustomPrice(p, 'تحديث تلقائي من دورة الـ 15 دقيقة');
  });

  // Load platform configuration from Firestore on mount
  useEffect(() => {
    loadPlatformConfigFromFirestore().then((remoteConfig) => {
      if (remoteConfig) {
        if (remoteConfig.smcConfig) {
          setSmcConfig(remoteConfig.smcConfig);
          localStorage.setItem('xauusd_smc_config', JSON.stringify(remoteConfig.smcConfig));
        }
        if (remoteConfig.telegramConfig) {
          setTelegramConfig(remoteConfig.telegramConfig);
          localStorage.setItem('xauusd_bot_token', remoteConfig.telegramConfig.botToken || '');
          localStorage.setItem('xauusd_chat_id', remoteConfig.telegramConfig.chatId || '');
        }
      }
    }).catch(() => {});
  }, []);

  // Configuration persistence handlers
  const handleUpdateConfig = (newConfig: SMCConfig) => {
    setSmcConfig(newConfig);
    localStorage.setItem('xauusd_smc_config', JSON.stringify(newConfig));
    savePlatformConfigToFirestore(newConfig, telegramConfig).catch(() => {});
  };

  const handleSaveTelegramConfig = (cfg: TelegramConfig) => {
    setTelegramConfig(cfg);
    localStorage.setItem('xauusd_bot_token', cfg.botToken);
    localStorage.setItem('xauusd_chat_id', cfg.chatId);
    savePlatformConfigToFirestore(smcConfig, cfg).catch(() => {});
  };

  // Custom price override / Scenario selector
  const handleSetCustomPrice = (price: number, label: string) => {
    setCustomPrice(price, label);
  };

  // Handlers for institutional actions
  const handleSimulateSweep = (type: 'BULLISH' | 'BEARISH') => {
    const basePrice = currentPrice ?? 4475.0;
    if (type === 'BULLISH') {
      const sweepLow = Number((basePrice - 6.50).toFixed(2));
      handleSetCustomPrice(sweepLow, 'محاكاة: سحب سيولة قاع شمعة الخبر (Bullish Sweep Reversal)');
    } else {
      const sweepHigh = Number((basePrice + 6.50).toFixed(2));
      handleSetCustomPrice(sweepHigh, 'محاكاة: سحب سيولة قمة شمعة الخبر (Bearish Sweep Reversal)');
    }
  };

  const handleDispatchProximityAlert = (message: string) => {
    const alertText = `🚨 *تنبيه الماسح اللحظي للأموال الذكية:*\n${message}\n\n📍 *السعر الحالي:* ${currentPrice ? `$${currentPrice}` : 'بانتظار البث السحابي'}`;
    if (telegramConfig.botToken && telegramConfig.chatId) {
      sendTelegramMessage(telegramConfig.botToken, telegramConfig.chatId, alertText);
    }
    addLog({
      step: 'تنبيه الماسح اللحظي',
      status: 'success',
      message: `تم بث تنبيه الاقتراب لمسافة ≤ $2.0: ${message}`,
    });
  };

  return (
    <div className="min-h-screen bg-[#0A0C10] text-gray-200 flex flex-col font-sans selection:bg-amber-400/30 selection:text-amber-200" dir="rtl">
      
      {/* Top App Header */}
      <Header
        priceData={priceData}
        futuresData={futuresData}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        nextCycleSeconds={nextCycleSeconds}
        onTriggerCycle={runExecutionCycle}
        isTriggering={isTriggering}
        onOpenGuide={() => setIsGuideOpen(true)}
        onOpenDownloadModal={() => setIsDownloadModalOpen(true)}
      />

      {/* Main App Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-4 lg:px-6 py-4 space-y-4">
        <TabContentRenderer
          activeTab={activeTab}
          analysis={analysis}
          currentPrice={currentPrice}
          priceData={priceData}
          futuresData={futuresData}
          newsData={newsData}
          mlData={mlData}
          isLoadingPrice={isLoadingPrice}
          activeScenario={activeScenario}
          smcConfig={smcConfig}
          telegramConfig={telegramConfig}
          logs={logs}
          nextCycleSeconds={nextCycleSeconds}
          isTriggering={isTriggering}
          runExecutionCycle={runExecutionCycle}
          loadMarketData={loadMarketData}
          onUpdateConfig={handleUpdateConfig}
          onSaveTelegramConfig={handleSaveTelegramConfig}
          onSetCustomPrice={handleSetCustomPrice}
          onSimulateSweep={handleSimulateSweep}
          onDispatchProximityAlert={handleDispatchProximityAlert}
          onOpenSignalsArchive={() => setIsArchiveOpen(true)}
          setActiveTab={setActiveTab}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1A1D26] bg-[#0A0C10] py-3.5 text-center text-xs text-zinc-400 font-mono">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs font-sans">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="text-zinc-300 font-semibold">منظومة تداول الذهب المؤسساتية XAUUSD SMC Quant</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-zinc-400">
            <span>جدولة كرون: <code className="text-amber-400 font-mono">*/15 * * * *</code></span>
            <span>•</span>
            <button
              onClick={() => setIsArchiveOpen(true)}
              className="text-emerald-400 hover:underline font-bold flex items-center gap-1"
            >
              أرشيف الإشارات (Firestore)
            </button>
            <span>•</span>
            <button
              onClick={() => setIsGuideOpen(true)}
              className="text-amber-400 hover:underline font-bold"
            >
              دليل التشغيل
            </button>
            <span>•</span>
            <button
              onClick={() => setIsDownloadModalOpen(true)}
              className="text-amber-300 hover:text-amber-200 font-bold flex items-center gap-1"
            >
              تنزيل الكود (JSON / ZIP) ⚡
            </button>
            <span>•</span>
            <button
              onClick={() => setActiveTab('repository')}
              className="text-zinc-300 hover:text-white"
            >
              مستودع الكود
            </button>
          </div>
        </div>
      </footer>

      {/* Setup Guide Modal */}
      <SetupGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />

      {/* Persistent Signals Archive Modal (Firestore) */}
      <SignalsArchiveModal
        isOpen={isArchiveOpen}
        onClose={() => setIsArchiveOpen(false)}
        onSelectPrice={handleSetCustomPrice}
      />

      {/* Full Project Codebase Download Modal */}
      <DownloadProjectModal
        isOpen={isDownloadModalOpen}
        onClose={() => setIsDownloadModalOpen(false)}
      />

    </div>
  );
}
