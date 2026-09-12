import React, { useState, useEffect } from 'react';
import { 
  Database, 
  X, 
  Target, 
  ShieldAlert, 
  Scale, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight, 
  CheckCircle, 
  RefreshCw, 
  ExternalLink,
  Layers,
  Sparkles
} from 'lucide-react';
import { 
  FirestoreSignalRecord, 
  getRecentSignalsFromFirestore, 
  subscribeToSignals 
} from '../services/firestoreService';

interface SignalsArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPrice?: (price: number, label: string) => void;
}

export const SignalsArchiveModal: React.FC<SignalsArchiveModalProps> = ({
  isOpen,
  onClose,
  onSelectPrice,
}) => {
  const [signals, setSignals] = useState<FirestoreSignalRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'MITIGATED' | 'HIT_TP' | 'HIT_SL'>('ALL');

  useEffect(() => {
    if (!isOpen) return;

    setIsLoading(true);
    // Initial fetch
    getRecentSignalsFromFirestore(30)
      .then((records) => {
        setSignals(records);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));

    // Live subscription
    const unsubscribe = subscribeToSignals((updated) => {
      setSignals(updated);
      setIsLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredSignals = signals.filter((s) => {
    if (filter === 'ALL') return true;
    return s.status === filter;
  });

  const formatDate = (isoStr: string) => {
    if (!isoStr) return '---';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return String(isoStr);
      return d.toLocaleString('ar-EG', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return String(isoStr);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div 
        className="bg-[#0F1117] border border-[#1E2330] rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-sans text-right"
        dir="rtl"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#1E2330] flex items-center justify-between bg-[#141824]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white">
                  أرشيف إشارات صانع السوق السحابي (Firestore Persistence)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  مزامنة حية
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                سجل دائم ومستمر لجميع توصيات SMC المخزنة في قاعدة بيانات Firebase Firestore
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-[#1C2233] hover:bg-[#252D42] text-zinc-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters Bar */}
        <div className="px-4 sm:px-5 py-3 border-b border-[#1E2330] bg-[#0A0C10] flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-zinc-400 text-xs ml-1">تصفية الإشارات:</span>
            {(['ALL', 'ACTIVE', 'MITIGATED', 'HIT_TP'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  filter === status
                    ? 'bg-amber-400 text-black shadow'
                    : 'bg-[#141824] text-zinc-400 hover:text-white hover:bg-[#1E2330]'
                }`}
              >
                {status === 'ALL' && `الكل (${signals.length})`}
                {status === 'ACTIVE' && 'نشطة (ACTIVE)'}
                {status === 'MITIGATED' && 'مخففة (MITIGATED)'}
                {status === 'HIT_TP' && 'حققت الهدف (HIT_TP)'}
              </button>
            ))}
          </div>

          <div className="text-[11px] font-mono text-zinc-400 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>المجموعة السحابية: <strong className="text-zinc-200">/signals</strong></span>
          </div>
        </div>

        {/* Signals List Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1 scrollbar-thin">
          {isLoading ? (
            <div className="py-16 text-center text-zinc-400 space-y-3">
              <RefreshCw className="w-8 h-8 mx-auto animate-spin text-amber-400" />
              <p className="text-sm font-mono">جاري استرجاع الإشارات من Firebase Firestore...</p>
            </div>
          ) : filteredSignals.length === 0 ? (
            <div className="py-16 text-center text-zinc-500 space-y-2 border border-dashed border-[#1E2330] rounded-xl">
              <Database className="w-10 h-10 mx-auto text-zinc-600 mb-2" />
              <p className="text-sm font-semibold text-zinc-300">لا توجد إشارات مسجلة بعد في هذا التصنيف</p>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                يتم حفظ كل إشارة يتم بناؤها في دورة الـ 15 دقيقة تلقائياً في Firestore مع وقف الخسارة والأهداف.
              </p>
            </div>
          ) : (
            filteredSignals.map((signal) => {
              const isBuy = signal.action === 'BUY' || signal.bias === 'BULLISH';
              const isSell = signal.action === 'SELL' || signal.bias === 'BEARISH';

              return (
                <div
                  key={signal.id}
                  className="bg-[#12141C] border border-[#1E2330] hover:border-[#2C344A] rounded-xl p-4 transition shadow-sm space-y-3"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${
                        isBuy 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
                          : isSell 
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30' 
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      }`}>
                        {isBuy ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className={`text-sm font-black font-mono ${
                            isBuy ? 'text-emerald-400' : isSell ? 'text-rose-400' : 'text-amber-400'
                          }`}>
                            {signal.action || (isBuy ? 'شراء BUY' : 'بيع SELL')} XAU/USD
                          </h4>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1C2233] text-zinc-300 border border-[#252D42]">
                            توافق: {signal.confluenceScore}%
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                            {signal.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-400 flex items-center gap-2 mt-0.5">
                          <Calendar className="w-3 h-3 text-zinc-500" />
                          <span>{formatDate(signal.createdAt)}</span>
                          <span>•</span>
                          <span className="text-zinc-300">{signal.structure || 'كسر هيكل BOS'}</span>
                        </div>
                      </div>
                    </div>

                    {onSelectPrice && (
                      <button
                        onClick={() => {
                          onSelectPrice(signal.currentPrice, `إشارة سحابية: ${signal.action}`);
                          onClose();
                        }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#1A2030] hover:bg-amber-400 hover:text-black text-zinc-300 text-xs font-semibold transition"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>تطبيق السعر (${signal.currentPrice?.toFixed(2)})</span>
                      </button>
                    )}
                  </div>

                  {/* Execution Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[#1E2330] font-mono text-xs">
                    <div className="bg-[#0A0C10] p-2 rounded-lg border border-[#1A1D26]">
                      <span className="text-[10px] text-zinc-500 block">نطاق الدخول:</span>
                      <span className="font-bold text-sky-400 text-xs">
                        ${signal.entryMin?.toFixed(2)} - ${signal.entryMax?.toFixed(2)}
                      </span>
                    </div>

                    <div className="bg-[#0A0C10] p-2 rounded-lg border border-[#1A1D26]">
                      <span className="text-[10px] text-zinc-500 block">وقف الخسارة المحمي:</span>
                      <span className="font-bold text-rose-400 text-xs">
                        ${signal.stopLoss?.toFixed(2)}
                      </span>
                    </div>

                    <div className="bg-[#0A0C10] p-2 rounded-lg border border-[#1A1D26]">
                      <span className="text-[10px] text-zinc-500 block">الهدف الرئيسي (TP):</span>
                      <span className="font-bold text-emerald-400 text-xs">
                        ${signal.takeProfit?.toFixed(2)}
                      </span>
                    </div>

                    <div className="bg-[#0A0C10] p-2 rounded-lg border border-[#1A1D26]">
                      <span className="text-[10px] text-zinc-500 block">العائد للمخاطرة:</span>
                      <span className="font-bold text-amber-400 text-xs">
                        {signal.riskReward || `1:${signal.rrNumeric || 2.4}`}
                      </span>
                    </div>
                  </div>

                  {signal.reason && (
                    <p className="text-[11px] text-zinc-400 leading-relaxed font-sans bg-[#0E1118] p-2 rounded-lg border border-[#1A1D26]">
                      {signal.reason}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-[#1E2330] bg-[#141824] flex items-center justify-between text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>قاعدة البيانات: Google Firebase Firestore (حفظ دائم)</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#1E2330] hover:bg-[#2A3245] text-white font-semibold transition"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
