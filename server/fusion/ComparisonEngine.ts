/**
 * Comparison Engine — Fusion Layer
 * -----------------------------------------------------------------------------
 * Compares Spot Gold (OANDA:XAUUSD) vs Futures Gold (COMEX:GC1!).
 * 
 * Computes:
 * 1. Structural and directional alignment (FULL / PARTIAL / DIVERGENT)
 * 2. Basis and Basis Z-Score analysis (Futures Price - Spot Price)
 * 3. Unified Confluence Score (0 - 100)
 * 4. Institutional Verdict and Arabic Reasoning
 * 
 * STRICT RULES:
 * - NO Math.random
 * - NO Math.sin / Math.cos
 * - NO fake / synthetic data
 * - DataUnavailableError if inputs are invalid or missing
 */

import { SpotAnalysis } from '../engines/SpotEngine';
import { FuturesAnalysis } from '../engines/FuturesEngine';
import { DataUnavailableError } from '../../src/errors/DataUnavailableError';

export type Alignment = 'FULL' | 'PARTIAL' | 'DIVERGENT';
export type Verdict =
  | 'STRONG_BUY'
  | 'BUY'
  | 'WEAK_BUY'
  | 'NEUTRAL'
  | 'WEAK_SELL'
  | 'SELL'
  | 'STRONG_SELL'
  | 'WAIT';

export interface FusionResult {
  alignment: Alignment;
  confluenceScore: number; // 0-100
  verdict: Verdict;
  verdictAr: string;
  spotAnalysis: SpotAnalysis;
  futuresAnalysis: FuturesAnalysis;
  basisAnalysis: {
    current: number; // Futures - Spot
    zScore: number;
    status: 'NORMAL' | 'ELEVATED' | 'EXTREME';
    statusAr: string;
  };
  unifiedRecommendation: {
    direction: 'LONG' | 'SHORT' | 'WAIT';
    confidence: number; // 0-100
    reasoningAr: string[];
  };
  warnings: string[];
  timestamp: number;
}

