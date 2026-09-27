/**
 * FRED Client — Federal Reserve Economic Data
 * -----------------------------------------------------------------------------
 * Series:
 * - DFII10: Real Yields (10Y TIPS)
 * - DTWEXBGS: DXY proxy (Trade Weighted U.S. Dollar Index: Broad, Goods and Services)
 * - FEDFUNDS: Effective Federal Funds Rate
 * 
 * STRICT RULES:
 * - NO fake data
 * - If API key missing → throw DataUnavailableError('FRED_API_KEY_MISSING')
 * - If fetch fails → return null for that series (NOT 0, NOT placeholder)
 */

import { DataUnavailableError } from '../../src/errors/DataUnavailableError';

export interface FredObservation {
  date: string;
  value: number;
}

export interface MacroSnapshot {
  realYields: FredObservation | null;
  dxy: FredObservation | null;
  fedFunds: FredObservation | null;
  fetchedAt: string;
}

export class FredClient {
  private readonly baseUrl = 'https://api.stlouisfed.org/fred/series/observations';
  private readonly apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.FRED_API_KEY;
  }

  public async fetchSeries(seriesId: string): Promise<FredObservation | null> {
    if (!this.apiKey) {
      throw new DataUnavailableError(
        'FRED_API_KEY_MISSING',
        'FRED_API_KEY environment variable is missing. Cross-asset macro data unavailable.'
      );
    }

    try {
      const url = `${this.baseUrl}?series_id=${encodeURIComponent(
        seriesId
      )}&api_key=${encodeURIComponent(
        this.apiKey
      )}&file_type=json&sort_order=desc&limit=5`;

      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        return null;
      }

      const json = await response.json();
      const observations: any[] = json?.observations;

      if (!Array.isArray(observations) || observations.length === 0) {
        return null;
      }

      // Find first observation with valid numerical value (FRED uses '.' for missing values)
      for (const obs of observations) {
        const val = parseFloat(obs.value);
        if (obs.value !== '.' && !isNaN(val) && isFinite(val)) {
          return {
            date: obs.date,
            value: Number(val.toFixed(4)),
          };
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  public async fetchSnapshot(): Promise<MacroSnapshot> {
    if (!this.apiKey) {
      throw new DataUnavailableError(
        'FRED_API_KEY_MISSING',
        'FRED_API_KEY environment variable is missing'
      );
    }

    const [realYields, dxy, fedFunds] = await Promise.all([
      this.fetchSeries('DFII10'),
      this.fetchSeries('DTWEXBGS'),
      this.fetchSeries('FEDFUNDS'),
    ]);

    return {
      realYields,
      dxy,
      fedFunds,
      fetchedAt: new Date().toISOString(),
    };
  }
}

export const fredClient = new FredClient();
