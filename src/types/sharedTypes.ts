/**
 * Client-Side Shared Types for TradingView, Yahoo & Project Bundles
 * Pure TypeScript types with NO Node.js runtime dependencies (like process, fs, path).
 */

export interface NormalizedCandle {
  time: number; // Unix timestamp in seconds
  timeFormatted?: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type VolumeType = 'CONTRACT' | 'TICK' | 'UNAVAILABLE';

export interface Candle {
  symbol: string;
  timeframe: string;
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
  volumeType: VolumeType;
  complete: boolean;
  source: string;
}

export function candleToNormalized(c: Candle): NormalizedCandle {
  return {
    time: Math.floor(c.openTime / 1000),
    timeFormatted: new Date(c.openTime).toISOString(),
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume ?? 0,
  };
}

export interface ProjectSourceFile {
  relativePath: string;
  category: 'ui_and_chart_components' | 'data_engine_and_apis' | 'smc_quant_algorithms' | 'risk_management_and_signals' | 'config_and_server_files';
  categoryAr: string;
  fileName: string;
  extension: string;
  sizeBytes: number;
  linesCount: number;
  content: string;
}

export interface ProjectSourceBundle {
  projectName: string;
  version: string;
  generatedAt: string;
  totalFiles: number;
  totalLines: number;
  totalSizeBytes: number;
  descriptionAr: string;
  categories: {
    id: string;
    nameAr: string;
    descriptionAr: string;
    filesCount: number;
    linesCount: number;
  }[];
  files: ProjectSourceFile[];
}
