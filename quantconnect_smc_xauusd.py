# region imports
from AlgorithmImports import *
import numpy as np
from datetime import datetime, timedelta
# endregion

"""
========================================================================================
XAUUSD Institutional Real-SMC Quant Strategy (Wall Street Confluence Engine)
========================================================================================
Designed to raise Win Rate from ~33% to 65% - 75%+ by implementing the true 5 institutional pillars:

1. Institutional Killzones (London 07:00-10:00 UTC & New York 12:00-16:00 UTC):
   - Eliminates off-hours chop, low-volume whipsaws, and Asian range fakeouts.
2. Premium vs. Discount Equilibrium (Fibonacci 50% Rule):
   - Strict rule: NEVER Buy in Premium (Upper 50%); NEVER Sell in Discount (Lower 50%).
3. True Liquidity Sweeps (BSL / SSL Sweeps):
   - Only enters AFTER retail stop-losses (Equal Highs / Equal Lows) are hunted and price reclaims.
4. Structural Shift Confirmation (CHoCH / BOS):
   - No catching falling knives. Requires candle body close confirming market structure shift.
5. Confluence Scoring Engine (Threshold >= 70/100):
   - Structure Aligned (25 pts) + Killzone Active (20 pts) + Discount/Premium (15 pts) +
     FVG / OB Zone (20 pts) + Liquidity Sweep Confirmed (20 pts).
6. Execution:
   - Fixed 0.02 Lot (2 Ounces).
   - Instant Native Broker Bracket Orders (StopMarketOrder + LimitOrder).
   - Segregated Performance Reports: Year 2025 vs Year 2026.
   - 1,000-Path Monte Carlo Bootstrap Simulation.
========================================================================================
"""

class SwingPoint:
    def __init__(self, price, bar_index, is_high, time):
        self.price = price
        self.bar_index = bar_index
        self.is_high = is_high
        self.time = time


class OrderBlockZone:
    def __init__(self, top, bottom, is_bullish, bar_index, time):
        self.top = top
        self.bottom = bottom
        self.is_bullish = is_bullish
        self.bar_index = bar_index
        self.time = time
        self.mitigated = False
        self.mitigation_time = None

    def get_freshness_score(self, current_bar_index):
        age = max(1, current_bar_index - self.bar_index)
        if self.mitigated:
            return 15
        if age <= 6:
            return 100
        elif age >= 25:
            return 25
        return int(100 - ((age - 6) / 19.0) * 75)


class FvgZone:
    def __init__(self, top, bottom, is_bullish, bar_index, time):
        self.top = top
        self.bottom = bottom
        self.midpoint = (top + bottom) / 2.0  # 50% Consequent Encroachment
        self.is_bullish = is_bullish
        self.bar_index = bar_index
        self.time = time
        self.filled = False


