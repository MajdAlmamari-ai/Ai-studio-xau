import test from 'node:test';
import assert from 'node:assert/strict';
import { logger } from '../server/loggerService';

test('Structured Logger & Telemetry Metrics Service', async (t) => {
  await t.test('records logs across multiple levels and bounds memory buffer', () => {
    logger.clearLogs();
    
    logger.info('UNIT_TEST', 'Sample informational event');
    logger.warn('UNIT_TEST', 'Sample warning event');
    logger.error('UNIT_TEST', 'Sample error event', { code: 500 });
    logger.metric('UNIT_TEST', 'Latency checkpoint', 45);

    const testLogs = logger.getLogs({ category: 'UNIT_TEST' });
    assert.strictEqual(testLogs.length, 4);

    // Test filter by level
    const errorsOnly = logger.getLogs({ category: 'UNIT_TEST', level: 'ERROR' });
    assert.strictEqual(errorsOnly.length, 1);
    assert.strictEqual(errorsOnly[0].level, 'ERROR');
    assert.strictEqual(errorsOnly[0].message, 'Sample error event');

    // Test filter by category
    const testCatLogs = logger.getLogs({ category: 'UNIT_TEST' });
    assert.strictEqual(testCatLogs.length, 4);
  });

  await t.test('maintains bounded circular buffer (max 500 entries) without memory leak', () => {
    logger.clearLogs();

    // Insert 600 log items
    for (let i = 0; i < 600; i++) {
      logger.debug('BENCHMARK', `Benchmark event #${i}`);
    }

    const currentLogs = logger.getLogs({ limit: 1000 });
    assert.strictEqual(currentLogs.length, 500, 'Logs must be capped at 500 entries');
    // Most recent log should be the first in descending array
    assert.ok(currentLogs[0].message.includes('599'));
  });

  await t.test('computes real-time system performance telemetry metrics', () => {
    logger.recordRequest(12, false);
    logger.recordRequest(18, false);
    logger.recordRequest(15, false);

    const metrics = logger.getMetrics();
    assert.ok(metrics, 'Metrics object must exist');
    assert.ok(metrics.memory.heapUsedMb > 0, 'Heap used must be > 0');
    assert.ok(metrics.memory.heapTotalMb > 0, 'Heap total must be > 0');
    assert.ok(metrics.memory.heapUtilizationPct <= 100, 'Heap utilization must be <= 100%');
    assert.ok(metrics.uptimeSeconds >= 0, 'Uptime must be >= 0');
    assert.strictEqual(typeof metrics.uptimeFormatted, 'string');
    assert.ok(metrics.network.totalRequests >= 3);
  });
});
