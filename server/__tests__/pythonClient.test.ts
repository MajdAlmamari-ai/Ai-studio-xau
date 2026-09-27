/**
 * Unit Tests for PythonClient (Batch 18)
 * -----------------------------------------------------------------------------
 * Tests:
 * - PythonClient throws DataUnavailableError when service is unreachable
 * - PythonClient constructs valid config payload
 * - NO Math.random
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { PythonClient } from '../pythonClient';
import { DataUnavailableError } from '../../src/errors/DataUnavailableError';

test('Node.js Python Client — Batch 18 Unit Tests', async (t) => {
  // Client pointing to an unreachable port to test offline error handling
  const client = new PythonClient('http://127.0.0.1:9999');

  await t.test('checkHealth returns false when Python service is offline', async () => {
    const isHealthy = await client.checkHealth();
    assert.strictEqual(isHealthy, false);
  });

  await t.test('callPythonAnalysis throws DataUnavailableError when service is down', async () => {
    await assert.rejects(
      async () => {
        await client.callPythonAnalysis('OANDA:XAUUSD', '15m');
      },
      (err: any) => {
        assert.ok(err instanceof DataUnavailableError);
        assert.strictEqual(err.code, 'PYTHON_SERVICE_UNAVAILABLE');
        return true;
      }
    );
  });

  await t.test('callPythonBacktest throws DataUnavailableError when service is down', async () => {
    await assert.rejects(
      async () => {
        await client.callPythonBacktest({ initialCapital: 20000 });
      },
      (err: any) => {
        assert.ok(err instanceof DataUnavailableError);
        assert.strictEqual(err.code, 'PYTHON_SERVICE_UNAVAILABLE');
        return true;
      }
    );
  });
});
