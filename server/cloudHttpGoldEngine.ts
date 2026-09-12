/**
 * -----------------------------------------------------------------------------
 * محرك البث السحابي المباشر للذهب ومؤشر الامتصاص الحجمي (Cloud HTTP Engine & VSA)
 * -----------------------------------------------------------------------------
 * 1. المصدر الرئيسي (Primary Feed): Tencent API (https://qt.gtimg.cn/q=hf_GC) كل 3 ثوانٍ
 * 2. المصدر الاحتياطي (Backup Feed): Eastmoney API (push2delay.eastmoney.com / 101.GC00Y)
 * 3. المصدر المرجعي (Reference Feed): JinDaGe API مع Fallback لـ Spot XAU كل 30 ثانية للأوفست
 * 4. مؤشر الامتصاص الحجمي (VSA): (Candle_Volume / Price_Range) بشمعة الدقيقة من Eastmoney
 */

export interface CloudGoldState {
  currentPrice: number;
  bid: number;
  ask: number;
  spreadPoints: number;
  spreadPips: number;
  high24h: number;
  low24h: number;
  open24h: number;
  prevClose: number;
  change24h: number;
  changePct: number;
  volume: number;
  lastUpdated: string;
  source: 'Tencent API (hf_GC)' | 'Eastmoney API (101.GC00Y)' | 'JinDaGe Reference';
  isLive: boolean;
  statusMessageAr: string;
  referencePrice: number;
  spreadOffset: number;
  spreadOffsetFormatted: string;
  vsa: {
    candleVolume: number;
    priceRange: number;
    absorptionRatio: number; // Candle_Volume / Price_Range
    candleTime: string;
    candleOpen: number;
    candleClose: number;
    candleHigh: number;
    candleLow: number;
    state: 'HIGH_ABSORPTION' | 'MODERATE_ABSORPTION' | 'LOW_ABSORPTION';
    stateLabelAr: string;
    descriptionAr: string;
  };
}

let latestState: CloudGoldState = {
  currentPrice: 4468.50,
  bid: 4466.50,
  ask: 4466.90,
  spreadPoints: 40,
  spreadPips: 4.0,
  high24h: 4488.80,
  low24h: 4426.20,
  open24h: 4476.60,
  prevClose: 4476.60,
  change24h: -8.10,
  changePct: -0.18,
  volume: 95200,
  lastUpdated: new Date().toISOString(),
  source: 'Tencent API (hf_GC)',
  isLive: true,
  statusMessageAr: 'تغذية سحابية مباشرة ونشطة من خوادم Tencent المالية (تحديث كل 3 ثوانٍ)',
  referencePrice: 4423.70,
  spreadOffset: 44.80,
  spreadOffsetFormatted: '+44.80$',
  vsa: {
    candleVolume: 120,
    priceRange: 0.80,
    absorptionRatio: 150.0,
    candleTime: '13:25',
    candleOpen: 4468.20,
    candleClose: 4468.50,
    candleHigh: 4468.90,
    candleLow: 4468.10,
    state: 'HIGH_ABSORPTION',
    stateLabelAr: 'امتصاص مؤسساتي كثيف (High Absorption 🟢)',
    descriptionAr: 'حجم تداول مرتفع جداً مقارنة بالنطاق السعري الضيق بشمعة الدقيقة؛ صناع السوق يمتصون العروض والطلبات.',
  },
};

let lastReferenceCheckTime = 0;
let cachedReferencePrice = 4423.70;

/**
 * 1. Fetch Primary Price from Tencent API (https://qt.gtimg.cn/q=hf_GC)
 */
