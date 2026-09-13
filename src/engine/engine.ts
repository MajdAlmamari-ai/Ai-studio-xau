/**
 * RealSMCEngine — Main Aggregator.
 *
 * This is the SINGLE public entry point of the engine.
 * It runs all modules in order and returns a unified analysis.
 *
 * Usage:
 *   const candles = await fetchGateIoCandlesticks('futures', '15m', 200);
 *   const analysis = runRealSMCEngine(candles);
 *
 * Deterministic. No Math.random.
 * No lookahead. Uses only candles[0..asOfIndex].
 */

import { calculateATR } from './atr';
import { detectSwings } from './swings';
import { detectBreaks } from './breaks';
import { detectFVGs, replayFVGLifecycle } from './fvg';
import { detectOrderBlocks, replayOBLifecycle } from './orderBlock';
import { detectLiquidityLevels, detectSweeps } from './liquidity';
import { classifyRegime } from './regime';
import { calculateConfluence } from './confluence';
import {
  EngineConfig,
  NormalizedCandle,
  RealSMCAnalysis,
  DEFAULT_ENGINE_CONFIG,
} from './types';

/**
 * Run the full SMC analysis pipeline.
 *
 * @param candles - Ascending OHLC candles.
 * @param asOfIndex - Optional index to analyze as-of (default: last candle).
 * @param config - Optional engine config.
 * @returns Unified RealSMCAnalysis.
 */
export function runRealSMCEngine(
  candles: ReadonlyArray<NormalizedCandle>,
  asOfIndex?: number,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): RealSMCAnalysis {
  if (candles.length === 0) {
    throw new Error('Cannot run engine: empty candles');
  }

  const idx = asOfIndex ?? candles.length - 1;
  if (idx < 0 || idx >= candles.length) {
    throw new Error(`asOfIndex out of range: ${idx}`);
  }

  // Slice candles up to (and including) idx — anti-lookahead.
  const sliced = candles.slice(0, idx + 1);

  // 1. ATR
  const atr = calculateATR(sliced, config.atrPeriod);
  const atrCurrent = atr[idx] ?? null;

  // 2. Swings
  const swings = detectSwings(sliced, config.swingConfig);

  // 3. Breaks
  const breaks = detectBreaks(sliced, swings, atr, config.breakConfig);

  // 4. FVGs
  const rawFvgs = detectFVGs(sliced, atr, config.fvgConfig);
  const fvgs = replayFVGLifecycle(rawFvgs, sliced);

  // 5. Order Blocks
  const rawObs = detectOrderBlocks(sliced, atr, breaks, config.obConfig);
  const orderBlocks = replayOBLifecycle(rawObs, sliced);

  // 6. Liquidity Levels + Sweeps
  const levels = detectLiquidityLevels(sliced);
  const sweeps = detectSweeps(sliced, atr, levels, config.liquidityConfig);

  // 7. Regime
  const regime = classifyRegime(
    sliced,
    atr,
    swings,
    breaks,
    idx,
    config.regimeConfig,
  );

  // 8. Confluence
  const confluence = calculateConfluence(
    sliced,
    atr,
    swings,
    breaks,
    fvgs,
    orderBlocks,
    sweeps,
    regime,
    idx,
    config.confluenceConfig,
  );

  // Aggregate reason codes
  const reasonCodes: string[] = [];
  reasonCodes.push(...regime.reasonCodes.map((c) => `REGIME:${c}`));
  reasonCodes.push(...confluence.reasonCodes.map((c) => `CONF:${c}`));

  return {
    asOfIndex: idx,
    asOfTime: sliced[idx].time,
    currentPrice: sliced[idx].close,
    atr,
    atrCurrent,
    swings,
    breaks,
    fvgs,
    orderBlocks,
    levels,
    sweeps,
    regime,
    confluence,
    reasonCodes,
  };
}

/**
 * Run the engine on the LAST candle.
 */
export function runLatestRealSMCEngine(
  candles: ReadonlyArray<NormalizedCandle>,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): RealSMCAnalysis {
  if (candles.length === 0) {
    throw new Error('Cannot run engine: empty candles');
  }
  return runRealSMCEngine(candles, candles.length - 1, config);
}

/**
 * Get only active (non-invalidated) FVGs.
 */
export function getActiveFvgs(
  analysis: RealSMCAnalysis,
): ReadonlyArray<import('./types').FVGZone> {
  return analysis.fvgs.filter((z) => z.status === 'ACTIVE' || z.status === 'PARTIAL');
}

/**
 * Get only active OBs.
 */
export function getActiveOBs(
  analysis: RealSMCAnalysis,
): ReadonlyArray<import('./types').OrderBlock> {
  return analysis.orderBlocks.filter((o) => o.status === 'ACTIVE' || o.status === 'MITIGATED');
}