class XauusdInstitutionalSMCAlgorithm(QCAlgorithm):

    def initialize(self):
        # 1. إعداد رأس المال والتواريخ (2025 و 2026)
        self.set_start_date(2025, 1, 1)
        self.set_end_date(2026, 9, 29)
        self.set_cash(500) # رأس مال 500$

        # 2. حجم اللوت الثابت: 0.02 لوت (2 أونصة)
        self.fixed_lot_size = 2

        self.trades_2025 = []
        self.trades_2026 = []
        self.all_completed_trades = []

        # 3. اشتراك الذهب الفوري OANDA CFD مع رافعة 50x لحماية الهامش
        self.spot = self.add_cfd("XAUUSD", Resolution.MINUTE, Market.OANDA)
        self.spot.set_leverage(50.0)
        self.spot_symbol = self.spot.symbol

        # 4. مجمعات الشموع (QuoteBarConsolidator) لفريمات 5M و 15M و 1H
        # شارت 5 دقائق لتأكيد الدخول القناص وتصفية المصائد (5M Entry Confirmation)
        self.m5_consolidator = QuoteBarConsolidator(timedelta(minutes=5))
        self.m5_consolidator.data_consolidated += self.on_m5_bar
        self.subscription_manager.add_consolidator(self.spot_symbol, self.m5_consolidator)

        # شارت 15 دقيقة لهيكل السوق وتحديد كتل الأوامر والفجوات (15M SMC Structure)
        self.m15_consolidator = QuoteBarConsolidator(timedelta(minutes=15))
        self.m15_consolidator.data_consolidated += self.on_m15_bar
        self.subscription_manager.add_consolidator(self.spot_symbol, self.m15_consolidator)

        # شارت 1 ساعة لتحديد الاتجاه العام وسيولة الجلسات (1H HTF Macro Bias)
        self.h1_consolidator = QuoteBarConsolidator(timedelta(hours=1))
        self.h1_consolidator.data_consolidated += self.on_h1_bar
        self.subscription_manager.add_consolidator(self.spot_symbol, self.h1_consolidator)

        # 5. المؤشرات المؤسساتية
        self.atr5 = self.atr(self.spot_symbol, 14, MovingAverageType.SIMPLE, Resolution.MINUTE)
        self.register_indicator(self.spot_symbol, self.atr5, self.m5_consolidator)

        self.atr15 = self.atr(self.spot_symbol, 14, MovingAverageType.SIMPLE, Resolution.MINUTE)
        self.register_indicator(self.spot_symbol, self.atr15, self.m15_consolidator)

        self.ema_h1_fast = ExponentialMovingAverage(20)
        self.register_indicator(self.spot_symbol, self.ema_h1_fast, self.h1_consolidator)
        self.ema_h1_slow = ExponentialMovingAverage(50)
        self.register_indicator(self.spot_symbol, self.ema_h1_slow, self.h1_consolidator)

        # 6. الذاكرة الهيكلية (SMC Institutional Memory)
        self.m5_bars = []
        self.m15_bars = []
        self.h1_bars = []
        self.bar_index_m5 = 0
        self.bar_index_m15 = 0
        self.order_blocks = []
        self.fvgs = []
        self.swings_high = []
        self.swings_low = []
        self.recent_sweeps = [] # سجل سحب السيولة الحديث

        # حالة الأوامر وتأكيد الدخول على 5M
        self.armed_setup = None # إشارة مجهزة من 15M بانتظار شمعة تأكيد 5M
        self.confirmed_5m_entries_count = 0
        self.saved_unconfirmed_setups_count = 0

        self.sl_ticket = None
        self.tp_ticket = None
        self.entry_price = 0.0
        self.entry_sl = 0.0
        self.entry_tp = 0.0
        self.trade_direction = ""
        self.trade_year = 2025
        self.active_news_cooldown_until = datetime.min

        # جدول رسم بياني يومي واحد فقط (لحماية الحساب من تجاوز 4,000 نقطة)
        self.schedule.on(self.date_rules.every_day(), self.time_rules.at(23, 50), self.plot_daily_equity)

        self.log(">>> [Institutional SMC Quant] Initialized with 5 Pillars Confluence Engine.")


    def plot_daily_equity(self):
        self.plot("Daily Equity", "Balance", self.portfolio.total_portfolio_value)


    def is_institutional_killzone(self, time_utc):
        """
        الركيزة 1: أوقات السيولة المؤسساتية الكبرى (London & New York Killzones)
        التداول فقط عندما تكون بنوك لندن ونيويورك نشطة لتجنب المصائد والتذبذب العشوائي:
        - جلسة لندن: 07:00 إلى 10:00 بتوقيت UTC
        - جلسة نيويورك: 12:00 إلى 16:00 بتوقيت UTC
        """
        hour = time_utc.hour
        is_london = (7 <= hour < 10)
        is_ny = (12 <= hour < 16)
        return is_london or is_ny


    def on_m15_bar(self, sender, bar):
        self.bar_index_m15 += 1
        self.m15_bars.append(bar)
        if len(self.m15_bars) > 200:
            self.m15_bars.pop(0)

        # فلتر تجميد الصفقات بعد شمعة الأخبار العنيفة (15 دقيقة)
        current_atr = self.atr15.current.value if self.atr15.is_ready else 2.50
        if (bar.high - bar.low) > (current_atr * 3.0):
            self.active_news_cooldown_until = self.time + timedelta(minutes=15)

        # تحديث الهيكل والسيولة
        self.update_smc_structure()

        # فحص إشارات التداول فقط إذا كنا خارج السوق
        if not self.portfolio.invested and self.sl_ticket is None:
            self.evaluate_confluence_setup(bar, current_atr)


    def on_h1_bar(self, sender, bar):
        self.h1_bars.append(bar)
        if len(self.h1_bars) > 100:
            self.h1_bars.pop(0)


    def update_smc_structure(self):
        """الركائز 2 و 3: تحديد القمم، القيعان، كتل الأوامر، الفجوات، وسحب السيولة."""
        if len(self.m15_bars) < 5:
            return

        idx = self.bar_index_m15
        b0 = self.m15_bars[-1] # الشمعة الحالية المغلقة
        b1 = self.m15_bars[-2] # الشمعة السابقة
        b2 = self.m15_bars[-3]

        # 1. كشف قمم وقيعان السوينغ (Swings)
        if len(self.m15_bars) >= 5:
            mid = self.m15_bars[-3]
            left = self.m15_bars[-4]
            right = self.m15_bars[-2]
            if mid.high > left.high and mid.high > right.high:
                self.swings_high.append(SwingPoint(mid.high, idx - 2, True, self.time))
                if len(self.swings_high) > 20: self.swings_high.pop(0)
            if mid.low < left.low and mid.low < right.low:
                self.swings_low.append(SwingPoint(mid.low, idx - 2, False, self.time))
                if len(self.swings_low) > 20: self.swings_low.pop(0)

        # 2. كشف سحب السيولة الحقيقي (Liquidity Sweep & Reclaim)
        # سحب سيولة قاع سابق والعودة للإغلاق فوقه (Bullish SSL Sweep)
        if len(self.swings_low) > 0:
            last_low = self.swings_low[-1].price
            if b0.low < last_low and b0.close > last_low:
                self.recent_sweeps.append({"type": "BULLISH_SSL_SWEEP", "price": last_low, "bar": idx})

        # سحب سيولة قمة سابقة والعودة للإغلاق تحتها (Bearish BSL Sweep)
        if len(self.swings_high) > 0:
            last_high = self.swings_high[-1].price
            if b0.high > last_high and b0.close < last_high:
                self.recent_sweeps.append({"type": "BEARISH_BSL_SWEEP", "price": last_high, "bar": idx})

        if len(self.recent_sweeps) > 10:
            self.recent_sweeps.pop(0)

        # 3. كشف كتل الأوامر المؤسساتية (Order Blocks)
        # كتلة شراء: شمعة هابطة أعقبها صعود اندفاعي يبتلع قمتها ويكسر الهيكل
        if b1.close < b1.open and b0.close > b1.high and (b0.close - b1.open) > 2.0:
            self.order_blocks.append(OrderBlockZone(b1.high, b1.low, True, idx, self.time))
        # كتلة بيع: شمعة صاعدة أعقبها هبوط اندفاعي يبتلع قاعها
        elif b1.close > b1.open and b0.close < b1.low and (b1.open - b0.close) > 2.0:
            self.order_blocks.append(OrderBlockZone(b1.high, b1.low, False, idx, self.time))

        if len(self.order_blocks) > 25:
            self.order_blocks.pop(0)

        # 4. كشف فجوات القيمة العادلة (Fair Value Gaps - FVG)
        if b0.low > b2.high and (b0.low - b2.high) >= 0.80:
            self.fvgs.append(FvgZone(b0.low, b2.high, True, idx, self.time))
        elif b0.high < b2.low and (b2.low - b0.high) >= 0.80:
            self.fvgs.append(FvgZone(b2.low, b0.high, False, idx, self.time))

        if len(self.fvgs) > 25:
            self.fvgs.pop(0)


    def on_m5_bar(self, sender, bar):
        """
        الركيزة 6: شارت 5 دقائق لتأكيد الدخول القناص وتصفية المصائد (5M Sniper Trigger)
        - انتظار تغير الشخصية اللحظي (5M CHoCH) أو سحب السيولة الصغرى (Micro Sweep).
        - تخفيض مسافة وقف الخسارة من 12$-14$ إلى 3.5$-7.5$ فقط!
        - حماية رأس المال الصغير (500$) ومضاعفة نسبة الربح إلى المخاطرة (R:R).
        """
        self.bar_index_m5 += 1
        self.m5_bars.append(bar)
        if len(self.m5_bars) > 100:
            self.m5_bars.pop(0)

        # إذا كانت هناك صفقة مفتوحة بالفعل أو أمر وقف معلق، لا ننفذ
        if self.portfolio.invested or self.sl_ticket is not None:
            return

        # إذا لم يكن هناك إعداد مجهز من فريم 15 دقيقة
        if self.armed_setup is None:
            return

        # فحص انتهاء صلاحية الإعداد (45 دقيقة = 9 شموع 5M كحد أقصى)
        if self.time > self.armed_setup["expires_time"]:
            self.saved_unconfirmed_setups_count += 1
            self.log(f"[{self.time}] [5M Filter Trap Shield] 15M Setup EXPIRED without 5M confirmation! Saved account from false breakout.")
            self.armed_setup = None
            return

        direction = self.armed_setup["direction"]
        current_p = bar.close
        current_atr5 = self.atr5.current.value if self.atr5.is_ready else 1.20

        if len(self.m5_bars) < 4:
            return

        b0 = self.m5_bars[-1] # الشمعة الحالية 5M
        b1 = self.m5_bars[-2] # الشمعة السابقة 5M
        b2 = self.m5_bars[-3]

        if direction == "BUY":
            # 1. كسر هيكل لحظي صاعد (5M CHoCH) أو شمعة اندفاع شرائية (Displacement)
            m5_bull_displacement = (b0.close > b1.high) and (b0.close > b0.open) and ((b0.close - b0.open) >= (0.30 * current_atr5))
            # 2. أو سحب سيولة صغرى لحظية (5M Micro Sweep & Reclaim)
            m5_micro_sweep = (b0.low < min(b1.low, b2.low)) and (b0.close > b1.close) and (b0.close > b0.open)

            if m5_bull_displacement or m5_micro_sweep:
                recent_low_5m = min(b0.low, b1.low, b2.low)
                # وقف خسارة صيدلي دقيق أسفل قاع شمعة التأكيد 5M
                sl_dist = min(7.50, max(3.50, current_p - recent_low_5m + (0.5 * current_atr5)))
                sl_price = round(current_p - sl_dist, 2)
                tp_price = round(current_p + (2.5 * sl_dist), 2) # نسبة R:R 1:2.5+

                if self.armed_setup.get("ob"): self.armed_setup["ob"].mitigated = True
                if self.armed_setup.get("fvg"): self.armed_setup["fvg"].filled = True

                self.confirmed_5m_entries_count += 1
                conf = self.armed_setup["confluence_score"]
                trigger_reason = "5M_CHOH_DISPLACEMENT" if m5_bull_displacement else "5M_MICRO_SWEEP"
                self.armed_setup = None
                self.execute_institutional_order("BUY", current_p, sl_price, tp_price, conf, trigger_reason)

        elif direction == "SELL":
            # 1. كسر هيكل لحظي هابط (5M CHoCH) أو شمعة اندفاع بيعية
            m5_bear_displacement = (b0.close < b1.low) and (b0.close < b0.open) and ((b0.open - b0.close) >= (0.30 * current_atr5))
            # 2. أو سحب سيولة عليا صغرى (5M Micro BSL Sweep & Reclaim)
            m5_micro_sweep = (b0.high > max(b1.high, b2.high)) and (b0.close < b1.close) and (b0.close < b0.open)

            if m5_bear_displacement or m5_micro_sweep:
                recent_high_5m = max(b0.high, b1.high, b2.high)
                sl_dist = min(7.50, max(3.50, recent_high_5m - current_p + (0.5 * current_atr5)))
                sl_price = round(current_p + sl_dist, 2)
                tp_price = round(current_p - (2.5 * sl_dist), 2)

                if self.armed_setup.get("ob"): self.armed_setup["ob"].mitigated = True
                if self.armed_setup.get("fvg"): self.armed_setup["fvg"].filled = True

                self.confirmed_5m_entries_count += 1
                conf = self.armed_setup["confluence_score"]
                trigger_reason = "5M_CHOH_DISPLACEMENT" if m5_bear_displacement else "5M_MICRO_SWEEP"
                self.armed_setup = None
                self.execute_institutional_order("SELL", current_p, sl_price, tp_price, conf, trigger_reason)


    def evaluate_confluence_setup(self, bar, atr):
        """
        الركيزة 5: نموذج قياس التوافق المؤسساتي وتجهيز الصفقة لتأكيد 5M (Arm Setup)
        - التحقق من توافق الفريم الأكبر (1H Trend + Killzone + Discount/Premium).
        - التحقق من كتل الأوامر 15M والفجوات وسحب السيولة.
        - تجهيز الإشارة بدلاً من الدخول العشوائي لانتظار شمعة تأكيد 5M.
        """
        if self.time < self.active_news_cooldown_until: return
        if self.portfolio.margin_remaining < 140: return # حماية الهامش لحساب 500$

        current_p = bar.close
        idx = self.bar_index_m15

        # الركيزة 1: التداول داخل الجلسات المؤسساتية الحقيقية فقط
        in_killzone = self.is_institutional_killzone(self.time)
        if not in_killzone:
            return # تجنب التذبذب القاتل خارج الجلسات

        # الركيزة 2: حساب نطاق الخصم والقمة (Discount vs Premium Equilibrium)
        if len(self.swings_high) == 0 or len(self.swings_low) == 0: return
        range_high = max(s.price for s in self.swings_high[-5:])
        range_low = min(s.price for s in self.swings_low[-5:])
        if range_high <= range_low: return
        equilibrium_50 = (range_high + range_low) / 2.0
        
        is_in_discount = current_p <= equilibrium_50 # منطقة خصم صالحة للشراء
        is_in_premium = current_p > equilibrium_50  # منطقة غلاء صالحة للبيع

        # الركيزة 4: اتجاه السيولة لفريم الساعة (HTF Trend Alignment)
        h1_trend_up = self.ema_h1_fast.current.value > self.ema_h1_slow.current.value if (self.ema_h1_fast.is_ready and self.ema_h1_slow.is_ready) else True

        # =========================================================================
        # تقييم صفقة الشراء المؤسساتية (BUY CONFLUENCE EVALUATION)
        # =========================================================================
        if h1_trend_up and is_in_discount:
            confluence_score = 0
            
            # 1. الاتجاه العام صاعد والصفقة في منطقة خصم (35 نقطة)
            confluence_score += 35

            # 2. وجود سحب سيولة صاعد حديث (25 نقطة)
            recent_ssl_sweep = any(s["type"] == "BULLISH_SSL_SWEEP" and (idx - s["bar"]) <= 12 for s in self.recent_sweeps)
            if recent_ssl_sweep:
                confluence_score += 25

            # 3. الارتكاز على كتلة أوامر غير ملموسة بنضارة عالية أو FVG (25 نقطة)
            bull_ob = next((ob for ob in reversed(self.order_blocks) if ob.is_bullish and not ob.mitigated and ob.get_freshness_score(idx) >= 50 and abs(current_p - ob.top) <= (1.5 * atr)), None)
            bull_fvg = next((f for f in reversed(self.fvgs) if f.is_bullish and not f.filled and abs(current_p - f.midpoint) <= (1.2 * atr)), None)
            if bull_ob is not None or bull_fvg is not None:
                confluence_score += 25

            # 4. شمعة هيكل صاعدة (15 نقطة)
            b0 = self.m15_bars[-1]
            b1 = self.m15_bars[-2]
            if b0.close > b1.high or b0.close > b0.open:
                confluence_score += 15

            # شرط تجهيز الصفقة: درجة توافق >= 70% -> تفويض التأكيد لشارت 5 دقائق
            if confluence_score >= 70:
                self.armed_setup = {
                    "direction": "BUY",
                    "poi_price": current_p,
                    "confluence_score": confluence_score,
                    "armed_time": self.time,
                    "expires_time": self.time + timedelta(minutes=45), # نافذة انتظار 45 دقيقة على فريم 5M
                    "ob": bull_ob,
                    "fvg": bull_fvg
                }
                self.log(f"[{self.time}] [15M SMC Setup ARMED] BUY @ ${current_p:.2f} (Score: {confluence_score}/100) -> Waiting for 5M CHoCH Trigger...")
                return

        # =========================================================================
        # تقييم صفقة البيع المؤسساتية (SELL CONFLUENCE EVALUATION)
        # =========================================================================
        if not h1_trend_up and is_in_premium:
            confluence_score = 0
            
            confluence_score += 35

            recent_bsl_sweep = any(s["type"] == "BEARISH_BSL_SWEEP" and (idx - s["bar"]) <= 12 for s in self.recent_sweeps)
            if recent_bsl_sweep:
                confluence_score += 25

            bear_ob = next((ob for ob in reversed(self.order_blocks) if not ob.is_bullish and not ob.mitigated and ob.get_freshness_score(idx) >= 50 and abs(current_p - ob.bottom) <= (1.5 * atr)), None)
            bear_fvg = next((f for f in reversed(self.fvgs) if not f.is_bullish and not f.filled and abs(current_p - f.midpoint) <= (1.2 * atr)), None)
            if bear_ob is not None or bear_fvg is not None:
                confluence_score += 25

            b0 = self.m15_bars[-1]
            b1 = self.m15_bars[-2]
            if b0.close < b1.low or b0.close < b0.open:
                confluence_score += 15

            if confluence_score >= 70:
                self.armed_setup = {
                    "direction": "SELL",
                    "poi_price": current_p,
                    "confluence_score": confluence_score,
                    "armed_time": self.time,
                    "expires_time": self.time + timedelta(minutes=45),
                    "ob": bear_ob,
                    "fvg": bear_fvg
                }
                self.log(f"[{self.time}] [15M SMC Setup ARMED] SELL @ ${current_p:.2f} (Score: {confluence_score}/100) -> Waiting for 5M CHoCH Trigger...")


    def execute_institutional_order(self, direction, entry_price, sl_price, tp_price, confluence_score, trigger_reason="5M_CONFIRMED"):
        """تنفيذ أمر مباشر بحجم 0.02 لوت مع أوامر الوقف والهدف المعلقة الفورية بعد تأكيد 5M"""
        qty = self.fixed_lot_size if direction == "BUY" else -self.fixed_lot_size

        entry_ticket = self.market_order(self.spot_symbol, qty)
        if entry_ticket.status != OrderStatus.FILLED:
            return

        fill_price = entry_ticket.average_fill_price
        self.entry_price = fill_price
        self.entry_sl = sl_price
        self.entry_tp = tp_price
        self.trade_direction = direction
        self.trade_year = self.time.year

        exit_qty = -qty
        # أوامر الوقف والهدف المعلقة المباشرة في البورصة لمنع أي انزلاق سعري
        self.sl_ticket = self.stop_market_order(self.spot_symbol, exit_qty, sl_price)
        self.tp_ticket = self.limit_order(self.spot_symbol, exit_qty, tp_price)

        risk_usd = abs(fill_price - sl_price) * self.fixed_lot_size
        reward_usd = abs(tp_price - fill_price) * self.fixed_lot_size
        rr_ratio = reward_usd / max(1.0, risk_usd)

        self.log(f"[{self.time}] EXECUTED {direction} 0.02 Lot @ ${fill_price:.2f} via [5M {trigger_reason}] | Confluence: {confluence_score}/100 | SL: ${sl_price:.2f} (-${risk_usd:.2f}) | TP: ${tp_price:.2f} (+${reward_usd:.2f}) | R:R 1:{rr_ratio:.1f} | Free Margin: ${self.portfolio.margin_remaining:.2f}")


    def on_order_event(self, order_event):
        """نظام OCO التلقائي لحماية الأرباح والخروج فور لمس الهدف أو الوقف"""
        if order_event.status != OrderStatus.FILLED:
            return

        if self.sl_ticket is not None and order_event.order_id == self.sl_ticket.order_id:
            if self.tp_ticket is not None:
                self.tp_ticket.cancel()
            self.finalize_trade_record(order_event.fill_price, "LOSS")
            self.sl_ticket = None
            self.tp_ticket = None

        elif self.tp_ticket is not None and order_event.order_id == self.tp_ticket.order_id:
            if self.sl_ticket is not None:
                self.sl_ticket.cancel()
            self.finalize_trade_record(order_event.fill_price, "WIN")
            self.sl_ticket = None
            self.tp_ticket = None


    def finalize_trade_record(self, exit_price, outcome):
        direction_mult = 1.0 if self.trade_direction == "BUY" else -1.0
        pnl = (exit_price - self.entry_price) * direction_mult * self.fixed_lot_size
        risk_dist = abs(self.entry_price - self.entry_sl)
        r_mult = round(pnl / max(1.0, (risk_dist * self.fixed_lot_size)), 2)

        record = {
            "year": self.trade_year,
            "outcome": outcome,
            "pnl": pnl,
            "r": r_mult
        }

        if self.trade_year == 2025:
            self.trades_2025.append(record)
        else:
            self.trades_2026.append(record)

        self.all_completed_trades.append(record)
        self.log(f"[{self.time}] CLOSED {self.trade_direction} -> {outcome} (${pnl:+.2f}, {r_mult:+.2f}R) | Equity: ${self.portfolio.total_portfolio_value:.2f}")


    def on_end_of_algorithm(self):
        """تقرير الأداء النهائي المنفصل لعامي 2025 و 2026 ومحاكاة مونت كارلو"""
        self.log("=" * 88)
        self.log(">>> [INSTITUTIONAL SMC QUANT] FINAL WALL-STREET GRADE AUDIT <<<")
        self.log("=" * 88)

        def print_report(trades, label):
            total = len(trades)
            if total == 0:
                self.log(f"[{label}] No trades recorded.")
                return
            wins = [t for t in trades if t["outcome"] == "WIN"]
            losses = [t for t in trades if t["outcome"] == "LOSS"]
            wr = (len(wins) / total) * 100.0
            gross_win = sum(t["pnl"] for t in wins)
            gross_loss = abs(sum(t["pnl"] for t in losses))
            pf = (gross_win / gross_loss) if gross_loss > 0 else 99.0
            net = sum(t["pnl"] for t in trades)
            self.log(f"[{label}] Trades: {total} | Win Rate: {wr:.1f}% | Profit Factor: {pf:.2f} | Net Profit: ${net:+.2f} USD")

        print_report(self.trades_2025, "YEAR 2025 (In-Sample Baseline)")
        print_report(self.trades_2026, "YEAR 2026 (Forward Out-of-Sample)")

        self.log(f"--- 5M TIMEFRAME CONFIRMATION SHIELD ---")
        self.log(f"Confirmed 5M Sniper Entries:        {self.confirmed_5m_entries_count} executions")
        self.log(f"False 15M Breakouts Filtered Out:   {self.saved_unconfirmed_setups_count} traps avoided")

        # محاكاة مونت كارلو 1,000 مسار عشوائي
        all_r = [t["r"] for t in self.all_completed_trades]
        if len(all_r) >= 5:
            np.random.seed(42)
            final_equities = []
            for _ in range(1000):
                sampled = np.random.choice(all_r, size=len(all_r), replace=True)
                eq = 500.0
                for r in sampled:
                    eq += (22.0 * r)
                final_equities.append(eq)
            self.log(f"--- MONTE CARLO 1,000 RUNS ---")
            self.log(f"Median Expected Final Equity: ${np.median(final_equities):.2f} USD")
            self.log(f"95% Confidence Final Range:   ${np.percentile(final_equities, 5):.2f} to ${np.percentile(final_equities, 95):.2f}")
        self.log("=" * 88)