async function fetchTencentGC(): Promise<Partial<CloudGoldState> | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const res = await fetch('https://qt.gtimg.cn/q=hf_GC', {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const text = await res.text();
    // Example: v_hf_GC="4468.51,-0.18,4466.50,4466.90,4488.80,4426.20,13:29:03,4476.60,4466.50,0,1,4,2026-09-08,..."
    const match = text.match(/="([^"]+)"/);
    if (!match || !match[1]) return null;

    const parts = match[1].split(',');
    const price = parseFloat(parts[0]);
    if (isNaN(price) || price <= 0) return null;

    const changePct = parseFloat(parts[1]) || 0;
    const bid = parseFloat(parts[2]) || price - 0.20;
    const ask = parseFloat(parts[3]) || price + 0.20;
    const high = parseFloat(parts[4]) || price + 5.0;
    const low = parseFloat(parts[5]) || price - 5.0;
    const prevClose = parseFloat(parts[7]) || price;
    const change24h = Number((price - prevClose).toFixed(2));
    const spreadVal = Number(Math.max(0.1, ask - bid).toFixed(2));
    const spreadPoints = Math.round(spreadVal * 100);
    const spreadPips = Number((spreadVal * 10).toFixed(1));

    return {
      currentPrice: Number(price.toFixed(2)),
      bid: Number(bid.toFixed(2)),
      ask: Number(ask.toFixed(2)),
      spreadPoints,
      spreadPips,
      high24h: Number(high.toFixed(2)),
      low24h: Number(low.toFixed(2)),
      open24h: prevClose,
      prevClose,
      change24h,
      changePct,
      source: 'Tencent API (hf_GC)',
      isLive: true,
      statusMessageAr: 'تغذية سحابية مباشرة ونشطة من Tencent API (تحديث كل 3 ثوانٍ)',
    };
  } catch (e) {
    return null;
  }
}

/**
 * 2. Fetch Backup Price from Eastmoney API
 */
async function fetchEastmoneyGC(): Promise<Partial<CloudGoldState> | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(
      'https://push2delay.eastmoney.com/api/qt/stock/get?secid=101.GC00Y&fields=f43,f44,f45,f46,f47,f48,f57,f58,f60,f169,f170',
      {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
      }
    );
    clearTimeout(timeout);

    if (!res.ok) return null;
    const json = await res.json();
    if (!json?.data?.f43) return null;

    const data = json.data;
    const rawPrice = data.f43; // e.g. 44747 -> 4474.7
    const price = rawPrice > 10000 ? rawPrice / 10 : rawPrice;
    if (isNaN(price) || price <= 0) return null;

    const high = (data.f44 || 0) > 10000 ? data.f44 / 10 : data.f44;
    const low = (data.f45 || 0) > 10000 ? data.f45 / 10 : data.f45;
    const open = (data.f46 || 0) > 10000 ? data.f46 / 10 : data.f46;
    const prevClose = (data.f60 || 0) > 10000 ? data.f60 / 10 : data.f60;
    const volume = data.f47 || 0;
    const change24h = Number((price - prevClose).toFixed(2));
    const changePct = prevClose > 0 ? Number(((change24h / prevClose) * 100).toFixed(2)) : 0;

    return {
      currentPrice: Number(price.toFixed(2)),
      bid: Number((price - 0.20).toFixed(2)),
      ask: Number((price + 0.20).toFixed(2)),
      spreadPoints: 40,
      spreadPips: 4.0,
      high24h: Number(high.toFixed(2)),
      low24h: Number(low.toFixed(2)),
      open24h: Number(open.toFixed(2)),
      prevClose: Number(prevClose.toFixed(2)),
      change24h,
      changePct,
      volume,
      source: 'Eastmoney API (101.GC00Y)',
      isLive: true,
      statusMessageAr: 'تغذية سحابية احتياطية نشطة من خوادم Eastmoney',
    };
  } catch (e) {
    return null;
  }
}

/**
 * 3. Fetch Reference Feed: JinDaGe API (Polled every 30 seconds)
 * Computes spread offset = primaryPrice - referencePrice
 */
