import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  GoldPriceData, 
  FuturesPriceData, 
  EconomicNewsItem, 
  ScenarioProjection 
} from '../types';
import { 
  triggerAutoCalibration, 
  setAutoCalibratePricingMode 
} from '../services/goldApiService';
import { fetchGoldApiSpot } from '../services/goldApiClient';
import { fetchTvQuote } from '../services/tvApiClient';
import { fetchLiveGoldFutures, getGoldFuturesData } from '../services/futuresService';
import { fetchLiveEconomicNews, GOLD_ECONOMIC_NEWS } from '../services/newsService';
import { fetchScenarioProjections, calculateScenarioProjections } from '../services/scenarioService';

export type ConnectionStatus = 'connected' | 'reconnecting' | 'fallback' | 'failed';

export function useMarketData(currentBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL') {
  const [priceData, setPriceData] = useState<GoldPriceData | null>(null);
  const [futuresData, setFuturesData] = useState<FuturesPriceData | null>(null);
  const [newsData, setNewsData] = useState<EconomicNewsItem[]>(GOLD_ECONOMIC_NEWS);
  const [scenarioData, setScenarioData] = useState<Record<'15M' | '1H' | '4H' | '1D', ScenarioProjection> | null>(null);
  const [isLoadingPrice, setIsLoadingPrice] = useState<boolean>(false);
  const [activeScenario, setActiveScenario] = useState<string>('جاري التهيئة والاتصال المباشر بشبكة TradingView المؤسساتية...');
  
  // Connection diagnostics & resilience states
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('reconnecting');
  const [spotQuality, setSpotQuality] = useState<'REAL' | 'UNAVAILABLE'>('REAL');
  const [consecutiveErrors, setConsecutiveErrors] = useState<number>(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // References to preserve state across polling intervals without stale closures
  const isCustomScenario = useRef(false);
  const lastKnownPriceRef = useRef<number | null>(null);
  const consecutiveErrorsRef = useRef<number>(0);
  const isFetchingRef = useRef<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentBiasRef = useRef(currentBias);

  useEffect(() => {
    currentBiasRef.current = currentBias;
  }, [currentBias]);

  // Active current price derived from priceData (strict null fallback)
  const currentPrice: number | null = priceData?.price ?? null;

  async function fetchPriceWithChain(
    signal: AbortSignal,
  ): Promise<{
    price: number;
    source: string;
    bid: number | null;
    ask: number | null;
    quality: 'REAL';
  } | null> {
    // Attempt 1: TradingView Relay (Primary live feed via /api/tv/quote/spot)
    try {
      const tvResult = await fetchTvQuote('spot');
      if (tvResult.ok && tvResult.data.price > 0) {
        return {
          price: tvResult.data.price,
          source: 'tradingview',
          bid: tvResult.data.bid ?? null,
          ask: tvResult.data.ask ?? null,
          quality: 'REAL',
        };
      }
    } catch (err) {
      console.warn('[useMarketData] TradingView relay failed:', err);
    }

    // Attempt 2: Gold-API (Direct spot)
    try {
      const goldResult = await fetchGoldApiSpot();
      if (goldResult.ok && goldResult.data.price > 0) {
        return {
          price: goldResult.data.price,
          source: 'gold-api',
          bid: goldResult.data.bid ?? null,
          ask: goldResult.data.ask ?? null,
          quality: 'REAL',
        };
      }
      const failReason = (goldResult as any)?.reason?.code || 'UNKNOWN';
      console.warn('[useMarketData] Gold-API failed:', failReason);
    } catch (err) {
      console.warn('[useMarketData] Gold-API threw:', err);
    }

    // All real sources failed - do NOT silently use fake or synthetic data
    return null;
  }

  /**
   * Real-time HTTP Polling cycle to fetch live spot price from Gold-API / Tencent API
   * Runs every 3 seconds (3000ms) with automated fallback & fault tolerance
   */
  const pollTencentFeed = useCallback(async (isManualTrigger = false) => {
    // Avoid queuing concurrent requests unless forced
    if (isFetchingRef.current && !isManualTrigger) {
      return;
    }

    // Cancel any previous hanging in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    isFetchingRef.current = true;

    try {
      const chainResult = await fetchPriceWithChain(controller.signal);

      if (chainResult && chainResult.price > 0) {
        // Successful poll from TradingView or Gold-API
        consecutiveErrorsRef.current = 0;
        setConsecutiveErrors(0);
        setSpotQuality('REAL');
        setConnectionStatus('connected');
        setLastSyncTime(new Date());

        lastKnownPriceRef.current = chainResult.price;
        const spotData: GoldPriceData = {
          price: chainResult.price,
          currency: 'USD',
          symbol: 'XAUUSD',
          name: 'Gold Spot (XAU/USD)',
          updatedAt: new Date().toISOString(),
          source: chainResult.source as any,
          bid: chainResult.bid,
          ask: chainResult.ask,
          spreadPoints: chainResult.bid && chainResult.ask ? Math.round((chainResult.ask - chainResult.bid) * 100) : null,
          spreadPips: chainResult.bid && chainResult.ask ? Number(((chainResult.ask - chainResult.bid) * 10).toFixed(1)) : null,
          statusMessageAr: chainResult.source === 'tradingview'
            ? 'تغذية لحظية مباشرة وفائقة الدقة من شبكة TradingView المؤسساتية (XAU/USD Spot)'
            : 'تغذية سحابية مباشرة ونشطة من Gold-API.com (XAU/USD Spot)',
        };
        setPriceData(spotData);

        if (!isCustomScenario.current) {
          setActiveScenario(spotData.statusMessageAr || 'تغذية سعرية لحظية');
        }

        // Concurrently update dependent institutional services (Futures & Scenario Projections)
        Promise.allSettled([
          fetchLiveGoldFutures(chainResult.price),
          fetchScenarioProjections({ currentPrice: chainResult.price, atr: null, bias: currentBiasRef.current }),
        ]).then(([futuresRes, scenarioRes]) => {
          if (futuresRes.status === 'fulfilled' && futuresRes.value) {
            setFuturesData(futuresRes.value);
          }
          if (scenarioRes.status === 'fulfilled' && scenarioRes.value) {
            setScenarioData(scenarioRes.value);
          }
        });
      } else {
        // Explicit UNAVAILABLE state when live sources fail
        setSpotQuality('UNAVAILABLE');
        consecutiveErrorsRef.current += 1;
        const errCount = consecutiveErrorsRef.current;
        setConsecutiveErrors(errCount);

        const newStatus: ConnectionStatus = errCount >= 3 ? 'failed' : 'reconnecting';
        setConnectionStatus(newStatus);

        // Safeguard: Keep last known real price active or fail gracefully
        const fallbackPrice = lastKnownPriceRef.current;
        if (fallbackPrice === null) {
          setPriceData(null);
          setActiveScenario('UNAVAILABLE: No price data.');
          return;
        }
        const failMessage = errCount < 3
          ? `جاري إعادة الاتصال بمصادر الأسعار (محاولة ${errCount})...`
          : `انقطاع مؤقت بالشبكة - تم تثبيت آخر سعر حقيقي ($${fallbackPrice.toFixed(2)}) وجاري المحاولة كل 3 ثوانٍ`;

        const preservedData: GoldPriceData = {
          price: fallbackPrice,
          currency: 'USD',
          symbol: 'XAUUSD',
          name: 'Gold Spot (XAU/USD)',
          source: 'cloud_engine',
          isOffline: true,
          statusMessageAr: failMessage,
          updatedAt: new Date().toISOString(),
        };

        setPriceData(preservedData);

        if (!isCustomScenario.current) {
          setActiveScenario(failMessage);
        }

        // Fallback for futures quote if missing
        if (fallbackPrice > 0) {
          setFuturesData((prev) => prev || getGoldFuturesData(fallbackPrice));
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        // Cancelled by a new polling cycle or component unmount
        return;
      }

      setSpotQuality('UNAVAILABLE');
      consecutiveErrorsRef.current += 1;
      const errCount = consecutiveErrorsRef.current;
      setConsecutiveErrors(errCount);
      setConnectionStatus(errCount >= 3 ? 'failed' : 'reconnecting');

      const fallbackPrice = lastKnownPriceRef.current;
      if (fallbackPrice === null) {
        setPriceData(null);
        setActiveScenario('UNAVAILABLE: No price data.');
        return;
      }
      const errorMsg = `فشل الاتصال اللحظي (${err?.message || 'Network Timeout'}) - جاري المحاولة كل 3 ثوانٍ`;

      setPriceData((prev) => ({
        ...(prev || {
          price: fallbackPrice,
          currency: 'USD',
          symbol: 'XAUUSD / GC',
          name: 'Gold Spot & Futures (تخزين مؤقت سحابي)',
          updatedAt: new Date().toISOString(),
          source: 'cloud_engine',
          isOffline: true,
        }),
        price: fallbackPrice,
        isOffline: true,
        statusMessageAr: errorMsg,
      }));

      if (!isCustomScenario.current) {
        setActiveScenario(errorMsg);
      }
    } finally {
      isFetchingRef.current = false;
      setIsLoadingPrice(false);
    }
  }, []);

  // Initial load and continuous 3-second (3000ms) HTTP polling engine
  useEffect(() => {
    setIsLoadingPrice(true);
    pollTencentFeed(true);

    // Strict 3-second HTTP Polling ticker
    const interval = setInterval(() => {
      if (!isCustomScenario.current) {
        pollTencentFeed();
      }
    }, 3000);

    // Browser network connectivity listeners
    const handleOnline = () => {
      consecutiveErrorsRef.current = 0;
      setConnectionStatus('reconnecting');
      pollTencentFeed(true);
    };

    const handleOffline = () => {
      setConnectionStatus('failed');
      setPriceData((prev) => prev ? {
        ...prev,
        isOffline: true,
        statusMessageAr: 'انقطع الاتصال بالإنترنت - تم تثبيت السعر الحالي حتى عودة الشبكة',
      } : null);
    };

    // Tab visibility recovery: instantly refresh price when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isCustomScenario.current) {
        pollTencentFeed(true);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [pollTencentFeed]);

  // Load economic news less frequently (every 60 seconds)
  useEffect(() => {
    fetchLiveEconomicNews().then(setNewsData).catch(() => {});
    const newsInterval = setInterval(() => {
      fetchLiveEconomicNews().then(setNewsData).catch(() => {});
    }, 60000);
    return () => clearInterval(newsInterval);
  }, []);

  /**
   * Set custom simulated price (pauses live polling until manually resumed)
   */
  const setCustomPrice = (price: number, label: string) => {
    isCustomScenario.current = true;
    const validPrice = typeof price === 'number' && !isNaN(price) && price > 0 ? price : 4337.53;
    lastKnownPriceRef.current = validPrice;

    setPriceData({
      price: Number(validPrice.toFixed(2)),
      currency: 'USD',
      symbol: 'XAU/USD (معايرة يدوية)',
      name: `سعر محاكاة يدوي (${label})`,
      updatedAt: new Date().toISOString(),
      source: 'gateio_cfd',
      isOffline: false,
      statusMessageAr: `سعر يدوي تجريبي: $${validPrice.toFixed(2)}`,
      change24h: -1.80,
      high24h: validPrice + 12,
      low24h: validPrice - 15,
      spreadPoints: 20,
      spreadPips: 2.0,
      spreadOffset: 0,
      spreadOffsetFormatted: '0.00$',
      referencePrice: validPrice,
      pricingMode: 'manual',
      autoCalibrated: false,
    });
    setFuturesData(getGoldFuturesData(validPrice));
    setScenarioData(calculateScenarioProjections({ currentPrice: validPrice, atr: null, bias: currentBias }));
    setActiveScenario(label);
  };

  /**
   * Automatic Calibration: Instantly locks the entire system to Gate CFD (XAUUSD)
   */
  const calibrateToCfd = async () => {
    isCustomScenario.current = false;
    setIsLoadingPrice(true);
    try {
      const res = await triggerAutoCalibration();
      if (res.quote) {
        lastKnownPriceRef.current = res.quote.price;
        setPriceData(res.quote);
        setActiveScenario('الضبط التلقائي نشط ومطابق لشارت Gate CFD (XAUUSD) الحي');
        if (typeof res.quote.price === 'number') {
          fetchLiveGoldFutures(res.quote.price).then(setFuturesData).catch(() => {});
          fetchScenarioProjections({ currentPrice: res.quote.price, atr: null, bias: currentBiasRef.current }).then(setScenarioData).catch(() => {});
        }
      }
    } catch {
      // If server route failed, poll directly
      await pollTencentFeed(true);
    } finally {
      setIsLoadingPrice(false);
    }
  };

  /**
   * Switch calibration pricing mode (Gate CFD vs Spot vs Manual)
   */
  const switchPricingMode = async (mode: 'gateio_cfd' | 'gateio_spot' | 'manual', manualPrice?: number) => {
    if (mode === 'manual') {
      isCustomScenario.current = true;
    } else {
      isCustomScenario.current = false;
    }
    setIsLoadingPrice(true);
    try {
      const res = await setAutoCalibratePricingMode(mode, manualPrice);
      if (res.quote) {
        lastKnownPriceRef.current = res.quote.price;
        setPriceData(res.quote);
        setActiveScenario(res.messageAr || 'تم تحديث نمط التسعير');
        if (typeof res.quote.price === 'number') {
          fetchLiveGoldFutures(res.quote.price).then(setFuturesData).catch(() => {});
          fetchScenarioProjections({ currentPrice: res.quote.price, atr: null, bias: currentBiasRef.current }).then(setScenarioData).catch(() => {});
        }
      }
    } catch {
      await pollTencentFeed(true);
    } finally {
      setIsLoadingPrice(false);
    }
  };

  /**
   * Resumes live HTTP polling from Gate.io API
   */
  const resumeLiveFeed = () => {
    isCustomScenario.current = false;
    consecutiveErrorsRef.current = 0;
    setConsecutiveErrors(0);
    calibrateToCfd();
  };

  return {
    priceData,
    setPriceData,
    futuresData,
    setFuturesData,
    newsData,
    scenarioData,
    isLoadingPrice,
    activeScenario,
    currentPrice,
    connectionStatus,
    spotQuality,
    consecutiveErrors,
    lastSyncTime,
    isReconnecting: connectionStatus === 'reconnecting',
    loadMarketData: pollTencentFeed,
    refreshNow: () => pollTencentFeed(true),
    setCustomPrice,
    resumeLiveFeed,
    calibrateToCfd,
    switchPricingMode,
  };
}
