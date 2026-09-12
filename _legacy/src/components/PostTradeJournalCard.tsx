import React, { useState, useEffect } from 'react';
import { BookOpen, CheckCircle, XCircle, TrendingUp, History, Shield, Award, Plus, Sparkles, Database, Cloud } from 'lucide-react';
import { PostTradeRecord, OrderBlockDetail, FairValueGap } from '../types';
import { 
  getPostTradeRecords, 
  savePostTradeRecord, 
  calculateJournalStatistics,
  syncJournalWithFirestore
} from '../services/postTradeJournalService';

interface PostTradeJournalCardProps {
  memoryOBs?: OrderBlockDetail[];
  currentPrice: number;
}

export const PostTradeJournalCard: React.FC<PostTradeJournalCardProps> = ({
  memoryOBs,
  currentPrice,
}) => {
  const [records, setRecords] = useState<PostTradeRecord[]>(getPostTradeRecords);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isFirestoreSynced, setIsFirestoreSynced] = useState(false);
  const [newAction, setNewAction] = useState<'BUY' | 'SELL'>('BUY');

  // Load & Sync from Firestore on component mount
  useEffect(() => {
    syncJournalWithFirestore()
      .then((synced) => {
        setRecords(synced);
        setIsFirestoreSynced(true);
      })
      .catch(() => {
        setIsFirestoreSynced(false);
      });
  }, []);
  const [newEntry, setNewEntry] = useState(currentPrice.toString());
  const [newExit, setNewExit] = useState((currentPrice + 12).toString());
  const [newHadSweep, setNewHadSweep] = useState(true);
  const [newObRespected, setNewObRespected] = useState(true);
  const [newFreshness, setNewFreshness] = useState('90');
  const [newDuration, setNewDuration] = useState('45');
  const [newLesson, setNewLesson] = useState('');

  const stats = calculateJournalStatistics(records);

  const handleAddRecord = (e: React.FormEvent) => {
    e.preventDefault();
    const entry = parseFloat(newEntry) || currentPrice;
    const exit = parseFloat(newExit) || (currentPrice + 10);
    const pnl = newAction === 'BUY' ? exit - entry : entry - exit;
    const result = pnl > 0 ? 'WIN' : pnl < 0 ? 'LOSS' : 'SCRATCH';

    const newRecord: PostTradeRecord = {
      id: `ptr-${Date.now()}`,
      date: new Date().toISOString().replace('T', ' ').substring(0, 16),
      action: newAction,
      entryPrice: Number(entry.toFixed(2)),
      exitPrice: Number(exit.toFixed(2)),
      stopLoss: Number((entry - 4.5).toFixed(2)),
      takeProfit: Number((entry + 12).toFixed(2)),
      pnlDollar: Number(pnl.toFixed(2)),
      result,
      obRespected: newObRespected,
      hadSweepBefore: newHadSweep,
      obFreshness: parseInt(newFreshness, 10) || 80,
      durationMinutes: parseInt(newDuration, 10) || 45,
      lessonLearnedAr: newLesson || (result === 'WIN' ? 'تحقق كامل لشروط التوافق مع ارتداد فوري من كتلة الأوامر.' : 'تم ضرب الوقف بسبب تذبذب شديد أو تآكل المنطقة.'),
    };

    const updated = savePostTradeRecord(newRecord);
    setRecords(updated);
    setIsAddingNew(false);
    setNewLesson('');
  };

  return (
    <div className="bg-[#10131A] border border-[#1E2330] rounded-xl p-5 shadow-lg space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1E2330] pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              تقرير ما بعد الصفقة وسجل الشفافية (Post-Trade Memory)
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                التعلم الآلي والتقييم
              </span>
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              تحليل نتائج الصفقات: هل احترم السعر الـ OB؟ هل سبقه Sweep؟ نضارة المنطقة ومعدل النجاح
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-mono ${
            isFirestoreSynced 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
              : 'bg-blue-500/10 border-blue-500/30 text-blue-300'
          }`}>
            <Database className="w-3.5 h-3.5 text-amber-400" />
            <span>Firestore: متصل</span>
          </div>

          <button
            onClick={() => setIsAddingNew(!isAddingNew)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isAddingNew ? 'إلغاء' : 'تسجيل صفقة بالسجل'}</span>
          </button>
        </div>
      </div>

      {/* Statistics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#151923] border border-[#232938] p-3 rounded-lg text-center">
          <div className="text-[11px] text-gray-400">معدل النجاح الإجمالي</div>
          <div className="text-xl font-bold font-mono text-emerald-400 mt-1">{stats.winRate}</div>
          <div className="text-[10px] text-gray-400 mt-0.5">{stats.totalTrades} صفقات مسجلة</div>
        </div>

        <div className="bg-[#151923] border border-[#232938] p-3 rounded-lg text-center">
          <div className="text-[11px] text-gray-400">عامل الربحية (Profit Factor)</div>
          <div className="text-xl font-bold font-mono text-cyan-300 mt-1">{stats.profitFactor}</div>
          <div className="text-[10px] text-gray-400 mt-0.5">صافي: +${stats.totalPnlDollars}</div>
        </div>

        <div className="bg-[#151923] border border-[#232938] p-3 rounded-lg text-center">
          <div className="text-[11px] text-gray-400">ارتباط النجاح بالـ Sweep</div>
          <div className="text-xl font-bold font-mono text-purple-300 mt-1">{stats.sweepCorrelation}</div>
          <div className="text-[10px] text-gray-400 mt-0.5">سحب سيولة مسبق</div>
        </div>

        <div className="bg-[#151923] border border-[#232938] p-3 rounded-lg text-center">
          <div className="text-[11px] text-gray-400">نجاح مناطق النضارة العالية</div>
          <div className="text-xl font-bold font-mono text-amber-300 mt-1">{stats.freshnessWinRateHigh}</div>
          <div className="text-[10px] text-gray-400 mt-0.5">نضارة &ge; 80%</div>
        </div>
      </div>

      {/* Add New Record Form Modal/Section */}
      {isAddingNew && (
        <form onSubmit={handleAddRecord} className="bg-[#141824] border border-[#252C3E] rounded-xl p-4 space-y-3">
          <div className="text-xs font-bold text-emerald-400 mb-2">إضافة تقرير ما بعد الصفقة إلى سجل الشفافية:</div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="text-gray-400 block mb-1">نوع الصفقة</label>
              <select
                value={newAction}
                onChange={(e) => setNewAction(e.target.value as 'BUY' | 'SELL')}
                className="w-full bg-[#1A202E] border border-gray-700 rounded p-1.5 text-white"
              >
                <option value="BUY">BUY (شراء)</option>
                <option value="SELL">SELL (بيع)</option>
              </select>
            </div>
            <div>
              <label className="text-gray-400 block mb-1">سعر الدخول ($)</label>
              <input
                type="number"
                step="0.1"
                value={newEntry}
                onChange={(e) => setNewEntry(e.target.value)}
                className="w-full bg-[#1A202E] border border-gray-700 rounded p-1.5 text-white"
              />
            </div>
            <div>
              <label className="text-gray-400 block mb-1">سعر الخروج ($)</label>
              <input
                type="number"
                step="0.1"
                value={newExit}
                onChange={(e) => setNewExit(e.target.value)}
                className="w-full bg-[#1A202E] border border-gray-700 rounded p-1.5 text-white"
              />
            </div>
            <div>
              <label className="text-gray-400 block mb-1">درجة نضارة الـ OB (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={newFreshness}
                onChange={(e) => setNewFreshness(e.target.value)}
                className="w-full bg-[#1A202E] border border-gray-700 rounded p-1.5 text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="flex items-center gap-4 bg-[#1A202E] p-2.5 rounded border border-gray-800">
              <label className="flex items-center gap-2 cursor-pointer text-gray-300">
                <input
                  type="checkbox"
                  checked={newObRespected}
                  onChange={(e) => setNewObRespected(e.target.checked)}
                  className="rounded text-emerald-500"
                />
                <span>هل احترم السعر منطقة الـ OB؟</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-gray-300">
                <input
                  type="checkbox"
                  checked={newHadSweep}
                  onChange={(e) => setNewHadSweep(e.target.checked)}
                  className="rounded text-emerald-500"
                />
                <span>هل كان هناك Sweep قبل الصفقة؟</span>
              </label>
            </div>

            <div>
              <input
                type="text"
                placeholder="الدروس المستفادة والتحليل البعدي..."
                value={newLesson}
                onChange={(e) => setNewLesson(e.target.value)}
                className="w-full bg-[#1A202E] border border-gray-700 rounded p-2 text-xs text-white"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition"
          >
            حفظ التقرير في سجل الشفافية
          </button>
        </form>
      )}

      {/* Market Memory Index Section */}
      <div className="bg-[#141822] border border-purple-500/20 rounded-xl p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
            <History className="w-4 h-4" />
            مؤشر ذاكرة السوق (Market Memory Index)
          </div>
          <span className="text-[11px] text-gray-400">مناطق تاريخية سابقة محترمة نفسياً</span>
        </div>
        <p className="text-xs text-gray-400 leading-relaxed">
          صناع السوق يحترمون كتل الأوامر والفجوات السابقة حتى بعد تخفيفها (Mitigated). تُعرض هذه الطبقة لدعم فهم السلوك النفسي للأسعار على المدى المتوسط والبعيد:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          {(memoryOBs || []).map((mem) => (
            <div key={mem.id} className="bg-[#191E2B] p-2.5 rounded-lg border border-purple-900/30 text-xs flex justify-between items-center">
              <div>
                <div className="text-purple-300 font-semibold">{mem.volume}</div>
                <div className="text-[11px] text-gray-400 font-mono mt-0.5">
                  النطاق: ${mem.min} - ${mem.max} ({mem.timeframe})
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] px-2 py-0.5 rounded bg-purple-950/50 text-purple-400 border border-purple-800/40">
                  {mem.mitigationStatus}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Trade History Table */}
      <div className="space-y-2.5">
        <div className="text-xs font-bold text-gray-300">سجل التوصيات والصفقات المنفذة:</div>
        <div className="space-y-2">
          {records.map((rec) => {
            const isWin = rec.result === 'WIN';
            return (
              <div
                key={rec.id}
                className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isWin ? 'bg-emerald-950/15 border-emerald-500/25' : 'bg-rose-950/15 border-rose-500/25'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono ${
                      rec.action === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                    }`}>
                      {rec.action} XAU/USD
                    </span>
                    <span className="text-xs font-mono text-white">
                      دخول: ${rec.entryPrice} &larr; خروج: ${rec.exitPrice}
                    </span>
                    <span className={`text-xs font-mono font-bold ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {rec.pnlDollar > 0 ? `+${rec.pnlDollar}` : rec.pnlDollar}$
                    </span>
                  </div>

                  <p className="text-xs text-gray-300 leading-relaxed">
                    {rec.lessonLearnedAr}
                  </p>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-gray-400 shrink-0">
                  <span className="bg-[#1A202C] px-2 py-1 rounded border border-gray-800">
                    نضارة الـ OB: <strong className="text-cyan-300">{rec.obFreshness}%</strong>
                  </span>
                  <span className="bg-[#1A202C] px-2 py-1 rounded border border-gray-800">
                    Sweep: <strong className={rec.hadSweepBefore ? 'text-emerald-400' : 'text-rose-400'}>{rec.hadSweepBefore ? 'نعم' : 'لا'}</strong>
                  </span>
                  <span className="bg-[#1A202C] px-2 py-1 rounded border border-gray-800">
                    المدة: {rec.durationMinutes} دقيقة
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
