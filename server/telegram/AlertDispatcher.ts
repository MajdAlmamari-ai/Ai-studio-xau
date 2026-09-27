/**
 * Institutional Alert Dispatcher with Rate-Limiting & Risk Safeguards (Action 24.2)
 * -----------------------------------------------------------------------------
 * Listens for trade signals from SpotEngine and FuturesEngine, applies:
 * - Rate limiting (Max 10 messages per minute)
 * - Emergency Kill-Switch verification
 * - 1:2.0 R:R floor filter
 * - Dispatches verified alerts to Telegram
 */

import { telegramClient, TelegramSignalPayload, TelegramReportPayload } from './TelegramClient';
import { DataUnavailableError } from '../../src/errors/DataUnavailableError';

export interface DispatchStatus {
  dispatched: boolean;
  reason?: string;
  timestamp: number;
}

export class AlertDispatcher {
  private lastDispatchTimes: number[] = [];
  private readonly maxDispatchesPerMinute: number = 10;
  private isKillSwitchActive: boolean = false;

  public setKillSwitch(active: boolean): void {
    this.isKillSwitchActive = active;
  }

  public getKillSwitch(): boolean {
    return this.isKillSwitchActive;
  }

  /**
   * Evaluates signal against risk filters and rate limits before sending to Telegram.
   */
  public async dispatchSignal(signal: TelegramSignalPayload): Promise<DispatchStatus> {
    const now = Date.now();

    // 1. Emergency Kill-Switch Check
    if (this.isKillSwitchActive) {
      return {
        dispatched: false,
        reason: 'KILL_SWITCH_ENGAGED: Recommendation dispatch is halted by operator',
        timestamp: now,
      };
    }

    // 2. Strict Institutional R:R Floor Check (Minimum 1:2.0)
    if (signal.rrRatio < 2.0) {
      return {
        dispatched: false,
        reason: `RR_FLOOR_REJECTED: Signal R:R 1:${signal.rrRatio.toFixed(2)} is below minimum 1:2.0`,
        timestamp: now,
      };
    }

    // 3. Sliding-window Rate Limiter (Max 10 per minute)
    this.lastDispatchTimes = this.lastDispatchTimes.filter((t) => now - t < 60000);
    if (this.lastDispatchTimes.length >= this.maxDispatchesPerMinute) {
      return {
        dispatched: false,
        reason: 'RATE_LIMIT_EXCEEDED: Telegram dispatcher reached maximum capacity (10/min)',
        timestamp: now,
      };
    }

    try {
      await telegramClient.sendSignal(signal);
      this.lastDispatchTimes.push(now);
      return {
        dispatched: true,
        timestamp: now,
      };
    } catch (err: any) {
      return {
        dispatched: false,
        reason: err?.message || 'FAILED_TO_SEND_SIGNAL',
        timestamp: now,
      };
    }
  }

  /**
   * Dispatches periodic quantitative report.
   */
  public async dispatchDailyReport(report: TelegramReportPayload): Promise<DispatchStatus> {
    const now = Date.now();
    if (this.isKillSwitchActive) {
      return {
        dispatched: false,
        reason: 'KILL_SWITCH_ENGAGED',
        timestamp: now,
      };
    }

    try {
      await telegramClient.sendDailyReport(report);
      return { dispatched: true, timestamp: now };
    } catch (err: any) {
      return {
        dispatched: false,
        reason: err?.message || 'FAILED_TO_SEND_REPORT',
        timestamp: now,
      };
    }
  }
}

export const alertDispatcher = new AlertDispatcher();
