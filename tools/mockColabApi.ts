/**
 * Mock API Endpoint Helpers for Google Colab Ingestion Testing
 * =============================================================================
 * Provides standalone mock API endpoint response helpers to test Colab ingestion
 * offline or in CI/CD environments with strictly verified realistic test fixtures.
 */

import { ColabMarketExportPayload } from './colabExporter';

export class MockColabApiHelper {
  /**
   * Generates a fully compliant mock API response payload for testing Colab notebooks
   * without needing an active live database connection.
   */
  public static createMockExportPayload(timeframe: string = '15m'): ColabMarketExportPayload {
    const baseTime = 1727500000;
    const baseSpotPrice = 2650.0;
    const baseFuturesPrice = 2658.5; // Contango basis $8.50

    const spotCandles = [];
    const futuresCandles = [];

    for (let i = 0; i < 35; i++) {
      const time = baseTime + (i * 900); // 15m intervals
      const spotClose = Number((baseSpotPrice + (i * 0.5)).toFixed(2));
      const futClose = Number((baseFuturesPrice + (i * 0.5)).toFixed(2));

      spotCandles.push({
        timestamp: time,
        datetime_utc: new Date(time * 1000).toISOString(),
        open: Number((spotClose - 0.3).toFixed(2)),
        high: Number((spotClose + 1.2).toFixed(2)),
        low: Number((spotClose - 0.8).toFixed(2)),
        close: spotClose,
        volume: 1200 + (i * 20),
        open_interest: null,
      });

      futuresCandles.push({
        timestamp: time,
        datetime_utc: new Date(time * 1000).toISOString(),
        open: Number((futClose - 0.3).toFixed(2)),
        high: Number((futClose + 1.2).toFixed(2)),
        low: Number((futClose - 0.8).toFixed(2)),
        close: futClose,
        volume: 4500 + (i * 50),
        open_interest: 450000 + (i * 100),
      });
    }

    return {
      exported_at: new Date().toISOString(),
      platform: 'XAUUSD SMC Quant Platform (Mock Colab API Testing)',
      source_symbols: {
        spot: 'OANDA:XAUUSD',
        futures: 'COMEX:GC1!',
      },
      timeframe,
      config: {
        platform_config: {
          enableGeminiAnalysis: true,
          enableTelegramAlerts: true,
          enableAutoTrade: false,
          maxDailyDrawdownPct: 3.0,
          telegramChannelId: '@XAUUSD_SMC_VIP',
          analysisFrequencyMinutes: 15,
        },
        risk_config: {
          accountSize: 50000,
          riskPerTrade: 0.01,
          maxDailyLoss: 0.03,
          maxWeeklyLoss: 0.06,
        },
        pip_value: 100,
      },
      ohlc_data: {
        spot: spotCandles,
        futures: futuresCandles,
      },
      analysis: {
        spot: {
          symbol: 'OANDA:XAUUSD',
          direction: 'LONG',
          score: 80,
          entry: 2667.5,
          stopLoss: 2655.5,
          takeProfit1: 2691.5,
          takeProfit2: 2709.5,
          atr: 8.0,
          vwap: 2662.0,
          sessionAnalysis: {
            activeSessions: ['LONDON', 'NEW_YORK'],
            liquidityLevel: 'OPTIMAL',
          },
          timestamp: Date.now(),
        },
        futures: {
          symbol: 'COMEX:GC1!',
          direction: 'LONG',
          score: 85,
          atr: 8.5,
          vwap: 2670.5,
          confluence: ['CVD Bullish Imbalance'],
          cvd: {
            cumulativeDelta: 14500,
            buyVolume: 85000,
            sellVolume: 70500,
          },
          sessionAnalysis: {
            activeSessions: ['LONDON', 'NEW_YORK'],
            liquidityLevel: 'OPTIMAL',
          },
          timestamp: Date.now(),
        },
        fusion: {
          alignment: 'FULL',
          confluenceScore: 85,
          verdict: 'STRONG_BUY',
          verdictAr: 'شراء قوي مؤسساتي بتوافق تام',
          spotAnalysis: {} as any,
          futuresAnalysis: {} as any,
          basisAnalysis: {
            current: 8.5,
            zScore: 0.6,
            status: 'NORMAL',
            statusAr: 'نطاق طبيعي',
          },
          unifiedRecommendation: {
            direction: 'LONG',
            confidence: 85,
            reasoningAr: [
              'توافق كامل في الاتجاه الشرائي بين الذهب الفوري وعقود كومكس',
              'فارق الأساس في النطاق الطبيعي',
            ],
          },
          warnings: [],
          timestamp: Date.now(),
        },
      },
      colab_python_snippet: '# Run Colab Ingestion snippet',
    };
  }

  /**
   * Express/Connect mock route handler for /api/colab/export.
   */
  public static handleMockApiRequest(_req: any, res: any): void {
    const payload = MockColabApiHelper.createMockExportPayload();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Mock-Source', 'ColabTestHelper');
    res.status(200).json(payload);
  }
}
