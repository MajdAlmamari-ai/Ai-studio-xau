/**
 * Telegram Bot Client for Institutional Trade Alerts (Action 24.1)
 * -----------------------------------------------------------------------------
 * Interacts directly with the official Telegram Bot HTTP API.
 * 
 * STRICT RULES:
 * - NO fake dispatches
 * - Throws DataUnavailableError if credentials missing or HTTP error
 * - All message templates formatted in clear Arabic RTL with institutional abbreviations
 */

import { DataUnavailableError } from '../../src/errors/DataUnavailableError';

export interface TelegramSignalPayload {
  symbol: string;
  type: 'BUY' | 'SELL';
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  rrRatio: number;
  confluenceScore: number;
  reasons: string[];
  session: string;
}

export interface TelegramReportPayload {
  date: string;
  totalSignals: number;
  winRate: number;
  dailyReturnPct: number;
  activeRegime: string;
}

export class TelegramClient {
  private readonly botToken: string;
  private readonly chatId: string;
  private readonly baseUrl: string;

  constructor(
    botToken: string = process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: string = process.env.TELEGRAM_CHAT_ID || ''
  ) {
    this.botToken = botToken;
    this.chatId = chatId;
    this.baseUrl = `https://api.telegram.org/bot${this.botToken}`;
  }

  /**
   * Dispatches a raw text message to the configured Telegram channel/group.
   */
  public async sendMessage(text: string): Promise<boolean> {
    if (!this.botToken || !this.chatId) {
      throw new DataUnavailableError(
        'TELEGRAM_CREDENTIALS_MISSING',
        'TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not configured in environment'
      );
    }

    try {
      const url = `${this.baseUrl}/sendMessage`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.chatId,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new DataUnavailableError(
          'TELEGRAM_API_ERROR',
          `Telegram API error HTTP ${res.status}: ${errText}`
        );
      }

      return true;
    } catch (err: any) {
      if (err instanceof DataUnavailableError) throw err;
      throw new DataUnavailableError(
        'TELEGRAM_NETWORK_FAILED',
        `Failed to reach Telegram servers: ${err?.message || 'Network error'}`
      );
    }
  }

  /**
   * Formats and dispatches an institutional SMC trade signal.
   */
  public async sendSignal(signal: TelegramSignalPayload): Promise<boolean> {
    const dirArabic = signal.type === 'BUY' ? '🟢 شراء مؤسساتي (BUY)' : '🔴 بيع مؤسساتي (SELL)';
    const msg = [
      `<b>🚨 إشارة تداول SMC كمي — ${signal.symbol}</b>`,
      `━━━━━━━━━━━━━━━━━━`,
      `<b>الاتجاه:</b> ${dirArabic}`,
      `<b>نقطة الدخول (Entry):</b> $${signal.entryPrice.toFixed(2)}`,
      `<b>وقف الخسارة المحمي (SL):</b> $${signal.stopLoss.toFixed(2)}`,
      `<b>الهدف المؤسساتي (TP):</b> $${signal.takeProfit.toFixed(2)}`,
      `<b>نسبة العائد للمخاطرة (R:R):</b> 1:${signal.rrRatio.toFixed(2)}`,
      `<b>درجة التوافق (Confluence):</b> ${signal.confluenceScore}%`,
      `<b>جلسة التداول:</b> ${signal.session}`,
      `━━━━━━━━━━━━━━━━━━`,
      `<b>الأسباب المؤسساتية:</b>`,
      ...signal.reasons.map((r) => `• ${r}`),
      `\n<i>⚠️ التزم بإدارة رأس المال المؤسساتية (مخاطرة 1% كحد أقصى).</i>`,
    ].join('\n');

    return this.sendMessage(msg);
  }

  /**
   * Formats and dispatches the end-of-day quant summary report.
   */
  public async sendDailyReport(report: TelegramReportPayload): Promise<boolean> {
    const msg = [
      `<b>📊 التقرير اليومي المؤسساتي — XAUUSD SMC Quant</b>`,
      `<b>التاريخ:</b> ${report.date}`,
      `━━━━━━━━━━━━━━━━━━`,
      `<b>إجمالي الإشارات الصادرة:</b> ${report.totalSignals}`,
      `<b>نسبة النجاح (Win Rate):</b> ${report.winRate.toFixed(1)}%`,
      `<b>العائد اليومي التراكمي:</b> ${report.dailyReturnPct >= 0 ? '+' : ''}${report.dailyReturnPct.toFixed(2)}%`,
      `<b>نظام السوق النشط (HMM/Macro):</b> ${report.activeRegime}`,
      `━━━━━━━━━━━━━━━━━━`,
      `<i>نظام التداول الخوارزمي المستقل — محرك Polars & DuckDB</i>`,
    ].join('\n');

    return this.sendMessage(msg);
  }
}

export const telegramClient = new TelegramClient();
