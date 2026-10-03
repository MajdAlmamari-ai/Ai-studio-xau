/**
 * @file spotRecommendationEngine.ts
 * @description المحرك النهائي لتوصيات السعر الفوري (Spot XAUUSD).
 * يدمج تحليل الفريمات متعدد الطبقات (Task 2)، نموذج السيولة AMD / Judas Swing (Task 3)، وتنقية الذيول (Task 1).
 */

import { MultiTimeframeAlignmentResult, analyzeMultiTimeframeAlignment, Candle } from './spotMultiTimeframeEngine';
import { AmdResult, detectAsianRange, detectJudasSwingAMD } from './ictAMDEngine';
import { WickValidationResult, purifyCandleWick } from './compressionWickService';

export type RecommendationAction = 'BUY' | 'SELL' | 'WAIT';

export interface SpotRecommendation {
  readonly action: RecommendationAction;
  readonly entryPrice: number;
  readonly stopLoss: number;
  readonly takeProfit1: number;
  readonly takeProfit2: number;
  readonly riskReward1: string;
  readonly riskReward2: string;
  readonly confidenceScore: number;
  readonly rationaleAr: string;
}

export interface SpotRecommendationInput {
  readonly weekly?: readonly Candle[];
  readonly daily: readonly Candle[];
  readonly h4?: readonly Candle[];
  readonly h1?: readonly Candle[];
  readonly m15: readonly Candle[];
}

export function generateSpotRecommendation(
  input: SpotRecommendationInput | number,
  atrInput?: number,
  multiTfInput?: MultiTimeframeAlignmentResult,
  amdInput?: AmdResult,
  wickValidationInput?: WickValidationResult
): SpotRecommendation {
  if (typeof input === 'number') {
    return generateSpotRecommendationInternal(
      input,
      atrInput ?? 5.0,
      multiTfInput ?? { confluenceScore: 70, overallBias: 'NEUTRAL', timeframeDetails: {}, rationaleAr: '' },
      amdInput ?? { phase: 'ACCUMULATION', sweepDirection: 'NONE', isSweep: false, rationaleAr: '' },
      wickValidationInput ?? { isUpperWickValid: true, isLowerWickValid: true, upperWickSize: 1, lowerWickSize: 1, maxAllowedWick: 10 }
    );
  }

  const { weekly = [], daily = [], h4 = [], h1 = [], m15 = [] } = input;
  const latestPrice = m15.length > 0 ? m15[m15.length - 1].close : (daily.length > 0 ? daily[daily.length - 1].close : 2700);
  const atr = 5.0;

  const candlesRecord = {
    '1W': weekly,
    '1D': daily,
    '4H': h4,
    '1H': h1,
    '15m': m15,
  };
  const atrRecord = {
    '1W': 15.0,
    '1D': 10.0,
    '4H': 6.0,
    '1H': 4.0,
    '15m': 2.5,
  };

  const multiTf = analyzeMultiTimeframeAlignment(candlesRecord, atrRecord);
  const asianRange = detectAsianRange(h1 && h1.length > 0 ? h1 : daily);
  const latestCandle = m15.length > 0 ? m15[m15.length - 1] : (daily.length > 0 ? daily[daily.length - 1] : { time: Date.now() / 1000, open: latestPrice, high: latestPrice + 2, low: latestPrice - 2, close: latestPrice });
  const amd = detectJudasSwingAMD(latestCandle, asianRange);
  const wickValidation = purifyCandleWick(latestCandle.open, latestCandle.high, latestCandle.low, latestCandle.close, atr);

  return generateSpotRecommendationInternal(latestPrice, atr, multiTf, amd, wickValidation);
}

function generateSpotRecommendationInternal(
  currentPrice: number,
  atr: number,
  multiTf: MultiTimeframeAlignmentResult,
  amd: AmdResult,
  wickValidation: WickValidationResult
): SpotRecommendation {
  let action: RecommendationAction = 'WAIT';
  let confidenceScore = multiTf.confluenceScore;

  const isWickHealthy = wickValidation.isUpperWickValid && wickValidation.isLowerWickValid;
  if (!isWickHealthy) {
    confidenceScore = Math.max(0, confidenceScore - 20);
  }

  if (multiTf.overallBias === 'LONG' && amd.isSweep && amd.sweepDirection === 'LOW' && isWickHealthy) {
    action = 'BUY';
    confidenceScore = Math.min(95, confidenceScore + 15);
  } else if (multiTf.overallBias === 'SHORT' && amd.isSweep && amd.sweepDirection === 'HIGH' && isWickHealthy) {
    action = 'SELL';
    confidenceScore = Math.min(95, confidenceScore + 15);
  } else if (multiTf.confluenceScore >= 75 && isWickHealthy) {
    action = multiTf.overallBias === 'LONG' ? 'BUY' : multiTf.overallBias === 'SHORT' ? 'SELL' : 'WAIT';
  } else {
    action = 'WAIT';
    confidenceScore = Math.min(50, confidenceScore);
  }

  const safeAtr = atr > 0 ? atr : 5.0;
  let stopLoss = currentPrice;
  let takeProfit1 = currentPrice;
  let takeProfit2 = currentPrice;

  if (action === 'BUY') {
    stopLoss = Number((currentPrice - 1.5 * safeAtr).toFixed(2));
    const risk = currentPrice - stopLoss;
    takeProfit1 = Number((currentPrice + risk * 1.5).toFixed(2));
    takeProfit2 = Number((currentPrice + risk * 2.5).toFixed(2));
  } else if (action === 'SELL') {
    stopLoss = Number((currentPrice + 1.5 * safeAtr).toFixed(2));
    const risk = stopLoss - currentPrice;
    takeProfit1 = Number((currentPrice - risk * 1.5).toFixed(2));
    takeProfit2 = Number((currentPrice - risk * 2.5).toFixed(2));
  }

  const rationaleAr = `توصية سبوت الذهب (${action}): ${multiTf.rationaleAr} | ${amd.rationaleAr} | درجة الثقة المدمجة: ${confidenceScore}% (مع اعتماد الإطار الأسبوعي مرجحاً للاتجاه دون تعليق قسري).`;

  return {
    action,
    entryPrice: currentPrice,
    stopLoss,
    takeProfit1,
    takeProfit2,
    riskReward1: '1:1.5',
    riskReward2: '1:2.5',
    confidenceScore,
    rationaleAr,
  };
}
