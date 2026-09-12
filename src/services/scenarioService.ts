/**
 * Scenario Projection Service
 * 
 * Projects possible price ranges based on ATR (Average True Range).
 * 
 * HONESTY NOTE:
 * This is NOT a trained ML model.
 * This is a simple ATR-based drift projection.
 * It provides a "what-if" range, not a prediction.
 */

import { ScenarioProjection } from '../types';

interface ProjectionInput {
  currentPrice: number;
  atr: number | null;
  bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
}

const HORIZONS: Record<'15M' | '1H' | '4H' | '1D', number> = {
  '15M': 15,
  '1H': 60,
  '4H': 240,
  '1D': 1440,
};

const ATR_MULTIPLIERS: Record<'15M' | '1H' | '4H' | '1D', number> = {
  '15M': 0.5,
  '1H': 0.8,
  '4H': 1.2,
  '1D': 1.8,
};

const DISCLAIMER =
  'Scenario projection based on ATR. Not a trained ML model. ' +
  'For research and visualization only.';

function projectOne(
  timeframe: '15M' | '1H' | '4H' | '1D',
  input: ProjectionInput,
): ScenarioProjection {
  const { currentPrice, atr, bias } = input;

  // If no ATR available, projection is unavailable.
  if (atr === null || atr <= 0 || !Number.isFinite(atr)) {
    return {
      timeframe,
      currentPrice,
      projectedPrice: currentPrice,
      projectedChangePct: 0,
      direction: 'NEUTRAL',
      atrUsed: null,
      rangeUpper: currentPrice,
      rangeLower: currentPrice,
      horizonMinutes: HORIZONS[timeframe],
      projectionMethod: 'ATR_SCALED_DRIFT',
      disclaimer: 'Projection unavailable: ATR not ready.',
      notesAr: 'التوقع غير متاح: ATR غير جاهز.',
    };
  }

  const biasSign = bias === 'BULLISH' ? 1 : bias === 'BEARISH' ? -1 : 0;
  const drift = atr * ATR_MULTIPLIERS[timeframe] * biasSign;
  const projectedPrice = Number((currentPrice + drift).toFixed(2));
  const projectedChangePct = Number(
    ((drift / currentPrice) * 100).toFixed(3),
  );
  const rangeUpper = Number(
    (projectedPrice + atr * 1.5).toFixed(2),
  );
  const rangeLower = Number(
    (projectedPrice - atr * 1.5).toFixed(2),
  );

  const direction =
    drift > 0 ? 'UP' : drift < 0 ? 'DOWN' : 'NEUTRAL';

  return {
    timeframe,
    currentPrice,
    projectedPrice,
    projectedChangePct,
    direction,
    atrUsed: atr,
    rangeUpper,
    rangeLower,
    horizonMinutes: HORIZONS[timeframe],
    projectionMethod: 'ATR_SCALED_DRIFT',
    disclaimer: DISCLAIMER,
    notesAr: `توقع مبني على ATR=${atr.toFixed(2)}. ليس نموذج تعلم آلي.`,
  };
}

export function calculateScenarioProjections(
  input: ProjectionInput,
): Record<'15M' | '1H' | '4H' | '1D', ScenarioProjection> {
  return {
    '15M': projectOne('15M', input),
    '1H': projectOne('1H', input),
    '4H': projectOne('4H', input),
    '1D': projectOne('1D', input),
  };
}

export async function fetchScenarioProjections(
  input: ProjectionInput,
): Promise<Record<'15M' | '1H' | '4H' | '1D', ScenarioProjection>> {
  return calculateScenarioProjections(input);
}
