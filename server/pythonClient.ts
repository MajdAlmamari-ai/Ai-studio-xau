/**
 * Node.js Client for Python Quant Microservice (Action 18.2)
 * -----------------------------------------------------------------------------
 * Provides typed methods to interact with Python's Polars & DuckDB analytics
 * engine and backtesting service.
 * 
 * STRICT RULES:
 * - NO fake data
 * - Throws DataUnavailableError on connection failure or missing data
 */

import { DataUnavailableError } from '../src/errors/DataUnavailableError';

export interface PythonAnalysisMetrics {
  close: number;
  atr14: number;
  rsi14: number;
  vwap: number;
  orderFlowDelta: number;
  bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
}

export interface PythonAnalysisResponse {
  status: string;
  symbol: string;
  timeframe: string;
  timestamp: number;
  metrics: PythonAnalysisMetrics;
}

export interface PythonBacktestConfig {
  symbol?: string;
  timeframe?: string;
  initialCapital?: number;
  riskRewardFloor?: number;
  atrPeriod?: number;
  rsiPeriod?: number;
}

export interface PythonBacktestTrade {
  type: 'BUY' | 'SELL';
  exit: 'TP' | 'SL';
  pnl: number;
  time: number;
}

export interface PythonBacktestResponse {
  status: string;
  symbol: string;
  timeframe: string;
  initialCapital: number;
  finalCapital: number;
  totalTrades: number;
  winRate: number;
  netProfit: number;
  returnPct: number;
  trades: PythonBacktestTrade[];
}

export class PythonClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string = process.env.PYTHON_SERVICE_URL || 'http://127.0.0.1:8000') {
    this.baseUrl = baseUrl;
  }

  /**
   * Health check to test if Python microservice is up.
   */
  public async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/python/health`, {
        signal: AbortSignal.timeout(3000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Call Python analysis endpoint using Polars feature engineering.
   */
  public async callPythonAnalysis(
    symbol: string = 'OANDA:XAUUSD',
    timeframe: string = '15m'
  ): Promise<PythonAnalysisResponse> {
    try {
      const url = `${this.baseUrl}/api/python/analysis/${encodeURIComponent(symbol)}/${encodeURIComponent(timeframe)}`;
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        let errJson: any = null;
        try {
          errJson = await res.json();
        } catch {
          // ignore
        }
        throw new DataUnavailableError(
          errJson?.detail?.code || 'PYTHON_SERVICE_ERROR',
          errJson?.detail?.message || `Python service returned HTTP ${res.status}`
        );
      }

      return (await res.json()) as PythonAnalysisResponse;
    } catch (err: any) {
      if (err instanceof DataUnavailableError && err.code !== 'PYTHON_SERVICE_ERROR') throw err;
      throw new DataUnavailableError(
        'PYTHON_SERVICE_UNAVAILABLE',
        `Failed to reach Python quant engine: ${err?.message || 'Connection error'}`
      );
    }
  }

  /**
   * Call Python deterministic backtest engine.
   */
  public async callPythonBacktest(
    config: PythonBacktestConfig = {}
  ): Promise<PythonBacktestResponse> {
    try {
      const url = `${this.baseUrl}/api/python/backtest`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          symbol: config.symbol || 'OANDA:XAUUSD',
          timeframe: config.timeframe || '15m',
          initialCapital: config.initialCapital ?? 10000.0,
          riskRewardFloor: config.riskRewardFloor ?? 2.0,
          atrPeriod: config.atrPeriod ?? 14,
          rsiPeriod: config.rsiPeriod ?? 14,
        }),
        signal: AbortSignal.timeout(12000),
      });

      if (!res.ok) {
        let errJson: any = null;
        try {
          errJson = await res.json();
        } catch {
          // ignore
        }
        throw new DataUnavailableError(
          errJson?.detail?.code || 'PYTHON_SERVICE_ERROR',
          errJson?.detail?.message || `Python backtest failed with HTTP ${res.status}`
        );
      }

      return (await res.json()) as PythonBacktestResponse;
    } catch (err: any) {
      if (err instanceof DataUnavailableError && err.code !== 'PYTHON_SERVICE_ERROR') throw err;
      throw new DataUnavailableError(
        'PYTHON_SERVICE_UNAVAILABLE',
        `Failed to execute Python backtest: ${err?.message || 'Connection error'}`
      );
    }
  }
}

export const pythonClient = new PythonClient();
