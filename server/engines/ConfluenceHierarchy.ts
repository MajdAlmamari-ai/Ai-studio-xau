/**
 * Multi-Timeframe Confluence Hierarchy Engine
 * -----------------------------------------------------------------------------
 * Combines up to 8 timeframes (1m, 5m, 15m, 30m, 1h, 4h, 1d, 1w) into a
 * strictly structured institutional hierarchical decision:
 * - HTF (Higher Timeframe): 1d + 1w (Weight: 50%)
 * - ITF (Intermediate Timeframe): 4h + 1h (Weight: 30%)
 * - LTF (Lower Timeframe): 15m + 5m + 1m (Weight: 20%)
 * 
 * Deterministic. Real calculations only.
 */

import { SpotAnalysis } from './SpotEngine';
import { FuturesAnalysis } from './FuturesEngine';

export type TFBias = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

export interface HierarchicalAnalysis {
  htfBias: TFBias;       // from 1d + 1w
  itfBias: TFBias;       // from 4h + 1h
  ltfBias: TFBias;       // from 15m + 5m + 1m
  alignment: 'FULL' | 'PARTIAL' | 'CONFLICT';
  alignmentAr: string;
  score: number;         // 0-100
  reasoningAr: string[];
}

export class ConfluenceHierarchy {
  /**
   * Determine single timeframe bias from combined Spot or Futures analysis
   */
  private static extractBias(analysis?: SpotAnalysis | FuturesAnalysis): TFBias {
    if (!analysis) return 'NEUTRAL';
    if (analysis.direction === 'LONG') return 'BULLISH';
    if (analysis.direction === 'SHORT') return 'BEARISH';
    return 'NEUTRAL';
  }

  /**
   * Average direction score from a list of analyses:
   * Returns BULLISH, BEARISH, or NEUTRAL
   */
  private static aggregateTierBias(analyses: (SpotAnalysis | FuturesAnalysis | undefined)[]): TFBias {
    const valid = analyses.filter((a): a is SpotAnalysis | FuturesAnalysis => Boolean(a));
    if (valid.length === 0) return 'NEUTRAL';

    let bullCount = 0;
    let bearCount = 0;

    for (const a of valid) {
      if (a.direction === 'LONG') bullCount++;
      else if (a.direction === 'SHORT') bearCount++;
    }

    if (bullCount > bearCount) return 'BULLISH';
    if (bearCount > bullCount) return 'BEARISH';
    return 'NEUTRAL';
  }

  /**
   * Calculate average confidence score of a tier
   */
  private static calculateTierScore(analyses: (SpotAnalysis | FuturesAnalysis | undefined)[]): number {
    const valid = analyses.filter((a): a is SpotAnalysis | FuturesAnalysis => Boolean(a));
    if (valid.length === 0) return 50;
    const total = valid.reduce((acc, curr) => acc + (curr.score || 50), 0);
    return Math.round(total / valid.length);
  }

  /**
   * Build hierarchical analysis across 8 timeframes
   */
  public buildAnalysis(
    spotAnalyses: { [tf: string]: SpotAnalysis } = {},
    futuresAnalyses: { [tf: string]: FuturesAnalysis } = {}
  ): HierarchicalAnalysis {
    // 1. HTF: 1d + 1w
    const htfItems = [
      spotAnalyses['1d'],
      futuresAnalyses['1d'],
      spotAnalyses['1w'],
      futuresAnalyses['1w'],
    ];
    const htfBias = ConfluenceHierarchy.aggregateTierBias(htfItems);
    const htfScore = ConfluenceHierarchy.calculateTierScore(htfItems);

    // 2. ITF: 4h + 1h
    const itfItems = [
      spotAnalyses['4h'],
      futuresAnalyses['4h'],
      spotAnalyses['1h'],
      futuresAnalyses['1h'],
    ];
    const itfBias = ConfluenceHierarchy.aggregateTierBias(itfItems);
    const itfScore = ConfluenceHierarchy.calculateTierScore(itfItems);

    // 3. LTF: 15m + 5m + 1m (+ optional 30m)
    const ltfItems = [
      spotAnalyses['15m'],
      futuresAnalyses['15m'],
      spotAnalyses['5m'],
      futuresAnalyses['5m'],
      spotAnalyses['1m'],
      futuresAnalyses['1m'],
      spotAnalyses['30m'],
      futuresAnalyses['30m'],
    ];
    const ltfBias = ConfluenceHierarchy.aggregateTierBias(ltfItems);
    const ltfScore = ConfluenceHierarchy.calculateTierScore(ltfItems);

    // 4. Determine Alignment
    let alignment: 'FULL' | 'PARTIAL' | 'CONFLICT';
    let alignmentAr: string;

    const biases = [htfBias, itfBias, ltfBias];
    const isAllSame = (htfBias === itfBias && itfBias === ltfBias && htfBias !== 'NEUTRAL');
    const isPartial = (
      (htfBias === itfBias && htfBias !== 'NEUTRAL') ||
      (htfBias === ltfBias && htfBias !== 'NEUTRAL') ||
      (itfBias === ltfBias && itfBias !== 'NEUTRAL')
    );

    if (isAllSame) {
      alignment = 'FULL';
      alignmentAr = 'توافق مؤسساتي كامل عبر كافة الفريمات (FULL CONFLUENCE)';
    } else if (isPartial) {
      alignment = 'PARTIAL';
      alignmentAr = 'توافق جزئي بين مستويين من الفريمات (PARTIAL ALIGNMENT)';
    } else {
      alignment = 'CONFLICT';
      alignmentAr = 'تعارض أو تباين في الاتجاه الهيكلي (CONFLICT / NEUTRAL)';
    }

    // 5. Hierarchical Score Calculation:
    // HTF weight: 50%
    // ITF weight: 30%
    // LTF weight: 20%
    let totalScore = (htfScore * 0.50) + (itfScore * 0.30) + (ltfScore * 0.20);

    // Alignment multiplier penalty / bonus
    if (alignment === 'FULL') {
      totalScore = Math.min(100, totalScore * 1.1);
    } else if (alignment === 'CONFLICT') {
      totalScore = Math.max(20, totalScore * 0.7);
    }

    const finalScore = Math.round(Math.max(0, Math.min(100, totalScore)));

    // 6. Build Reasoning Strings
    const reasoningAr: string[] = [
      `الإطار الأكبر (HTF - 1D/1W): اتجاه [${htfBias}] بقوة ${htfScore}% (وزن 50%).`,
      `الإطار الوسيط (ITF - 4H/1H): اتجاه [${itfBias}] بقوة ${itfScore}% (وزن 30%).`,
      `إطار التنفيذ (LTF - 15M/5M/1M): اتجاه [${ltfBias}] بقوة ${ltfScore}% (وزن 20%).`,
      `حالة التوافق الهرمي: ${alignmentAr}، المحصلة التوافقية الإجمالية: ${finalScore}/100.`,
    ];

    return {
      htfBias,
      itfBias,
      ltfBias,
      alignment,
      alignmentAr,
      score: finalScore,
      reasoningAr,
    };
  }
}

export const confluenceHierarchy = new ConfluenceHierarchy();
