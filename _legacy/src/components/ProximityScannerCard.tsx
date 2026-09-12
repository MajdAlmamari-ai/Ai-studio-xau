import React, { useState } from 'react';
import { Radar, Bell, CheckCircle2, AlertCircle, RefreshCw, Send, Radio } from 'lucide-react';
import { ProximityAlert, OrderBlockDetail, FairValueGap } from '../types';
import { scanProximityAlerts } from '../services/proximityScannerService';

interface ProximityScannerCardProps {
  currentPrice: number;
  orderBlocks: OrderBlockDetail[];
  fvgs: FairValueGap[];
  onDispatchAlert?: (message: string) => void;
}

export const ProximityScannerCard: React.FC<ProximityScannerCardProps> = ({
  currentPrice,
  orderBlocks,
  fvgs,
  onDispatchAlert,
}) => {
  const [alerts, setAlerts] = useState<ProximityAlert[]>(() => 
    scanProximityAlerts(currentPrice, orderBlocks, fvgs)
  );
  const [isScanning, setIsScanning] = useState(false);
  const [sentAlertId, setSentAlertId] = useState<string | null>(null);

  const handleManualScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      const results = scanProximityAlerts(currentPrice, orderBlocks, fvgs);
      setAlerts(results);
      setIsScanning(false);
    }, 600);
  };

  const handleSendToTelegram = (alert: ProximityAlert) => {
    if (onDispatchAlert) {
      onDispatchAlert(alert.messageAr);
      setSentAlertId(alert.id);
      setTimeout(() => setSentAlertId(null), 3000);
    }
  };

  return (
    <div className="bg-[#10131A] border border-[#1E2330] rounded-xl p-5 shadow-lg space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1E2330] pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Radar className="w-5 h-5 animate-spin-slow" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              نظام الإنذار المبكر والماسح الضوئي اللحظي (Proximity Scanner)
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span>
                مراقبة حية (15M / 1H)
              </span>
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              تنبيه فوري تلقائي في اللحظة التي يقترب فيها السعر بمسافة أقل من 2 دولار (≤ $2.0) من منطقة OB + FVG
            </p>
          </div>
        </div>

        <button
          onClick={handleManualScan}
          disabled={isScanning}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#181D29] hover:bg-[#222838] border border-gray-700 text-xs font-medium text-gray-200 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
          <span>مسح لحظي الآن</span>
        </button>
      </div>

      {/* Trigger Logic Banner */}
      <div className="bg-[#141926] border border-cyan-500/20 rounded-lg p-3.5 flex items-start gap-3">
        <Radio className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
        <div className="text-xs text-gray-300 leading-relaxed">
          <span className="font-semibold text-cyan-300">آلية عمل الماسح: </span>
          يتحقق الرادار من بعد السعر الحالي عن نقطة التوازن (Equilibrium / CE) لكافة كتل الطلب والعرض. إذا كانت المسافة <span className="text-amber-300 font-bold">≤ 2.0$</span> يُطلق إشعار <span className="text-amber-400 font-semibold">"اقتراب فرصة: انتظر تأكيد 5 دقائق"</span>، وعند التلامس مع تحقق Confluence يُرسل <span className="text-emerald-400 font-semibold">"التوصية النهائية"</span>.
        </div>
      </div>

      {/* Active Alerts List */}
      <div className="space-y-3">
        {alerts.map((alert) => {
          const isReady = alert.status === 'CONFLUENCE_READY';
          const isWarning = alert.status === 'EARLY_WARNING';

          return (
            <div
              key={alert.id}
              className={`p-4 rounded-xl border transition-all ${
                isReady
                  ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200'
                  : isWarning
                  ? 'bg-amber-950/20 border-amber-500/30 text-amber-200'
                  : 'bg-[#151923] border-[#222838] text-gray-300'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className={`p-1.5 rounded-lg ${isReady ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                    <Bell className="w-4 h-4" />
                  </span>
                  <span className="font-bold text-white text-xs">{alert.levelName}</span>
                  <span className="text-[11px] px-2 py-0.5 rounded font-mono font-bold bg-[#1C2230] text-cyan-300">
                    المسافة: ${alert.distanceToPrice}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-400 font-mono">{alert.timestamp}</span>
                  <button
                    onClick={() => handleSendToTelegram(alert)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#1F2738] hover:bg-[#2A344A] border border-cyan-500/30 text-cyan-300 text-[11px] font-semibold transition"
                  >
                    <Send className="w-3 h-3" />
                    <span>{sentAlertId === alert.id ? 'تم الإرسال لتيليجرام!' : 'بث التنبيه'}</span>
                  </button>
                </div>
              </div>

              <p className="text-xs leading-relaxed text-gray-200">
                {alert.messageAr}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
