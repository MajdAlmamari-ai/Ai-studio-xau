/**
 * Session Manager — Advisory Mode
 * 
 * Detects market sessions and provides context-aware alerts.
 * 
 * Philosophy:
 * - NOT restrictive (does not block analysis)
 * - Provides context (session, liquidity, timing)
 * - Uses Saudi Arabia time (AST, UTC+3)
 * 
 * Time zones:
 * - Asia/Riyadh = UTC+3
 * - No DST
 * 
 * NO FAKE DATA:
 * - All time-based, deterministic
 * - No placeholders
 */

export type SessionType =
  | 'ASIAN'
  | 'LONDON_KILL'
  | 'LONDON_GAP'
  | 'NY_KILL'
  | 'NY_PM'
  | 'COMEX_HALT'
  | 'LATE_NIGHT';

export type LiquidityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'OPTIMAL';

export type AlertSeverity = 'INFO' | 'WARN' | 'CRITICAL';

export interface SessionAlert {
  code: string;
  severity: AlertSeverity;
  title: string;
  message: string;
}

export interface SessionContext {
  currentSession: SessionType;
  sessionLabel: string;
  liquidityLevel: LiquidityLevel;
  utcHour: number;
  saudiHour: number;
  saudiTime: string;
  alerts: SessionAlert[];
  nextSession: {
    name: SessionType;
    startsInMinutes: number;
    startsAt: string;
  };
}

export class SessionManager {
  /**
   * Get current session context
   * Uses Saudi Arabia Time (AST, UTC+3)
   */
  static getContext(now: Date = new Date()): SessionContext {
    const utcHour = now.getUTCHours();
    const utcMinute = now.getUTCMinutes();
    const utcDay = now.getUTCDate();
    const utcDayOfWeek = now.getUTCDay(); // 0=Sunday, 6=Saturday

    // Convert to Saudi Arabia Time (UTC+3)
    const saudiHour = (utcHour + 3) % 24;

    const alerts: SessionAlert[] = [];

    // Determine current session
    let currentSession: SessionType;
    let sessionLabel: string;
    let liquidityLevel: LiquidityLevel;

    if (utcDayOfWeek === 6 || (utcDayOfWeek === 0 && utcHour < 22)) {
      // Weekend
      currentSession = 'LATE_NIGHT';
      sessionLabel = 'عطلة نهاية الأسبوع';
      liquidityLevel = 'LOW';
    } else if (utcHour >= 7 && utcHour < 10) {
      currentSession = 'LONDON_KILL';
      sessionLabel = 'London Kill Zone';
      liquidityLevel = 'OPTIMAL';
    } else if (utcHour >= 10 && utcHour < 12) {
      currentSession = 'LONDON_GAP';
      sessionLabel = 'London–NY Gap';
      liquidityLevel = 'MEDIUM';
    } else if ((utcHour === 12 && utcMinute >= 30) || (utcHour >= 13 && utcHour < 15)) {
      currentSession = 'NY_KILL';
      sessionLabel = 'NY Kill Zone';
      liquidityLevel = 'OPTIMAL';
    } else if (utcHour >= 15 && utcHour < 18) {
      currentSession = 'NY_PM';
      sessionLabel = 'NY PM Session';
      liquidityLevel = 'MEDIUM';
    } else if (utcHour >= 22 && utcHour < 23) {
      currentSession = 'COMEX_HALT';
      sessionLabel = 'COMEX Halt';
      liquidityLevel = 'LOW';
    } else {
      currentSession = 'ASIAN';
      sessionLabel = 'Asian Session';
      liquidityLevel = 'LOW';
    }

    // Build alerts (advisory, not restrictive)
    if (currentSession === 'ASIAN') {
      alerts.push({
        code: 'ASIAN_SESSION',
        severity: 'INFO',
        title: 'الجلسة الآسيوية',
        message: 'السيولة أقل من المعتاد. عادةً Range ضيق.',
      });
    }

    if (currentSession === 'COMEX_HALT') {
      alerts.push({
        code: 'COMEX_HALT',
        severity: 'CRITICAL',
        title: 'COMEX في فترة توقف',
        message: 'COMEX Halt (22:00-23:00 UTC). Analysis uses last available data.',
      });
    }

    // Rollover days (26-28)
    if (utcDay >= 26 && utcDay <= 28) {
      const severity: AlertSeverity = utcDay === 27 ? 'CRITICAL' : 'WARN';
      const title =
        utcDay === 27 ? 'يوم Rollover' : utcDay === 26 ? 'غداً Rollover' : 'أمس Rollover';
      alerts.push({
        code: `ROLLOVER_${utcDay}`,
        severity,
        title,
        message: 'COMEX ينقل العقود. Basis قد يكون مشوّهاً.',
      });
    }

    if (currentSession === 'LONDON_KILL' || currentSession === 'NY_KILL') {
      alerts.push({
        code: 'KILL_ZONE_ACTIVE',
        severity: 'INFO',
        title: `${sessionLabel} نشطة`,
        message: 'أعلى سيولة في اليوم. أفضل وقت للتحليل.',
      });
    }

    // Next session calculation
    const nextSession = this.calculateNextSession(utcHour, utcMinute);

    // Format Saudi time
    const saudiTime = `${String(saudiHour).padStart(2, '0')}:${String(utcMinute).padStart(2, '0')} AST`;

    return {
      currentSession,
      sessionLabel,
      liquidityLevel,
      utcHour,
      saudiHour,
      saudiTime,
      alerts,
      nextSession,
    };
  }

  private static calculateNextSession(
    currentHour: number,
    currentMinute: number
  ): SessionContext['nextSession'] {
    // Compute next session start
    const sessions = [
      { name: 'LONDON_KILL' as SessionType, startHour: 7 },
      { name: 'NY_KILL' as SessionType, startHour: 12 },
      { name: 'NY_PM' as SessionType, startHour: 15 },
      { name: 'COMEX_HALT' as SessionType, startHour: 22 },
      { name: 'ASIAN' as SessionType, startHour: 23 },
    ];

    for (const session of sessions) {
      if (session.startHour > currentHour) {
        const minutesUntil = (session.startHour - currentHour) * 60 - currentMinute;
        return {
          name: session.name,
          startsInMinutes: minutesUntil,
          startsAt: `${String(session.startHour).padStart(2, '0')}:00 UTC`,
        };
      }
    }

    // Next day
    const minutesUntil = (24 - currentHour + 7) * 60 - currentMinute;
    return {
      name: 'LONDON_KILL',
      startsInMinutes: minutesUntil,
      startsAt: '07:00 UTC (next day)',
    };
  }
}
