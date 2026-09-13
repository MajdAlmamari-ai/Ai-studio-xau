import React from 'react';
import {
  Database,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from 'lucide-react';

export interface SourceStatus {
  sourceId: string;
  label: string;
  status: 'OK' | 'DEGRADED' | 'UNAVAILABLE';
  used?: number;
  limit?: number;
  remaining?: number;
  reserve?: number;
  resetInMs?: number;
  note?: string;
}

export interface SourceStatusPanelProps {
  spotSource: string;
  spotQuality: 'REAL' | 'FALLBACK' | 'UNAVAILABLE';
  session: string;
  sources: SourceStatus[];
  onRefresh?: () => void;
}

function formatMs(ms: number | undefined): string {
  if (ms === undefined || !Number.isFinite(ms)) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h`;
  return `${Math.floor(ms / 86_400_000)}d`;
}

function statusIcon(status: SourceStatus['status']) {
  if (status === 'OK') return <CheckCircle className="w-4 h-4 text-emerald-400" />;
  if (status === 'DEGRADED') return <AlertTriangle className="w-4 h-4 text-amber-400" />;
  return <XCircle className="w-4 h-4 text-rose-400" />;
}

export const SourceStatusPanel: React.FC<SourceStatusPanelProps> = ({
  spotSource,
  spotQuality,
  session,
  sources,
  onRefresh,
}) => {
  return (
    <div id="source-status-panel" className="bg-[#12141B] border border-[#1A1D26] rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-bold text-white">
            حالة مصادر البيانات
          </h3>
        </div>
        {onRefresh && (
          <button
            id="source-status-refresh-btn"
            onClick={onRefresh}
            className="text-xs text-zinc-400 hover:text-white"
          >
            تحديث
          </button>
        )}
      </div>

      {/* Spot Source Summary */}
      <div className="mb-4 p-3 bg-[#0A0C10] rounded-lg border border-[#1A1D26]">
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-400">السعر الفوري:</span>
          <div className="flex items-center gap-2">
            <span className="text-white font-mono">{spotSource}</span>
            <span
              className={
                spotQuality === 'REAL'
                  ? 'text-emerald-400 font-bold'
                  : spotQuality === 'FALLBACK'
                  ? 'text-amber-400 font-bold'
                  : 'text-rose-400 font-bold'
              }
            >
              [{spotQuality}]
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between text-xs mt-2">
          <span className="text-zinc-400">الجلسة:</span>
          <span className="text-white font-mono flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {session}
          </span>
        </div>
      </div>

      {/* Sources List */}
      <div className="space-y-2">
        {sources.map((s) => (
          <div
            key={s.sourceId}
            id={`source-item-${s.sourceId}`}
            className="flex items-center justify-between p-2 bg-[#0A0C10] rounded border border-[#1A1D26] text-xs"
          >
            <div className="flex items-center gap-2">
              {statusIcon(s.status)}
              <span className="text-white">{s.label}</span>
            </div>
            <div className="flex items-center gap-2 text-zinc-400">
              {s.limit !== undefined && Number.isFinite(s.limit) && (
                <span className="font-mono">
                  {s.used ?? 0}/{s.limit}
                </span>
              )}
              {s.resetInMs !== undefined && Number.isFinite(s.resetInMs) && (
                <span className="text-[10px] text-zinc-500">
                  إعادة: {formatMs(s.resetInMs)}
                </span>
              )}
              {s.note && (
                <span className="text-[10px] text-amber-400">{s.note}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
