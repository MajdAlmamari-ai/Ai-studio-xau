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
    gateIoHits: number;
    gateIoMisses: number;
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
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch system logs: ${res.statusText}`);
  }
  return res.json();
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
