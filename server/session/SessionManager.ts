/**
 * Session Manager — Advisory Mode (Saudi Arabia Time AST, UTC+3)
 * 
 * Detects market sessions, weekend halts, daily halts, and provides context-aware alerts.
 * 
 * Philosophy:
 * - NOT restrictive (does not block analysis)
 * - Provides context (session, liquidity, timing)
 * - Uses Saudi Arabia time (Asia/Riyadh, AST, UTC+3)
 * 
 * NO FAKE DATA:
 * - Deterministic time calculations, no placeholders
 */

export type SessionType = 'ASIAN' | 'LONDON' | 'NY' | 'OVERLAP' | 'CLOSED';
export type MarketState = 'LIVE' | 'CLOSED';
export type ClosedReason = 'WEEKEND' | 'DAILY_HALT' | 'ROLLOVER';

export interface SessionAlert {
  code: string;
  severity: 'INFO' | 'WARN' | 'CRITICAL';
  titleAr: string;
  messageAr: string;
}

export interface SessionStatus {
  state: MarketState;
  session: SessionType;
  sessionLabelAr: string;
  closedReason?: ClosedReason;
  closedReasonAr?: string;
  resumesAtAST?: string;
  currentTimeAST: string;
  alerts: SessionAlert[];
}

// Backward compatibility alias for legacy tests
export type LegacySessionType =
  | 'ASIAN'
  | 'LONDON_KILL'
  | 'LONDON_GAP'
  | 'NY_KILL'
  | 'NY_PM'
  | 'COMEX_HALT'
  | 'LATE_NIGHT';

export interface LegacySessionContext {
  currentSession: LegacySessionType;
  sessionLabel: string;
  liquidityLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'OPTIMAL';
  utcHour: number;
  saudiHour: number;
  saudiTime: string;
  alerts: Array<{
    code: string;
    severity: 'INFO' | 'WARN' | 'CRITICAL';
    title: string;
    message: string;
  }>;
  nextSession: {
    name: LegacySessionType;
    startsInMinutes: number;
    startsAt: string;
  };
}