async function fetchReferenceJinDaGe(primaryPrice: number): Promise<{ referencePrice: number; offset: number; offsetFormatted: string }> {
  const now = Date.now();
  // Only refresh every 30 seconds
  if (now - lastReferenceCheckTime < 30000 && cachedReferencePrice > 0) {
    const offset = Number((primaryPrice - cachedReferencePrice).toFixed(2));
    return {
      referencePrice: cachedReferencePrice,
      offset,
      offsetFormatted: `${offset >= 0 ? '+' : ''}${offset.toFixed(2)}$`,
    };
  }

  let refPrice: number | null = null;

  // Try JinDaGe API
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch('https://api.jindage.com/api/gold', {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    clearTimeout(timeout);
    if (res.ok) {
      const json = await res.json();
      const p = json?.price || json?.data?.price;
      if (typeof p === 'number' && p > 0) {
        refPrice = p;
      }
    }
  } catch (e) {
    // Expected if endpoint path is specialized
  }

  // Fallback Reference: Tencent London Spot Gold (hf_XAU)
  if (!refPrice) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const res = await fetch('https://qt.gtimg.cn/q=hf_XAU', { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const text = await res.text();
        const match = text.match(/="([^"]+)"/);
        if (match && match[1]) {
          const parts = match[1].split(',');
          const p = parseFloat(parts[0]);
          if (!isNaN(p) && p > 0) {
            refPrice = p;
          }
        }
      }
    } catch (e) {}
  }

  if (refPrice && refPrice > 0) {
    cachedReferencePrice = Number(refPrice.toFixed(2));
    lastReferenceCheckTime = now;
  }

  const offset = Number((primaryPrice - cachedReferencePrice).toFixed(2));
  return {
    referencePrice: cachedReferencePrice,
    offset,
    offsetFormatted: `${offset >= 0 ? '+' : ''}${offset.toFixed(2)}$`,
  };
}

/**
 * 4. VSA (Volume Spread Analysis) Absorption Indicator
 * Formula: Absorption = Candle_Volume / Price_Range from Eastmoney 1-Minute Candle
 */
async function fetchVSAAbsorptionIndicator(): Promise<CloudGoldState['vsa'] | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(
      'https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=101.GC00Y&klt=1&fqt=1&lmt=5&end=20500101&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56',
      {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      }
    );
    clearTimeout(timeout);

    if (!res.ok) return null;
    const json = await res.json();
    const klines: string[] = json?.data?.klines;
    if (!Array.isArray(klines) || klines.length === 0) return null;

    // Latest 1-minute candle string: "2026-09-08 13:21,4474.7,4475.0,4475.0,4474.3,28"
    const latestStr = klines[klines.length - 1];
    const parts = latestStr.split(',');
    const candleTime = parts[0] ? parts[0].split(' ')[1] || parts[0] : '1M';
    const candleOpen = parseFloat(parts[1]) || 4470;
    const candleClose = parseFloat(parts[2]) || 4470;
    const candleHigh = parseFloat(parts[3]) || 4471;
    const candleLow = parseFloat(parts[4]) || 4469;
    const candleVolume = parseFloat(parts[5]) || 50;

    // Price Range (Spread of the candle)
    const priceRange = Number(Math.max(0.1, candleHigh - candleLow).toFixed(2));
    // VSA Absorption Indicator = Candle_Volume / Price_Range
    const absorptionRatio = Number((candleVolume / priceRange).toFixed(1));

    let state: 'HIGH_ABSORPTION' | 'MODERATE_ABSORPTION' | 'LOW_ABSORPTION' = 'MODERATE_ABSORPTION';
    let stateLabelAr = 'امتصاص معتدل (Moderate Absorption 🟡)';
    let descriptionAr = 'حجم تداول اعتيادي ونطاق سعري متوازن بدون اختناق حاد في السيولة.';

    if (absorptionRatio >= 80) {
      state = 'HIGH_ABSORPTION';
      stateLabelAr = 'امتصاص مؤسساتي كثيف (High Absorption 🟢)';
      descriptionAr = 'كثافة حجمية ضخمة تبتلع العروض داخل نطاق سعري ضيق؛ دلالة قوية على تثبيت السعر وبدء انعكاس صانع السوق.';
    } else if (absorptionRatio < 30) {
      state = 'LOW_ABSORPTION';
      stateLabelAr = 'امتصاص منخفض (Low Absorption ⚪)';
      descriptionAr = 'انخفاض في الحجم المنفذ مقارنة باتساع المدى؛ شمعة اندفاعية غير ممتصة.';
    }

    return {
      candleVolume,
      priceRange,
      absorptionRatio,
      candleTime,
      candleOpen,
      candleClose,
      candleHigh,
      candleLow,
      state,
      stateLabelAr,
      descriptionAr,
    };
  } catch (e) {
    return null;
  }
}

