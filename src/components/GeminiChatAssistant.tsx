import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, SMCAnalysis } from '../types';
import { Bot, Send, User, Sparkles, AlertCircle, Copy, Check, RefreshCw } from 'lucide-react';

interface GeminiChatAssistantProps {
  currentPrice: number;
  analysis?: SMCAnalysis;
}

export const GeminiChatAssistant: React.FC<GeminiChatAssistantProps> = ({ currentPrice, analysis }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-msg',
      sender: 'assistant',
      text: `مرحباً بك! أنا مساعد التداول المؤسساتي الذكي للذهب مدعوماً بنموذج Gemini 3.8 Flash.
أنا متصل بالبيانات اللحظية لسعر الذهب ($${currentPrice.toFixed(2)})، فجوات القيمة العادلة (FVG)، كتل الأوامر (Order Blocks)، وأسعار العقود الآجلة (COMEX Futures).
كيف يمكنني مساعدتك في خطتك التداولية اليوم؟`,
      timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const quickPrompts = [
    'ما هو اتجاه الذهب الحالي ومناطق الأوردر بلوك؟',
    'أين تتمركز سيولة الشراء (BSL) وسيولة البيع (SSL)؟',
    'حلل لي فجوات القيمة العادلة (FVG) القريبة من السعر',
    'ما تأثير مؤشر الدولار (DXY) والفائدة على صفقاتي اليوم؟',
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || input;
    if (!text.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: text.trim(),
          currentPrice,
          analysisAction: analysis?.action,
          bias: analysis?.bias
        }),
      });

      const data = await res.json();
      const replyText = data.reply || (data.error ? `تنبيه: ${data.error}` : 'تعذر الحصول على رد من المساعد.');

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        sender: 'assistant',
        text: replyText,
        timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errMsg: ChatMessage = {
        id: `assistant-err-${Date.now()}`,
        sender: 'assistant',
        text: `تعذر الاتصال بخادم Gemini Flash 3.8. تأكد من عمل السيرفر الداخلي. (${err?.message || 'خطأ شبكة'})`,
        timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="bg-[#12141B] border border-[#1A1D26] rounded-xl shadow-lg relative flex flex-col h-[580px] overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-[#1A1D26] flex items-center justify-between bg-[#0A0C10]/60">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-gradient-to-br from-amber-400 to-amber-600 rounded-lg text-black">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-white tracking-wide">
                مساعد Gemini 3.8 Flash لتحليل الذهب (SMC Quant AI)
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Live Server AI
              </span>
              {analysis && (
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                  analysis.action === 'BUY' 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                    : analysis.action === 'SELL' 
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' 
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                }`}>
                  {analysis.action} (${currentPrice.toFixed(2)})
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400">
              تحليل فوري لمناطق العرض والطلب وفجوات القيمة العادلة وتأثيرات الاقتصاد الكلي
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setMessages([
              {
                id: 'welcome-reset',
                sender: 'assistant',
                text: `تمت إعادة ضبط المحادثة. جاهز لتحليل صفقات الذهب الحالية عند $${currentPrice.toFixed(2)}.`,
                timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
              },
            ]);
          }}
          className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-[#1A1D26] transition-colors"
          title="إعادة ضبط المحادثة"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Quick Prompts Bar */}
      <div className="px-4 py-2 bg-[#0A0C10] border-b border-[#1A1D26] flex items-center gap-2 overflow-x-auto no-scrollbar text-xs">
        <span className="text-[11px] text-zinc-500 shrink-0">مقترحات:</span>
        {quickPrompts.map((prompt, idx) => (
          <button
            key={idx}
            disabled={loading}
            onClick={() => handleSend(prompt)}
            className="px-2.5 py-1 rounded-full bg-[#1A1D26] hover:bg-[#232733] text-zinc-300 hover:text-white border border-[#232733] whitespace-nowrap transition-colors text-[11px]"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-[#0A0C10]/40">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';

          return (
            <div
              key={msg.id}
              className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs ${
                  isUser
                    ? 'bg-amber-400 text-black font-bold'
                    : 'bg-[#1A1D26] text-amber-400 border border-[#2A2E3D]'
                }`}
              >
                {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-xl p-3.5 text-xs sm:text-sm leading-relaxed relative group ${
                  isUser
                    ? 'bg-amber-400/10 border border-amber-400/20 text-zinc-100 rounded-tr-none'
                    : 'bg-[#12141B] border border-[#1A1D26] text-zinc-200 rounded-tl-none shadow-md'
                }`}
              >
                <div className="whitespace-pre-wrap font-sans">{msg.text}</div>

                <div className="flex items-center justify-between mt-2 pt-1 border-t border-[#1A1D26]/40 text-[10px] text-zinc-500">
                  <span>{msg.timestamp}</span>
                  {!isUser && (
                    <button
                      onClick={() => copyToClipboard(msg.id, msg.text)}
                      className="opacity-60 hover:opacity-100 transition-opacity flex items-center gap-1 text-zinc-400 hover:text-white"
                    >
                      {copiedId === msg.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" /> تم النسخ
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" /> نسخ
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-full bg-[#1A1D26] text-amber-400 border border-[#2A2E3D] flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-[#12141B] border border-[#1A1D26] p-3 rounded-xl rounded-tl-none flex items-center gap-2 text-xs text-zinc-400">
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>جاري تحليل بيانات السوق عبر Gemini 3.8 Flash...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="p-3 bg-[#0A0C10] border-t border-[#1A1D26] flex items-center gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="اسأل Gemini 3.8 عن مناطق الذهب، الفاليو قاب، أو السيناريو الأفضل..."
          disabled={loading}
          className="flex-1 bg-[#12141B] border border-[#1A1D26] focus:border-amber-400/60 rounded-lg px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none transition-colors"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="bg-amber-400 hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold p-2.5 rounded-lg transition-colors flex items-center justify-center shrink-0"
        >
          <Send className="w-4 h-4 rtl:-scale-x-100" />
        </button>
      </form>
    </div>
  );
};
