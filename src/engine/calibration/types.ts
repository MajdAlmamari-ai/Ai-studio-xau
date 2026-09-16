/**
 * Calibration Types
 *
 * Converts raw features into calibrated probabilities.
 * Uses Logistic Regression (interpretable).
 *
 * Rules:
 *   - If sample < 100 → INSUFFICIENT_SAMPLE
 *   - Never return fake probabilities.
 *   - Deterministic. NO Math.random.
 */

export type CalibrationStatus =
  | 'CALIBRATED'
  | 'UNCALIBRATED'
  | 'INSUFFICIENT_SAMPLE';

export interface FeatureVector {
  readonly confluenceScore: number;       // 0-100
  readonly structureAligned: number;      // 0 or 1
  readonly regimeTrending: number;        // 0 or 1
  readonly sweepRecent: number;           // 0 or 1
  readonly fvgNearby: number;             // 0 or 1
  readonly obNearby: number;              // 0 or 1
  readonly volatilityScore: number;       // 0-1
  readonly sessionScore: number;          // 0-1
}

export interface CalibrationSample {
  readonly features: FeatureVector;
  readonly label: 0 | 1;                  // 1 = win, 0 = loss
}

export interface CalibratedProbability {
  readonly probability: number | null;
  readonly status: CalibrationStatus;
  readonly modelVersion: string | null;
  readonly sampleCount: number;
}

export interface TrainedModel {
  readonly weights: readonly number[];
  readonly bias: number;
  readonly sampleCount: number;
  readonly version: string;
  readonly brierScore: number;
}
