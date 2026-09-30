import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, 
  ShieldAlert, 
  Activity, 
  HelpCircle, 
  RefreshCw, 
  Sparkles, 
  Percent, 
  BarChart, 
  Target, 
  CheckCircle2, 
  AlertTriangle 
} from 'lucide-react';
import { getRecentSignalsFromFirestore, FirestoreSignalRecord } from '../services/firestoreService';

interface StatisticalSimulationCardProps {
  currentPrice: number;
}

export const StatisticalSimulationCard: React.FC<StatisticalSimulationCardProps> = ({ currentPrice }) => {
  const [signals, setSignals] = useState<FirestoreSignalRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [riskFreeRate, setRiskFreeRate] = useState<number>(4.5); // 4.5% annual risk-free rate
  const [timeHorizon, setTimeHorizon] = useState<'all' | '30d' | '7d'>('all');
  const [sampleType, setSampleType] = useState<'firestore' | 'synthetic'>('firestore');
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const fetchSignals = async () => {
    setIsLoading(true);
    try {
      const records = await getRecentSignalsFromFirestore(100);
      setSignals(records || []);
      setSampleType('firestore');
    } catch (err) {
      console.warn('[StatisticalSimulationCard] Failed to fetch signals from Firestore:', err);
      setSignals([]);
    } finally {
      setIsLoading(false);
      setLastRefreshed(new Date());
    }
  };

  useEffect(() => {
    fetchSignals();
  }, [currentPrice]);

  // Filter signals by selected horizon
  const filteredSignals = useMemo(() => {
    if (timeHorizon === 'all') return signals;
    const now = Date.now();
    const cutoff = timeHorizon === '30d' ? now - 30 * 86400 * 1000 : now - 7 * 86400 * 1000;
    return signals.filter(s => new Date(s.createdAt).getTime() >= cutoff);
  }, [signals, timeHorizon]);

  // Compute Returns, Sharpe Ratio & Sortino Ratio
  const metrics = useMemo(() => {
    if (!filteredSignals || filteredSignals.length === 0) {
      return {
        sharpeRatio: 0,
        sortinoRatio: 0,
        winRate: 0,
        profitFactor: 0,
        totalReturnR: 0,
        avgWinR: 0,
        avgLossR: 0,
        annualizedReturnPct: 0,
        annualizedVolPct: 0,
        downsideDevPct: 0,
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        calmarRatio: 0,
        maxDrawdownR: 0,
      };
    }

    // Convert each signal into percentage return / R-return
    // Assumption: Risk per trade = 1.0% (1R = 1.0%)
    const returns: number[] = [];
    let wins = 0;
    let losses = 0;
    let winSum = 0;
    let lossSum = 0;

    filteredSignals.forEach(s => {
      let rReturn = 0;
      if (s.status === 'HIT_TP') {
        rReturn = s.rrNumeric && s.rrNumeric >= 1.5 ? s.rrNumeric : 2.0;
        wins++;
        winSum += rReturn;
      } else if (s.status === 'HIT_SL') {
        rReturn = -1.0; // Stopped out with protected wick filter
        losses++;
        lossSum += 1.0;
      } else {
        // ACTIVE or MITIGATED: evaluate unrealized delta vs entry
        const entry = (s.entryMin + s.entryMax) / 2 || s.currentPrice;
        const slDist = Math.abs(entry - s.stopLoss) || 4.0;
        const pnl = s.bias === 'BULLISH' ? currentPrice - entry : entry - currentPrice;
        rReturn = Number((pnl / slDist).toFixed(2));
        if (rReturn > 0) {
          wins++;
          winSum += rReturn;
        } else if (rReturn < 0) {
          losses++;
          lossSum += Math.abs(rReturn);
        }
      }
      // 1R = 1.0% portfolio return
      returns.push(rReturn * 0.01);
    });

    const totalTrades = returns.length;
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
    const profitFactor = lossSum > 0 ? winSum / lossSum : winSum > 0 ? 99 : 0;

    // Mean return per trade
    const meanReturn = returns.reduce((a, b) => a + b, 0) / (totalTrades || 1);

    // Standard deviation (total volatility)
    const variance = returns.reduce((acc, r) => acc + Math.pow(r - meanReturn, 2), 0) / Math.max(1, totalTrades - 1);
    const standardDeviation = Math.sqrt(variance);

    // Downside deviation (only negative returns for Sortino)
    // MAR (Minimum Acceptable Return) = 0 or risk-free rate per trade
    const downsideVariance = returns.reduce((acc, r) => {
      return r < 0 ? acc + Math.pow(r, 2) : acc;
    }, 0) / Math.max(1, totalTrades - 1);
    const downsideDeviation = Math.sqrt(downsideVariance);

    // Annualization factor: based on approx 252 trading days with ~2 signals/day = ~500 trades/year
    const annualFactor = Math.sqrt(500);
    const dailyRiskFree = riskFreeRate / 100 / 252;
    const perTradeRiskFree = dailyRiskFree / 2; // ~2 trades per day

    // Annualized figures
    const annualizedReturnPct = meanReturn * 500 * 100;
    const annualizedVolPct = standardDeviation * annualFactor * 100;
    const downsideDevPct = downsideDeviation * annualFactor * 100;

    // Sharpe Ratio = (Mean Return - Risk Free) / StdDev
    const rawSharpe = standardDeviation > 0 
      ? ((meanReturn - perTradeRiskFree) / standardDeviation) * annualFactor 
      : 0;
    const sharpeRatio = Number(Math.max(-5, Math.min(10, rawSharpe)).toFixed(2));

    // Sortino Ratio = (Mean Return - MAR) / DownsideDev
    const rawSortino = downsideDeviation > 0 
      ? ((meanReturn - perTradeRiskFree) / downsideDeviation) * annualFactor 
      : (meanReturn > 0 ? 10 : 0);
    const sortinoRatio = Number(Math.max(-5, Math.min(15, rawSortino)).toFixed(2));

    // Cumulative Drawdown
    let peak = 0;
    let equityR = 0;
    let maxDrawdownR = 0;
    returns.forEach(ret => {
      const r = ret * 100; // back to R
      equityR += r;
      if (equityR > peak) peak = equityR;
      const dd = peak - equityR;
      if (dd > maxDrawdownR) maxDrawdownR = dd;
    });

    const totalReturnR = Number(equityR.toFixed(1));
    const calmarRatio = maxDrawdownR > 0 ? Number((totalReturnR / maxDrawdownR).toFixed(2)) : totalReturnR;

    return {
      sharpeRatio,
      sortinoRatio,
      winRate: Number(winRate.toFixed(1)),
      profitFactor: Number(profitFactor.toFixed(2)),
      totalReturnR,
      avgWinR: wins > 0 ? Number((winSum / wins).toFixed(2)) : 0,
      avgLossR: losses > 0 ? Number((lossSum / losses).toFixed(2)) : 0,
      annualizedReturnPct: Number(annualizedReturnPct.toFixed(1)),
      annualizedVolPct: Number(annualizedVolPct.toFixed(1)),
      downsideDevPct: Number(downsideDevPct.toFixed(1)),
      totalTrades,
      winningTrades: wins,
      losingTrades: losses,
      calmarRatio,
      maxDrawdownR: Number(maxDrawdownR.toFixed(1)),
    };
  }, [filteredSignals, currentPrice, riskFreeRate]);

  // Color & Badge evaluators for Sharpe Ratio
  const getSharpeStatus = (val: number) => {
    if (val >= 2.0) return { label: 'استثنائي (Excellent)', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' };
    if (val >= 1.0) return { label: 'جيد جداً (Solid)', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30' };
    if (val >= 0.5) return { label: 'مقبول (Acceptable)', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' };
    return { label: 'ضعيف / عالي المخاطر', color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/30' };
  };

  // Color & Badge evaluators for Sortino Ratio
  const getSortinoStatus = (val: number) => {
    if (val >= 3.0) return { label: 'أداء نخبوي (Institutional Tier)', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' };
    if (val >= 1.5) return { label: 'متفوق ومحمي ضد الهبوط', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30' };
    if (val >= 0.8) return { label: 'مقبول إحصائياً', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' };
    return { label: 'تذبذب هابط حاد', color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/30' };
  };

  const sharpeMeta = getSharpeStatus(metrics.sharpeRatio);
  const sortinoMeta = getSortinoStatus(metrics.sortinoRatio);

  return (
    <div className="bg-[#11141D] border border-[#1E2333] rounded-xl p-5 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#1E2333] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shadow-sm">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white">
                محاكاة الكفاءة الإحصائية (Sharpe & Sortino Lab)
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Firestore Signals
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              تقييم كفاءة استراتيجية SMC على المدى الطويل وقياس العائد المعدل بالمخاطر وتذبذب الهبوط
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          {/* Horizon Selector */}
          <div className="flex items-center bg-[#0D1017] p-1 rounded-lg border border-[#1E2333]">
            <button
              onClick={() => setTimeHorizon('7d')}
              className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${timeHorizon === '7d' ? 'bg-[#1E2333] text-white font-bold' : 'text-zinc-400 hover:text-white'}`}
            >
              7 أيام
            </button>
            <button
              onClick={() => setTimeHorizon('30d')}
              className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${timeHorizon === '30d' ? 'bg-[#1E2333] text-white font-bold' : 'text-zinc-400 hover:text-white'}`}
            >
              30 يوماً
            </button>
            <button
              onClick={() => setTimeHorizon('all')}
              className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${timeHorizon === 'all' ? 'bg-[#1E2333] text-white font-bold' : 'text-zinc-400 hover:text-white'}`}
            >
              كل الإشارات ({signals.length})
            </button>
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchSignals}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#161B26] hover:bg-[#1E2536] text-zinc-300 text-xs border border-[#2A3142] transition-colors cursor-pointer"
            title="تحديث البيانات من Firestore"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-purple-400' : ''}`} />
            <span>تحديث</span>
          </button>
        </div>
      </div>

      {/* Main Ratio Metric Display Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Sharpe Ratio Box */}
        <div className="bg-[#0D1017] border border-[#1E2333] rounded-xl p-4 space-y-3 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl pointer-events-none"></div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-zinc-400">نسبة شارب (Sharpe Ratio)</span>
              <div className="group relative cursor-help">
                <HelpCircle className="w-3.5 h-3.5 text-zinc-500" />
                <div className="hidden group-hover:block absolute right-0 top-5 w-60 p-2.5 bg-[#1A1F2C] border border-[#2A3142] rounded-lg text-[11px] text-zinc-300 z-50 shadow-xl leading-relaxed">
                  يقيس العائد الإضافي المحقق لكل وحدة من إجمالي التذبذب (Total Volatility). القيمة فوق 1.0 تعتبر ممتازة وفوق 2.0 استثنائية.
                </div>
              </div>
            </div>
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded border ${sharpeMeta.bg} ${sharpeMeta.color}`}>
              {sharpeMeta.label}
            </span>
          </div>

          <div className="flex items-baseline gap-3">
            <span className={`text-3xl font-extrabold font-mono tracking-tight ${metrics.sharpeRatio >= 1.0 ? 'text-blue-400' : 'text-zinc-200'}`}>
              {metrics.sharpeRatio > 0 ? `+${metrics.sharpeRatio.toFixed(2)}` : metrics.sharpeRatio.toFixed(2)}
            </span>
            <span className="text-xs text-zinc-500 font-mono">
              العائد السنوي: +{metrics.annualizedReturnPct}% / تذبذب: {metrics.annualizedVolPct}%
            </span>
          </div>

          {/* Mini progress bar */}
          <div className="space-y-1">
            <div className="w-full bg-[#161B26] h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-blue-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(5, (metrics.sharpeRatio / 3.0) * 100))}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
              <span>0.0 (ضعيف)</span>
              <span>1.0 (جيد)</span>
              <span>2.0+ (مؤسساتي)</span>
            </div>
          </div>
        </div>

        {/* Sortino Ratio Box */}
        <div className="bg-[#0D1017] border border-[#1E2333] rounded-xl p-4 space-y-3 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none"></div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-zinc-400">نسبة سورتينو (Sortino Ratio)</span>
              <div className="group relative cursor-help">
                <HelpCircle className="w-3.5 h-3.5 text-zinc-500" />
                <div className="hidden group-hover:block absolute right-0 top-5 w-60 p-2.5 bg-[#1A1F2C] border border-[#2A3142] rounded-lg text-[11px] text-zinc-300 z-50 shadow-xl leading-relaxed">
                  يعاقب الاستراتيجية فقط على التذبذب السلبي الضار (Downside Deviation)، مع تجاهل القفزات الإيجابية للأرباح. المؤشر المفضل لدى صناديق التحوط.
                </div>
              </div>
            </div>
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded border ${sortinoMeta.bg} ${sortinoMeta.color}`}>
              {sortinoMeta.label}
            </span>
          </div>

          <div className="flex items-baseline gap-3">
            <span className={`text-3xl font-extrabold font-mono tracking-tight ${metrics.sortinoRatio >= 1.5 ? 'text-emerald-400' : 'text-zinc-200'}`}>
              {metrics.sortinoRatio > 0 ? `+${metrics.sortinoRatio.toFixed(2)}` : metrics.sortinoRatio.toFixed(2)}
            </span>
            <span className="text-xs text-zinc-500 font-mono">
              انحراف الهبوط: {metrics.downsideDevPct}%
            </span>
          </div>

          {/* Mini progress bar */}
          <div className="space-y-1">
            <div className="w-full bg-[#161B26] h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(5, (metrics.sortinoRatio / 4.0) * 100))}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
              <span>0.0</span>
              <span>1.5 (متفوق)</span>
              <span>3.0+ (نخبوي)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid of Supporting Statistical Proofs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        {/* Win Rate */}
        <div className="bg-[#0A0C10] p-3 rounded-lg border border-[#1E2333] space-y-1">
          <div className="flex items-center justify-between text-zinc-400">
            <span>نسبة الفوز</span>
            <Target className="w-3.5 h-3.5 text-zinc-500" />
          </div>
          <div className="text-base font-bold font-mono text-white">
            {metrics.winRate}%
          </div>
          <div className="text-[10px] text-zinc-500 font-mono">
            {metrics.winningTrades} رابحة / {metrics.losingTrades} خاسرة
          </div>
        </div>

        {/* Profit Factor */}
        <div className="bg-[#0A0C10] p-3 rounded-lg border border-[#1E2333] space-y-1">
          <div className="flex items-center justify-between text-zinc-400">
            <span>عامل الربح (PF)</span>
            <TrendingUp className="w-3.5 h-3.5 text-zinc-500" />
          </div>
          <div className="text-base font-bold font-mono text-emerald-400">
            {metrics.profitFactor.toFixed(2)}
          </div>
          <div className="text-[10px] text-zinc-500 font-mono">
            R:R أدنى 1:2.0 إلزامي
          </div>
        </div>

        {/* Total R-Return */}
        <div className="bg-[#0A0C10] p-3 rounded-lg border border-[#1E2333] space-y-1">
          <div className="flex items-center justify-between text-zinc-400">
            <span>العائد التراكمي</span>
            <BarChart className="w-3.5 h-3.5 text-zinc-500" />
          </div>
          <div className="text-base font-bold font-mono text-purple-400">
            {metrics.totalReturnR > 0 ? `+${metrics.totalReturnR}` : metrics.totalReturnR}R
          </div>
          <div className="text-[10px] text-zinc-500 font-mono">
            {metrics.totalTrades} إشارة مسجلة
          </div>
        </div>

        {/* Max Drawdown */}
        <div className="bg-[#0A0C10] p-3 rounded-lg border border-[#1E2333] space-y-1">
          <div className="flex items-center justify-between text-zinc-400">
            <span>أقصى تراجع (Max DD)</span>
            <ShieldAlert className="w-3.5 h-3.5 text-zinc-500" />
          </div>
          <div className="text-base font-bold font-mono text-rose-400">
            -{metrics.maxDrawdownR}R
          </div>
          <div className="text-[10px] text-zinc-500 font-mono">
            Calmar: {metrics.calmarRatio}
          </div>
        </div>
      </div>

      {/* Institutional Synthesis Footer */}
      <div className="bg-[#0A0C10] p-3.5 rounded-lg border border-[#1E2333] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-zinc-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>
            تم ربط وحساب كافة المقاييس الإحصائية مباشرة من سجلات إشارات Firestore الفعلية ({metrics.totalTrades} إشارة مسجلة).
          </span>
        </div>

        <div className="flex items-center gap-2 text-zinc-400 text-[11px] font-mono">
          <span>معدل الخالي من المخاطرة:</span>
          <select
            value={riskFreeRate}
            onChange={(e) => setRiskFreeRate(Number(e.target.value))}
            className="bg-[#161B26] text-zinc-200 border border-[#2A3142] rounded px-1.5 py-0.5 text-[11px] cursor-pointer"
          >
            <option value={3.5}>3.5% (سندات خزانة)</option>
            <option value={4.5}>4.5% (المعيار الأمريكي)</option>
            <option value={5.5}>5.5% (فائدة مرتفعة)</option>
          </select>
        </div>
      </div>
    </div>
  );
};
