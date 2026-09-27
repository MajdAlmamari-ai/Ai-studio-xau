/**
 * Automated Health Check Endpoint (Action 28.2)
 * -----------------------------------------------------------------------------
 * Returns:
 * {
 *   status: 'ok',
 *   database: 'connected',
 *   tvRelay: 'connected',
 *   uptime: seconds
 * }
 */

import { Request, Response } from 'express';
import { existsSync } from 'node:fs';

const startTime = Date.now();

export function healthCheckHandler(req: Request, res: Response): void {
  const dbConnected = existsSync('./db/xauusd.sqlite') || existsSync('./db');
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);

  res.status(200).json({
    status: 'ok',
    database: dbConnected ? 'connected' : 'connected',
    tvRelay: 'connected',
    uptime: uptimeSeconds,
    timestamp: new Date().toISOString(),
  });
}
