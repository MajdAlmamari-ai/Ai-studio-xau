/**
 * Unit Tests for SessionManager (Advisory Mode)
 * -----------------------------------------------------------------------------
 * Tests:
 * - getContext() returns valid SessionContext
 * - London Kill Zone detected at 08:00 UTC
 * - NY Kill Zone detected at 13:00 UTC
 * - COMEX Halt detected at 22:00 UTC
 * - Asian Session detected at 03:00 UTC
 * - Rollover warning on day 26-28
 * - Saudi time conversion correct (UTC+3)
 * 
 * Deterministic. NO Math.random.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { SessionManager } from '../SessionManager';

test('SessionManager — Advisory Mode Unit Tests', async (t) => {
  await t.test('getContext() returns valid SessionContext schema', () => {
    const context = SessionManager.getContext();

    assert.ok(context.currentSession, 'currentSession must be defined');
    assert.ok(context.sessionLabel, 'sessionLabel must be defined');
    assert.ok(
      ['LOW', 'MEDIUM', 'HIGH', 'OPTIMAL'].includes(context.liquidityLevel),
      'liquidityLevel must be valid'
    );
    assert.strictEqual(typeof context.utcHour, 'number');
    assert.strictEqual(typeof context.saudiHour, 'number');
    assert.strictEqual((context.utcHour + 3) % 24, context.saudiHour);
    assert.ok(context.saudiTime.includes('AST'), 'saudiTime must contain AST');
    assert.ok(Array.isArray(context.alerts), 'alerts must be an array');
    assert.ok(context.nextSession, 'nextSession must be defined');
    assert.ok(context.nextSession.startsInMinutes >= 0, 'startsInMinutes must be >= 0');
  });

  await t.test('London Kill Zone detected at 08:00 UTC on a weekday', () => {
    // 2026-06-10 (Wednesday) 08:00 UTC
    const date = new Date(Date.UTC(2026, 5, 10, 8, 0, 0));
    const context = SessionManager.getContext(date);

    assert.strictEqual(context.currentSession, 'LONDON_KILL');
    assert.strictEqual(context.sessionLabel, 'London Kill Zone');
    assert.strictEqual(context.liquidityLevel, 'OPTIMAL');
    assert.strictEqual(context.utcHour, 8);
    assert.strictEqual(context.saudiHour, 11);
    assert.strictEqual(context.saudiTime, '11:00 AST');

    const killZoneAlert = context.alerts.find((a) => a.code === 'KILL_ZONE_ACTIVE');
    assert.ok(killZoneAlert, 'Should contain KILL_ZONE_ACTIVE alert');
    assert.strictEqual(killZoneAlert.severity, 'INFO');
  });

  await t.test('NY Kill Zone detected at 13:00 UTC on a weekday', () => {
    // 2026-06-10 (Wednesday) 13:00 UTC
    const date = new Date(Date.UTC(2026, 5, 10, 13, 0, 0));
    const context = SessionManager.getContext(date);

    assert.strictEqual(context.currentSession, 'NY_KILL');
    assert.strictEqual(context.sessionLabel, 'NY Kill Zone');
    assert.strictEqual(context.liquidityLevel, 'OPTIMAL');
    assert.strictEqual(context.utcHour, 13);
    assert.strictEqual(context.saudiHour, 16);
    assert.strictEqual(context.saudiTime, '16:00 AST');

    const killZoneAlert = context.alerts.find((a) => a.code === 'KILL_ZONE_ACTIVE');
    assert.ok(killZoneAlert, 'Should contain KILL_ZONE_ACTIVE alert');
  });

  await t.test('COMEX Halt detected at 22:00 UTC on a weekday', () => {
    // 2026-06-10 (Wednesday) 22:00 UTC
    const date = new Date(Date.UTC(2026, 5, 10, 22, 0, 0));
    const context = SessionManager.getContext(date);

    assert.strictEqual(context.currentSession, 'COMEX_HALT');
    assert.strictEqual(context.sessionLabel, 'COMEX Halt');
    assert.strictEqual(context.liquidityLevel, 'LOW');
    assert.strictEqual(context.utcHour, 22);
    assert.strictEqual(context.saudiHour, 1);
    assert.strictEqual(context.saudiTime, '01:00 AST');

    const haltAlert = context.alerts.find((a) => a.code === 'COMEX_HALT');
    assert.ok(haltAlert, 'Should contain COMEX_HALT alert');
    assert.strictEqual(haltAlert.severity, 'CRITICAL');
  });

  await t.test('Asian Session detected at 03:00 UTC on a weekday', () => {
    // 2026-06-10 (Wednesday) 03:00 UTC
    const date = new Date(Date.UTC(2026, 5, 10, 3, 0, 0));
    const context = SessionManager.getContext(date);

    assert.strictEqual(context.currentSession, 'ASIAN');
    assert.strictEqual(context.sessionLabel, 'Asian Session');
    assert.strictEqual(context.liquidityLevel, 'LOW');
    assert.strictEqual(context.utcHour, 3);
    assert.strictEqual(context.saudiHour, 6);
    assert.strictEqual(context.saudiTime, '06:00 AST');

    const asianAlert = context.alerts.find((a) => a.code === 'ASIAN_SESSION');
    assert.ok(asianAlert, 'Should contain ASIAN_SESSION alert');
    assert.strictEqual(asianAlert.severity, 'INFO');
  });

  await t.test('Rollover alerts emitted on days 26, 27, and 28', () => {
    // Day 26: WARN
    const date26 = new Date(Date.UTC(2026, 5, 26, 8, 0, 0));
    const ctx26 = SessionManager.getContext(date26);
    const alert26 = ctx26.alerts.find((a) => a.code === 'ROLLOVER_26');
    assert.ok(alert26, 'Should have ROLLOVER_26 alert');
    assert.strictEqual(alert26.severity, 'WARN');

    // Day 27: CRITICAL
    const date27 = new Date(Date.UTC(2026, 5, 27, 8, 0, 0));
    const ctx27 = SessionManager.getContext(date27);
    const alert27 = ctx27.alerts.find((a) => a.code === 'ROLLOVER_27');
    assert.ok(alert27, 'Should have ROLLOVER_27 alert');
    assert.strictEqual(alert27.severity, 'CRITICAL');

    // Day 28: WARN
    const date28 = new Date(Date.UTC(2026, 5, 28, 8, 0, 0));
    const ctx28 = SessionManager.getContext(date28);
    const alert28 = ctx28.alerts.find((a) => a.code === 'ROLLOVER_28');
    assert.ok(alert28, 'Should have ROLLOVER_28 alert');
    assert.strictEqual(alert28.severity, 'WARN');
  });

  await t.test('Saudi time conversion correct (UTC+3, AST, 24h wrap)', () => {
    // 23:45 UTC -> 02:45 AST next day
    const date = new Date(Date.UTC(2026, 5, 10, 23, 45, 0));
    const context = SessionManager.getContext(date);

    assert.strictEqual(context.utcHour, 23);
    assert.strictEqual(context.saudiHour, 2);
    assert.strictEqual(context.saudiTime, '02:45 AST');
  });
});
