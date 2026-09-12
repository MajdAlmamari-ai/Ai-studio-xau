/**
 * Centralized Institutional Logging & Performance Metrics Service
 * ----------------------------------------------------------------
 * Provides:
 * 1. Ring-buffer in-memory structured log storage (bounded to 500 entries).
 * 2. Multi-level logging: DEBUG, INFO, WARN, ERROR, AUDIT, METRIC.
 * 3. Performance & System Resource Metrics (Memory, Latency, Request counters).
 * 4. Error capture and diagnostic contextualization.
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'AUDIT' | 'METRIC';

export type LogCategory = 
  | 'SMC_ENGINE' 
  | 'GATEIO' 
  | 'CME_ORDER_FLOW' 
  | 'RISK_SAFEGUARD' 
  | 'CIRCUIT_BREAKER' 
  | 'HTTP_API' 
  | 'WEBSOCKET' 
  | 'TELEGRAM' 
  | 'SYSTEM'
  | 'UNIT_TEST'
  | 'BENCHMARK';

export interface LogEntry {
  id: string;
  timestamp: string;
  timestampMs: number;
  level: LogLevel;
  category: LogCategory;
  message: string;
  details?: Record<string, any>;
  durationMs?: number;
  memoryHeapUsedMb?: number;
}

export interface SystemPerformanceMetrics {
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

class LoggerService {
  private static instance: LoggerService;
  private readonly MAX_LOGS = 500;
  private logs: LogEntry[] = [];
  private logIdCounter = 1;
  private startTime = Date.now();

  // Metrics counters
  private totalRequests = 0;
  private errorRequests = 0;
  private latencyAccumulator = 0;
  private latencyCount = 0;
  private activeConnections = 0;

  // Cache stats
  public cacheStats = {
    gateIoHits: 0,
    gateIoMisses: 0,
    smcCalculations: 0,
    candleCacheHits: 0,
  };

  // Safeguard stats
  public safeguardStats = {
    circuitBreakerTripped: false,
    killSwitchActive: false,
    rateLimitBlocks: 0,
  };

  private constructor() {
    this.info('SYSTEM', 'Institutional Logging & Diagnostics Engine initialized successfully');
  }

  public static getInstance(): LoggerService {
    if (!LoggerService.instance) {
      LoggerService.instance = new LoggerService();
    }
    return LoggerService.instance;
  }

  private formatUptime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h}h ${m}m ${s}s`;
  }

  private addLog(
    level: LogLevel,
    category: LogCategory,
    message: string,
    details?: Record<string, any>,
    durationMs?: number
  ): LogEntry {
    const mem = process.memoryUsage();
    const heapUsedMb = parseFloat((mem.heapUsed / (1024 * 1024)).toFixed(2));

    const entry: LogEntry = {
      id: `log_${this.logIdCounter++}_${Date.now().toString(36)}`,
      timestamp: new Date().toISOString(),
      timestampMs: Date.now(),
      level,
      category,
      message,
      details,
      durationMs,
      memoryHeapUsedMb: heapUsedMb,
    };

    this.logs.push(entry);

    // Circular ring-buffer eviction
    if (this.logs.length > this.MAX_LOGS) {
      this.logs.shift();
    }

    // Standard console output for developer visibility
    const prefix = `[${entry.timestamp.substring(11, 19)}] [${level}] [${category}]`;
    if (level === 'ERROR') {
      console.error(prefix, message, details || '');
    } else if (level === 'WARN') {
      console.warn(prefix, message, details || '');
    }

    return entry;
  }

  public debug(category: LogCategory, message: string, details?: Record<string, any>): LogEntry {
    return this.addLog('DEBUG', category, message, details);
  }

  public info(category: LogCategory, message: string, details?: Record<string, any>): LogEntry {
    return this.addLog('INFO', category, message, details);
  }

  public warn(category: LogCategory, message: string, details?: Record<string, any>): LogEntry {
    return this.addLog('WARN', category, message, details);
  }

  public error(category: LogCategory, message: string, details?: Record<string, any>): LogEntry {
    this.errorRequests++;
    return this.addLog('ERROR', category, message, details);
  }

  public audit(category: LogCategory, message: string, details?: Record<string, any>): LogEntry {
    return this.addLog('AUDIT', category, message, details);
  }

  public metric(category: LogCategory, message: string, durationMs: number, details?: Record<string, any>): LogEntry {
    return this.addLog('METRIC', category, message, details, durationMs);
  }

  // Request tracing & metrics
  public recordRequest(durationMs: number, isError = false) {
    this.totalRequests++;
    if (isError) this.errorRequests++;
    this.latencyAccumulator += durationMs;
    this.latencyCount++;
  }

  public incrementConnections() {
    this.activeConnections++;
  }

  public decrementConnections() {
    this.activeConnections = Math.max(0, this.activeConnections - 1);
  }

  // Query logs with filtering
  public getLogs(filter?: {
    level?: LogLevel;
    category?: LogCategory;
    limit?: number;
    search?: string;
  }): LogEntry[] {
    let result = [...this.logs];

    if (filter?.level) {
      result = result.filter(l => l.level === filter.level);
    }
    if (filter?.category) {
      result = result.filter(l => l.category === filter.category);
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      result = result.filter(l => 
        l.message.toLowerCase().includes(q) || 
        (l.details && JSON.stringify(l.details).toLowerCase().includes(q))
      );
    }

    // Return newest first
    result.reverse();

    const limit = filter?.limit || 100;
    return result.slice(0, limit);
  }

  public clearLogs(): void {
    this.logs = [];
    this.info('SYSTEM', 'Log buffer was reset and cleared');
  }

  // Generate system performance metrics
  public getMetrics(): SystemPerformanceMetrics {
    const uptimeSec = Math.floor((Date.now() - this.startTime) / 1000);
    const mem = process.memoryUsage();

    const rssMb = parseFloat((mem.rss / (1024 * 1024)).toFixed(2));
    const heapTotalMb = parseFloat((mem.heapTotal / (1024 * 1024)).toFixed(2));
    const heapUsedMb = parseFloat((mem.heapUsed / (1024 * 1024)).toFixed(2));
    const externalMb = parseFloat((mem.external / (1024 * 1024)).toFixed(2));
    const heapUtilizationPct = heapTotalMb > 0 ? parseFloat(((heapUsedMb / heapTotalMb) * 100).toFixed(1)) : 0;

    const avgLatencyMs = this.latencyCount > 0 
      ? parseFloat((this.latencyAccumulator / this.latencyCount).toFixed(2)) 
      : 8.5;

    const errorRatePct = this.totalRequests > 0 
      ? parseFloat(((this.errorRequests / this.totalRequests) * 100).toFixed(2)) 
      : 0;

    // Approximated CPU load based on heap usage and latency
    const cpuLoadEstimatePct = Math.min(100, Math.max(5, parseFloat(((heapUtilizationPct * 0.4) + (avgLatencyMs * 0.3)).toFixed(1))));

    return {
      uptimeSeconds: uptimeSec,
      uptimeFormatted: this.formatUptime(uptimeSec),
      memory: {
        rssMb,
        heapTotalMb,
        heapUsedMb,
        externalMb,
        heapUtilizationPct,
      },
      cpuLoadEstimatePct,
      network: {
        totalRequests: this.totalRequests,
        errorRequests: this.errorRequests,
        errorRatePct,
        avgLatencyMs,
        activeConnections: this.activeConnections,
      },
      cacheStats: this.cacheStats,
      safeguards: {
        circuitBreakerTripped: this.safeguardStats.circuitBreakerTripped,
        killSwitchActive: this.safeguardStats.killSwitchActive,
        rateLimitBlocks: this.safeguardStats.rateLimitBlocks,
      },
      timestamp: new Date().toISOString(),
    };
  }
}

export const logger = LoggerService.getInstance();
