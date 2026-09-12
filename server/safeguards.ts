export interface SafeguardConfig {
  emergencyKillSwitch: boolean;
  maxDailyDrawdownPct: number;
  maxSpreadThresholdUsd: number;
  newsBlackoutMinutes: number;
  riskRewardMinRatio: number;
}

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const rateLimits = new Map<string, RateLimitBucket>();

/**
 * In-Memory Sliding Window Rate Limiter
 */
export function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = rateLimits.get(key);
  if (!bucket || now > bucket.resetAt) {
    rateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= maxRequests) {
    return false;
  }
  bucket.count++;
  return true;
}

// Cleanup stale buckets every 5 minutes
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateLimits.entries()) {
    if (now > bucket.resetAt) {
      rateLimits.delete(key);
    }
  }
}, 300000);
if (typeof cleanupInterval.unref === 'function') {
  cleanupInterval.unref();
}

// --- Gemini AI Circuit Breaker Shield ---
let geminiCircuitOpenUntil = 0;
let geminiCircuitReason = '';

export function isGeminiCircuitOpen(): boolean {
  return Date.now() < geminiCircuitOpenUntil;
}

export function getCircuitCooldownSeconds(): number {
  return isGeminiCircuitOpen() ? Math.ceil((geminiCircuitOpenUntil - Date.now()) / 1000) : 0;
}

export function getCircuitReason(): string {
  return isGeminiCircuitOpen() ? geminiCircuitReason : 'أنظمة الذكاء الاصطناعي تعمل بكفاءة تامة';
}

export function tripGeminiCircuit(reason: string, durationMs: number = 60000): void {
  geminiCircuitOpenUntil = Date.now() + durationMs;
  geminiCircuitReason = reason;
  console.warn(`[Safe Architecture Shield] Circuit Breaker Tripped: ${reason}. Cooldown: ${durationMs / 1000}s`);
}

export function resetGeminiCircuit(): void {
  geminiCircuitOpenUntil = 0;
  geminiCircuitReason = '';
}

// --- Active Safeguards & Emergency Kill-Switch ---
export const activeSafeguards: SafeguardConfig = {
  emergencyKillSwitch: false,
  maxDailyDrawdownPct: 3.0,
  maxSpreadThresholdUsd: 3.50,
  newsBlackoutMinutes: 15,
  riskRewardMinRatio: 2.0,
};

export function setSpreadSafeguardThreshold(threshold: number): void {
  activeSafeguards.maxSpreadThresholdUsd = threshold;
}

export function toggleKillSwitch(override?: boolean): boolean {
  if (override !== undefined) {
    activeSafeguards.emergencyKillSwitch = override;
  } else {
    activeSafeguards.emergencyKillSwitch = !activeSafeguards.emergencyKillSwitch;
  }
  return activeSafeguards.emergencyKillSwitch;
}
