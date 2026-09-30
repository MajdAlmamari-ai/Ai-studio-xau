/**
 * Unit Tests for Colab Exporter & Mock Helpers
 * =============================================================================
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { MockColabApiHelper } from '../tools/mockColabApi';
import { colabExporter } from '../tools/colabExporter';

test('Colab Exporter & Mock API Unit Tests', async (t) => {
  await t.test('MockColabApiHelper creates valid export structure', () => {
    const payload = MockColabApiHelper.createMockExportPayload('15m');

    assert.ok(payload.exported_at);
    assert.strictEqual(payload.source_symbols.spot, 'OANDA:XAUUSD');
    assert.strictEqual(payload.source_symbols.futures, 'COMEX:GC1!');
    assert.strictEqual(payload.timeframe, '15m');
    assert.ok(payload.ohlc_data.spot.length > 0);
    assert.ok(payload.ohlc_data.futures.length > 0);
    assert.strictEqual(payload.analysis.fusion?.alignment, 'FULL');
    assert.strictEqual(payload.config.pip_value, 100);
  });

  await t.test('MockColabApiHelper handles mock HTTP request', () => {
    let statusCode = 0;
    let headers: Record<string, string> = {};
    let responseData: any = null;

    const mockRes = {
      setHeader(k: string, v: string) {
        headers[k] = v;
      },
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(data: any) {
        responseData = data;
        return this;
      },
    };

    MockColabApiHelper.handleMockApiRequest({}, mockRes);
    assert.strictEqual(statusCode, 200);
    assert.strictEqual(headers['Content-Type'], 'application/json');
    assert.strictEqual(headers['X-Mock-Source'], 'ColabTestHelper');
    assert.ok(responseData?.ohlc_data?.spot);
  });

  await t.test('ColabExporter generates python ingestion code snippet', () => {
    const py = colabExporter.generatePythonIngestionCode('http://test-server/api/colab/export');
    assert.ok(py.includes('import requests'));
    assert.ok(py.includes('import pandas as pd'));
    assert.ok(py.includes('http://test-server/api/colab/export'));
  });
});
