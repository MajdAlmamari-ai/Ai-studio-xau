import React, { useState } from 'react';
import { 
  Send, 
  KeyRound, 
  MessageSquare, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  Eye, 
  EyeOff, 
  Copy, 
  Check, 
  Smartphone,
  Info
} from 'lucide-react';
import { SMCAnalysis, TelegramConfig } from '../types';
import { formatTelegramReport, sendTelegramMessage } from '../services/telegramService';

interface TelegramDispatcherProps {
  analysis: SMCAnalysis;
  telegramConfig: TelegramConfig;
  onSaveConfig: (config: TelegramConfig) => void;
}

export const TelegramDispatcher: React.FC<TelegramDispatcherProps> = ({
  analysis,
  telegramConfig,
  onSaveConfig,
}) => {
  const [botToken, setBotToken] = useState(telegramConfig.botToken || '');
  const [chatId, setChatId] = useState(telegramConfig.chatId || '');
  const [showToken, setShowToken] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [dispatchStatus, setDispatchStatus] = useState<{
    success?: boolean;
    message?: string;
    messageId?: number;
  } | null>(null);
  const [copiedPreview, setCopiedPreview] = useState(false);

  const formattedHtml = formatTelegramReport(analysis);

  const handleSaveAndSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!botToken.trim() || !chatId.trim()) {
      setDispatchStatus({
        success: false,
        message: 'يرجى إدخال رمز البوت (BOT_TOKEN) ومعرف الدردشة (CHAT_ID).',
      });
      return;
    }

    onSaveConfig({ botToken, chatId });
    setIsSending(true);
    setDispatchStatus(null);

    const result = await sendTelegramMessage(botToken, chatId, formattedHtml);
    setIsSending(false);

    if (result.success) {
      setDispatchStatus({
        success: true,
        message: `تم إرسال التقرير بنجاح إلى تيليجرام!`,
        messageId: result.messageId,
      });
    } else {
      setDispatchStatus({
        success: false,
        message: result.error || 'فشل إرسال التقرير إلى تيليجرام.',
      });
    }
  };

  const handleCopyRaw = () => {
    navigator.clipboard.writeText(formattedHtml);
    setCopiedPreview(true);
    setTimeout(() => setCopiedPreview(false), 2000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      
      {/* Left Column: Credentials & Test Dispatcher Form (7 cols) */}
      <div className="lg:col-span-7 bg-[#12141B] border border-[#1A1D26] rounded-xl p-4 sm:p-5 shadow-lg space-y-4 font-mono">
        <div className="flex items-center justify-between border-b border-[#1A1D26] pb-3">
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs sm:text-sm font-bold text-white tracking-wide font-sans">
              مرسل إشعارات بوت تيليجرام المباشر (Telegram Dispatcher)
            </h3>
          </div>
          <span className="text-[10px] text-zinc-400 uppercase bg-[#0A0C10] px-2 py-0.5 rounded border border-[#1A1D26]">
            HTTP POST /sendMessage
          </span>
        </div>

        <form onSubmit={handleSaveAndSend} className="space-y-3.5">
          {/* Bot Token Input */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5 font-sans">
                <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                <span>رمز البوت (BOT_TOKEN من @BotFather)</span>
              </label>
              <a
                href="https://t.me/botfather"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-sky-400 hover:underline flex items-center gap-1"
              >
                <span>فتح @BotFather</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="relative">
              <input
                id="telegram-bot-token-input"
                type={showToken ? 'text' : 'password'}
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder="مثال: 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                className="w-full bg-[#0A0C10] border border-[#1A1D26] focus:border-amber-400 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-zinc-600 focus:outline-none transition pl-10"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute left-2.5 top-2.5 text-zinc-500 hover:text-zinc-300"
              >
                {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Chat ID Input */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5 font-sans">
                <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                <span>معرف الدردشة أو القناة (CHAT_ID)</span>
              </label>
              <a
                href="https://t.me/userinfobot"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-sky-400 hover:underline flex items-center gap-1"
              >
                <span>معرفة الـ ID عبر @userinfobot</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <input
              id="telegram-chat-id-input"
              type="text"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="مثال: 987654321 أو لقناة خاصة -1001234567890"
              className="w-full bg-[#0A0C10] border border-[#1A1D26] focus:border-amber-400 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-zinc-600 focus:outline-none transition"
            />
          </div>

          {/* Quick Setup Tip */}
          <div className="bg-[#0A0C10] p-3 rounded-lg border border-[#1A1D26] text-xs text-zinc-400 space-y-1 font-sans">
            <div className="flex items-center gap-1 text-amber-400 font-bold">
              <Info className="w-3.5 h-3.5" />
              <span>ملاحظة مهمة لبدء التوصيل:</span>
            </div>
            <p className="leading-relaxed">
              افتح محادثة البوت في تيليجرام واضغط <strong>/start</strong> أولاً، أو قم بإضافة البوت كـ <strong>مسؤول (Admin)</strong> بصلاحية نشر الرسائل في قناتك الخاصة.
            </p>
          </div>

          {/* Dispatch Feedback Alert */}
          {dispatchStatus && (
            <div
              className={`p-3 rounded-lg border text-xs flex items-start gap-2 font-sans ${
                dispatchStatus.success
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              }`}
            >
              {dispatchStatus.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-0.5">
                <p className="font-bold">{dispatchStatus.message}</p>
                {dispatchStatus.messageId && (
                  <p className="text-[10px] text-emerald-300 font-mono">
                    الحالة: 200 OK • معرف الرسالة في تيليجرام: #{dispatchStatus.messageId}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Send Button */}
          <button
            id="send-telegram-test-btn"
            type="submit"
            disabled={isSending}
            className="w-full py-2.5 px-4 rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs flex items-center justify-center gap-2 transition active:scale-98 disabled:opacity-50 font-sans shadow-md"
          >
            <Send className={`w-3.5 h-3.5 ${isSending ? 'animate-bounce' : ''}`} />
            <span>{isSending ? 'جاري إرسال التقرير...' : 'إرسال الإشارة والتقرير الفوري إلى تيليجرام'}</span>
          </button>
        </form>

        {/* GitHub Secrets Reminder */}
        <div className="pt-2.5 border-t border-[#1A1D26] text-xs text-zinc-400 font-sans">
          <p className="font-bold text-zinc-300 mb-1">ربط الأتمتة التلقائية على GitHub Actions:</p>
          <p className="leading-relaxed text-zinc-400">
            أضف هذه المتغيرات في مستودع GitHub الخاص بك عبر: <strong>Settings → Secrets and variables → Actions</strong> باسم <code className="text-amber-400 font-mono">BOT_TOKEN</code> و <code className="text-amber-400 font-mono">CHAT_ID</code> ليعمل البوت كل 15 دقيقة تلقائياً.
          </p>
        </div>
      </div>

      {/* Right Column: Live Telegram Mobile Message Mockup */}
      <div className="lg:col-span-5 bg-[#12141B] border border-[#1A1D26] rounded-xl p-4 sm:p-5 shadow-lg flex flex-col justify-between font-mono">
        <div>
          <div className="flex items-center justify-between mb-3 border-b border-[#1A1D26] pb-2 font-sans">
            <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-300">
              <Smartphone className="w-4 h-4 text-sky-400" />
              <span>معاينة رسالة تيليجرام (كما تظهر في الهاتف)</span>
            </div>
            <button
              id="copy-preview-html-btn"
              onClick={handleCopyRaw}
              className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 bg-[#0A0C10] px-2 py-0.5 rounded-md border border-[#1A1D26]"
            >
              {copiedPreview ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedPreview ? 'تم النسخ' : 'نسخ HTML'}</span>
            </button>
          </div>

          {/* Telegram Preview Bubble */}
          <div className="bg-[#0A0C10] rounded-xl border border-[#1A1D26] p-3.5 text-xs text-zinc-300 space-y-2 font-sans">
            <div className="flex items-center justify-between border-b border-[#1A1D26] pb-2">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-amber-400 flex items-center justify-center text-black font-black text-[10px]">Au</span>
                <span className="font-bold text-white text-xs">إشارات بوت الذهب SMC</span>
              </div>
              <span className="text-[10px] text-zinc-500 font-mono">دورة 15 دقيقة</span>
            </div>

            <div className="space-y-1 text-xs leading-relaxed">
              <p className="text-amber-400 font-bold">🏆 تقرير تداول الذهب المؤسساتي (XAUUSD)</p>
              <p>💰 السعر الفوري: <strong className="text-white font-mono">${analysis.currentPrice.toFixed(2)}</strong></p>
              <p>📊 الاتجاه: <span className={analysis.bias === 'BULLISH' ? 'text-emerald-400 font-bold' : analysis.bias === 'BEARISH' ? 'text-rose-400 font-bold' : 'text-amber-400 font-bold'}>{analysis.bias}</span></p>
              <p>⚡ الإشارة: <strong className="text-white bg-[#1A1D26] px-1.5 py-0.5 rounded border border-zinc-700">{analysis.action}</strong></p>
              <p>📍 الدخول: <span className="font-mono">${analysis.entryZone.min.toFixed(2)} - ${analysis.entryZone.max.toFixed(2)}</span></p>
              <p>🛑 وقف الخسارة: <span className="text-rose-400 font-mono">${analysis.stopLoss.toFixed(2)}</span></p>
              <p>🎯 جني الأرباح: <span className="text-emerald-400 font-mono">${analysis.takeProfit.toFixed(2)}</span></p>
              <p>⚖️ العائد للمخاطرة: <span className="text-amber-400 font-mono">{analysis.riskRewardRatio}</span></p>
              <p className="text-zinc-500 text-[10px] pt-1.5 border-t border-[#1A1D26] font-mono">
                💧 سيولة الشراء BSL: ${analysis.bsl.toFixed(2)} | سيولة البيع SSL: ${analysis.ssl.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* Telegram Log Console */}
        <div className="bg-[#0A0C10] border border-[#1A1D26] p-3 rounded-lg mt-3">
          <div className="text-xs font-bold text-zinc-400 mb-2 font-mono flex items-center justify-between">
            <span>سجل إرسال التيرمينال</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
          </div>
          <div className="space-y-1 text-[11px] font-mono leading-tight">
            <p className="text-emerald-400">&gt; الإشارة: {analysis.action} XAUUSD @ ${analysis.currentPrice.toFixed(2)}</p>
            <p className="text-zinc-300">&gt; القناة المستهدفة: {chatId ? chatId : 'غير محددة'}</p>
            <p className="text-zinc-400">&gt; الحالة: {dispatchStatus ? (dispatchStatus.success ? 'تم الإرسال (200 OK)' : 'خطأ') : 'جاهز للإرسال'}</p>
            <p className="text-amber-400/90">&gt; جدولة كرون: */15 * * * * (GitHub Actions)</p>
          </div>
        </div>
      </div>

    </div>
  );
};