export class SessionManager {
  /**
   * Primary Action 9.1 status method
   * All times in Saudi Arabia timezone (Asia/Riyadh, UTC+3)
   */
  static getStatus(now: Date = new Date()): SessionStatus {
    // Determine Saudi Arabia time (AST, UTC+3) via Intl API
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Riyadh',
      hour12: false,
      weekday: 'short',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });

    const parts = formatter.formatToParts(now);
    const partMap: Record<string, string> = {};
    for (const p of parts) {
      partMap[p.type] = p.value;
    }

    const astHour = parseInt(partMap.hour, 10);
    const astMinute = parseInt(partMap.minute, 10);
    const astDay = parseInt(partMap.day, 10);
    const astWeekday = partMap.weekday; // 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'

    const currentTimeAST = `${String(astHour).padStart(2, '0')}:${String(astMinute).padStart(2, '0')} AST`;
    const alerts: SessionAlert[] = [];

    // 1. Check Weekend:
    // Gold markets close Friday 23:59 AST (or 17:00 NY = 21:00 UTC) until Monday 01:00 AST (Sunday 22:00 UTC)
    // Friday after 23:00 AST, all day Saturday, and Sunday until Monday 01:00 AST
    const isFridayNight = astWeekday === 'Fri' && (astHour >= 23 && astMinute >= 0);
    const isSaturday = astWeekday === 'Sat';
    const isSunday = astWeekday === 'Sun';
    const isSundayBeforeOpen = isSunday && !(astHour >= 24); // all Sunday AST is before Monday 01:00 AST

    const isWeekend = isFridayNight || isSaturday || isSundayBeforeOpen;

    if (isWeekend) {
      return {
        state: 'CLOSED',
        session: 'CLOSED',
        sessionLabelAr: 'عطلة نهاية الأسبوع (السوق مغلق)',
        closedReason: 'WEEKEND',
        closedReasonAr: 'إغلاق عطلة نهاية الأسبوع لأسواق الذهب العالمية',
        resumesAtAST: 'الاثنين 01:00 AST',
        currentTimeAST,
        alerts: [
          {
            code: 'WEEKEND_CLOSED',
            severity: 'INFO',
            titleAr: 'عطلة نهاية الأسبوع',
            messageAr: 'أسواق الذهب العالمية مغلقة حالياً وتستأنف التداول فجر الاثنين الساعة 01:00 بتوقيت مكة.',
          },
        ],
      };
    }

    // 2. Check Daily Halt:
    // COMEX daily halt is 22:00-23:00 UTC = 01:00-02:00 AST (Monday through Friday)
    const isDailyHalt = astHour === 1; // 01:00 to 01:59 AST
    if (isDailyHalt) {
      return {
        state: 'CLOSED',
        session: 'CLOSED',
        sessionLabelAr: 'فترة التوقف اليومي (COMEX Halt)',
        closedReason: 'DAILY_HALT',
        closedReasonAr: 'فترة التوقف اليومية لبورصة شيكاغو (22:00-23:00 UTC)',
        resumesAtAST: '02:00 AST',
        currentTimeAST,
        alerts: [
          {
            code: 'COMEX_HALT',
            severity: 'CRITICAL',
            titleAr: 'توقف يومي للبورصة (COMEX Halt)',
            messageAr: 'فترة التوقف اليومي (01:00-02:00 AST). التحليلات تعتمد على آخر بيانات مسجلة.',
          },
        ],
      };
    }

    // 3. Determine Active Session:
    // ASIAN: 00:00-07:00 AST (excluding halt 01:00-02:00 handled above)
    // LONDON: 07:00-12:00 AST
    // OVERLAP: 12:00-16:00 AST (London + NY)
    // NY: 16:00-22:00 AST
    // CLOSED: 22:00-24:00 AST / outside
    let session: SessionType;
    let sessionLabelAr: string;

    if (astHour >= 0 && astHour < 7) {
      session = 'ASIAN';
      sessionLabelAr = 'الجلسة الآسيوية (طوكيو / سيدني)';
      alerts.push({
        code: 'ASIAN_SESSION',
        severity: 'INFO',
        titleAr: 'الجلسة الآسيوية',
        messageAr: 'سيولة منخفضة وتذبذب عرضي محصور غالباً.',
      });
    } else if (astHour >= 7 && astHour < 12) {
      session = 'LONDON';
      sessionLabelAr = 'جلسة لندن (أوروبا)';
      alerts.push({
        code: 'LONDON_SESSION',
        severity: 'INFO',
        titleAr: 'جلسة لندن',
        messageAr: 'سيولة وتدفقات قوية مع بدء التداولات الأوروبية.',
      });
    } else if (astHour >= 12 && astHour < 16) {
      session = 'OVERLAP';
      sessionLabelAr = 'تداخل جلسة لندن ونيويورك (ذروة السيولة)';
      alerts.push({
        code: 'OVERLAP_SESSION',
        severity: 'INFO',
        titleAr: 'فترة التداخل الذهبية (London + NY)',
        messageAr: 'أعلى معدل سيولة وحركة سعرية في اليوم المؤسساتي.',
      });
    } else if (astHour >= 16 && astHour < 22) {
      session = 'NY';
      sessionLabelAr = 'جلسة نيويورك الأمريكية';
      alerts.push({
        code: 'NY_SESSION',
        severity: 'INFO',
        titleAr: 'جلسة نيويورك',
        messageAr: 'حركة اتجاهية قوية وتأثير مباشر لبيانات الاقتصاد الأمريكي.',
      });
    } else {
      session = 'CLOSED';
      sessionLabelAr = 'فترة ما بعد الإغلاق الأمريكي';
    }

    // 4. Rollover Checks (26-28 of month)
    if (astDay === 26) {
      alerts.push({
        code: 'ROLLOVER_PRE',
        severity: 'WARN',
        titleAr: 'اقتراب موعد التدوير (Rollover)',
        messageAr: 'غداً موعد تدوير عقود COMEX الآجلة، راقب فروقات السبريد.',
      });
    } else if (astDay === 27) {
      alerts.push({
        code: 'ROLLOVER_DAY',
        severity: 'CRITICAL',
        titleAr: 'يوم التدوير الرئيسي (Rollover Day)',
        messageAr: 'تجري اليوم تسوية وانتقال العقود الآجلة، احذر من التذبذبات غير الاعتيادية.',
      });
    } else if (astDay === 28) {
      alerts.push({
        code: 'ROLLOVER_POST',
        severity: 'WARN',
        titleAr: 'ما بعد التدوير (Post-Rollover)',
        messageAr: 'استقرار تدريجي في أحجام وسيولة العقد الجديد.',
      });
    }

    // 5. Friday Close Approaching
    if (astWeekday === 'Fri' && astHour >= 20 && astHour < 23) {
      alerts.push({
        code: 'FRIDAY_APPROACHING',
        severity: 'WARN',
        titleAr: 'اقتراب إغلاق الأسبوع',
        messageAr: 'اقتراب إغلاق الأسواق الأسبوعي، يفضل تجنب فتح مراكز جديدة تفادياً للفجوات السعرية.',
      });
    }

    return {
      state: 'LIVE',
      session,
      sessionLabelAr,
      currentTimeAST,
      alerts,
    };
  }

  /**
   * Backward compatibility for legacy tests and components
   */
  static getContext(now: Date = new Date()): LegacySessionContext {
    const utcHour = now.getUTCHours();
    const utcMinute = now.getUTCMinutes();
    const utcDay = now.getUTCDate();
    const utcDayOfWeek = now.getUTCDay();

    const saudiHour = (utcHour + 3) % 24;
    const alerts: Array<{ code: string; severity: 'INFO' | 'WARN' | 'CRITICAL'; title: string; message: string }> = [];

    let currentSession: LegacySessionType;
    let sessionLabel: string;
    let liquidityLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'OPTIMAL';

    if (utcDayOfWeek === 6 || (utcDayOfWeek === 0 && utcHour < 22)) {
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

    if (utcDay >= 26 && utcDay <= 28) {
      const severity = utcDay === 27 ? 'CRITICAL' : 'WARN';
      const title = utcDay === 27 ? 'يوم Rollover' : utcDay === 26 ? 'غداً Rollover' : 'أمس Rollover';
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

    const saudiTime = `${String(saudiHour).padStart(2, '0')}:${String(utcMinute).padStart(2, '0')} AST`;

    return {
      currentSession,
      sessionLabel,
      liquidityLevel,
      utcHour,
      saudiHour,
      saudiTime,
      alerts,
      nextSession: {
        name: 'LONDON_KILL',
        startsInMinutes: 60,
        startsAt: '07:00 UTC',
      },
    };
  }
}
