/**
 * Unit Tests for SessionManager (Action 9.1 & 9.2)
 * -----------------------------------------------------------------------------
 * Tests:
 * - Monday 02:00 AST → state: LIVE, session: ASIAN
 * - Monday 08:00 AST → state: LIVE, session: LONDON
 * - Monday 13:00 AST → state: LIVE, session: OVERLAP
 * - Monday 18:00 AST → state: LIVE, session: NY
 * - Friday 23:00 AST → state: CLOSED (weekend)
 * - Saturday → state: CLOSED
 * - Sunday before 01:00 AST → state: CLOSED
 * - Monday 01:30 AST → state: CLOSED (halt), reason: DAILY_HALT
 * - Day 27 of month → alert: ROLLOVER_DAY
 * 
 * Deterministic. NO Math.random.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { SessionManager } from '../SessionManager';

test('SessionManager — Action 9.2 Unit Tests', async (t) => {
  // Test Monday 02:00 AST (23:00 UTC previous day)
  // Date: 2026-06-08 is Monday. 02:00 AST = 2026-06-07 23:00 UTC
  await t.test('Monday 02:00 AST → state: LIVE, session: ASIAN', () => {
    const d = new Date(Date.UTC(2026, 5, 7, 23, 0, 0));
    const status = SessionManager.getStatus(d);

    assert.strictEqual(status.state, 'LIVE');
    assert.strictEqual(status.session, 'ASIAN');
    assert.ok(status.sessionLabelAr.includes('الآسيوية'));
  });

  // Test Monday 08:00 AST (05:00 UTC)
  await t.test('Monday 08:00 AST → state: LIVE, session: LONDON', () => {
    const d = new Date(Date.UTC(2026, 5, 8, 5, 0, 0));
    const status = SessionManager.getStatus(d);

    assert.strictEqual(status.state, 'LIVE');
    assert.strictEqual(status.session, 'LONDON');
    assert.ok(status.sessionLabelAr.includes('لندن'));
  });

  // Test Monday 13:00 AST (10:00 UTC)
  await t.test('Monday 13:00 AST → state: LIVE, session: OVERLAP', () => {
    const d = new Date(Date.UTC(2026, 5, 8, 10, 0, 0));
    const status = SessionManager.getStatus(d);

    assert.strictEqual(status.state, 'LIVE');
    assert.strictEqual(status.session, 'OVERLAP');
    assert.ok(status.sessionLabelAr.includes('تداخل'));
  });

  // Test Monday 18:00 AST (15:00 UTC)
  await t.test('Monday 18:00 AST → state: LIVE, session: NY', () => {
    const d = new Date(Date.UTC(2026, 5, 8, 15, 0, 0));
    const status = SessionManager.getStatus(d);

    assert.strictEqual(status.state, 'LIVE');
    assert.strictEqual(status.session, 'NY');
    assert.ok(status.sessionLabelAr.includes('نيويورك'));
  });

  // Test Friday 23:00 AST (20:00 UTC) → state: CLOSED (weekend)
  // Date: 2026-06-12 is Friday. 23:00 AST = 20:00 UTC
  await t.test('Friday 23:00 AST → state: CLOSED (weekend)', () => {
    const d = new Date(Date.UTC(2026, 5, 12, 20, 0, 0));
    const status = SessionManager.getStatus(d);

    assert.strictEqual(status.state, 'CLOSED');
    assert.strictEqual(status.session, 'CLOSED');
    assert.strictEqual(status.closedReason, 'WEEKEND');
    assert.ok(status.closedReasonAr?.includes('عطلة نهاية الأسبوع'));
  });

  // Test Saturday → state: CLOSED
  // Date: 2026-06-13 is Saturday
  await t.test('Saturday → state: CLOSED', () => {
    const d = new Date(Date.UTC(2026, 5, 13, 12, 0, 0));
    const status = SessionManager.getStatus(d);

    assert.strictEqual(status.state, 'CLOSED');
    assert.strictEqual(status.session, 'CLOSED');
    assert.strictEqual(status.closedReason, 'WEEKEND');
  });

  // Test Sunday before 01:00 AST → state: CLOSED
  // Date: 2026-06-14 is Sunday.
  await t.test('Sunday before 01:00 AST → state: CLOSED', () => {
    const d = new Date(Date.UTC(2026, 5, 14, 15, 0, 0)); // 18:00 AST on Sunday
    const status = SessionManager.getStatus(d);

    assert.strictEqual(status.state, 'CLOSED');
    assert.strictEqual(status.session, 'CLOSED');
    assert.strictEqual(status.closedReason, 'WEEKEND');
  });

  // Test Monday 01:30 AST → state: CLOSED (halt), reason: DAILY_HALT
  // Monday 2026-06-15 01:30 AST = 2026-06-14 22:30 UTC
  await t.test('Monday 01:30 AST → state: CLOSED (halt), reason: DAILY_HALT', () => {
    const d = new Date(Date.UTC(2026, 5, 14, 22, 30, 0));
    const status = SessionManager.getStatus(d);

    assert.strictEqual(status.state, 'CLOSED');
    assert.strictEqual(status.session, 'CLOSED');
    assert.strictEqual(status.closedReason, 'DAILY_HALT');
    assert.strictEqual(status.resumesAtAST, '02:00 AST');
  });

  // Test Day 27 of month → alert: ROLLOVER_DAY
  // Date: 2026-05-27 Wednesday 13:00 AST (10:00 UTC)
  await t.test('Day 27 of month → alert: ROLLOVER_DAY', () => {
    const d = new Date(Date.UTC(2026, 4, 27, 10, 0, 0));
    const status = SessionManager.getStatus(d);

    const rolloverAlert = status.alerts.find((a) => a.code === 'ROLLOVER_DAY');
    assert.ok(rolloverAlert, 'ROLLOVER_DAY alert must be present');
    assert.strictEqual(rolloverAlert.severity, 'CRITICAL');
  });

  // Legacy context backwards compatibility test
  await t.test('Legacy: getContext() returns valid structure', () => {
    const ctx = SessionManager.getContext();
    assert.ok(ctx.currentSession);
    assert.ok(ctx.sessionLabel);
  });
});
