import React, { useState } from 'react';
import { FileCode, X, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
import { useGraphStore } from '../../store/useGraphStore';
import { getLayoutedElements } from '../canvas/autoLayout';
import { useTranslation } from '../../i18n/useTranslation';

interface ImportLegacyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ImportLegacyModal: React.FC<ImportLegacyModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const { loadTemplate } = useGraphStore();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleReverseEngineer = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/ai/reverse-engineer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() })
      });
      const data = await res.json();
      if (data.nodes && Array.isArray(data.nodes)) {
        setSummary(data.summary || 'Структура успешно распознана.');
        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
          data.nodes.map((n: any, idx: number) => ({
            id: n.id || `node_${idx}`,
            type: n.type || 'message',
            position: { x: 100 * idx, y: 150 },
            data: n.data || {}
          })),
          data.edges || []
        );

        setTimeout(() => {
          loadTemplate(layoutedNodes, layoutedEdges);
          onClose();
        }, 1200);
      } else {
        setErrorMsg('Не удалось извлечь граф из кода.');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Ошибка соединения с сервером.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      <div className="flex w-[640px] flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50 text-orange-500">
              <FileCode className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {t('modal.reverse_title', 'Реверс старого бота (Legacy to Visual Graph)')}
              </h2>
              <p className="text-xs text-slate-500">
                {t('modal.reverse_desc', 'Поддерживает telebot (pyTelegramBotAPI), aiogram 2.x и самописные боты')}
              </p>
            </div>
          </div>
          <button onClick={onClose} title={t('modal.close', 'Закрыть')} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              {t('modal.reverse_desc', 'Вставьте Python-код вашего старого бота:')}
            </label>
            <textarea
              rows={8}
              placeholder={`import telebot\n\nbot = telebot.TeleBot("TOKEN")\n\n@bot.message_handler(commands=['start'])\ndef start(message):\n    bot.send_message(message.chat.id, "Привет! Выберите действие:")`}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="nodrag nowheel w-full rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-800 focus:border-red-500 focus:bg-white focus:outline-none leading-relaxed"
            />
          </div>

          {summary && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-emerald-800 text-[11px]">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{summary}</span>
            </div>
          )}

          {errorMsg && (
            <p className="rounded-lg bg-red-50 p-2 text-red-600 text-[11px]">{errorMsg}</p>
          )}

          <button
            disabled={loading || !code.trim()}
            onClick={handleReverseEngineer}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-2.5 text-xs font-bold text-white hover:bg-orange-600 active:scale-98 transition-all shadow-xs disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>ИИ разбирает хендлеры и стейты...</span>
              </>
            ) : (
              <>
                <span>{t('modal.reverse_btn', 'Преобразовать в визуальный граф')}</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
