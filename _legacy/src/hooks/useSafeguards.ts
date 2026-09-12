import { useState, useEffect, useCallback } from 'react';

export interface SafeguardStatus {
  activeSafeguards: {
    emergencyKillSwitch: boolean;
    maxDailyDrawdownPct: number;
    maxSpreadThresholdUsd: number;
    newsBlackoutMinutes: number;
    riskRewardMinRatio: number;
  };
  circuitBreaker: {
    isCircuitActive: boolean;
    cooldownSeconds: number;
    reason: string;
  };
}

export function useSafeguards() {
  const [status, setStatus] = useState<SafeguardStatus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isToggling, setIsToggling] = useState<boolean>(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/safeguards');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (err) {
      console.warn('[useSafeguards] Failed to fetch safeguards:', err);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const toggleEmergencyKillSwitch = async () => {
    setIsToggling(true);
    try {
      const res = await fetch('/api/safeguards/toggle-kill-switch', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setStatus((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            activeSafeguards: {
              ...prev.activeSafeguards,
              emergencyKillSwitch: data.emergencyKillSwitch,
            },
          };
        });
        return data.emergencyKillSwitch;
      }
    } catch (err) {
      console.error('[useSafeguards] Toggle kill switch error:', err);
    } finally {
      setIsToggling(false);
    }
    return false;
  };

  return {
    status,
    isLoading,
    isToggling,
    fetchStatus,
    toggleEmergencyKillSwitch,
  };
}
