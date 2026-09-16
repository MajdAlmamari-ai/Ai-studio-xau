/**
 * Logistic Regression Calibration
 *
 * p = sigmoid(beta0 + beta1*x1 + ... + betan*xn)
 *
 * Trained via Gradient Descent.
 * Deterministic. NO Math.random.
 *
 * Rules:
 *   - Need >= 100 samples to train.
 *   - If insufficient -> return null.
 */

import {
  CalibrationSample,
  FeatureVector,
  TrainedModel,
} from './types';

const FEATURE_KEYS: readonly (keyof FeatureVector)[] = [
  'confluenceScore',
  'structureAligned',
  'regimeTrending',
  'sweepRecent',
  'fvgNearby',
  'obNearby',
  'volatilityScore',
  'sessionScore',
];

function toVector(f: FeatureVector): number[] {
  return FEATURE_KEYS.map((k) => f[k]);
}

function sigmoid(z: number): number {
  if (z >= 0) {
    const e = Math.exp(-z);
    return 1 / (1 + e);
  }
  const e = Math.exp(z);
  return e / (1 + e);
}

function dot(a: readonly number[], b: readonly number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function normalizeFeatures(samples: readonly CalibrationSample[]): {
  means: number[];
  stds: number[];
} {
  const n = samples.length;
  const dims = FEATURE_KEYS.length;
  const sums = new Array(dims).fill(0);
  const sumSq = new Array(dims).fill(0);

  for (const s of samples) {
    const v = toVector(s.features);
    for (let i = 0; i < dims; i++) {
      sums[i] += v[i];
      sumSq[i] += v[i] * v[i];
    }
  }

  const means = sums.map((s) => s / n);
  const stds = means.map((m, i) => {
    const variance = sumSq[i] / n - m * m;
    return Math.sqrt(Math.max(variance, 1e-9));
  });

  return { means, stds };
}

export function trainLogistic(
  samples: readonly CalibrationSample[],
  options?: {
    learningRate?: number;
    epochs?: number;
    l2?: number;
  },
): TrainedModel | null {
  if (samples.length < 100) return null;

  const lr = options?.learningRate ?? 0.1;
  const epochs = options?.epochs ?? 500;
  const l2 = options?.l2 ?? 0.001;

  const { means, stds } = normalizeFeatures(samples);
  const dims = FEATURE_KEYS.length;

  const X: number[][] = samples.map((s) => {
    const v = toVector(s.features);
    return v.map((val, i) => (val - means[i]) / stds[i]);
  });
  const y: number[] = samples.map((s) => s.label);

  let weights = new Array(dims).fill(0);
  let bias = 0;

  for (let epoch = 0; epoch < epochs; epoch++) {
    const gradW = new Array(dims).fill(0);
    let gradB = 0;

    for (let i = 0; i < X.length; i++) {
      const z = dot(weights, X[i]) + bias;
      const pred = sigmoid(z);
      const error = pred - y[i];
      for (let j = 0; j < dims; j++) {
        gradW[j] += error * X[i][j];
      }
      gradB += error;
    }

    for (let j = 0; j < dims; j++) {
      weights[j] -= lr * (gradW[j] / X.length + l2 * weights[j]);
    }
    bias -= lr * (gradB / X.length);
  }

  let brierSum = 0;
  for (let i = 0; i < X.length; i++) {
    const pred = sigmoid(dot(weights, X[i]) + bias);
    const diff = pred - y[i];
    brierSum += diff * diff;
  }
  const brierScore = brierSum / X.length;

  const versionInput = weights
    .map((w) => w.toFixed(4))
    .concat([bias.toFixed(4), brierScore.toFixed(4)])
    .join('|');
  const version = `lr_v${simpleHash(versionInput)}`;

  return {
    weights,
    bias,
    sampleCount: samples.length,
    version,
    brierScore,
  };
}

export function predictLogistic(
  model: TrainedModel,
  features: FeatureVector,
): number {
  const v = toVector(features).map((x, i) => {
    if (i === 0) return Math.max(0, Math.min(100, x)) / 100;
    return Math.max(0, Math.min(1, x));
  });

  const w = model.weights;
  let z = model.bias;
  for (let i = 0; i < Math.min(v.length, w.length); i++) {
    z += w[i] * v[i];
  }
  return sigmoid(z);
}

function simpleHash(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
