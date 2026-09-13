/**
 * Confluence Scoring.
 *
 * Combines features (structure, regime, FVG, OB, liquidity sweep)
 * into a single 0-100 score.
 *
 * Anti-lookahead: all inputs are pre-sliced to the decision index.
 * Deterministic. No Math.random.
 */

import {
  AtrArray,
  ConfirmedSwing,
  ConfluenceConfig,
  ConfluenceFeatures,
  ConfluenceResult,
  FVGZone,
  NormalizedCandle,
  OrderBlock,
  RegimeContext,
  StructureBreak,
  SweepEvent,
  DEFAULT_CONFLUENCE_CONFIG,
} from './types';

function isStructureAligned(
  breaks: ReadonlyArray<StructureBreak>,
  regime: RegimeContext,
): boolean {
  if (breaks.length === 0) return false;
  const latest = breaks[breaks.length - 1];
  if (regime.regime === 'TREND_UP') {
    return latest.type === 'BOS_UP' || latest.type === 'CHOCH_UP';
  }
  if (regime.regime === 'TREND_DOWN') {
    return latest.type === 'BOS_DOWN' || latest.type === 'CHOCH_DOWN';
  }
  return false;
}

function isRegimeTrending(regime: RegimeContext): boolean {
  return regime.regime === 'TREND_UP' || regime.regime === 'TREND_DOWN';
}

function isFvgNearby(
  fvgs: ReadonlyArray<FVGZone>,
  currentPrice: number,
  atr: number,
  proximityAtr: number,
): boolean {
  if (atr <= 0) return false;
  const threshold = proximityAtr * atr;
  for (const z of fvgs) {
    if (z.status === 'INVALIDATED' || z.status === 'FULL_FILLED') continue;
    if (currentPrice >= z.bottom - threshold && currentPrice <= z.top + threshold) {
      return true;
    }
  }
  return false;
}

function isObNearby(
  obs: ReadonlyArray<OrderBlock>,
  currentPrice: number,
  atr: number,
  proximityAtr: number,
): boolean {
  if (atr <= 0) return false;
  const threshold = proximityAtr * atr;
  for (const ob of obs) {
    if (ob.status === 'INVALIDATED') continue;
    if (currentPrice >= ob.bottom - threshold && currentPrice <= ob.top + threshold) {
      return true;
    }
  }
  return false;
}

function isSweepRecent(
  sweeps: ReadonlyArray<SweepEvent>,
  currentIndex: number,
  recencyBars: number,
): boolean {
  for (const s of sweeps) {
    if (currentIndex - s.candleIndex <= recencyBars) {
      return true;
    }
  }
  return false;
}

function isPriceInDiscount(
  currentPrice: number,
  swings: ReadonlyArray<ConfirmedSwing>,
  asOfIndex: number,
): boolean | null {
  const visible = swings.filter((s) => s.confirmedAtIndex <= asOfIndex);
  const highs = visible.filter((s) => s.type === 'HIGH');
  const lows = visible.filter((s) => s.type === 'LOW');
  if (highs.length === 0 || lows.length === 0) return null;

  const rangeHigh = Math.max(...highs.map((h) => h.price));
  const rangeLow = Math.min(...lows.map((l) => l.price));
  const mid = (rangeHigh + rangeLow) / 2;
  return currentPrice <= mid;
}

