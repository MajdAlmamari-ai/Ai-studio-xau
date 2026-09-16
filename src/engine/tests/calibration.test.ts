import { describe, it, expect } from 'vitest';
import {
  trainLogistic,
  predictLogistic,
} from '../calibration/logistic';
import {
  computeBrierScore,
  computeReliabilityBins,
  computeCalibrationError,
  evaluateCalibration,
  Prediction,
} from '../calibration/brier';
import {
  CalibrationSample,
  FeatureVector,
} from '../calibration/types';

function makeFeatures(confluence: number, aligned: 0 | 1): FeatureVector {
  return {
    confluenceScore: confluence,
    structureAligned: aligned,
    regimeTrending: aligned,
    sweepRecent: aligned,
    fvgNearby: 1,
    obNearby: 1,
    volatilityScore: 0.5,
    sessionScore: 0.8,
  };
}

function generateDeterministicSamples(count: number): CalibrationSample[] {
  const samples: CalibrationSample[] = [];
  for (let i = 0; i < count; i++) {
    // Deterministic generation without Math.random
    const aligned: 0 | 1 = i % 2 === 0 ? 1 : 0;
    const confluence = aligned === 1 ? 70 + (i % 25) : 20 + (i % 30);
    const label: 0 | 1 = (aligned === 1 && confluence > 75) || (i % 4 === 0) ? 1 : 0;

    samples.push({
      features: makeFeatures(confluence, aligned),
      label,
    });
  }
  return samples;
}

describe('Calibration — Logistic Regression', () => {
  it('returns null if sample count < 100', () => {
    const samples = generateDeterministicSamples(99);
    const model = trainLogistic(samples);
    expect(model).toBeNull();
  });

  it('trains successfully with >= 100 samples', () => {
    const samples = generateDeterministicSamples(120);
    const model = trainLogistic(samples, { epochs: 100 });
    expect(model).not.toBeNull();
    if (!model) return;

    expect(model.weights.length).toBe(8);
    expect(model.sampleCount).toBe(120);
    expect(typeof model.bias).toBe('number');
    expect(typeof model.brierScore).toBe('number');
    expect(model.version.startsWith('lr_v')).toBe(true);
  });

  it('predicts probabilities bounded between 0 and 1', () => {
    const samples = generateDeterministicSamples(100);
    const model = trainLogistic(samples, { epochs: 50 });
    expect(model).not.toBeNull();
    if (!model) return;

    const highProb = predictLogistic(model, makeFeatures(95, 1));
    const lowProb = predictLogistic(model, makeFeatures(10, 0));

    expect(highProb).toBeGreaterThanOrEqual(0);
    expect(highProb).toBeLessThanOrEqual(1);
    expect(lowProb).toBeGreaterThanOrEqual(0);
    expect(lowProb).toBeLessThanOrEqual(1);
  });
});

describe('Calibration — Brier Score & Reliability', () => {
  it('computes 0 for perfect predictions', () => {
    const preds: Prediction[] = [
      { probability: 1.0, actual: 1 },
      { probability: 0.0, actual: 0 },
    ];
    expect(computeBrierScore(preds)).toBe(0);
  });

  it('computes 1 for inverted predictions', () => {
    const preds: Prediction[] = [
      { probability: 1.0, actual: 0 },
      { probability: 0.0, actual: 1 },
    ];
    expect(computeBrierScore(preds)).toBe(1);
  });

  it('computes correct baseline score (0.25 for 0.5 prediction)', () => {
    const preds: Prediction[] = [
      { probability: 0.5, actual: 1 },
      { probability: 0.5, actual: 0 },
    ];
    expect(computeBrierScore(preds)).toBe(0.25);
  });

  it('computes reliability bins and calibration error correctly', () => {
    const preds: Prediction[] = [
      { probability: 0.15, actual: 0 },
      { probability: 0.18, actual: 0 },
      { probability: 0.85, actual: 1 },
      { probability: 0.90, actual: 1 },
    ];

    const report = evaluateCalibration(preds);
    expect(report.sampleCount).toBe(4);
    expect(report.brierScore).toBeLessThan(0.05);
    expect(report.bins.length).toBe(10);
    expect(report.calibrationError).toBeGreaterThanOrEqual(0);
  });
});
