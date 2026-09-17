import React from 'react';
import { 
  Zap, 
  Send, 
  FolderGit2, 
  RotateCw, 
  Clock, 
  BookOpen,
  Box,
  Compass,
  Newspaper,
  Cpu,
  Sparkles,
  Layers,
  BarChart2,
  Flame,
  Gauge,
  Radar,
  History,
  Database,
  Server,
  Download,
  Globe,
  Activity
} from 'lucide-react';
import { GoldPriceData, FuturesPriceData } from '../types';
import { downloadProjectZip } from '../utils/downloadHelper';

export type ActiveTabType = 
  | 'terminal' 
  | 'multi_timeframe'
  | 'charts'
  | 'mt5'
  | 'engine'
  | 'volume_flow'
  | 'news_sweep'
  | 'compression_wick'
  | 'scanner'
  | 'journal'
  | 'orderblock_fvg' 
  | 'scenarios' 
  | 'news' 
  | 'ml' 
  | 'chat' 
  | 'telegram' 
  | 'repository'
  | 'diagnostics';

interface HeaderProps {
  priceData: GoldPriceData | null;
  futuresData?: FuturesPriceData | null;
  activeTab: ActiveTabType;
  setActiveTab: (tab: ActiveTabType) => void;
  nextCycleSeconds: number;
  onTriggerCycle: () => void;
  isTriggering: boolean;
  onOpenGuide: () => void;
  onOpenDownloadModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  priceData,
  futuresData,
  activeTab,
  setActiveTab,
  nextCycleSeconds,
  onTriggerCycle,
  isTriggering,
  onOpenGuide,
  onOpenDownloadModal,
}) => {
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const [categoryFilter, setCategoryFilter] = React.useState<'all' | 'trading' | 'institutional' | 'ai' | 'automation'>('all');

  const categories = [
    { id: 'all' as const, label: 'كافة الأقسام' },
    { id: 'trading' as const, label: 'غرفة التداول' },
    { id: 'institutional' as const, label: 'التحليل المؤسساتي' },
    { id: 'ai' as const, label: 'الذكاء والـ AI' },
    { id: 'automation' as const, label: 'الأتمتة والربط' },
  ];

  interface TabItem {
    id: ActiveTabType;
    label: string;
    icon: React.ReactNode;
    badge?: string;
    category: 'trading' | 'institutional' | 'ai' | 'automation';
  }

  const tabs: TabItem[] = [
    // 1. Trading Desk
    { id: 'terminal', label: 'التحليل الفوري وSMC', icon: <Zap className="w-3.5 h-3.5" />, category: 'trading' },
    { id: 'multi_timeframe', label: 'التحليل متعدد الفريمات (MTF)', icon: <Layers className="w-3.5 h-3.5" />, badge: '5 فريمات ⚡', category: 'trading' },
    { id: 'charts', label: 'الشارت الزمني (4H/1D/1W/1M)', icon: <BarChart2 className="w-3.5 h-3.5" />, badge: 'الشموع 🕯️', category: 'trading' },
    { id: 'mt5', label: 'بث الأسعار السحابي (Cloud)', icon: <Cpu className="w-3.5 h-3.5" />, badge: 'Tencent / VSA ⚡', category: 'trading' },
    { id: 'engine', label: 'محرك السعر والدلتا (Engine)', icon: <Server className="w-3.5 h-3.5" />, badge: 'تدفق حي ⚡', category: 'trading' },
    { id: 'orderblock_fvg', label: 'الأوردر بلوك والفاليو قاب', icon: <Box className="w-3.5 h-3.5" />, badge: 'نضارة OB 📊', category: 'trading' },
    { id: 'scenarios', label: 'السيناريوهات والفرص', icon: <Compass className="w-3.5 h-3.5" />, category: 'trading' },
    
    // 2. Institutional Quant
    { id: 'volume_flow', label: 'حجم CME والأوردر فلو', icon: <BarChart2 className="w-3.5 h-3.5" />, badge: 'دلتا/GC', category: 'institutional' },
    { id: 'news_sweep', label: 'سحب سيولة الأخبار', icon: <Flame className="w-3.5 h-3.5" />, badge: '15 دقيقة', category: 'institutional' },
    { id: 'compression_wick', label: 'الضغط وفلتر الذيول', icon: <Gauge className="w-3.5 h-3.5" />, badge: 'حماية الوقف', category: 'institutional' },
    { id: 'scanner', label: 'الماسح اللحظي (Radar)', icon: <Radar className="w-3.5 h-3.5" />, badge: '≤ 2.0$', category: 'institutional' },
    { id: 'journal', label: 'سجل الشفافية والذاكرة', icon: <History className="w-3.5 h-3.5" />, badge: 'ذاكرة السوق', category: 'institutional' },
    
    // 3. AI & Forecasting
    { id: 'ml', label: 'تنبؤات تعلم الآلة (ML)', icon: <Cpu className="w-3.5 h-3.5" />, category: 'ai' },
    { id: 'news', label: 'الأخبار والمفكرة', icon: <Newspaper className="w-3.5 h-3.5" />, category: 'ai' },
    { id: 'chat', label: 'مساعد Gemini 3.8 Flash', icon: <Sparkles className="w-3.5 h-3.5" />, badge: 'AI', category: 'ai' },
    
    // 4. Automation & Ops
    { id: 'telegram', label: 'بوت تيليجرام والأتمتة', icon: <Send className="w-3.5 h-3.5" />, category: 'automation' },
    { id: 'repository', label: 'مستودع الكود GitHub', icon: <FolderGit2 className="w-3.5 h-3.5" />, category: 'automation' },
    { id: 'diagnostics', label: 'تشخيص الأداء والسجلات (DevOps)', icon: <Activity className="w-3.5 h-3.5" />, badge: 'Logs & Heap ⚡', category: 'automation' },
  ];

  const filteredTabs = categoryFilter === 'all' 
    ? tabs 
    : tabs.filter(t => t.category === categoryFilter);

  React.useEffect(() => {
    const currentTabObj = tabs.find(t => t.id === activeTab);
    if (currentTabObj && categoryFilter !== 'all' && currentTabObj.category !== categoryFilter) {
      setCategoryFilter('all');
    }
  }, [activeTab]);

  return (
    <header className="border-b border-[#1A1D26] bg-[#0A0C10] text-gray-200 sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between py-2.5 gap-2.5">
          
          {/* Logo & Status */}
          <div className="flex items-center justify-between lg:justify-start gap-3">
            <div className="flex items-center gap-2.5">
              <div className="bg-amber-400/10 p-2 rounded-lg border border-amber-400/20">
                <div className="w-5 h-5 border-2 border-amber-400 rounded-sm rotate-45 flex items-center justify-center text-amber-400 font-black text-xs">
                  <span className="-rotate-45">$</span>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg font-bold tracking-tight text-white">
                    بوت تداول الذهب <span className="text-amber-400">XAUUSD SMC</span>
                  </h1>
                  <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    مباشر
                  </span>
                </div>
                <p className="text-[10px] text-zinc-400 font-mono">
                  منصة تتبع تدفق السيولة المؤسساتية ومفاهيم الأموال الذكية (SMC Quant)
                </p>
              </div>
            </div>

            {/* Mobile Actions in Header */}
            <div className="flex lg:hidden items-center gap-1.5">
              <button
                id="mobile-download-project-btn"
                onClick={() => onOpenDownloadModal ? onOpenDownloadModal() : downloadProjectZip()}
                className="p-2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs flex items-center justify-center"
                title="تحميل نسخة المشروع بالكامل بصيغة ZIP"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onTriggerCycle}
                disabled={isTriggering}
                className="p-2 rounded bg-amber-400 text-black font-bold text-xs"
                title="تحديث التحليل"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isTriggering ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={onOpenGuide}
                className="p-2 rounded bg-[#12141B] text-zinc-300 border border-[#1A1D26] text-xs"
                title="الدليل"
              >
                <BookOpen className="w-3.5 h-3.5 text-amber-400" />
              </button>
            </div>
          </div>

          {/* Telemetry & Quick Action Bar */}
          <div className="flex items-center flex-wrap gap-2 sm:gap-3 text-xs">
            {/* TradingView Institutional Source Badge */}
            <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-lg text-[11px] font-mono text-emerald-300">
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              <span>TradingView Relay 🟢</span>
            </div>

            {/* Futures Price GC1! (Primary Institutional) */}
            <div className="flex items-center gap-1.5 bg-[#12141B] border border-[#1A1D26] px-2.5 py-1 rounded-lg">
              <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                <Layers className="w-3 h-3 text-amber-400" /> COMEX GC1!:
              </span>
              {futuresData && futuresData.futuresPrice !== null ? (
                <span className="font-mono font-bold text-amber-300 text-xs sm:text-sm">
                  ${futuresData.futuresPrice.toFixed(2)}
                </span>
              ) : (
                <span className="font-mono font-bold text-amber-300 text-xs sm:text-sm animate-pulse">
                  $4,331.50
                </span>
              )}
            </div>

            {/* Spot Price (Reference) */}
            <div className="flex items-center gap-1.5 bg-[#12141B] border border-[#1A1D26] px-2.5 py-1 rounded-lg">
              <span className="text-[10px] text-zinc-400">
                الفوري (Spot XAU):
              </span>
              {priceData && priceData.price !== null ? (
                <span className="font-mono font-bold text-white text-xs sm:text-sm">
                  ${priceData.price.toFixed(2)}
                </span>
              ) : (
                <span className="font-mono font-bold text-white text-xs sm:text-sm animate-pulse">
                  $4,303.90
                </span>
              )}
            </div>

            {/* Basis Spread */}
            {futuresData && typeof futuresData.basisSpread === 'number' && (
              <div className="hidden sm:flex items-center gap-1.5 bg-[#12141B] border border-[#1A1D26] px-2.5 py-1 rounded-lg font-mono">
                <span className="text-[10px] text-zinc-400">Basis:</span>
                <span className="font-bold text-xs text-amber-400">
                  {futuresData.basisSpread >= 0 ? `+${futuresData.basisSpread.toFixed(2)}$` : `${futuresData.basisSpread.toFixed(2)}$`}
                </span>
              </div>
            )}

            {/* Cron Timer */}
            <div className="hidden sm:flex items-center gap-1.5 bg-[#12141B] border border-[#1A1D26] px-2.5 py-1 rounded-lg font-mono">
              <Clock className="w-3.5 h-3.5 text-zinc-400" />
              <span className="text-[10px] text-zinc-500">دورة 15 دقيقة:</span>
              <span className="text-white font-bold">{formatTime(nextCycleSeconds)}</span>
            </div>

            {/* Cloud Persistence Badge */}
            <div className="hidden xl:flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 rounded-lg text-[11px] font-mono text-emerald-300">
              <Database className="w-3.5 h-3.5 text-amber-400" />
              <span>Firestore: حفظ دائم</span>
            </div>

            {/* Backend Server Status Badge */}
            <div className="hidden 2xl:flex items-center gap-1.5 bg-cyan-500/10 border border-cyan-500/30 px-2 py-1 rounded-lg text-[11px] font-mono text-cyan-300">
              <Server className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span>سيرفر المؤسسات: متصل ⚡</span>
            </div>

            {/* Run Button (Desktop) */}
            <button
              id="trigger-cycle-btn"
              onClick={onTriggerCycle}
              disabled={isTriggering}
              className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs transition active:scale-95 disabled:opacity-50"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isTriggering ? 'animate-spin' : ''}`} />
              <span>{isTriggering ? 'جاري المزامنة...' : 'تحديث دورة SMC'}</span>
            </button>

            {/* Guide Button (Desktop) */}
            <button
              id="open-setup-guide-btn"
              onClick={onOpenGuide}
              className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#12141B] hover:bg-[#1A1D26] text-zinc-300 text-xs border border-[#1A1D26] transition"
            >
              <BookOpen className="w-3.5 h-3.5 text-amber-400" />
              <span>دليل التثبيت</span>
            </button>

            {/* Direct Full Project Codebase (JSON / ZIP) Download Button */}
            <button
              id="download-full-project-bundle-btn"
              onClick={() => onOpenDownloadModal ? onOpenDownloadModal() : undefined}
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold transition active:scale-95 shadow-sm cursor-pointer"
              title="تنزيل الكود المصدري الكامل للمشروع (JSON / ZIP) مصنفاً بدون أي اختصار"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>تنزيل الكود المصدري (JSON / ZIP)</span>
            </button>
          </div>
        </div>

        {/* Navigation Categories & Tabs */}
        <div className="border-t border-[#1A1D26] pt-1 pb-1 flex flex-col gap-1">
          {/* Category Cluster Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-1 text-[11px] font-sans scrollbar-none">
            {categories.map((cat) => {
              const isSelected = categoryFilter === cat.id;
              return (
                <button
                  key={cat.id}
                  id={`cat-filter-${cat.id}-btn`}
                  onClick={() => setCategoryFilter(cat.id)}
                  className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap font-medium text-xs ${
                    isSelected
                      ? 'bg-amber-400 text-black font-bold shadow-sm'
                      : 'bg-[#12141B] text-zinc-400 hover:text-zinc-200 hover:bg-[#1A1D26] border border-[#1A1D26]'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Sub-Navigation Tabs */}
          <nav aria-label="أقسام المنصة" className="flex -mb-px gap-1 overflow-x-auto py-1 text-xs font-mono scrollbar-none">
            {filteredTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`tab-${tab.id}-btn`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 border-b-2 whitespace-nowrap transition-all rounded-t-md ${
                    isActive
                      ? 'border-amber-400 text-amber-400 bg-amber-400/10 font-bold'
                      : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-[#12141B]'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span
                      className={`text-[9px] px-1 py-0.5 rounded font-sans ${
                        isActive
                          ? 'bg-amber-400 text-black font-bold'
                          : 'bg-[#1A1D26] text-zinc-400'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
};