export function calculateConfluence(
  candles: ReadonlyArray<NormalizedCandle>,
  atr: AtrArray,
  swings: ReadonlyArray<ConfirmedSwing>,
  breaks: ReadonlyArray<StructureBreak>,
  fvgs: ReadonlyArray<FVGZone>,
  obs: ReadonlyArray<OrderBlock>,
  sweeps: ReadonlyArray<SweepEvent>,
  regime: RegimeContext,
  asOfIndex: number,
  config: ConfluenceConfig = DEFAULT_CONFLUENCE_CONFIG,
): ConfluenceResult {
  if (asOfIndex < 0 || asOfIndex >= candles.length) {
    throw new Error(`asOfIndex out of range: ${asOfIndex}`);
  }

  const currentPrice = candles[asOfIndex].close;
  const currentAtr = atr[asOfIndex];
  const safeAtr = currentAtr !== null && currentAtr > 0 ? currentAtr : 0;

  const visibleFvgs = fvgs.filter((z) => z.confirmedAtIndex <= asOfIndex);
  const visibleObs = obs.filter((o) => o.confirmedAtIndex <= asOfIndex);
  const visibleBreaks = breaks.filter((b) => b.confirmedAtIndex <= asOfIndex);
  const visibleSweeps = sweeps.filter((s) => s.candleIndex <= asOfIndex);

  const features: ConfluenceFeatures = {
    structureAligned: isStructureAligned(visibleBreaks, regime),
    regimeTrending: isRegimeTrending(regime),
    fvgNearby: isFvgNearby(visibleFvgs, currentPrice, safeAtr, config.proximityAtr),
    obNearby: isObNearby(visibleObs, currentPrice, safeAtr, config.proximityAtr),
    liquiditySweepRecent: isSweepRecent(visibleSweeps, asOfIndex, config.sweepRecencyBars),
    priceInDiscount: isPriceInDiscount(currentPrice, swings, asOfIndex),
    higherTimeframeAligned: null,
  };

  let score = 0;
  const reasonCodes: string[] = [];

  if (features.structureAligned) {
    score += config.weightStructure;
    reasonCodes.push('STRUCTURE_ALIGNED');
  } else {
    reasonCodes.push('STRUCTURE_NOT_ALIGNED');
  }

  if (features.regimeTrending) {
    score += config.weightRegime;
    reasonCodes.push('REGIME_TRENDING');
  } else {
    reasonCodes.push('REGIME_NOT_TRENDING');
  }

  if (features.fvgNearby) {
    score += config.weightFvg;
    reasonCodes.push('FVG_NEARBY');
  } else {
    reasonCodes.push('NO_FVG_NEARBY');
  }

  if (features.obNearby) {
    score += config.weightOb;
    reasonCodes.push('OB_NEARBY');
  } else {
    reasonCodes.push('NO_OB_NEARBY');
  }

  if (features.liquiditySweepRecent) {
    score += config.weightSweep;
    reasonCodes.push('SWEEP_RECENT');
  } else {
    reasonCodes.push('NO_SWEEP');
  }

  if (features.priceInDiscount === true) {
    score += config.weightDiscount;
    reasonCodes.push('PRICE_DISCOUNT');
  } else if (features.priceInDiscount === false) {
    reasonCodes.push('PRICE_PREMIUM');
  } else {
    reasonCodes.push('PRICE_ZONE_UNKNOWN');
  }

  score = Math.max(0, Math.min(100, score));
  const eligible = score >= config.minEligibleScore;

  return {
    score,
    eligible,
    features,
    reasonCodes,
  };
}

export function calculateLatestConfluence(
  candles: ReadonlyArray<NormalizedCandle>,
  atr: AtrArray,
  swings: ReadonlyArray<ConfirmedSwing>,
  breaks: ReadonlyArray<StructureBreak>,
  fvgs: ReadonlyArray<FVGZone>,
  obs: ReadonlyArray<OrderBlock>,
  sweeps: ReadonlyArray<SweepEvent>,
  regime: RegimeContext,
  config: ConfluenceConfig = DEFAULT_CONFLUENCE_CONFIG,
): ConfluenceResult {
  if (candles.length === 0) {
    throw new Error('Cannot calculate confluence: empty candles');
  }
  return calculateConfluence(
    candles,
    atr,
    swings,
    breaks,
    fvgs,
    obs,
    sweeps,
    regime,
    candles.length - 1,
    config,
  );
}
