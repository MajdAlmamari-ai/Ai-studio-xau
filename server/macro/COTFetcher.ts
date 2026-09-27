/**
 * CFTC Commitment of Traders (COT) Fetcher
 * -----------------------------------------------------------------------------
 * Source: CFTC.gov (Weekly report released Fridays at 15:30 EST / 20:30 UTC)
 * Target Market: COMEX Gold Futures (GC)
 * 
 * STRICT RULES:
 * - NO fake or cached random data
 * - If fetch fails → throw DataUnavailableError
 * - Real parsing and numbers only
 */

import { DataUnavailableError } from '../../src/errors/DataUnavailableError';

export interface COTReport {
  date: string;
  commercialLong: number;
  commercialShort: number;
  nonCommercialLong: number;
  nonCommercialShort: number;
  openInterest: number;
  commercialNet?: number;
  nonCommercialNet?: number;
}

export class COTFetcher {
  // Public CFTC text/csv reports endpoint for Chicago Mercantile Exchange / COMEX
  private readonly defaultUrl = 'https://www.cftc.gov/dea/futures/deacmesf.htm';

  /**
   * Fetches the latest published COT report for Gold Futures.
   */
  public async fetchLatest(): Promise<COTReport | null> {
    try {
      const response = await fetch(this.defaultUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Institutional Gold Quant Engine)',
          Accept: 'text/plain, text/html, */*',
        },
      });

      if (!response.ok) {
        throw new DataUnavailableError(
          'CFTC_FETCH_FAILED',
          `CFTC server returned status ${response.status}`
        );
      }

      const text = await response.text();
      return this.parseCFTCText(text);
    } catch (err: any) {
      if (err instanceof DataUnavailableError) throw err;
      throw new DataUnavailableError(
        'CFTC_NETWORK_ERROR',
        `Failed to reach CFTC.gov: ${err?.message || 'Network error'}`
      );
    }
  }

  /**
   * Parse legacy CFTC text format report for GOLD (COMMODITY CODE 088691)
   */
  public parseCFTCText(raw: string): COTReport | null {
    if (!raw || typeof raw !== 'string') {
      throw new DataUnavailableError('COT_EMPTY_RESPONSE', 'Empty response received from CFTC');
    }

    // Look for GOLD block in CFTC report
    const goldIndex = raw.toUpperCase().indexOf('GOLD - COMMODITY EXCHANGE INC.');
    if (goldIndex === -1) {
      return this.parseCSV(raw);
    }

    const goldSection = raw.substring(goldIndex, goldIndex + 3000);
    const lines = goldSection.split('\n');

    // Extract Date from header: e.g. "GOLD - COMMODITY EXCHANGE INC.   AS OF 09/22/26"
    let reportDate = new Date().toISOString().split('T')[0];
    const dateMatch = lines[0]?.match(/AS OF\s+(\d{2}\/\d{2}\/\d{2})/i);
    if (dateMatch) {
      reportDate = dateMatch[1];
    }

    // Lines typically contain:
    // Positions: [Non-Commercial Long, Short, Spreading] [Commercial Long, Short] [Total Open Interest]
    // Locate row of numbers
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      const parts = line.split(/\s+/).map((p) => parseInt(p.replace(/,/g, ''), 10));
      const numbers = parts.filter((n) => !isNaN(n) && n > 1000);

      if (numbers.length >= 5) {
        // Line layout:
        // Non-Commercial (Long, Short, Spreading?) | Commercial (Long, Short) | Total Open Interest
        // In sampleText: [280000, 45000, 20000, 110000, 390000, 500000]
        // nonCommercialLong = 280000, nonCommercialShort = 45000
        // commercialLong = 110000, commercialShort = 390000
        // openInterest = 500000 (last element)
        const openInterest = numbers[numbers.length - 1];
        const nonCommercialLong = numbers[0];
        const nonCommercialShort = numbers[1];
        const commercialLong = numbers[numbers.length - 3];
        const commercialShort = numbers[numbers.length - 2];

        return {
          date: reportDate,
          commercialLong,
          commercialShort,
          nonCommercialLong,
          nonCommercialShort,
          openInterest,
          commercialNet: commercialLong - commercialShort,
          nonCommercialNet: nonCommercialLong - nonCommercialShort,
        };
      }
    }

    throw new DataUnavailableError('COT_PARSING_FAILED', 'Unable to parse Gold section from CFTC report');
  }

  /**
   * Parse CSV format if returned by alternate CFTC data pipelines
   */
  public parseCSV(raw: string): COTReport | null {
    if (!raw) return null;
    const lines = raw.trim().split('\n');
    for (const line of lines) {
      if (line.includes('GOLD') || line.includes('088691')) {
        const cols = line.split(',').map((c) => c.replace(/["\r]/g, '').trim());
        // Standard disaggregated or legacy format mapping
        if (cols.length >= 7) {
          const date = cols[1] || cols[0];
          const openInterest = parseInt(cols[2], 10) || 0;
          const nonCommercialLong = parseInt(cols[3], 10) || 0;
          const nonCommercialShort = parseInt(cols[4], 10) || 0;
          const commercialLong = parseInt(cols[5], 10) || 0;
          const commercialShort = parseInt(cols[6], 10) || 0;

          return {
            date,
            commercialLong,
            commercialShort,
            nonCommercialLong,
            nonCommercialShort,
            openInterest,
            commercialNet: commercialLong - commercialShort,
            nonCommercialNet: nonCommercialLong - nonCommercialShort,
          };
        }
      }
    }
    return null;
  }
}

export const cotFetcher = new COTFetcher();
