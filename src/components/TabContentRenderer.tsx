import React from 'react';
import { BarChart2, TrendingUp } from 'lucide-react';
import { ActiveTabType } from './Header';
import { LivePriceCard } from './LivePriceCard';
import { FuturesPriceCard } from './FuturesPriceCard';
import { SMCReportCard } from './SMCReportCard';
import { LiquidityMap } from './LiquidityMap';
import { OrderBlockAndFVGCard } from './OrderBlockAndFVGCard';
import { ScenariosCard } from './ScenariosCard';
import { EconomicNewsCard } from './EconomicNewsCard';
import { ScenarioProjectionCard } from './ScenarioProjectionCard';
import { GeminiChatAssistant } from './GeminiChatAssistant';
import { TelegramDispatcher } from './TelegramDispatcher';
import { ExecutionConsole } from './ExecutionConsole';
import { RepoCodeCenter } from './RepoCodeCenter';
import { OrderFlowVolumeCard } from './OrderFlowVolumeCard';
import { PostNewsSweepCard } from './PostNewsSweepCard';
import { CompressionAndWickCard } from './CompressionAndWickCard';
import { ProximityScannerCard } from './ProximityScannerCard';
import { PostTradeJournalCard } from './PostTradeJournalCard';
import { PriceVolumeEngineCard } from './PriceVolumeEngineCard';
import { CloudMarketSyncCard } from './CloudMarketSyncCard';
import { CandlestickChartCard } from './CandlestickChartCard';
import { MultiTimeframeSMCCard } from './MultiTimeframeSMCCard';
import { SystemDiagnosticsCard } from './SystemDiagnosticsCard';
import { Globe } from 'lucide-react';

import { 
  GoldPriceData, 
  FuturesPriceData, 
  SMCConfig, 
  SMCAnalysis, 
  TelegramConfig, 
  ExecutionLog,
  EconomicNewsItem,
  ScenarioProjection
} from '../types';
import { calculateScenarioProjections } from '../services/scenarioService';

interface TabContentRendererProps {
  activeTab: ActiveTabType;
  analysis: SMCAnalysis;
  currentPrice: number;
  priceData: GoldPriceData | null;
  futuresData: FuturesPriceData | null;
  newsData: EconomicNewsItem[];
  scenarioData: Record<'15M' | '1H' | '4H' | '1D', ScenarioProjection> | null;
  isLoadingPrice: boolean;
  activeScenario: string;
  smcConfig: SMCConfig;
  telegramConfig: TelegramConfig;
  logs: ExecutionLog[];
  nextCycleSeconds: number;
  isTriggering: boolean;
  runExecutionCycle: () => void;
  loadMarketData: () => void;
  onUpdateConfig: (newConfig: SMCConfig) => void;
  onSaveTelegramConfig: (cfg: TelegramConfig) => void;
  onSetCustomPrice: (price: number, label: string) => void;
  onSimulateSweep: (type: 'BULLISH' | 'BEARISH') => void;
  onDispatchProximityAlert: (message: string) => void;
  onOpenSignalsArchive?: () => void;
  setActiveTab: (tab: ActiveTabType) => void;
}

