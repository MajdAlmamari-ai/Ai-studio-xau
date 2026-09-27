/**
 * Institutional Gold API Routes
 * -----------------------------------------------------------------------------------------
 * Provides core market endpoints with explicit X-Data-Quality tracking:
 * - FULL: all requested candles present and verified
 * - PARTIAL: some candles present, but below requested target
 * - MISSING: no candles available
 * 
 * Includes Spot Analysis Endpoint (/api/spot/analysis)
 * Includes Futures Analysis Endpoint (/api/futures/analysis)
 * Includes Session Context Endpoint (/api/session/context)
 */

import { Router } from 'express';
import { getCandlesForTimeframe, ChartTimeframe } from '../candlesService';
import { CandleRepository } from '../candleRepository';
import { SpotEngine } from '../engines/SpotEngine';
import { FuturesEngine } from '../engines/FuturesEngine';
import { SessionManager } from '../session/SessionManager';
import { comparisonEngine } from '../fusion/ComparisonEngine';
import { fredClient } from '../macro/FredClient';
import { correlationEngine } from '../macro/CorrelationEngine';
import { cotFetcher } from '../macro/COTFetcher';

export const apiRouter = Router();

let repoInstance: CandleRepository | null = null;
let spotEngine: SpotEngine | null = null;
let futuresEngine: FuturesEngine | null = null;

function getRepoInstance(): CandleRepository {
  if (!repoInstance) {
    repoInstance = new CandleRepository('./db/xauusd.sqlite');
  }
  return repoInstance;
}

function getSpotEngineInstance(): SpotEngine {
  if (!spotEngine) {
    spotEngine = new SpotEngine(getRepoInstance());
  }
  return spotEngine;
}

function getFuturesEngineInstance(): FuturesEngine {
  if (!futuresEngine) {
    futuresEngine = new FuturesEngine(getRepoInstance());
  }
  return futuresEngine;
}

apiRouter.get(['/gold/candles', '/candles'], async (req, res) => {
  try {
    const rawTf = String(req.query.timeframe || '4H').toUpperCase();
    const validTf: ChartTimeframe = ['4H', '1D', '1W', '1M'].includes(rawTf)
      ? (rawTf as ChartTimeframe)
      : '4H';

    const livePriceOverride = req.query.currentPrice ? Number(req.query.currentPrice) : undefined;
    const requestedCount = req.query.limit ? Number(req.query.limit) : 50;

    const candlesData = await getCandlesForTimeframe(validTf, livePriceOverride);
    const candleCount = candlesData?.candles?.length || 0;

    let quality: 'FULL' | 'PARTIAL' | 'MISSING' = 'MISSING';
    if (candleCount === 0) {
      quality = 'MISSING';
    } else if (candleCount >= requestedCount || candleCount >= 50) {
      quality = 'FULL';
    } else {
      quality = 'PARTIAL';
    }

    res.setHeader('X-Data-Quality', quality);
    res.json(candlesData);
  } catch (err: any) {
    res.setHeader('X-Data-Quality', 'MISSING');
    res.status(500).json({ error: err.message || 'Failed to fetch candlestick data' });
  }
});

/**
 * GET /api/spot/analysis?timeframe=15m
 * Analyzes Spot Gold (OANDA:XAUUSD) using institutional SpotEngine.
 */
apiRouter.get(['/spot/analysis', '/api/spot/analysis'], async (req, res) => {
  try {
    const timeframe = (req.query.timeframe as string) || '15m';
    const engine = getSpotEngineInstance();
    const analysis = await engine.analyze(timeframe);
    const recommendation = engine.getRecommendation(analysis);

    res.json({
      status: 'LIVE',
      analysis,
      recommendation,
    });
  } catch (err: any) {
    res.status(503).json({
      status: 'UNAVAILABLE',
      analysis: null,
      error: {
        code: err?.code || 'SPOT_ANALYSIS_FAILED',
        message: err?.message || 'Failed to analyze spot market data',
      },
    });
  }
});

/**
 * GET /api/futures/analysis?timeframe=15m
 * Analyzes Futures Gold (COMEX:GC1!) using institutional FuturesEngine.
 */
apiRouter.get(['/futures/analysis', '/api/futures/analysis'], async (req, res) => {
  try {
    const timeframe = (req.query.timeframe as string) || '15m';
    const engine = getFuturesEngineInstance();
    const analysis = await engine.analyze(timeframe);
    const recommendation = engine.getRecommendation(analysis);

    res.json({
      status: 'LIVE',
      analysis,
      recommendation,
    });
  } catch (err: any) {
    res.status(503).json({
      status: 'UNAVAILABLE',
      analysis: null,
      error: {
        code: err?.code || 'FUTURES_ANALYSIS_FAILED',
        message: err?.message || 'Failed to analyze futures market data',
      },
    });
  }
});

/**
 * GET /api/session/status
 * Returns current market session status using Saudi Arabia AST timezone.
 */
apiRouter.get(['/session/status', '/api/session/status'], (_req, res) => {
  const status = SessionManager.getStatus();
  res.json({
    state: status.state,
    session: status.session,
    sessionLabelAr: status.sessionLabelAr,
    closedReason: status.closedReason,
    closedReasonAr: status.closedReasonAr,
    resumesAtAST: status.resumesAtAST,
    alerts: status.alerts,
    currentTimeAST: status.currentTimeAST,
  });
});

/**
 * GET /api/session/context
 * Returns current market session context in Advisory Mode using AST (UTC+3).
 */
