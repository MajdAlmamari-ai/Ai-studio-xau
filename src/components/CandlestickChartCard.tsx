import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  BarChart2, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  RefreshCw, 
  Layers, 
  Maximize2, 
  Activity, 
  Eye, 
  ShieldCheck, 
  Zap, 
  Sliders, 
  Crosshair,
  Calendar,
  Sparkles,
  Info
} from 'lucide-react';
import { ChartTimeframe, CandleData, CandleResponseData, MultiTimeframeSummary } from '../types';
import { fetchCandlesData } from '../services/candlesService';

interface CandlestickChartCardProps {
  currentPrice: number;
  onRefreshLivePrice?: () => void;
}

const TIMEFRAMES: Array<{
  id: ChartTimeframe;
  labelAr: string;
  subLabelAr: string;
  descriptionAr: string;
  badgeAr: string;
}> = [
  {
    id: '4H',
    labelAr: 'شمعة 4 ساعات (4H)',
    subLabelAr: 'نطاق المتداول اليومي وسوينج الأوردر بلوك',
    descriptionAr: 'الفريم الأقوى لتأكيد كتل الأوامر اللحظية (Order Blocks) ومناطق الكسر الحقيقي لهيكل السوق (BOS).',
    badgeAr: 'سعر لحظي ⚡',
  },
  {
    id: '1D',
    labelAr: 'شمعة اليوم (1D Daily)',
    subLabelAr: 'الاتجاه الهيكلي ومستويات الفاليو إريا اليومية',
    descriptionAr: 'يحدد الاتجاه المؤسساتي العام لجلسات لندن ونيويورك ومستويات السيولة الصباحية والمسائية.',
    badgeAr: 'هيكل رئيسي 🏛️',
  },
  {
    id: '1W',
    labelAr: 'شمعة الأسبوع (1W Weekly)',
    subLabelAr: 'سيولة الشراء والبيع الأسبوعية (BSL / SSL)',
    descriptionAr: 'رصد مناطق سحب سيولة قمة وقاع الأسبوع السابق ومناطق توازن كبار البنوك وصناديق التحوط.',
    badgeAr: 'سيولة أسبوعية 📊',
  },
  {
    id: '1M',
    labelAr: 'شمعة الشهر (1M Monthly)',
    subLabelAr: 'النطاق الكلي والتوزيع الاستراتيجي الموسمي',
    descriptionAr: 'تحليل الإغلاقات الشهرية الكبرى ومستويات التضخم الجيوسياسي وتراكم عقود COMEX المؤسساتية.',
    badgeAr: 'نطاق كلي 🌐',
  },
];