export const TabContentRenderer: React.FC<TabContentRendererProps> = ({
  activeTab,
  analysis,
  currentPrice,
  priceData,
  futuresData,
  newsData,
  scenarioData,
  isLoadingPrice,
  activeScenario,
  smcConfig,
  telegramConfig,
  logs,
  nextCycleSeconds,
  isTriggering,
  runExecutionCycle,
  loadMarketData,
  onUpdateConfig,
  onSaveTelegramConfig,
  onSetCustomPrice,
  onSimulateSweep,
  onDispatchProximityAlert,
  onOpenSignalsArchive,
  setActiveTab,
}) => {
  switch (activeTab) {
    case 'terminal':
      return (
        <div className="space-y-4">
          {/* Proximity Scanner Alert Radar (Top Priority Notice) */}
          <ProximityScannerCard
            currentPrice={currentPrice}
            orderBlocks={analysis.orderBlocks}
            fvgs={analysis.fvgs}
            onDispatchAlert={onDispatchProximityAlert}
          />

          {/* Grid Row 1: Live Spot Price & COMEX Futures Comparison */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            <div className="lg:col-span-7 xl:col-span-8">
              <LivePriceCard
                priceData={priceData}
                futuresData={futuresData}
                onRefreshPrice={loadMarketData}
                isLoading={isLoadingPrice}
                onSetCustomPrice={onSetCustomPrice}
                config={smcConfig}
                onUpdateConfig={onUpdateConfig}
                activeScenario={activeScenario}
              />
            </div>
            <div className="lg:col-span-5 xl:col-span-4">
              <FuturesPriceCard 
                futuresData={futuresData} 
                spotPrice={currentPrice}
                onRefresh={loadMarketData} 
              />
            </div>
          </div>

          {/* Quick Access to Timeframe Candlestick Charts (4H • 1D • 1W • 1M) */}
          <div className="bg-[#0E131F] border border-[#1E273A] rounded-xl p-3 shadow-md flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <BarChart2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">الشارت الزمني المؤسساتي للشموع:</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    4H • 1D • 1W • 1M 🕯️
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  عرض شمعة الأربع ساعات، شمعة اليوم، شمعة الأسبوع، وشمعة الشهر مع كتل الأوامر وخطوط السيولة
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                id="terminal-open-charts-btn"
                onClick={() => setActiveTab('charts')}
                className="px-3.5 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>فتح الشارت الزمني التفاعلي</span>
              </button>
            </div>
          </div>

          {/* SMC Institutional Signal & Recommendation Banner */}
          <SMCReportCard
            analysis={analysis}
            onOpenTelegramModal={() => setActiveTab('telegram')}
            onOpenSignalsArchive={onOpenSignalsArchive}
            onOpenFreshnessTab={() => setActiveTab('orderblock_fvg')}
          />

          {/* Grid Row 2: CME Order Flow Delta & Liquidity Map */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            <OrderFlowVolumeCard
              data={analysis.orderFlowVolume}
              futuresData={futuresData}
              spotPrice={currentPrice}
            />
            <LiquidityMap analysis={analysis} />
          </div>

          {/* Automated Workflow & Safe Architecture Console */}
          <ExecutionConsole
            logs={logs}
            isTriggering={isTriggering}
            onTriggerCycle={runExecutionCycle}
            nextCycleSeconds={nextCycleSeconds}
          />
        </div>
      );

    case 'charts':
      return (
        <div className="space-y-4">
          <CandlestickChartCard
            currentPrice={currentPrice}
            onRefreshLivePrice={loadMarketData}
          />
        </div>
      );

    case 'mt5':
      return (
        <div className="space-y-4">
          <CloudMarketSyncCard
            onRefresh={loadMarketData}
            pointsPips={analysis.pointsPips}
            currentAction={analysis.action}
            entryPrice={analysis.entryZone ? (analysis.action === 'BUY' ? analysis.entryZone.max : analysis.entryZone.min) : currentPrice}
            stopLoss={analysis.stopLoss}
            takeProfit={analysis.takeProfit}
          />
        </div>
      );

    case 'engine':
      return (
        <div className="space-y-4">
          <CloudMarketSyncCard
            onRefresh={loadMarketData}
            pointsPips={analysis.pointsPips}
            currentAction={analysis.action}
            entryPrice={analysis.entryZone ? (analysis.action === 'BUY' ? analysis.entryZone.max : analysis.entryZone.min) : currentPrice}
            stopLoss={analysis.stopLoss}
            takeProfit={analysis.takeProfit}
          />
          <PriceVolumeEngineCard />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            <OrderFlowVolumeCard
              data={analysis.orderFlowVolume}
              futuresData={futuresData}
              spotPrice={currentPrice}
            />
            <FuturesPriceCard 
              futuresData={futuresData} 
              spotPrice={currentPrice}
              onRefresh={loadMarketData} 
            />
          </div>
        </div>
      );

    case 'volume_flow':
      return (
        <div className="space-y-4">
          <PriceVolumeEngineCard />
          <OrderFlowVolumeCard
            data={analysis.orderFlowVolume}
            futuresData={futuresData}
            spotPrice={currentPrice}
          />
          <FuturesPriceCard 
            futuresData={futuresData} 
            spotPrice={currentPrice}
            onRefresh={loadMarketData} 
          />
        </div>
      );

    case 'news_sweep':
      return (
        <div className="space-y-4">
          <PostNewsSweepCard
            data={analysis.postNewsSweep}
            currentPrice={currentPrice}
            onSimulateSweep={onSimulateSweep}
          />
          <EconomicNewsCard 
            newsItems={newsData} 
            onRefresh={loadMarketData} 
          />
        </div>
      );

    case 'compression_wick':
      return (
        <div className="space-y-4">
          <CompressionAndWickCard
            compression={analysis.compression}
            wickFilter={analysis.wickFilter}
            orderBlocks={analysis.orderBlocks}
            currentPrice={currentPrice}
          />
        </div>
      );

    case 'scanner':
      return (
        <div className="space-y-4">
          <ProximityScannerCard
            currentPrice={currentPrice}
            orderBlocks={analysis.orderBlocks}
            fvgs={analysis.fvgs}
            onDispatchAlert={onDispatchProximityAlert}
          />
          <LiquidityMap analysis={analysis} />
        </div>
      );

    case 'journal':
      return (
        <div className="space-y-4">
          <PostTradeJournalCard
            memoryOBs={analysis.memoryIndexOBs}
            currentPrice={currentPrice}
          />
        </div>
      );

    case 'orderblock_fvg':
      return (
        <div className="space-y-4">
          <OrderBlockAndFVGCard analysis={analysis} />
        </div>
      );

    case 'scenarios':
      return (
        <div className="space-y-4">
          <ScenariosCard
            currentPrice={currentPrice}
            onApplyScenario={(scenario) => {
              const targetP = scenario.targetTakeProfits?.[0] || scenario.entryRange?.min || currentPrice;
              onSetCustomPrice(targetP, scenario.titleAr);
            }}
          />
        </div>
      );

    case 'news':
      return (
        <div className="space-y-4">
          <EconomicNewsCard 
            newsItems={newsData} 
            onRefresh={loadMarketData} 
          />
        </div>
      );

    case 'ml':
      return (
        <div className="space-y-4">
          <ScenarioProjectionCard
            scenarioData={scenarioData || calculateScenarioProjections({ currentPrice, atr: null, bias: analysis.bias })}
            currentPrice={currentPrice}
          />
        </div>
      );

    case 'chat':
      return (
        <div className="space-y-4">
          <GeminiChatAssistant 
            currentPrice={currentPrice}
            analysis={analysis}
          />
        </div>
      );

    case 'telegram':
      return (
        <div className="space-y-4">
          <TelegramDispatcher
            analysis={analysis}
            telegramConfig={telegramConfig}
            onSaveConfig={onSaveTelegramConfig}
          />
        </div>
      );

    case 'multi_timeframe':
      return (
        <div className="space-y-4">
          <MultiTimeframeSMCCard
            currentPrice={currentPrice}
          />
        </div>
      );

    case 'repository':
      return (
        <div className="space-y-4">
          <RepoCodeCenter />
        </div>
      );

    case 'diagnostics':
      return (
        <div className="space-y-4">
          <SystemDiagnosticsCard />
        </div>
      );

    default:
      return null;
  }
};
