import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activeSafeguards,
  checkRateLimit,
  isGeminiCircuitOpen,
  tripGeminiCircuit,
  resetGeminiCircuit,
  toggleKillSwitch,
  setSpreadSafeguardThreshold,
} from '../server/safeguards';

test('Institutional Safeguards & Risk Controls', async (t) => {
  await t.test('enforces IP / client rate limiting correctly', () => {
    const testIp = '192.168.1.99';
    const action = 'test_rate_limit';
    const maxRequests = 5;
    const windowMs = 5000;

    // First 5 requests should pass
    for (let i = 0; i < maxRequests; i++) {
      const allowed = checkRateLimit(`${testIp}_${action}`, maxRequests, windowMs);
      assert.strictEqual(allowed, true, `Request ${i + 1} should be allowed`);
    }

    // 6th request must be blocked
    const blocked = checkRateLimit(`${testIp}_${action}`, maxRequests, windowMs);
    assert.strictEqual(blocked, false, '6th request must be blocked by rate limiter');
  });

  await t.test('manages AI Circuit Breaker state (trip on quota, reset on recovery)', () => {
    resetGeminiCircuit();
    assert.strictEqual(isGeminiCircuitOpen(), false, 'Circuit must start closed');

    // Trip circuit
    tripGeminiCircuit('Testing quota overload 429', 10000);
    assert.strictEqual(isGeminiCircuitOpen(), true, 'Circuit should be open after tripping');

    // Reset circuit
    resetGeminiCircuit();
    assert.strictEqual(isGeminiCircuitOpen(), false, 'Circuit should be closed after reset');
  });

  await t.test('controls Emergency Kill-Switch properly', () => {
    const initialStatus = activeSafeguards.emergencyKillSwitch;
    
    // Toggle
    const newStatus = toggleKillSwitch(!initialStatus);
    assert.strictEqual(newStatus, !initialStatus, 'Kill switch should toggle state');
    assert.strictEqual(activeSafeguards.emergencyKillSwitch, !initialStatus);

    // Toggle back to clean state
    toggleKillSwitch(false);
    assert.strictEqual(activeSafeguards.emergencyKillSwitch, false);
  });

  await t.test('updates maximum spread threshold safeguard', () => {
    setSpreadSafeguardThreshold(4.0);
    assert.strictEqual(activeSafeguards.maxSpreadThresholdUsd, 4.0);

    // Reset back to default $3.50 institutional limit
    setSpreadSafeguardThreshold(3.5);
    assert.strictEqual(activeSafeguards.maxSpreadThresholdUsd, 3.5);
  });
});
