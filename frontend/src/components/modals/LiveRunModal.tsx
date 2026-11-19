import React, { useState, useEffect } from 'react';
import { Play, Square, X, AlertCircle, CheckCircle2, Terminal } from 'lucide-react';
import { useGraphStore } from '../../store/useGraphStore';
import { useTranslation } from '../../i18n/useTranslation';

interface LiveRunModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LiveRunModal: React.FC<LiveRunModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const { nodes, edges, metadata } = useGraphStore();
  const [token, setToken] = useState('');
  const [status, setStatus] = useState<{ is_running: boolean; active_token_preview: string; log_lines: string[] }>({
    is_running: false,
    active_token_preview: '',
    log_lines: []
  });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      checkStatus();
      const interval = setInterval(checkStatus, 2000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const checkStatus = async () => {
    try {
      const res = await fetch('/api/live/status');
      const data = await res.json();
      setStatus(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleStart = async () => {
    if (!token.trim()) {
      setErrorMsg(t('modal.live_token_placeholder', 'Пожалуйста, введите токен бота от @BotFather'));
      return;
    }
    setErrorMsg('');
    setLoading(true);
    try {
      const res = await fetch('/api/live/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token.trim(),
          graph: {
            nodes: nodes.map((n) => ({
              id: n.id,
              type: n.type,
              position: n.position,
              data: n.data
            })),
            edges: edges.map((e) => ({
              id: e.id,
              source: e.source,
              target: e.target,
              sourceHandle: e.sourceHandle,
              targetHandle: e.targetHandle
            })),
            metadata
          }
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.detail || 'Не удалось запустить бота');
      } else {
        checkStatus();
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Ошибка соединения');
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    try {
      await fetch('/api/live/stop', { method: 'POST' });
      checkStatus();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      <div className="flex w-[560px] flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              {t('modal.live_title', 'Live Test в реальном Telegram')}
            </h2>
            <p className="text-xs text-slate-500">
              Live polling runner on aiogram 3.x
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Telegram Bot Token (@BotFather)
            </label>
            <input
              type="password"
              placeholder={t('modal.live_token_placeholder', 'Вставьте токен вашего бота от @BotFather...')}
              value={token}
              disabled={status.is_running}
              onChange={(e) => setToken(e.target.value)}
              className="nodrag nowheel w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-800 focus:border-red-500 focus:bg-white focus:outline-none font-mono shadow-2xs"
            />
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-2.5 text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {status.is_running ? (
            <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <div>
                  <h4 className="font-bold text-emerald-900">
                    {t('modal.live_running', 'Бот работает в режиме реального времени!')}
                  </h4>
                  <p className="text-[11px] text-emerald-700 font-mono">
                    Token: {status.active_token_preview}
                  </p>
                </div>
              </div>
              <button
                onClick={handleStop}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 font-bold text-white hover:bg-red-700 transition-colors cursor-pointer shadow-xs"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
                <span>{t('modal.live_stop', 'Остановить бота')}</span>
              </button>
            </div>
          ) : (
            <button
              onClick={handleStart}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 active:scale-95 transition-all shadow-md cursor-pointer disabled:opacity-50"
            >
              <Play className="h-4 w-4 fill-current" />
              <span>{t('modal.live_start', 'Запустить бота (Polling)')}</span>
            </button>
          )}

          {/* Real-time Logs Console */}
          <div className="rounded-xl border border-slate-800 bg-[#1E222D] p-3.5">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              <Terminal className="h-3.5 w-3.5" />
              <span>Runner Logs</span>
            </div>
            <div className="h-32 overflow-y-auto font-mono text-[11px] text-emerald-400 space-y-1">
              {status.log_lines && status.log_lines.length > 0 ? (
                status.log_lines.map((l, i) => <div key={i}>{l}</div>)
              ) : (
                <div className="text-slate-500 italic">No logs yet. Click start to run polling...</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