export const CandlestickChartCard: React.FC<CandlestickChartCardProps> = ({
  currentPrice,
  onRefreshLivePrice,
}) => {
  const [selectedTf, setSelectedTf] = useState<ChartTimeframe>('4H');
  const [candlesData, setCandlesData] = useState<CandleResponseData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hoveredCandle, setHoveredCandle] = useState<CandleData | null>(null);
  const [showEMAs, setShowEMAs] = useState<boolean>(true);
  const [showLiquidityLevels, setShowLiquidityLevels] = useState<boolean>(true);
  const [showVolume, setShowVolume] = useState<boolean>(true);
  const [chartWidth, setChartWidth] = useState<number>(800);

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Measure container width for responsive SVG chart
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 200) {
          setChartWidth(Math.floor(entry.contentRect.width));
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Fetch candle data on timeframe change or price update
  const loadCandles = async (tf: ChartTimeframe, isBackground = false) => {
    if (!isBackground) setIsLoading(true);
    try {
      const data = await fetchCandlesData(tf, currentPrice);
      setCandlesData(data);
    } catch {
      // Handled in service
    } finally {
      if (!isBackground) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCandles(selectedTf);
  }, [selectedTf]);

  // Keep latest candle updated if live price ticks
  useEffect(() => {
    if (candlesData?.candles?.length && currentPrice > 0) {
      setCandlesData((prev) => {
        if (!prev) return prev;
        const updatedCandles = [...prev.candles];
        const lastIdx = updatedCandles.length - 1;
        const last = { ...updatedCandles[lastIdx] };

        last.close = Number(currentPrice.toFixed(2));
        if (currentPrice > last.high) last.high = Number(currentPrice.toFixed(2));
        if (currentPrice < last.low) last.low = Number(currentPrice.toFixed(2));
        last.change = Number((last.close - last.open).toFixed(2));
        last.changePercent = Number(((last.change / last.open) * 100).toFixed(2));
        last.isBullish = last.close >= last.open;
        updatedCandles[lastIdx] = last;

        return {
          ...prev,
          candles: updatedCandles,
          latestCandle: last,
        };
      });
    }
  }, [currentPrice]);

  const candles = candlesData?.candles || [];
  const latestCandle = candles[candles.length - 1] || null;
  const activeCandle = hoveredCandle || latestCandle;

  // Chart Layout Calculations
  const chartHeight = 360;
  const volumeHeight = showVolume ? 60 : 0;
  const priceChartHeight = chartHeight - volumeHeight - 30; // padding
  const paddingX = 40;
  const paddingRightAxis = 65;

  const { minPrice, maxPrice, maxVol, priceRange, candleWidth, stepX } = useMemo(() => {
    if (candles.length === 0) {
      return { minPrice: 4400, maxPrice: 4500, maxVol: 10000, priceRange: 100, candleWidth: 10, stepX: 15 };
    }

    let min = Infinity;
    let max = -Infinity;
    let volMax = 0;

    for (const c of candles) {
      if (c.low < min) min = c.low;
      if (c.high > max) max = c.high;
      if (c.volume > volMax) volMax = c.volume;
    }

    // Add 4% padding top & bottom
    const span = Math.max(1, max - min);
    const paddedMin = Math.floor(min - span * 0.05);
    const paddedMax = Math.ceil(max + span * 0.05);
    const pRange = Math.max(1, paddedMax - paddedMin);

    const availableW = Math.max(200, chartWidth - paddingX - paddingRightAxis);
    const step = availableW / Math.max(1, candles.length);
    const cWidth = Math.max(3, Math.min(18, step * 0.68));

    return {
      minPrice: paddedMin,
      maxPrice: paddedMax,
      maxVol: Math.max(1, volMax),
      priceRange: pRange,
      candleWidth: cWidth,
      stepX: step,
    };
  }, [candles, chartWidth, paddingX, paddingRightAxis]);

  // Coordinate mapping functions
  const getY = (price: number) => {
    const ratio = (maxPrice - price) / priceRange;
    return 15 + ratio * priceChartHeight;
  };

  const getX = (index: number) => {
    return paddingX + index * stepX + stepX / 2;
  };

  const getVolY = (vol: number) => {
    const ratio = vol / maxVol;
    const bottom = chartHeight - 10;
    return bottom - ratio * (volumeHeight - 5);
  };

  // Moving averages (EMA 9 and EMA 21)
  const ema9Points = useMemo(() => {
    if (!showEMAs || candles.length < 5) return [];
    const k = 2 / (9 + 1);
    let ema = candles[0].close;
    return candles.map((c, i) => {
      ema = c.close * k + ema * (1 - k);
      return { x: getX(i), y: getY(ema) };
    });
  }, [candles, showEMAs, maxPrice, priceRange, chartWidth]);

  const ema21Points = useMemo(() => {
    if (!showEMAs || candles.length < 10) return [];
    const k = 2 / (21 + 1);
    let ema = candles[0].close;
    return candles.map((c, i) => {
      ema = c.close * k + ema * (1 - k);
      return { x: getX(i), y: getY(ema) };
    });
  }, [candles, showEMAs, maxPrice, priceRange, chartWidth]);

  // Y-Axis Price Ticks
  const priceTicks = useMemo(() => {
    const ticksCount = 6;
    const ticks: number[] = [];
    const step = priceRange / ticksCount;
    for (let i = 0; i <= ticksCount; i++) {
      ticks.push(Number((minPrice + step * i).toFixed(1)));
    }
    return ticks;
  }, [minPrice, priceRange]);

  // Buy-side (BSL) and Sell-side (SSL) Liquidity levels
  const { bslLevel, sslLevel } = useMemo(() => {
    if (candles.length < 5) return { bslLevel: maxPrice, sslLevel: minPrice };
    const slice = candles.slice(-12);
    const bsl = Math.max(...slice.map(c => c.high));
    const ssl = Math.min(...slice.map(c => c.low));
    return { bslLevel: bsl, sslLevel: ssl };
  }, [candles, maxPrice, minPrice]);

  const currentTfInfo = TIMEFRAMES.find(t => t.id === selectedTf)!;

  return (
    <div className="space-y-4" dir="rtl" id="institutional-candlestick-chart-root">
      
      {/* 1. Header Banner & Multi-Timeframe Controls */}
      <div className="bg-[#0E121A] border border-[#1E2433] rounded-xl p-4 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-[#1A202E]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <BarChart2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                  الشارت الزمني المؤسساتي للذهب <span className="text-amber-400">XAUUSD / COMEX GC</span>
                </h2>
                <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  مباشر 3 ثوانٍ
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                تتبع شموع الأربع ساعات (4H)، شمعة اليوم (1D)، شمعة الأسبوع (1W)، وشمعة الشهر (1M) مع كتل الأوامر ومناطق السيولة
              </p>
            </div>
          </div>

          {/* Quick Stats Strip */}
          <div className="flex items-center flex-wrap gap-2 text-xs font-mono">
            <div className="bg-[#141924] border border-[#232B3E] px-3 py-1.5 rounded-lg flex items-center gap-2">
              <span className="text-zinc-400">السعر اللحظي:</span>
              <span className="text-white font-bold text-sm">
                {currentPrice > 0 ? `$${currentPrice.toFixed(2)}` : '---'}
              </span>
            </div>

            <button
              id="chart-refresh-feed-btn"
              onClick={() => {
                loadCandles(selectedTf);
                if (onRefreshLivePrice) onRefreshLivePrice();
              }}
              disabled={isLoading}
              className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg flex items-center gap-1.5 transition-all text-xs font-medium cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>تحديث الشارت</span>
            </button>
          </div>
        </div>

        {/* 2. The 4 Timeframe Switcher Tabs (4H / 1D / 1W / 1M) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 pt-3">
          {TIMEFRAMES.map((tf) => {
            const isSelected = selectedTf === tf.id;
            const summary = candlesData?.allTimeframesSummary?.[tf.id];
            const candle = summary?.candle;
            const isBull = candle ? candle.isBullish : true;

            return (
              <button
                key={tf.id}
                id={`tf-btn-${tf.id}`}
                onClick={() => setSelectedTf(tf.id)}
                className={`p-3 rounded-xl border text-right transition-all flex flex-col justify-between cursor-pointer relative overflow-hidden ${
                  isSelected
                    ? 'bg-gradient-to-br from-amber-500/15 via-[#161B26] to-[#0E121A] border-amber-500/50 shadow-md shadow-amber-500/10'
                    : 'bg-[#121622] hover:bg-[#161C2C] border-[#202738] text-zinc-300'
                }`}
              >
                {isSelected && (
                  <div className="absolute top-0 right-0 left-0 h-0.5 bg-gradient-to-r from-amber-400 to-yellow-300" />
                )}

                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className={`text-xs font-bold ${isSelected ? 'text-amber-300' : 'text-zinc-200'}`}>
                    {tf.labelAr}
                  </span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                    isSelected ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30' : 'bg-zinc-800 text-zinc-400'
                  }`}>
                    {tf.badgeAr}
                  </span>
                </div>

                <div className="text-[11px] text-zinc-400 line-clamp-1 mb-2">
                  {tf.subLabelAr}
                </div>

                {/* Micro Candle Stats */}
                <div className="pt-2 border-t border-[#1F273A] flex items-center justify-between text-[11px] font-mono">
                  <span className="text-zinc-400">الإغلاق:</span>
                  <span className={`font-bold flex items-center gap-1 ${isBull ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {isBull ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    ${candle ? candle.close.toFixed(2) : currentPrice.toFixed(2)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Main Candlestick Chart Stage */}
      <div 
        ref={containerRef} 
        className="bg-[#0B0E14] border border-[#1C2230] rounded-xl p-4 shadow-xl relative select-none"
      >
        {/* Active Candle Hover Info Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-2 border-b border-[#181E2C] text-xs font-mono">
          <div className="flex items-center flex-wrap gap-3">
            <span className="text-amber-400 font-bold bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20 text-[11px]">
              {currentTfInfo.labelAr}
            </span>
            <span className="text-zinc-400 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-zinc-500" />
              {activeCandle ? activeCandle.dateStr : 'جاري التحميل...'}
            </span>
            {activeCandle && (
              <>
                <span className="text-zinc-400">
                  افتتاح: <b className="text-white">${activeCandle.open.toFixed(2)}</b>
                </span>
                <span className="text-zinc-400">
                  أعلى: <b className="text-emerald-300">${activeCandle.high.toFixed(2)}</b>
                </span>
                <span className="text-zinc-400">
                  أدنى: <b className="text-rose-300">${activeCandle.low.toFixed(2)}</b>
                </span>
                <span className="text-zinc-400">
                  إغلاق: <b className={activeCandle.isBullish ? 'text-emerald-400' : 'text-rose-400'}>
                    ${activeCandle.close.toFixed(2)}
                  </b>
                </span>
                <span className={`font-bold px-1.5 py-0.5 rounded ${
                  activeCandle.isBullish ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                }`}>
                  {activeCandle.change >= 0 ? '+' : ''}{activeCandle.change.toFixed(2)}$ ({activeCandle.changePercent}%)
                </span>
              </>
            )}
          </div>

          {/* Chart Feature Toggles */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEMAs(!showEMAs)}
              className={`px-2 py-1 rounded text-[11px] font-sans border transition-all cursor-pointer ${
                showEMAs 
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' 
                  : 'bg-zinc-800/60 border-zinc-700 text-zinc-400'
              }`}
              title="إظهار المتوسطات المتحركة الأسية EMA 9 / EMA 21"
            >
              EMA 9/21
            </button>
            <button
              onClick={() => setShowLiquidityLevels(!showLiquidityLevels)}
              className={`px-2 py-1 rounded text-[11px] font-sans border transition-all cursor-pointer ${
                showLiquidityLevels 
                  ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300' 
                  : 'bg-zinc-800/60 border-zinc-700 text-zinc-400'
              }`}
              title="إظهار خطوط السيولة المؤسساتية BSL و SSL"
            >
              سيولة BSL/SSL
            </button>
            <button
              onClick={() => setShowVolume(!showVolume)}
              className={`px-2 py-1 rounded text-[11px] font-sans border transition-all cursor-pointer ${
                showVolume 
                  ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300' 
                  : 'bg-zinc-800/60 border-zinc-700 text-zinc-400'
              }`}
              title="إظهار أحجام التداول (Volume Bars)"
            >
              الحجم (Volume)
            </button>
          </div>
        </div>

        {/* SVG Drawing Canvas */}
        <div 
          className="relative overflow-hidden w-full"
          onMouseLeave={() => setHoveredCandle(null)}
        >
          <svg
            width={chartWidth}
            height={chartHeight}
            className="w-full block overflow-visible"
            style={{ minHeight: `${chartHeight}px` }}
          >
            <defs>
              <linearGradient id="bullVolGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10B981" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#10B981" stopOpacity="0.08" />
              </linearGradient>
              <linearGradient id="bearVolGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#EF4444" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#EF4444" stopOpacity="0.08" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid Lines */}
            {priceTicks.map((tick) => {
              const y = getY(tick);
              return (
                <g key={`grid-${tick}`}>
                  <line
                    x1={paddingX}
                    y1={y}
                    x2={chartWidth - paddingRightAxis}
                    y2={y}
                    stroke="#181F2E"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                  {/* Right-hand Price Axis Label */}
                  <text
                    x={chartWidth - paddingRightAxis + 8}
                    y={y + 3.5}
                    fill="#6B7280"
                    fontSize="10"
                    fontFamily="monospace"
                    textAnchor="start"
                  >
                    ${tick.toFixed(1)}
                  </text>
                </g>
              );
            })}

            {/* Buy-Side Liquidity (BSL) Dotted Line */}
            {showLiquidityLevels && bslLevel && (
              <g id="bsl-liquidity-line">
                <line
                  x1={paddingX}
                  y1={getY(bslLevel)}
                  x2={chartWidth - paddingRightAxis}
                  y2={getY(bslLevel)}
                  stroke="#06B6D4"
                  strokeWidth="1.2"
                  strokeDasharray="4 4"
                />
                <rect
                  x={chartWidth - paddingRightAxis - 88}
                  y={getY(bslLevel) - 16}
                  width="85"
                  height="14"
                  fill="#083344"
                  rx="3"
                  stroke="#06B6D4"
                  strokeWidth="0.8"
                />
                <text
                  x={chartWidth - paddingRightAxis - 46}
                  y={getY(bslLevel) - 6}
                  fill="#67E8F9"
                  fontSize="9"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  BSL قمة السيولة ${bslLevel.toFixed(1)}
                </text>
              </g>
            )}

            {/* Sell-Side Liquidity (SSL) Dotted Line */}
            {showLiquidityLevels && sslLevel && (
              <g id="ssl-liquidity-line">
                <line
                  x1={paddingX}
                  y1={getY(sslLevel)}
                  x2={chartWidth - paddingRightAxis}
                  y2={getY(sslLevel)}
                  stroke="#F43F5E"
                  strokeWidth="1.2"
                  strokeDasharray="4 4"
                />
                <rect
                  x={chartWidth - paddingRightAxis - 88}
                  y={getY(sslLevel) + 3}
                  width="85"
                  height="14"
                  fill="#4C0519"
                  rx="3"
                  stroke="#F43F5E"
                  strokeWidth="0.8"
                />
                <text
                  x={chartWidth - paddingRightAxis - 46}
                  y={getY(sslLevel) + 13}
                  fill="#FDA4AF"
                  fontSize="9"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  SSL قاع السيولة ${sslLevel.toFixed(1)}
                </text>
              </g>
            )}

            {/* Live Spot Price Reference Line */}
            {currentPrice > 0 && (
              <g id="live-spot-price-line">
                <line
                  x1={paddingX}
                  y1={getY(currentPrice)}
                  x2={chartWidth - paddingRightAxis}
                  y2={getY(currentPrice)}
                  stroke="#F59E0B"
                  strokeWidth="1.5"
                  strokeDasharray="2 2"
                />
                {/* Live Price Tag on Right Axis */}
                <rect
                  x={chartWidth - paddingRightAxis + 2}
                  y={getY(currentPrice) - 9}
                  width="60"
                  height="18"
                  fill="#D97706"
                  rx="3"
                />
                <text
                  x={chartWidth - paddingRightAxis + 32}
                  y={getY(currentPrice) + 3.5}
                  fill="#FFFFFF"
                  fontSize="10"
                  fontWeight="bold"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  ${currentPrice.toFixed(1)}
                </text>
              </g>
            )}

            {/* Volume Bars */}
            {showVolume && candles.map((c, i) => {
              const x = getX(i);
              const volY = getVolY(c.volume);
              const volH = Math.max(2, (chartHeight - 10) - volY);
              const fill = c.isBullish ? 'url(#bullVolGrad)' : 'url(#bearVolGrad)';
              return (
                <rect
                  key={`vol-${c.time}-${i}`}
                  x={x - candleWidth / 2}
                  y={volY}
                  width={candleWidth}
                  height={volH}
                  fill={fill}
                  rx="1"
                />
              );
            })}

            {/* Moving Average EMA 9 (Yellow) */}
            {showEMAs && ema9Points.length > 1 && (
              <polyline
                fill="none"
                stroke="#FBBF24"
                strokeWidth="1.5"
                opacity="0.8"
                points={ema9Points.map(p => `${p.x},${p.y}`).join(' ')}
              />
            )}

            {/* Moving Average EMA 21 (Sky Blue) */}
            {showEMAs && ema21Points.length > 1 && (
              <polyline
                fill="none"
                stroke="#38BDF8"
                strokeWidth="1.5"
                opacity="0.8"
                points={ema21Points.map(p => `${p.x},${p.y}`).join(' ')}
              />
            )}

            {/* Candlestick Glyphs */}
            {candles.map((c, i) => {
              const x = getX(i);
              const highY = getY(c.high);
              const lowY = getY(c.low);
              const openY = getY(c.open);
              const closeY = getY(c.close);

              const bodyTop = Math.min(openY, closeY);
              const bodyHeight = Math.max(2, Math.abs(openY - closeY));
              const isHovered = hoveredCandle?.time === c.time;
              const color = c.isBullish ? '#10B981' : '#EF4444';

              return (
                <g 
                  key={`candle-${c.time}-${i}`}
                  onMouseEnter={() => setHoveredCandle(c)}
                  className="cursor-pointer transition-opacity"
                  opacity={isHovered ? 1 : 0.9}
                >
                  {/* Wick Line */}
                  <line
                    x1={x}
                    y1={highY}
                    x2={x}
                    y2={lowY}
                    stroke={color}
                    strokeWidth={isHovered ? 2 : 1.2}
                  />

                  {/* Candle Body */}
                  <rect
                    x={x - candleWidth / 2}
                    y={bodyTop}
                    width={candleWidth}
                    height={bodyHeight}
                    fill={color}
                    stroke={isHovered ? '#FFFFFF' : color}
                    strokeWidth={isHovered ? 1.5 : 0.5}
                    rx="1.5"
                  />

                  {/* Highlight aura if hovered */}
                  {isHovered && (
                    <circle
                      cx={x}
                      cy={closeY}
                      r="4"
                      fill="#FFFFFF"
                      stroke={color}
                      strokeWidth="2"
                    />
                  )}
                </g>
              );
            })}

            {/* Time labels below chart */}
            {candles.map((c, i) => {
              // Show label every 4-6 candles depending on count
              const stepInterval = Math.max(3, Math.floor(candles.length / 7));
              if (i % stepInterval !== 0 && i !== candles.length - 1) return null;
              const x = getX(i);
              return (
                <text
                  key={`t-label-${c.time}-${i}`}
                  x={x}
                  y={chartHeight - 2}
                  fill="#64748B"
                  fontSize="9"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  {c.dateStr.split(' ')[0]} {c.dateStr.split(' ')[1] || ''}
                </text>
              );
            })}
          </svg>
        </div>

        {/* Chart Legend / Active Candle Pattern Badge */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-3 pt-3 border-t border-[#19202E] text-xs">
          <div className="flex items-center gap-3">
            <span className="text-zinc-400 font-mono">النمط المرصود بالشمعة:</span>
            <span className="px-2.5 py-1 rounded bg-[#151C2A] border border-[#252E44] text-white font-medium flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              {activeCandle?.patternAr || 'جاري تحليل بنية الشمعة المؤسساتية...'}
            </span>
          </div>

          {/* Color Legend */}
          <div className="flex items-center gap-4 text-[11px] text-zinc-400 font-mono">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
              شمعة صاعدة (شراء)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
              شمعة هابطة (بيع)
            </span>
            {showEMAs && (
              <>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-0.5 bg-yellow-400 inline-block" />
                  EMA 9
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-0.5 bg-sky-400 inline-block" />
                  EMA 21
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 4. Multi-Timeframe Structural Matrix (مصفوفة الشموع المؤسساتية الأربعة) */}
      <div className="bg-[#0E121A] border border-[#1E2433] rounded-xl p-4 shadow-lg">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#181E2C]">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white">
              مصفوفة مقارنة الأطر الزمنية الأربعة (4H • 1D • 1W • 1M Structure)
            </h3>
          </div>
          <span className="text-xs text-zinc-400 font-mono">
            نظرة شمولية لهيكل صانع السوق المتعدد
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {TIMEFRAMES.map((tf) => {
            const summary = candlesData?.allTimeframesSummary?.[tf.id];
            const c = summary?.candle || latestCandle;
            const isBull = c ? c.isBullish : true;
            const isCur = selectedTf === tf.id;

            return (
              <div
                key={`matrix-${tf.id}`}
                className={`p-3.5 rounded-xl border transition-all ${
                  isCur
                    ? 'bg-amber-500/10 border-amber-500/40 ring-1 ring-amber-400/30'
                    : 'bg-[#121622] border-[#202738]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    {tf.labelAr}
                  </span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                    isBull 
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                      : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                  }`}>
                    {isBull ? 'اتجاه صاعد 🟢' : 'اتجاه هابط 🔴'}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between text-zinc-400">
                    <span>نطاق الشمعة (H-L):</span>
                    <span className="text-white">
                      ${c ? (c.high - c.low).toFixed(2) : '0.00'}
                    </span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>القمة (High):</span>
                    <span className="text-emerald-300">
                      ${c ? c.high.toFixed(2) : '0.00'}
                    </span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>القاع (Low):</span>
                    <span className="text-rose-300">
                      ${c ? c.low.toFixed(2) : '0.00'}
                    </span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>نسبة الزخم:</span>
                    <span className="text-amber-300">
                      {summary?.momentumScore ?? 80}%
                    </span>
                  </div>
                </div>

                <div className="mt-2.5 pt-2 border-t border-[#1C2334] text-[11px] text-zinc-400">
                  <div className="line-clamp-1">
                    {c?.patternAr || tf.descriptionAr}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Institutional Price Action Strategy Guide */}
      <div className="bg-[#0E121A] border border-[#1E2433] rounded-xl p-4 shadow-lg text-xs">
        <div className="flex items-center gap-2 mb-2 text-amber-400 font-bold">
          <Info className="w-4 h-4" />
          <span>القواعد المؤسساتية للتعامل مع الشموع الأربعة (SMC Timeframe Synergy):</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-zinc-300 leading-relaxed">
          <div className="bg-[#121622] p-3 rounded-lg border border-[#1F273A]">
            <b className="text-white block mb-1">1. التوافق الهيكلي (Top-Down Multi-Timeframe):</b>
            تحديد الاتجاه الرئيسي من شمعة الشهر (1M) والأسبوع (1W)، واستخراج مناطق العرض والطلب من شمعة اليوم (1D)، ثم البحث عن إشارة الدخول وسحب السيولة الدقيق على شمعة الـ 4 ساعات (4H).
          </div>
          <div className="bg-[#121622] p-3 rounded-lg border border-[#1F273A]">
            <b className="text-white block mb-1">2. سحب قمة أو قاع الشمعة السابقة (Liquidity Sweep):</b>
            إذا قامت شمعة الـ 4 ساعات أو اليوم باختراق ذيل الشمعة السابقة (Sweep) ثم أغلقت سريعاً داخل النطاق، فهذه إشارة مصيدة سيولة قوية تدعم الانعكاس الفوري بنسبة عائد تفوق 1:2.5.
          </div>
        </div>
      </div>

    </div>
  );
};
