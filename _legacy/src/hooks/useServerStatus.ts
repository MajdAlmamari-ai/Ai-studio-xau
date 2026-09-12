import { useState, useEffect, useCallback } from 'react';

export interface SystemStatusData {
  status: string;
  version: string;
  serverUptimeSeconds: number;
  nodeVersion: string;
  memoryUsageMb: number;
  goldFeeds: {
    spotPrice: number;
    source: string;
    status: string;
  };
  backendServices: {
    smcQuantEngine: string;
    zoneFreshnessDecay: string;
    proximityScanner: string;
    futuresBasisArbitrage: string;
    scheduler: string;
    telegramProxy: string;
    aiCircuitBreaker: string;
    emergencyKillSwitch: string;
  };
  scheduler: {
    isSchedulerRunning: boolean;
    intervalMinutes: number;
    remainingSeconds: number;
    lastCycleTimestamp: string | null;
    totalCyclesCompleted: number;
  };
  timestamp: string;
}

export function useServerStatus() {
  const [status, setStatus] = useState<SystemStatusData | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const fetchStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/system/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        setIsOnline(true);
      } else {
        setIsOnline(false);
      }
    } catch (err) {
      setIsOnline(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const toggleServerScheduler = async (action?: 'start' | 'stop') => {
    try {
      const res = await fetch('/api/smc/cycle/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        await fetchStatus();
      }
    } catch (e) {
      console.error('Failed to toggle server scheduler:', e);
    }
  };

  return {
    status,
    isOnline,
    isLoading,
    refreshStatus: fetchStatus,
    toggleServerScheduler,
  };
}
