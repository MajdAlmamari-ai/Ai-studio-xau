import React from 'react';
import { 
  Play, 
  RotateCw, 
  Terminal, 
  CheckCircle2, 
  Clock, 
  Radio, 
  Cpu, 
  Send, 
  FileText,
  ShieldCheck,
  ShieldAlert,
  AlertOctagon,
  Lock,
  Activity,
  ZapOff,
  Server,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { ExecutionLog } from '../types';
import { useSafeguards } from '../hooks/useSafeguards';
import { useServerStatus } from '../hooks/useServerStatus';

interface ExecutionConsoleProps {
  logs: ExecutionLog[];
  isTriggering: boolean;
  onTriggerCycle: () => void;
  nextCycleSeconds: number;
}

export const ExecutionConsole: React.FC<ExecutionConsoleProps> = ({
  logs,
  isTriggering,
  onTriggerCycle,
  nextCycleSeconds,
}) => {
  const { status, isToggling, toggleEmergencyKillSwitch } = useSafeguards();
  const { status: serverStatus, isOnline: isServerOnline, toggleServerScheduler } = useServerStatus();

  const killSwitchActive = status?.activeSafeguards?.emergencyKillSwitch ?? false;
  const circuitBreakerActive = status?.circuitBreaker?.isCircuitActive ?? false;
  const circuitReason = status?.circuitBreaker?.reason ?? 'أنظمة الحماية الذكية تعمل بكفاءة تامة';
  const maxSpreadThresholdUsd = status?.activeSafeguards?.maxSpreadThresholdUsd ?? 3.50;
  const newsBlackoutMinutes = status?.activeSafeguards?.newsBlackoutMinutes ?? 15;
  const riskRewardMinRatio = status?.activeSafeguards?.riskRewardMinRatio ?? 2.0;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}د ${s < 10 ? '0' : ''}${s}ث`;
  };

  const steps = [
    {
      num: 1,
      title: 'المرحلة 1: جلب بيانات السوق والفيوتشرز',
      desc: 'استيقاظ الخادم عبر مشغل Cron كل 15 دقيقة، وجلب السعر الفوري والعقود الآجلة عبر واجهات برمجة التطبيقات مع نظام احتياطي.',
      icon: Radio,
    },
    {
      num: 2,
      title: 'المرحلة 2: التحليل الهيكلي ومناطق السيولة',
      desc: 'حساب اتجاه السوق المؤسساتي ومصائد سيولة الشراء BSL وسيولة البيع SSL ورصد كتل الأوامر وفجوات القيمة FVG بدقة.',
      icon: Cpu,
    },
    {
      num: 3,
      title: 'المرحلة 3: توليد التوصية ونموذج ML',
      desc: 'تحديد نقطة الدخول ووقف الخسارة وجني الأرباح ونسبة العائد للمخاطرة 1:2+ وتوقع نموذج الذكاء الاصطناعي XGBoost.',
      icon: FileText,
    },
    {
      num: 4,
      title: 'المرحلة 4: البث الآلي إلى تيليجرام',
      desc: 'تنسيق الإشارة بترميز HTML المعتمد وإرسالها فورياً إلى قناة تيليجرام أو المجموعة الخاصة للمشتركين.',
      icon: Send,
    },
  ];

  return (
    <div className="space-y-4 font-mono">
      
      {/* 4-Step Technical Workflow Pipeline */}
      <div className="bg-[#12141B] border border-[#1A1D26] rounded-xl p-4 sm:p-5 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-[#1A1D26]">
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2 font-sans">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>خط أنابيب التشغيل الآلي لدورة الـ 15 دقيقة المؤسساتية</span>
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5 font-sans">
              دورة التشغيل السحابي المؤتمتة عبر خادم الباك إند و GitHub Actions
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="px-3 py-1 rounded-lg bg-[#0A0C10] border border-[#1A1D26] text-xs font-mono text-zinc-300">
              موعد الدورة القادمة: <strong className="text-amber-400">{formatTime(nextCycleSeconds)}</strong>
            </div>
            <button
              id="manual-trigger-run-btn"
              onClick={onTriggerCycle}
              disabled={isTriggering}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs transition active:scale-95 disabled:opacity-50 font-sans shadow-md"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isTriggering ? 'animate-spin' : ''}`} />
              <span>{isTriggering ? 'جاري التشغيل...' : 'تشغيل يدوي فوري للدورة'}</span>
            </button>
          </div>
        </div>

        {/* Step Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 font-sans">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.num}
                className="bg-[#0A0C10] p-3.5 rounded-xl border border-[#1A1D26] flex flex-col justify-between space-y-2.5 hover:border-zinc-700 transition"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="w-6 h-6 rounded-md bg-amber-400/10 text-amber-400 border border-amber-400/30 flex items-center justify-center font-bold text-xs font-mono">
                      0{step.num}
                    </span>
                    <Icon className="w-4 h-4 text-zinc-400" />
                  </div>
                  <h4 className="text-xs font-bold text-white">{step.title}</h4>
                  <p className="text-xs leading-relaxed text-zinc-400 mt-1">
                    {step.desc}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono pt-2 border-t border-[#1A1D26]">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>نشط ومفعل 100%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Institutional Safe Architecture & Risk Management Shield */}
      <div className={`border rounded-xl p-4 sm:p-5 shadow-lg transition-colors duration-300 ${
        killSwitchActive 
          ? 'bg-rose-950/30 border-rose-600/50' 
          : 'bg-[#12141B] border-[#1A1D26]'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-[#1A1D26]">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
              killSwitchActive 
                ? 'bg-rose-500/20 border-rose-500 text-rose-400' 
                : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
            }`}>
              {killSwitchActive ? <ShieldAlert className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2 font-sans">
                <span>هندسة الأمان المؤسساتية وإدارة المخاطر (Safe Architecture Shield)</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                  killSwitchActive 
                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/30 animate-pulse' 
                    : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                }`}>
                  {killSwitchActive ? '⚠️ التداول موقوف طارئاً' : '🛡️ الحماية نشطة 100%'}
                </span>
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5 font-sans">
                قواطع دوائر الحماية التلقائية وفلاتر تقلبات الأخبار والسبريد لمنع استنزاف الحصص وحماية رأس المال
              </p>
            </div>
          </div>

          <button
            id="emergency-kill-switch-btn"
            onClick={toggleEmergencyKillSwitch}
            disabled={isToggling}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold font-sans transition shadow-md active:scale-95 disabled:opacity-50 ${
              killSwitchActive 
                ? 'bg-emerald-500 hover:bg-emerald-400 text-black' 
                : 'bg-rose-600 hover:bg-rose-500 text-white'
            }`}
          >
            {killSwitchActive ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>إلغاء الإيقاف واستئناف التداول الآمن</span>
              </>
            ) : (
              <>
                <AlertOctagon className="w-4 h-4" />
                <span>قاطع التداول الطارئ (Emergency Kill-Switch)</span>
              </>
            )}
          </button>
        </div>

        {/* Safeguard Grid Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-sans">
          <div className="bg-[#0A0C10] p-3 rounded-lg border border-[#1A1D26]">
            <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
              <span>قاطع الدوائر الذكي (Circuit Breaker)</span>
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="text-xs font-bold text-white font-mono flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${circuitBreakerActive ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'}`} />
              <span>{circuitBreakerActive ? 'مفعل مؤقتاً (حماية الحصص)' : 'جاهز وحاسم (Auto-Failover)'}</span>
            </div>
            <p className="text-[10px] text-zinc-500 mt-1">
              {circuitReason}
            </p>
          </div>

          <div className="bg-[#0A0C10] p-3 rounded-lg border border-[#1A1D26]">
            <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
              <span>أقصى انزلاق للسبريد (Max Spread Guard)</span>
              <Lock className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-xs font-bold text-amber-400 font-mono">
              ${maxSpreadThresholdUsd.toFixed(2)} USD
            </div>
            <p className="text-[10px] text-zinc-500 mt-1">
              حظر التوصيات تلقائياً إذا اتسع فرق الأساس بين Spot و GC
            </p>
          </div>

          <div className="bg-[#0A0C10] p-3 rounded-lg border border-[#1A1D26]">
            <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
              <span>نافذة التعتيم الإخباري (News Blackout)</span>
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <div className="text-xs font-bold text-indigo-400 font-mono">
              {newsBlackoutMinutes} دقيقة بعد الخبر
            </div>
            <p className="text-[10px] text-zinc-500 mt-1">
              قاعدة الـ 15 دقيقة لمنع الوقوع في فخ التحرك الأولي لـ CPI/NFP
            </p>
          </div>

          <div className="bg-[#0A0C10] p-3 rounded-lg border border-[#1A1D26]">
            <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
              <span>أدنى عائد للمخاطرة (R:R Floor)</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-xs font-bold text-emerald-400 font-mono">
              1:{riskRewardMinRatio.toFixed(1)} كحد أدنى
            </div>
            <p className="text-[10px] text-zinc-500 mt-1">
              استبعاد وإلغاء أي صفقة لا تحقق ضعف وقف الخسارة المحمي
            </p>
          </div>
        </div>
      </div>

      {/* Backend Institutional Server & Scheduler Telemetry */}
      <div className="bg-[#12141B] border border-[#1A1D26] rounded-xl p-4 sm:p-5 shadow-lg space-y-3 font-sans">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#1A1D26]">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-cyan-400" />
            <h4 className="text-xs sm:text-sm font-bold text-white">
              محرك الخادم المؤسساتي المستقل (Full-Stack Backend Services)
            </h4>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
              isServerOnline
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
            }`}>
              {isServerOnline ? '● متصل ومستقر (Online)' : '○ غير متاح'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleServerScheduler(serverStatus?.scheduler?.isSchedulerRunning ? 'stop' : 'start')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition border ${
                serverStatus?.scheduler?.isSchedulerRunning
                  ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700'
              }`}
            >
              {serverStatus?.scheduler?.isSchedulerRunning ? (
                <>
                  <ToggleRight className="w-4 h-4 text-emerald-400" />
                  <span>جدولة السيرفر: تعمل تلقائياً</span>
                </>
              ) : (
                <>
                  <ToggleLeft className="w-4 h-4 text-zinc-400" />
                  <span>جدولة السيرفر: متوقفة</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
          <div className="bg-[#0A0C10] p-2.5 rounded-lg border border-[#1A1D26]">
            <span className="text-[10px] text-zinc-400 block mb-0.5 font-sans">جدولة الـ 15 دقيقة السحابية:</span>
            <span className="font-bold text-cyan-400">
              {serverStatus?.scheduler?.isSchedulerRunning ? 'نشطة سحابياً ⏱️' : 'متوقفة مؤقتاً'}
            </span>
          </div>
          <div className="bg-[#0A0C10] p-2.5 rounded-lg border border-[#1A1D26]">
            <span className="text-[10px] text-zinc-400 block mb-0.5 font-sans">الدورات المنفذة بالخادم:</span>
            <span className="font-bold text-white">
              {serverStatus?.scheduler?.totalCyclesCompleted ?? 0} دورات مؤسساتية
            </span>
          </div>
          <div className="bg-[#0A0C10] p-2.5 rounded-lg border border-[#1A1D26]">
            <span className="text-[10px] text-zinc-400 block mb-0.5 font-sans">استهلاك الذاكرة والـ Node:</span>
            <span className="font-bold text-amber-300">
              {serverStatus?.memoryUsageMb ?? 0} MB ({serverStatus?.nodeVersion ?? 'Node.js'})
            </span>
          </div>
          <div className="bg-[#0A0C10] p-2.5 rounded-lg border border-[#1A1D26]">
            <span className="text-[10px] text-zinc-400 block mb-0.5 font-sans">وقت تشغيل الخادم (Uptime):</span>
            <span className="font-bold text-emerald-400">
              {Math.floor((serverStatus?.serverUptimeSeconds ?? 0) / 60)} دقيقة
            </span>
          </div>
        </div>
      </div>

      {/* Real-time Execution Log Console */}
      <div className="bg-[#12141B] border border-[#1A1D26] rounded-xl p-4 sm:p-5 shadow-lg space-y-3">
        <div className="flex items-center justify-between border-b border-[#1A1D26] pb-2 font-sans">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span>وحدة التحكم بسجلات الأحداث والأوامر المباشرة</span>
          </div>
          <span className="text-[10px] font-mono text-zinc-400 bg-[#0A0C10] px-2.5 py-0.5 rounded border border-[#1A1D26]">
            {logs.length} أحداث مسجلة
          </span>
        </div>

        <div className="bg-[#0A0C10] rounded-xl border border-[#1A1D26] p-3 font-mono text-xs text-zinc-300 max-h-64 overflow-y-auto space-y-2">
          {logs.length === 0 ? (
            <div className="text-zinc-600 text-center py-6 text-xs font-sans">
              لا توجد سجلات بعد. انقر فوق "تشغيل يدوي فوري للدورة" لبدء دورة التحليل الفوري.
            </div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="flex items-start gap-2.5 py-1 border-b border-[#1A1D26] last:border-0 text-xs">
                <span className="text-zinc-500 shrink-0 text-[10px]">{log.timestamp}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 border ${
                  log.status === 'success'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : log.status === 'warning'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    : log.status === 'error'
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                }`}>
                  [{log.step}]
                </span>
                <span className="text-zinc-300 leading-snug font-sans">{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
};
