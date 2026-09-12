import React, { useState } from 'react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Cell, 
  ReferenceLine, 
  CartesianGrid,
  AreaChart,
  Area
} from 'recharts';
import { OrderBlockDetail } from '../types';
import { Sparkles, ShieldAlert, CheckCircle, Info, BarChart3, TrendingDown, Layers, HelpCircle } from 'lucide-react';

interface ZoneFreshnessChartProps {
  orderBlocks: OrderBlockDetail[];
  currentPrice: number;
}

export const ZoneFreshnessChart: React.FC<ZoneFreshnessChartProps> = ({
  orderBlocks = [],
  currentPrice,
}) => {
  const [chartMode, setChartMode] = useState<'bars' | 'decay'>('bars');

  // Format data for the bar chart
  const chartData = orderBlocks.map((ob, idx) => {
    const isDemand = ob.type === 'BULLISH_DEMAND';
    const freshness = ob.freshnessScore ?? 80;
    const age = ob.barsAge ?? 5;
    const distanceToPrice = Math.abs(currentPrice - ob.equilibrium);

    let statusLabelAr = 'طازجة (قوية)';
    let color = '#10B981'; // Emerald

    if (freshness >= 70) {
      statusLabelAr = 'نضارة فائقة (Fresh 🟢)';
      color = '#10B981';
    } else if (freshness >= 40) {
      statusLabelAr = 'متوسطة النضارة (Tested 🟡)';
      color = '#F59E0B';
    } else {
      statusLabelAr = 'متآكلة (Eroded 🔴)';
      color = '#EF4444';
    }

    const shortName = isDemand 
      ? `طلب $${ob.min.toFixed(0)}` 
      : `عرض $${ob.min.toFixed(0)}`;

    return {
      id: ob.id,
      name: shortName,
      fullName: isDemand ? 'كتلة طلب صاعدة (Demand OB)' : 'كتلة عرض هابطة (Supply OB)',
      type: ob.type,
      timeframe: ob.timeframe,
      min: ob.min,
      max: ob.max,
      equilibrium: ob.equilibrium,
      freshness,
      barsAge: age,
      mitigationStatus: ob.mitigationStatus,
      confluenceScore: ob.confluenceScore,
      distanceToPrice: Number(distanceToPrice.toFixed(2)),
      color,
      statusLabelAr,
    };
  });

  // Calculate Decay Curve Data (from 0 to 22 candles age)
  const decayData = Array.from({ length: 23 }, (_, bars) => {
    let calculatedFreshness = 100;
    if (bars <= 5) {
      calculatedFreshness = 100;
    } else if (bars >= 20) {
      calculatedFreshness = 0;
    } else {
      calculatedFreshness = Math.round(100 - ((bars - 5) / (20 - 5)) * 100);
    }

    // Check if any current OB matches this age
    const matchingOB = chartData.find(ob => ob.barsAge === bars);

    return {
      bars,
      barLabel: `${bars} ش`,
      freshness: calculatedFreshness,
      activeOBName: matchingOB ? matchingOB.name : null,
      activeOBFreshness: matchingOB ? matchingOB.freshness : null,
      obDetails: matchingOB || null,
    };
  });

  // Summary stats
  const freshCount = chartData.filter(d => d.freshness >= 70).length;
  const avgFreshness = chartData.length > 0 
    ? Math.round(chartData.reduce((acc, curr) => acc + curr.freshness, 0) / chartData.length)
    : 0;

  // Custom tooltip for Bar Chart
  const CustomBarTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div 
          className="bg-[#0A0C12] border border-[#232938] p-3 rounded-xl shadow-2xl text-right font-sans text-xs space-y-2 min-w-[220px]"
          dir="rtl"
        >
          <div className="flex items-center justify-between border-b border-[#1E2330] pb-1.5">
            <span className="font-bold text-white text-sm">{data.fullName}</span>
            <span 
              className="text-[10px] font-mono px-2 py-0.5 rounded font-bold"
              style={{ backgroundColor: `${data.color}20`, color: data.color }}
            >
              {data.statusLabelAr}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
            <div className="bg-[#12151E] p-1.5 rounded border border-[#1A1E29]">
              <span className="text-zinc-400 block text-[10px]">درجة النضارة:</span>
              <span className="font-bold text-base" style={{ color: data.color }}>
                {data.freshness}%
              </span>
            </div>
            <div className="bg-[#12151E] p-1.5 rounded border border-[#1A1E29]">
              <span className="text-zinc-400 block text-[10px]">عمر الشموع:</span>
              <span className="font-bold text-white text-base">
                {data.barsAge} <span className="text-xs text-zinc-400 font-normal">شموع</span>
              </span>
            </div>
          </div>

          <div className="text-[11px] text-zinc-300 space-y-1 pt-1 border-t border-[#1E2330]">
            <div className="flex justify-between">
              <span className="text-zinc-400">النطاق السعري:</span>
              <span className="font-mono text-amber-300">${data.min} - ${data.max}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">نقطة التوازن (EQ):</span>
              <span className="font-mono text-cyan-300">${data.equilibrium}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">المسافة عن السعر:</span>
              <span className="font-mono text-zinc-200">${data.distanceToPrice}</span>
            </div>
          </div>

          <div className="text-[10px] text-zinc-400 bg-[#12151E] p-2 rounded border border-[#1A1E29] leading-tight">
            {data.freshness >= 70 ? (
              <span className="text-emerald-300">
                ⚡ منطقة طازجة لم تستهلك أوامرها بعد؛ ارتداد مؤسساتي عالي الثقة.
              </span>
            ) : data.freshness >= 40 ? (
              <span className="text-amber-300">
                ⚠️ منطقة خضعت لاختبارات؛ تأكد من ظهور شمعة انعكاسية قبل الدخول.
              </span>
            ) : (
              <span className="text-rose-300">
                🛑 منطقة متآكلة قديمة؛ خطر الكسر وتجاوز الأوامر مرتفع جداً.
              </span>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  // Custom tooltip for Decay Curve
  const CustomDecayTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div 
          className="bg-[#0A0C12] border border-[#232938] p-3 rounded-xl shadow-2xl text-right font-sans text-xs space-y-2 min-w-[210px]"
          dir="rtl"
        >
          <div className="flex items-center justify-between border-b border-[#1E2330] pb-1">
            <span className="font-bold text-white text-xs">منحنى تآكل النضارة</span>
            <span className="font-mono text-cyan-400">{data.bars} شمعة</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">معدل النضارة النظري:</span>
            <span className="font-mono font-bold text-amber-300 text-sm">{data.freshness}%</span>
          </div>

          {data.activeOBName && (
            <div className="bg-[#12151E] p-2 rounded border border-amber-500/30 text-[11px] text-amber-200 space-y-1">
              <div className="font-bold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>كتلة متمركزة هنا: {data.activeOBName}</span>
              </div>
              <div className="text-[10px] text-zinc-400">
                نطاق: ${data.obDetails?.min} - ${data.obDetails?.max}
              </div>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-[#0D0F16] border border-[#1E2330] rounded-xl p-4 sm:p-5 space-y-4 shadow-xl font-sans text-right" dir="rtl">
      {/* Header with Title and Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1E2330] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm sm:text-base font-bold text-white tracking-wide">
                مخطط نضارة كتل الأوامر (Zone Freshness Visualizer)
              </h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/30">
                SMC Recharts
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              مقياس ديناميكي من 0% إلى 100% يحدد جودة ارتداد مناطق صانع السوق ويمنع التداول في المناطق المتهالكة
            </p>
          </div>
        </div>

        {/* View Mode Buttons */}
        <div className="flex items-center bg-[#06070B] p-1 rounded-lg border border-[#1E2330] self-start sm:self-auto text-xs">
          <button
            onClick={() => setChartMode('bars')}
            className={`px-3 py-1 rounded-md font-semibold transition flex items-center gap-1.5 ${
              chartMode === 'bars'
                ? 'bg-[#1E2330] text-emerald-400 shadow'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>مقارنة الكتل (Bar Chart)</span>
          </button>
          <button
            onClick={() => setChartMode('decay')}
            className={`px-3 py-1 rounded-md font-semibold transition flex items-center gap-1.5 ${
              chartMode === 'decay'
                ? 'bg-[#1E2330] text-amber-400 shadow'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <TrendingDown className="w-3.5 h-3.5" />
            <span>منحنى التآكل (Decay Curve)</span>
          </button>
        </div>
      </div>

      {/* Top Telemetry Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="bg-[#12151E] p-2.5 rounded-lg border border-[#1A1F2D] flex items-center justify-between">
          <span className="text-zinc-400 text-[11px]">متوسط النضارة:</span>
          <span className={`font-mono font-bold text-sm ${
            avgFreshness >= 70 ? 'text-emerald-400' : avgFreshness >= 40 ? 'text-amber-400' : 'text-rose-400'
          }`}>
            {avgFreshness}%
          </span>
        </div>

        <div className="bg-[#12151E] p-2.5 rounded-lg border border-[#1A1F2D] flex items-center justify-between">
          <span className="text-zinc-400 text-[11px]">كتل طازجة (≥70%):</span>
          <span className="font-mono font-bold text-sm text-emerald-400">
            {freshCount} من {chartData.length}
          </span>
        </div>

        <div className="bg-[#12151E] p-2.5 rounded-lg border border-[#1A1F2D] flex items-center justify-between">
          <span className="text-zinc-400 text-[11px]">معيار الـ 100%:</span>
          <span className="font-mono font-bold text-xs text-zinc-200">
            عمر ≤ 5 شموع
          </span>
        </div>

        <div className="bg-[#12151E] p-2.5 rounded-lg border border-[#1A1F2D] flex items-center justify-between">
          <span className="text-zinc-400 text-[11px]">معيار التآكل (0%):</span>
          <span className="font-mono font-bold text-xs text-rose-400">
            عمر ≥ 20 شمعة
          </span>
        </div>
      </div>

      {/* Primary Chart Canvas */}
      <div className="w-full h-64 sm:h-72 bg-[#090B10] rounded-xl border border-[#1A1E2A] p-2 sm:p-3 relative">
        <ResponsiveContainer width="100%" height="100%">
          {chartMode === 'bars' ? (
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 15, left: 0, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1A1F2C" vertical={false} />
              <XAxis 
                dataKey="name" 
                tick={{ fill: '#9CA3AF', fontSize: 11, fontFamily: 'monospace' }}
                axisLine={{ stroke: '#2A3142' }}
                tickLine={false}
              />
              <YAxis 
                domain={[0, 100]} 
                ticks={[0, 20, 40, 60, 70, 80, 100]}
                tick={{ fill: '#6B7280', fontSize: 10, fontFamily: 'monospace' }}
                axisLine={{ stroke: '#2A3142' }}
                tickLine={false}
                unit="%"
                orientation="right"
              />
              <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.03)' }} />
              
              {/* Reference line for Fresh threshold 70% */}
              <ReferenceLine 
                y={70} 
                stroke="#10B981" 
                strokeDasharray="4 4" 
                label={{ 
                  value: 'عتبة النضارة الفائقة (70%)', 
                  fill: '#10B981', 
                  fontSize: 10,
                  position: 'left'
                }} 
              />
              {/* Reference line for Eroded threshold 40% */}
              <ReferenceLine 
                y={40} 
                stroke="#EF4444" 
                strokeDasharray="4 4" 
                label={{ 
                  value: 'عتبة الخطر والتآكل (40%)', 
                  fill: '#EF4444', 
                  fontSize: 10,
                  position: 'left'
                }} 
              />

              <Bar 
                dataKey="freshness" 
                radius={[6, 6, 0, 0]} 
                maxBarSize={55}
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.color} 
                    stroke={entry.freshness >= 70 ? '#34D399' : entry.freshness >= 40 ? '#FBBF24' : '#F87171'}
                    strokeWidth={1}
                  />
                ))}
              </Bar>
            </BarChart>
          ) : (
            <AreaChart
              data={decayData}
              margin={{ top: 20, right: 15, left: 0, bottom: 20 }}
            >
              <defs>
                <linearGradient id="freshnessDecayGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.6}/>
                  <stop offset="50%" stopColor="#F59E0B" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#EF4444" stopOpacity={0.05}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1A1F2C" vertical={false} />
              <XAxis 
                dataKey="barLabel" 
                tick={{ fill: '#9CA3AF', fontSize: 10, fontFamily: 'monospace' }}
                axisLine={{ stroke: '#2A3142' }}
                tickLine={false}
              />
              <YAxis 
                domain={[0, 100]} 
                tick={{ fill: '#6B7280', fontSize: 10, fontFamily: 'monospace' }}
                axisLine={{ stroke: '#2A3142' }}
                tickLine={false}
                unit="%"
                orientation="right"
              />
              <Tooltip content={<CustomDecayTooltip />} />
              
              <ReferenceLine y={70} stroke="#10B981" strokeDasharray="4 4" />
              <ReferenceLine y={40} stroke="#EF4444" strokeDasharray="4 4" />

              <Area 
                type="monotone" 
                dataKey="freshness" 
                stroke="#F59E0B" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#freshnessDecayGrad)" 
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Educational Legend Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
        <div className="bg-[#121620] border border-emerald-500/20 p-2.5 rounded-lg flex items-start gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 mt-1 shrink-0 shadow-[0_0_8px_#10B981]"></div>
          <div>
            <span className="font-bold text-emerald-300 block">نضارة عالية (70% - 100%)</span>
            <p className="text-[11px] text-zinc-400 leading-snug mt-0.5">
              عمر 1 إلى 9 شموع. الكتلة لم تُلمس، أوامر البنوك جاهزة، وارتداد السعر يكون سريعاً وحاداً.
            </p>
          </div>
        </div>

        <div className="bg-[#121620] border border-amber-500/20 p-2.5 rounded-lg flex items-start gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400 mt-1 shrink-0 shadow-[0_0_8px_#F59E0B]"></div>
          <div>
            <span className="font-bold text-amber-300 block">نضارة متوسطة (40% - 69%)</span>
            <p className="text-[11px] text-zinc-400 leading-snug mt-0.5">
              عمر 10 إلى 14 شمعة. تم تخفيف جزء من السيولة؛ يُنصح بانتظار إشارة تأكيد على فريم أصغر.
            </p>
          </div>
        </div>

        <div className="bg-[#121620] border border-rose-500/20 p-2.5 rounded-lg flex items-start gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-rose-400 mt-1 shrink-0 shadow-[0_0_8px_#EF4444]"></div>
          <div>
            <span className="font-bold text-rose-300 block">منطقة متآكلة (0% - 39%)</span>
            <p className="text-[11px] text-zinc-400 leading-snug mt-0.5">
              عمر 15 شمعة فأكثر. استُهلكت الأوامر بالكامل؛ مرشحة بقوة للكسر وفشل الارتداد.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
