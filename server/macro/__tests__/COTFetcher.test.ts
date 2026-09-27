/**
 * Unit Tests for COTFetcher (Batch 14)
 * -----------------------------------------------------------------------------
 * Tests:
 * - parseCFTCText parses Gold section accurately
 * - parseCSV parses CSV records accurately
 * - Throws DataUnavailableError on empty/invalid inputs
 * - NO Math.random
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { COTFetcher } from '../COTFetcher';
import { DataUnavailableError } from '../../../src/errors/DataUnavailableError';

test('CFTC COT Fetcher — Batch 14 Unit Tests', async (t) => {
  const fetcher = new COTFetcher();

  await t.test('parseCFTCText parses Gold section accurately', () => {
    const sampleText = `
CHICAGO MERCANTILE EXCHANGE
GOLD - COMMODITY EXCHANGE INC.   AS OF 09/22/26
------------------------------------------------------------------------------------------------------------------------------------
Positions
          Non-Commercial                          Commercial               Total
   Long     Short    Spreading            Long     Short           Open Interest
  280,000   45,000      20,000          110,000  390,000               500,000
------------------------------------------------------------------------------------------------------------------------------------
    `;

    const report = fetcher.parseCFTCText(sampleText);
    assert.ok(report, 'Report should be parsed');
    assert.strictEqual(report.openInterest, 500000);
    assert.strictEqual(report.commercialLong, 110000);
    assert.strictEqual(report.commercialShort, 390000);
    assert.strictEqual(report.commercialNet, -280000);
  });

  await t.test('parseCSV parses formatted CFTC CSV records accurately', () => {
    const sampleCsv = `
"Market_and_Exchange_Names","As_of_Date_In_Form_YYMMDD","Open_Interest_All","NonComm_Positions_Long_All","NonComm_Positions_Short_All","Comm_Positions_Long_All","Comm_Positions_Short_All"
"GOLD - COMMODITY EXCHANGE INC.","260922",520000,290000,40000,105000,410000
    `;

    const report = fetcher.parseCSV(sampleCsv);
    assert.ok(report, 'CSV report should be parsed');
    assert.strictEqual(report.openInterest, 520000);
    assert.strictEqual(report.nonCommercialLong, 290000);
    assert.strictEqual(report.nonCommercialShort, 40000);
    assert.strictEqual(report.nonCommercialNet, 250000);
  });

  await t.test('Throws DataUnavailableError on empty inputs', () => {
    assert.throws(
      () => fetcher.parseCFTCText(''),
      (err: any) => err instanceof DataUnavailableError && err.code === 'COT_EMPTY_RESPONSE'
    );
  });
});
