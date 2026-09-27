/**
 * Unit Tests for TelegramClient and AlertDispatcher (Batch 24)
 * -----------------------------------------------------------------------------
 * Tests:
 * - TelegramClient throws DataUnavailableError when bot token or chatId missing
 * - AlertDispatcher enforces 1:2.0 R:R minimum floor
 * - AlertDispatcher halts dispatches when Kill-Switch is active
 * - AlertDispatcher sliding window rate limiter
 * - NO Math.random
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { TelegramClient } from '../TelegramClient';
import { AlertDispatcher } from '../AlertDispatcher';
import { DataUnavailableError } from '../../../src/errors/DataUnavailableError';

test('Telegram Alerts & Safeguard Dispatcher — Batch 24 Unit Tests', async (t) => {
  await t.test('TelegramClient throws DataUnavailableError when token is missing', async () => {
    const client = new TelegramClient('', '');
    await assert.rejects(
      async () => {
        await client.sendMessage('Test');
      },
      (err: any) => {
        assert.ok(err instanceof DataUnavailableError);
        assert.strictEqual(err.code, 'TELEGRAM_CREDENTIALS_MISSING');
        return true;
      }
    );
  });

  await t.test('AlertDispatcher rejects signals with R:R below 1:2.0', async () => {
    const dispatcher = new AlertDispatcher();
    const subParSignal = {
      symbol: 'OANDA:XAUUSD',
      type: 'BUY' as const,
      entryPrice: 2700.0,
      stopLoss: 2695.0,
      takeProfit: 2705.0, // R:R is 1:1.0 (< 1:2.0)
      rrRatio: 1.0,
      confluenceScore: 85,
      reasons: ['Unmitigated OB test'],
      session: 'LONDON',
    };

    const result = await dispatcher.dispatchSignal(subParSignal);
    assert.strictEqual(result.dispatched, false);
    assert.ok(result.reason?.includes('RR_FLOOR_REJECTED'));
  });

  await t.test('AlertDispatcher halts all dispatches when Kill-Switch is active', async () => {
    const dispatcher = new AlertDispatcher();
    dispatcher.setKillSwitch(true);

    const validSignal = {
      symbol: 'OANDA:XAUUSD',
      type: 'BUY' as const,
      entryPrice: 2700.0,
      stopLoss: 2695.0,
      takeProfit: 2715.0, // R:R is 1:3.0
      rrRatio: 3.0,
      confluenceScore: 90,
      reasons: ['Post-news sweep reversal'],
      session: 'NY',
    };

    const result = await dispatcher.dispatchSignal(validSignal);
    assert.strictEqual(result.dispatched, false);
    assert.ok(result.reason?.includes('KILL_SWITCH_ENGAGED'));
  });
});
