/**
 * Client-Side Shared Types for Gate.io & Project Bundles
 * Pure TypeScript types with NO Node.js runtime dependencies (like process, fs, path).
 */

export interface NormalizedCandle {
  time: number; // Unix timestamp in seconds
  timeFormatted: string;
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

export interface GateIoSpotTicker {
  symbol: string;
  currencyPair: string;
  last: number;
  lowestAsk: number;
  highestBid: number;
  changePercentage: number;
  baseVolume: number;
  quoteVolume: number;
  high24h: number;
  low24h: number;
  updatedAt: string;
}

export interface GateIoFuturesTicker {
  contract: string;
  last: number;
  markPrice: number;
  indexPrice: number;
  fundingRate: number;
  fundingRatePct: number;
  volume24h: number;
  volume24hUsd: number;
  highestBid: number;
  lowestAsk: number;
  changePercentage: number;
  changePrice: number;
  high24h: number;
  low24h: number;
  updatedAt: string;
}

export interface GateIoOrderBookLevel {
  price: number;
  size: number;
  total: number;
}

export interface GateIoOrderBookData {
  market: 'spot' | 'futures';
  symbol: string;
  bids: GateIoOrderBookLevel[];
  asks: GateIoOrderBookLevel[];
  totalBidSize: number;
  totalAskSize: number;
  imbalanceRatio: number;
  imbalanceVerdictAr: string;
  spread: number;
  timestamp: string;
}

export interface GateIoSpotTradeItem {
  id: string;
  createTime: number;
  timeFormatted: string;
  side: 'buy' | 'sell';
  amount: number;
  price: number;
  volumeUsd: number;
}

export interface GateIoSpotTradeFlow {
  trades: GateIoSpotTradeItem[];
  buyVolume: number;
  sellVolume: number;
  totalVolume: number;
  cumulativeDelta: number;
  tickVelocity: number;
  orderFlowSpeedAr: string;
  timestamp: string;
}

export interface GateIoSpotMasterOverview {
  status: 'ONLINE' | 'DEGRADED' | 'FALLBACK';
  source: 'Gate.io API v4 (Official)';
  symbol: 'XAU/USD Spot';
  currencyPair: 'PAXG_USDT';
  ticker: GateIoSpotTicker;
  orderBook: GateIoOrderBookData;
  tradeFlow: GateIoSpotTradeFlow;
  lastSync: string;
}

export interface GateIoMarketOverview {
  status: 'ONLINE' | 'DEGRADED' | 'FALLBACK';
  source: 'Gate.io API v4 (Official)';
  apiEndpoint: string;
  spot: GateIoSpotTicker;
  futures: GateIoFuturesTicker;
  basisMetrics: {
    basisSpread: number;
    basisSpreadPips: number;
    basisPct: number;
    state: 'CONTANGO' | 'BACKWARDATION';
    stateLabelAr: string;
    descriptionAr: string;
  };
  orderBook: {
    spot: GateIoOrderBookData;
    futures: GateIoOrderBookData;
  };
  tradeFlow: GateIoSpotTradeFlow;
  lastSync: string;
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
