/**
 * Client Service for System Diagnostics, Performance Metrics & Structured Logs
 */

export interface SystemLogEntry {
  id: string;
  timestamp: string;
  timestampMs: number;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'AUDIT' | 'METRIC';
  category: string;
  message: string;
  details?: Record<string, any>;
  durationMs?: number;
  memoryHeapUsedMb?: number;
}

export interface SystemMetrics {
  uptimeSeconds: number;
  uptimeFormatted: string;
  memory: {
    rssMb: number;
    heapTotalMb: number;
    heapUsedMb: number;
    externalMb: number;
    heapUtilizationPct: number;
  };
  cpuLoadEstimatePct: number;
  network: {
    totalRequests: number;
    errorRequests: number;
    errorRatePct: number;
    avgLatencyMs: number;
    activeConnections: number;
  };
  cacheStats: {
    yahooHits: number;
    yahooMisses: number;
    tvRelayHits?: number;
    smcCalculations: number;
    candleCacheHits: number;
  };
  safeguards: {
    circuitBreakerTripped: boolean;
    killSwitchActive: boolean;
    rateLimitBlocks: number;
  };
  timestamp: string;
}

export interface LogsResponse {
  logs: SystemLogEntry[];
  count: number;
  metrics: SystemMetrics;
  timestamp: string;
}

export async function fetchSystemLogs(filter?: {
  level?: string;
  category?: string;
  limit?: number;
  search?: string;
}): Promise<LogsResponse> {
  const params = new URLSearchParams();
  if (filter?.level && filter.level !== 'ALL') params.append('level', filter.level);
  if (filter?.category && filter.category !== 'ALL') params.append('category', filter.category);
  if (filter?.limit) params.append('limit', String(filter.limit));
  if (filter?.search) params.append('search', filter.search);

  const url = `/api/system/logs${params.toString() ? `?${params.toString()}` : ''}`;
  try {
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch system logs: ${res.statusText}`);
    }
    return await res.json();
  } catch (err: any) {
    // Graceful fallback to prevent client crash during dev server reload or transient network errors
    return {
      logs: [
        {
          id: 'log_fallback',
          timestamp: new Date().toISOString(),
          timestampMs: Date.now(),
          level: 'WARN',
          category: 'DIAGNOSTICS',
          message: 'جاري محاولة إعادة الاتصال بمركز السجلات والتشخيص...',
          details: { error: err?.message || 'Network error' },
        },
      ],
      count: 1,
      metrics: {
        uptimeSeconds: 0,
        uptimeFormatted: '0h 0m 0s',
        memory: {
          rssMb: 0,
          heapTotalMb: 0,
          heapUsedMb: 0,
          externalMb: 0,
          heapUtilizationPct: 0,
        },
        cpuLoadEstimatePct: 0,
        network: {
          totalRequests: 0,
          errorRequests: 0,
          errorRatePct: 0,
          avgLatencyMs: 0,
          activeConnections: 0,
        },
        cacheStats: {
          yahooHits: 0,
          yahooMisses: 0,
          tvRelayHits: 0,
          smcCalculations: 0,
          candleCacheHits: 0,
        },
        safeguards: {
          circuitBreakerTripped: false,
          killSwitchActive: false,
          rateLimitBlocks: 0,
        },
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    };
  }
}


export async function fetchSystemMetrics(): Promise<SystemMetrics> {
  const res = await fetch('/api/system/metrics');
  if (!res.ok) {
    throw new Error(`Failed to fetch system metrics: ${res.statusText}`);
  }
  return res.json();
}

export async function clearSystemLogs(): Promise<boolean> {
  const res = await fetch('/api/system/logs', { method: 'DELETE' });
  return res.ok;
}