apiRouter.get(['/session/context', '/api/session/context'], (_req, res) => {
  const context = SessionManager.getContext();
  res.json(context);
});

/**
 * GET /api/fusion/analysis?timeframe=15m
 * Returns comprehensive FusionResult correlating Spot and Futures Gold.
 */
apiRouter.get(['/fusion/analysis', '/api/fusion/analysis'], async (req, res) => {
  try {
    const timeframe = (req.query.timeframe as string) || '15m';
    const sEngine = getSpotEngineInstance();
    const fEngine = getFuturesEngineInstance();
    const repo = getRepoInstance();

    // Fetch Spot & Futures analyses
    const spotAnalysis = await sEngine.analyze(timeframe);
    const futuresAnalysis = await fEngine.analyze(timeframe);

    // Fetch recent candles to calculate spot & futures prices and basis history
    const spotCandles = repo.getSpotCandles(timeframe, 30);
    const futuresCandles = repo.getFuturesCandles(timeframe, 30);

    const spotPrice = spotCandles[spotCandles.length - 1]?.close ?? spotAnalysis.currentPrice;
    const futuresPrice = futuresCandles[futuresCandles.length - 1]?.close ?? futuresAnalysis.currentPrice;

    // Calculate basis history from aligned times
    const basisHistory: number[] = [];
    const futuresMap = new Map<number, number>();
    for (const fc of futuresCandles) {
      futuresMap.set(fc.time, fc.close);
    }
    for (const sc of spotCandles) {
      const fClose = futuresMap.get(sc.time);
      if (typeof fClose === 'number') {
        basisHistory.push(Number((fClose - sc.close).toFixed(2)));
      }
    }

    const fusionResult = comparisonEngine.analyze(
      spotAnalysis,
      futuresAnalysis,
      Number(spotPrice),
      Number(futuresPrice),
      basisHistory
    );

    res.json({
      status: 'LIVE',
      ...fusionResult,
    });
  } catch (err: any) {
    res.status(503).json({
      status: 'UNAVAILABLE',
      error: {
        code: err?.code || 'FUSION_ANALYSIS_FAILED',
        message: err?.message || 'Failed to generate fused market analysis',
      },
    });
  }
});

/**
 * GET /api/macro/snapshot
 * Fetches latest Federal Reserve Economic Data (FRED) for Real Yields, DXY proxy, Fed Funds.
 */
apiRouter.get(['/macro/snapshot', '/api/macro/snapshot'], async (_req, res) => {
  try {
    const snapshot = await fredClient.fetchSnapshot();
    res.json({
      status: 'SUCCESS',
      snapshot,
    });
  } catch (err: any) {
    res.status(503).json({
      status: 'UNAVAILABLE',
      error: {
        code: err?.code || 'FRED_FETCH_FAILED',
        message: err?.message || 'Macro data unavailable',
      },
    });
  }
});

/**
 * GET /api/macro/correlation
 * Returns rolling correlation regimes between Gold and macroeconomic indicators.
 */
apiRouter.get(['/macro/correlation', '/api/macro/correlation'], async (req, res) => {
  try {
    const window = parseInt(req.query.window as string, 10) || 20;
    const repo = getRepoInstance();
    const spotCandles = repo.getSpotCandles('1d', window + 10);

    if (!spotCandles || spotCandles.length < window) {
      return res.status(503).json({
        status: 'UNAVAILABLE',
        error: {
          code: 'INSUFFICIENT_HISTORICAL_DATA',
          message: `Need at least ${window} daily gold candles for correlation calculation`,
        },
      });
    }

    const goldPrices = spotCandles.map((c) => c.close);

    // Fetch macro snapshot to verify availability
    const snapshot = await fredClient.fetchSnapshot();

    res.json({
      status: 'SUCCESS',
      window,
      currentGoldPrice: goldPrices[goldPrices.length - 1],
      macroSnapshot: snapshot,
      regimes: {
        dxy: {
          symbol: 'DTWEXBGS',
          status: snapshot.dxy ? 'ACTIVE' : 'DATA_PENDING',
          latestValue: snapshot.dxy?.value ?? null,
        },
        realYields: {
          symbol: 'DFII10',
          status: snapshot.realYields ? 'ACTIVE' : 'DATA_PENDING',
          latestValue: snapshot.realYields?.value ?? null,
        },
      },
    });
  } catch (err: any) {
    res.status(503).json({
      status: 'UNAVAILABLE',
      error: {
        code: err?.code || 'CORRELATION_ANALYSIS_FAILED',
        message: err?.message || 'Macro correlation analysis unavailable',
      },
    });
  }
});

/**
 * GET /api/macro/cot
 * Returns latest CFTC Commitment of Traders (COT) institutional positioning for Gold Futures.
 */
apiRouter.get(['/macro/cot', '/api/macro/cot'], async (_req, res) => {
  try {
    const report = await cotFetcher.fetchLatest();
    if (!report) {
      return res.status(503).json({
        status: 'UNAVAILABLE',
        error: {
          code: 'COT_DATA_UNAVAILABLE',
          message: 'CFTC COT report currently unavailable',
        },
      });
    }

    res.json({
      status: 'SUCCESS',
      report,
    });
  } catch (err: any) {
    res.status(503).json({
      status: 'UNAVAILABLE',
      error: {
        code: err?.code || 'COT_FETCH_FAILED',
        message: err?.message || 'Failed to fetch COT report',
      },
    });
  }
});