export class ComparisonEngine {
  /**
   * Analyze and correlate Spot and Futures market analyses.
   */
  public analyze(
    spotAnalysis: SpotAnalysis,
    futuresAnalysis: FuturesAnalysis,
    spotPrice: number,
    futuresPrice: number,
    basisHistory: number[] = []
  ): FusionResult {
    // 0. Validation
    if (!spotAnalysis || typeof spotAnalysis.score !== 'number' || !spotAnalysis.direction) {
      throw new DataUnavailableError('INVALID_SPOT_ANALYSIS', 'Invalid or missing spotAnalysis provided');
    }
    if (!futuresAnalysis || typeof futuresAnalysis.score !== 'number' || !futuresAnalysis.direction) {
      throw new DataUnavailableError('INVALID_FUTURES_ANALYSIS', 'Invalid or missing futuresAnalysis provided');
    }
    if (typeof spotPrice !== 'number' || spotPrice <= 0 || !isFinite(spotPrice)) {
      throw new DataUnavailableError('INVALID_SPOT_PRICE', `Invalid spot price: ${spotPrice}`);
    }
    if (typeof futuresPrice !== 'number' || futuresPrice <= 0 || !isFinite(futuresPrice)) {
      throw new DataUnavailableError('INVALID_FUTURES_PRICE', `Invalid futures price: ${futuresPrice}`);
    }

    const warnings: string[] = [];
    const reasoningAr: string[] = [];

    // 1. Determine alignment
    // FULL: both agree on direction + score diff <= 15
    // PARTIAL: both agree on direction + score diff > 15
    // DIVERGENT: disagree on direction (e.g. LONG vs SHORT, or one NEUTRAL while other is directional)
    let alignment: Alignment;
    const scoreDiff = Math.abs(spotAnalysis.score - futuresAnalysis.score);

    if (spotAnalysis.direction === futuresAnalysis.direction && spotAnalysis.direction !== 'NEUTRAL') {
      if (scoreDiff <= 15) {
        alignment = 'FULL';
      } else {
        alignment = 'PARTIAL';
      }
    } else if (spotAnalysis.direction === 'NEUTRAL' && futuresAnalysis.direction === 'NEUTRAL') {
      alignment = scoreDiff <= 15 ? 'FULL' : 'PARTIAL';
    } else {
      alignment = 'DIVERGENT';
      warnings.push('تباين هيكلي بين حركة السعر الفوري والعقود الآجلة (DIVERGENT). يرجى الحذر.');
    }

    // 2. Compute Basis (Futures - Spot) and Z-Score
    // zScore = (basis - mean(basisHistory)) / std(basisHistory)
    const currentBasis = Number((futuresPrice - spotPrice).toFixed(2));

    let zScore = 0;
    if (basisHistory.length >= 2) {
      const histMean = basisHistory.reduce((sum, b) => sum + b, 0) / basisHistory.length;
      let histVar = 0;
      for (const b of basisHistory) {
        histVar += Math.pow(b - histMean, 2);
      }
      const histStd = Math.sqrt(histVar / basisHistory.length);
      if (histStd > 0.0001) {
        zScore = Number(((currentBasis - histMean) / histStd).toFixed(2));
      }
    }

    let basisStatus: 'NORMAL' | 'ELEVATED' | 'EXTREME' = 'NORMAL';
    let basisStatusAr = 'طبيعي ومستقر (Normal Basis)';

    const absZ = Math.abs(zScore);
    if (absZ >= 2.5) {
      basisStatus = 'EXTREME';
      basisStatusAr = 'انحراف حاد غير اعتيادي (Extreme Basis)';
      warnings.push(`فارق السعر بين الآجل والفوري في مرحلة انحراف قصوى (Z-Score: ${zScore}).`);
    } else if (absZ >= 1.5) {
      basisStatus = 'ELEVATED';
      basisStatusAr = 'فارق مرتفع (Elevated Basis)';
      warnings.push(`فارق السعر بين الآجل والفوري مرتفع نسبياً (Z-Score: ${zScore}).`);
    }

    // 3. Compute Confluence Score (0 - 100):
    // - Alignment: 40 points (FULL = 40, PARTIAL = 25, DIVERGENT = 5)
    // - Basis status: 20 points (NORMAL = 20, ELEVATED = 12, EXTREME = 2)
    // - CVD agreement: 20 points
    // - Structure agreement: 20 points
    let confluenceScore = 0;

    if (alignment === 'FULL') confluenceScore += 40;
    else if (alignment === 'PARTIAL') confluenceScore += 25;
    else confluenceScore += 5;

    if (basisStatus === 'NORMAL') confluenceScore += 20;
    else if (basisStatus === 'ELEVATED') confluenceScore += 12;
    else confluenceScore += 2;

    // CVD agreement with spot direction (20 points)
    const cvdDelta = futuresAnalysis.cvd?.cumulativeDelta ?? 0;
    if (spotAnalysis.direction === 'LONG' && cvdDelta > 0) {
      confluenceScore += 20;
    } else if (spotAnalysis.direction === 'SHORT' && cvdDelta < 0) {
      confluenceScore += 20;
    } else if (spotAnalysis.direction === 'NEUTRAL' && Math.abs(cvdDelta) < 300) {
      confluenceScore += 15;
    } else if (cvdDelta === 0) {
      confluenceScore += 10;
    } else {
      confluenceScore += 4;
      warnings.push('عدم تطابق بين اتجاه السعر ودلتا تدفق الأوامر CVD.');
    }

    // Structure agreement (20 points)
    const spotConfluenceCount = spotAnalysis.confluence?.length ?? 0;
    const futuresConfluenceCount = futuresAnalysis.confluence?.length ?? 0;
    if (spotConfluenceCount > 0 && futuresConfluenceCount > 0) {
      confluenceScore += 20;
    } else if (spotConfluenceCount > 0 || futuresConfluenceCount > 0) {
      confluenceScore += 12;
    } else {
      confluenceScore += 5;
    }

    confluenceScore = Math.max(0, Math.min(100, Math.round(confluenceScore)));

    // 4. Determine Verdict & Unified Recommendation
    let verdict: Verdict = 'WAIT';
    let verdictAr = 'انتظار وتريث (WAIT)';
    let unifiedDirection: 'LONG' | 'SHORT' | 'WAIT' = 'WAIT';

    if (alignment === 'DIVERGENT') {
      verdict = 'WAIT';
      verdictAr = 'انتظار وتريث (تضارب الاتجاه)';
      unifiedDirection = 'WAIT';
      reasoningAr.push('تباين الإشارات بين كتل الأوامر الفورية والعقود الآجلة.');
    } else if (confluenceScore >= 80) {
      if (spotAnalysis.direction === 'LONG') {
        verdict = 'STRONG_BUY';
        verdictAr = 'شراء مؤسساتي قوي (STRONG BUY)';
        unifiedDirection = 'LONG';
      } else if (spotAnalysis.direction === 'SHORT') {
        verdict = 'STRONG_SELL';
        verdictAr = 'بيع مؤسساتي قوي (STRONG SELL)';
        unifiedDirection = 'SHORT';
      } else {
        verdict = 'NEUTRAL';
        verdictAr = 'حياد مؤسساتي (NEUTRAL)';
        unifiedDirection = 'WAIT';
      }
    } else if (confluenceScore >= 65) {
      if (spotAnalysis.direction === 'LONG') {
        verdict = 'BUY';
        verdictAr = 'شراء متوافق (BUY)';
        unifiedDirection = 'LONG';
      } else if (spotAnalysis.direction === 'SHORT') {
        verdict = 'SELL';
        verdictAr = 'بيع متوافق (SELL)';
        unifiedDirection = 'SHORT';
      } else {
        verdict = 'NEUTRAL';
        verdictAr = 'حياد مؤسساتي (NEUTRAL)';
        unifiedDirection = 'WAIT';
      }
    } else if (confluenceScore >= 50) {
      if (spotAnalysis.direction === 'LONG') {
        verdict = 'WEAK_BUY';
        verdictAr = 'شراء ضعيف / حذر (WEAK BUY)';
        unifiedDirection = 'LONG';
      } else if (spotAnalysis.direction === 'SHORT') {
        verdict = 'WEAK_SELL';
        verdictAr = 'بيع ضعيف / حذر (WEAK SELL)';
        unifiedDirection = 'SHORT';
      } else {
        verdict = 'NEUTRAL';
        verdictAr = 'حياد مؤسساتي (NEUTRAL)';
        unifiedDirection = 'WAIT';
      }
    } else {
      verdict = 'WAIT';
      verdictAr = 'انتظار اكتمال التوافق (WAIT)';
      unifiedDirection = 'WAIT';
    }

    // 5. Build Arabic Reasoning
    reasoningAr.push(`حالة التوافق بين الأسواق: ${alignment === 'FULL' ? 'تطابق كامل (FULL)' : alignment === 'PARTIAL' ? 'تطابق جزئي (PARTIAL)' : 'تباين وتضارب (DIVERGENT)'}.`);
    reasoningAr.push(`نسبة التوافق المؤسساتي الكلية: ${confluenceScore}%.`);
    reasoningAr.push(`فارق السعر Basis الحالي: $${currentBasis.toFixed(2)} (${basisStatusAr}) مع Z-Score: ${zScore}.`);

    if (cvdDelta !== 0) {
      reasoningAr.push(`دلتا تدفق الأوامر التراكمية (CVD): ${cvdDelta > 0 ? '+' : ''}${cvdDelta} عقد.`);
    }

    return {
      alignment,
      confluenceScore,
      verdict,
      verdictAr,
      spotAnalysis,
      futuresAnalysis,
      basisAnalysis: {
        current: currentBasis,
        zScore,
        status: basisStatus,
        statusAr: basisStatusAr,
      },
      unifiedRecommendation: {
        direction: unifiedDirection,
        confidence: confluenceScore,
        reasoningAr,
      },
      warnings,
      timestamp: Date.now(),
    };
  }
}

export const comparisonEngine = new ComparisonEngine();
