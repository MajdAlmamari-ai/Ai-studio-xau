import React, { useState, useEffect, useCallback } from 'react';
import { 
  Activity, 
  Cpu, 
  Database, 
  RotateCw, 
  Trash2, 
  Search, 
  ShieldAlert, 
  Zap, 
  Server, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  BarChart3,
  Flame,
  Layers
} from 'lucide-react';
import { 
  fetchSystemLogs, 
  fetchSystemMetrics, 
  clearSystemLogs, 
  SystemLogEntry, 
  SystemMetrics 
} from '../services/systemLogService';
import { SourceStatusPanel, SourceStatus } from './SourceStatusPanel';
import { DataScheduler } from '../engine/data/scheduler';

export const SystemDiagnosticsCard: React.FC = () => {
  const [logs, setLogs] = useState<SystemLogEntry[]>([]);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const session = new DataScheduler().getCurrentSession(Date.now());

  const sources: SourceStatus[] = [
    {
      sourceId: 'tradingview',
      label: 'TradingView Relay (COMEX:GC1! & Spot)',
      status: 'OK',
      note: 'المصدر الأساسي الحقيقي ⚡',
    },
    {
      sourceId: 'gold-api',
      label: 'Gold-API (Spot Reference)',
      status: 'OK',
      note: 'مرجعي',
    },
    {
      sourceId: 'yahoo',
      label: 'Yahoo Finance (GC=F Context)',
      status: 'OK',
      note: 'احتياطي اختياري',
    },
  ];
  
  // Filters
  const [selectedLevel, setSelectedLevel] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [limit, setLimit] = useState<number>(100);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetchSystemLogs({
        level: selectedLevel,
        category: selectedCategory,
        limit,
        search: searchQuery.trim() || undefined,
      });
      setLogs(res.logs);
      setMetrics(res.metrics);
    } catch (err) {
      console.error('Error loading diagnostics data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedLevel, selectedCategory, limit, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto refresh interval (every 4 seconds if enabled and tab is visible)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadData();
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadData]);

  const handleClear = async () => {
    if (!window.confirm('هل أنت متأكد من مسح وإعادة ضبط سجلات النظام؟')) return;
    try {
      setIsClearing(true);
      await clearSystemLogs();
      await loadData();
    } catch (err) {
      console.error('Error clearing logs:', err);
    } finally {
      setIsClearing(false);
    }
  };

  const getLevelBadge = (level: SystemLogEntry['level']) => {
    switch (level) {
      case 'ERROR':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
            <AlertTriangle className="w-3 h-3" /> خطأ (ERROR)
          </span>
        );
      case 'WARN':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <AlertTriangle className="w-3 h-3" /> تحذير (WARN)
          </span>
        );
      case 'METRIC':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
            <BarChart3 className="w-3 h-3" /> قياس (METRIC)
          </span>
        );
      case 'AUDIT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
            <ShieldAlert className="w-3 h-3" /> تدقيق (AUDIT)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
            <Info className="w-3 h-3" /> إشعار (INFO)
          </span>
        );
    }
  };

  return (
    <div className="space-y-4" dir="rtl">
      {/* 1. Header & Quick Controls */}
      <div className="bg-[#12141B] border border-[#1A1D26] rounded-xl p-4 sm:p-5 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1A1D26] pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white">
                  مركز تشخيص الأداء وإدارة السجلات المؤسساتية (DevOps & Logs)
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  Active Tracing ⚡
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                رصد استهلاك الذاكرة (Memory Heap)، سرعة الاستجابة اللحظية، ومراقبة قواطع الأمان وسجلات الأخطاء
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition flex items-center gap-1.5 ${
                autoRefresh
                  ? 'bg-amber-400/10 text-amber-400 border-amber-400/30'
                  : 'bg-[#1A1D26] text-zinc-400 border-transparent hover:text-white'
              }`}
            >
              <RotateCw className={`w-3.5 h-3.5 ${autoRefresh ? 'animate-spin' : ''}`} />
              <span>تحديث تلقائي {autoRefresh ? '(مفعّل)' : '(متوقف)'}</span>
            </button>

            <button
              onClick={loadData}
              disabled={isLoading}
              className="px-3 py-1.5 bg-[#1A1D26] hover:bg-[#222733] text-zinc-200 border border-[#2B3142] rounded-lg text-xs font-bold flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>تحديث الآن</span>
            </button>

            <button
              onClick={handleClear}
              disabled={isClearing}
              className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-bold flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>مسح السجلات</span>
            </button>
          </div>
        </div>

        {/* 2. Top Resource & Performance Metrics Grid */}
        {metrics && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">
            {/* Memory Heap */}
            <div className="bg-[#0A0C10] p-3 rounded-lg border border-[#1A1D26]">
              <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
                <span className="flex items-center gap-1">
                  <Database className="w-3.5 h-3.5 text-cyan-400" />
                  <span>الذاكرة (Heap)</span>
                </span>
                <span className="text-[10px] text-cyan-400 font-mono">
                  {metrics.memory.heapUtilizationPct}%
                </span>
              </div>
              <div className="text-base sm:text-lg font-black font-mono text-white">
                {metrics.memory.heapUsedMb} <span className="text-xs text-zinc-400 font-normal">MB</span>
              </div>
              <span className="text-[10px] text-zinc-500 font-mono block mt-0.5">
                الإجمالي: {metrics.memory.heapTotalMb} MB
              </span>
            </div>

            {/* Average Latency */}
            <div className="bg-[#0A0C10] p-3 rounded-lg border border-[#1A1D26]">
              <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
                <span className="flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>زمن الاستجابة</span>
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">
                  Fast
                </span>
              </div>
              <div className="text-base sm:text-lg font-black font-mono text-amber-400">
                {metrics.network.avgLatencyMs} <span className="text-xs text-zinc-400 font-normal">ms</span>
              </div>
              <span className="text-[10px] text-zinc-500 font-mono block mt-0.5">
                متوسط تأخير المسارات
              </span>
            </div>

            {/* Total Requests & Error Rate */}
            <div className="bg-[#0A0C10] p-3 rounded-lg border border-[#1A1D26]">
              <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
                <span className="flex items-center gap-1">
                  <Server className="w-3.5 h-3.5 text-emerald-400" />
                  <span>الطلبات والخطأ</span>
                </span>
                <span className={`text-[10px] font-mono ${metrics.network.errorRatePct > 1 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {metrics.network.errorRatePct}%
                </span>
              </div>
              <div className="text-base sm:text-lg font-black font-mono text-white">
                {metrics.network.totalRequests.toLocaleString()}
              </div>
              <span className="text-[10px] text-zinc-500 font-mono block mt-0.5">
                أخطاء: {metrics.network.errorRequests} طلب
              </span>
            </div>

            {/* Gate.io Cache Hits */}
            <div className="bg-[#0A0C10] p-3 rounded-lg border border-[#1A1D26]">
              <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
                <span className="flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-purple-400" />
                  <span>كاش Gate.io</span>
                </span>
                <span className="text-[10px] text-purple-400 font-mono">
                  1.5s TTL
                </span>
              </div>
              <div className="text-base sm:text-lg font-black font-mono text-purple-300">
                {metrics.cacheStats.gateIoHits} <span className="text-xs text-zinc-500 font-normal">Hits</span>
              </div>
              <span className="text-[10px] text-zinc-500 font-mono block mt-0.5">
                Misses: {metrics.cacheStats.gateIoMisses}
              </span>
            </div>

            {/* Candle Cache Hits */}
            <div className="bg-[#0A0C10] p-3 rounded-lg border border-[#1A1D26]">
              <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
                <span className="flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-blue-400" />
                  <span>كاش الشموع (LRU)</span>
                </span>
                <span className="text-[10px] text-blue-400 font-mono">
                  15s Max 16
                </span>
              </div>
              <div className="text-base sm:text-lg font-black font-mono text-blue-300">
                {metrics.cacheStats.candleCacheHits} <span className="text-xs text-zinc-500 font-normal">Hits</span>
              </div>
              <span className="text-[10px] text-zinc-500 font-mono block mt-0.5">
                حد أقصى للذاكرة مفعل
              </span>
            </div>

            {/* Server Uptime */}
            <div className="bg-[#0A0C10] p-3 rounded-lg border border-[#1A1D26]">
              <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-zinc-400" />
                  <span>جاهزية الخادم</span>
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">
                  Online
                </span>
              </div>
              <div className="text-base sm:text-lg font-black font-mono text-emerald-400 truncate">
                {metrics.uptimeFormatted}
              </div>
              <span className="text-[10px] text-zinc-500 font-mono block mt-0.5 truncate">
                قاطع الطوارئ: {metrics.safeguards.killSwitchActive ? 'مفعل' : 'جاهز'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 2.5 Data Sources Health & Budget Panel */}
      <SourceStatusPanel
        spotSource="TradingView Relay"
        spotQuality="REAL"
        session={session}
        sources={sources}
        onRefresh={loadData}
      />

      {/* 3. Filter Bar */}
      <div className="bg-[#12141B] border border-[#1A1D26] rounded-xl p-3 sm:p-4 shadow-md flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Level Filter */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-zinc-400">المستوى:</span>
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="bg-[#0A0C10] border border-[#1A1D26] text-zinc-200 text-xs rounded-lg px-2.5 py-1.5 focus:border-amber-400 focus:outline-none"
            >
              <option value="ALL">الكل (All Levels)</option>
              <option value="ERROR">الأخطاء فقط (ERROR)</option>
              <option value="WARN">التحذيرات (WARN)</option>
              <option value="INFO">المعلومات (INFO)</option>
              <option value="METRIC">القياسات (METRIC)</option>
              <option value="AUDIT">التدقيق (AUDIT)</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-zinc-400">القسم:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-[#0A0C10] border border-[#1A1D26] text-zinc-200 text-xs rounded-lg px-2.5 py-1.5 focus:border-amber-400 focus:outline-none"
            >
              <option value="ALL">كافة الأقسام</option>
              <option value="SMC_ENGINE">محرك SMC</option>
              <option value="GATEIO">بوابة Gate.io</option>
              <option value="CME_ORDER_FLOW">أوردر فلو CME</option>
              <option value="HTTP_API">طلبات HTTP API</option>
              <option value="RISK_SAFEGUARD">قواطع المخاطر</option>
              <option value="CIRCUIT_BREAKER">قاطع الدوائر الذكي</option>
              <option value="SYSTEM">النظام العام</option>
            </select>
          </div>

          {/* Limit Filter */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-zinc-400">العدد:</span>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="bg-[#0A0C10] border border-[#1A1D26] text-zinc-200 text-xs rounded-lg px-2.5 py-1.5 focus:border-amber-400 focus:outline-none"
            >
              <option value={50}>50 سجل</option>
              <option value={100}>100 سجل</option>
              <option value={250}>250 سجل</option>
              <option value={500}>500 سجل</option>
            </select>
          </div>
        </div>

        {/* Search Box */}
        <div className="relative min-w-[200px] flex-1 sm:flex-initial">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute right-2.5 top-2.5" />
          <input
            type="text"
            placeholder="بحث في السجلات..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0A0C10] border border-[#1A1D26] rounded-lg text-xs pr-8 pl-3 py-1.5 text-zinc-200 placeholder-zinc-500 focus:border-amber-400 focus:outline-none font-mono"
          />
        </div>
      </div>

      {/* 4. Structured Logs List */}
      <div className="bg-[#12141B] border border-[#1A1D26] rounded-xl overflow-hidden shadow-lg">
        <div className="p-3 bg-[#0A0C10] border-b border-[#1A1D26] flex items-center justify-between text-xs text-zinc-400 font-mono">
          <span>سجل الأحداث والعمليات (محدث لحظياً): {logs.length} سجل معروض</span>
          <span>الذاكرة المحجوزة: حلقة تخزين دائرية مقيدة (500 كحد أقصى)</span>
        </div>

        <div className="divide-y divide-[#1A1D26] max-h-[550px] overflow-y-auto font-mono text-xs">
          {logs.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">
              <CheckCircle2 className="w-8 h-8 text-emerald-500/50 mx-auto mb-2" />
              <p className="text-sm font-sans">لا توجد سجلات تطابق الفلتر الحالي، أو أن النظام يعمل بسلاسة دون أخطاء.</p>
            </div>
          ) : (
            logs.map((log) => (
              <div 
                key={log.id} 
                className={`p-3 transition hover:bg-[#161922] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 ${
                  log.level === 'ERROR' ? 'bg-rose-950/10' : log.level === 'WARN' ? 'bg-amber-950/10' : ''
                }`}
              >
                <div className="flex items-start gap-2.5 flex-1 min-w-0">
                  <span className="text-[11px] text-zinc-500 shrink-0 pt-0.5">
                    {new Date(log.timestamp).toLocaleTimeString('ar-EG')}
                  </span>
                  <div className="shrink-0">{getLevelBadge(log.level)}</div>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#1A1D26] text-zinc-400 shrink-0">
                    {log.category}
                  </span>
                  <p className="text-zinc-200 font-sans text-xs break-all">
                    {log.message}
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0 text-[11px] text-zinc-400 self-end sm:self-auto">
                  {log.durationMs !== undefined && (
                    <span className="text-amber-400/90 font-mono">
                      {log.durationMs}ms
                    </span>
                  )}
                  {log.memoryHeapUsedMb !== undefined && (
                    <span className="text-zinc-500 font-mono hidden md:inline">
                      {log.memoryHeapUsedMb}MB
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