/**
 * Main Continuous Sync Loop (Called every 3 seconds)
 */
export async function syncCloudGoldData(): Promise<CloudGoldState> {
  // 1. Try Tencent (Primary)
  let update = await fetchTencentGC();

  // 2. If Tencent fails, fallback to Eastmoney (Backup)
  if (!update) {
    update = await fetchEastmoneyGC();
  }

  // If both failed, retain last valid price with timestamp update
  if (update) {
    latestState = {
      ...latestState,
      ...update,
      lastUpdated: new Date().toISOString(),
    };
  }

  // 3. Update JinDaGe Reference Spread Offset (Every 30s)
  try {
    const refData = await fetchReferenceJinDaGe(latestState.currentPrice);
    latestState.referencePrice = refData.referencePrice;
    latestState.spreadOffset = refData.offset;
    latestState.spreadOffsetFormatted = refData.offsetFormatted;
  } catch (e) {}

  // 4. Update VSA Absorption Indicator
  try {
    const vsaData = await fetchVSAAbsorptionIndicator();
    if (vsaData) {
      latestState.vsa = vsaData;
    }
  } catch (e) {}

  return latestState;
}

// Background scheduler running every 3 seconds on the server
if (process.env.NODE_ENV !== 'test' && process.env.IS_TEST !== 'true') {
  const syncInterval = setInterval(syncCloudGoldData, 3000);
  if (typeof syncInterval.unref === 'function') {
    syncInterval.unref();
  }
  // Trigger initial sync immediately
  syncCloudGoldData();
}

export function getCloudGoldState(): CloudGoldState {
  return latestState;
}

export function setManualPrice(price: number): CloudGoldState {
  if (typeof price === 'number' && !isNaN(price) && price > 0) {
    latestState.currentPrice = Number(price.toFixed(2));
    latestState.bid = Number((price - 0.20).toFixed(2));
    latestState.ask = Number((price + 0.20).toFixed(2));
    latestState.lastUpdated = new Date().toISOString();
    latestState.statusMessageAr = 'تم تطبيق السعر المخصص يدوياً';
  }
  return latestState;
}

export const cloudHttpGoldEngine = {
  getState: () => latestState,
  getFinalExecutionPrice: () => ({
    bid: latestState.bid,
    ask: latestState.ask,
    mid: latestState.currentPrice,
  }),
  updateExternalReferencePrice: (price: number) => {
    if (price > 0 && latestState.referencePrice > 0) {
      latestState.spreadOffset = Number((price - latestState.referencePrice).toFixed(2));
      latestState.spreadOffsetFormatted = `${latestState.spreadOffset >= 0 ? '+' : ''}${latestState.spreadOffset.toFixed(2)}$`;
    }
  },
  getSpreadOffset: () => latestState.spreadOffset,
  calculatePipsPointsDistances: (
    entryPrice: number,
    stopLoss: number,
    takeProfit: number,
    atr1h?: number
  ) => {
    const slDistance = Math.abs(entryPrice - stopLoss);
    const tpDistance = Math.abs(entryPrice - takeProfit);
    const slPoints = Math.round(slDistance * 100);
    const slPips = Number((slDistance * 10).toFixed(1));
    const tpPoints = Math.round(tpDistance * 100);
    const tpPips = Number((tpDistance * 10).toFixed(1));

    return {
      entryPrice,
      stopLoss,
      takeProfit,
      slDistance,
      tpDistance,
      slPoints,
      slPips,
      tpPoints,
      tpPips,
      atrPoints: atr1h ? Math.round(atr1h * 100) : 150,
      summaryAr: `وقف: ${slPoints} نقطة (${slPips} بيب) | هدف: ${tpPoints} نقطة (${tpPips} بيب)`,
    };
  },
};
