/**
 * Brier Score & Reliability
 *
 * Evaluates calibration quality.
 *
 * Brier Score = mean((prob - actual)^2)
 *   - 0 = perfect
 *   - 0.25 = baseline
 *   - 1 = worst
 *
 * Deterministic. NO Math.random.
 */

export interface ReliabilityBin {
  readonly binStart: number;
  readonly binEnd: number;
  readonly count: number;
  readonly avgPredicted: number;
  readonly actualRate: number;
}

export interface CalibrationReport {
  readonly brierScore: number;
  readonly sampleCount: number;
  readonly bins: readonly ReliabilityBin[];
  readonly calibrationError: number;
}

export interface Prediction {
  readonly probability: number;
  readonly actual: 0 | 1;
}

export function computeBrierScore(
  predictions: readonly Prediction[],
): number {
  if (predictions.length === 0) return 0;
  let sum = 0;
  for (const p of predictions) {
    const diff = p.probability - p.actual;
    sum += diff * diff;
  }
  return sum / predictions.length;
}

export function computeReliabilityBins(
  predictions: readonly Prediction[],
  binCount = 10,
): ReliabilityBin[] {
  const bins: ReliabilityBin[] = [];
  const binSize = 1 / binCount;

  for (let i = 0; i < binCount; i++) {
    const binStart = i * binSize;
    const binEnd = (i + 1) * binSize;
    const inBin = predictions.filter(
      (p) => p.probability >= binStart && p.probability < binEnd,
    );

    if (inBin.length === 0) {
      bins.push({
        binStart,
        binEnd,
        count: 0,
        avgPredicted: 0,
        actualRate: 0,
      });
      continue;
    }

    const avgPredicted =
      inBin.reduce((s, p) => s + p.probability, 0) / inBin.length;
    const actualRate =
      inBin.reduce((s, p) => s + p.actual, 0) / inBin.length;

    bins.push({
      binStart,
      binEnd,
      count: inBin.length,
      avgPredicted,
      actualRate,
    });
  }

  return bins;
}

export function computeCalibrationError(
  bins: readonly ReliabilityBin[],
): number {
  const total = bins.reduce((s, b) => s + b.count, 0);
  if (total === 0) return 0;
  let sum = 0;
  for (const b of bins) {
    sum += b.count * Math.abs(b.avgPredicted - b.actualRate);
  }
  return sum / total;
}

export function evaluateCalibration(
  predictions: readonly Prediction[],
): CalibrationReport {
  const brierScore = computeBrierScore(predictions);
  const bins = computeReliabilityBins(predictions);
  const calibrationError = computeCalibrationError(bins);

  return {
    brierScore,
    sampleCount: predictions.length,
    bins,
    calibrationError,
  };
}
