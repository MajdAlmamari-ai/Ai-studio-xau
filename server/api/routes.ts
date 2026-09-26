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
 * GET /api/session/context
 * Returns current market session context in Advisory Mode using AST (UTC+3).
 */
apiRouter.get(['/session/context', '/api/session/context'], (_req, res) => {
  const context = SessionManager.getContext();
  res.json(context);
});
