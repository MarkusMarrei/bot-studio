import React, { useState } from 'react';
import { Sparkles, X, Wand2, Loader2 } from 'lucide-react';
import { useGraphStore } from '../../store/useGraphStore';
import { getLayoutedElements } from '../canvas/autoLayout';

interface AiPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AiPromptModal: React.FC<AiPromptModalProps> = ({ isOpen, onClose }) => {
  const { loadTemplate } = useGraphStore();
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/ai/text-to-graph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() })
      });
      const data = await res.json();
      if (data.nodes && Array.isArray(data.nodes)) {
        // Layout newly generated nodes using Dagre
        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
          data.nodes.map((n: any, idx: number) => ({
            id: n.id || `node_${idx}`,
            type: n.type || 'message',
            position: { x: 100 * idx, y: 150 },
            data: n.data || {}
          })),
          data.edges || []
        );

        loadTemplate(layoutedNodes, layoutedEdges);
        onClose();
      } else {
        setErrorMsg('Не удалось распознать структуру графа из ответа ИИ.');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Ошибка соединения с сервером ИИ.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="flex w-[540px] flex-col rounded-2xl border border-zinc-800 bg-[#0d0d10] p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100">
                ИИ-Генератор сценария бота
              </h2>
              <p className="text-xs text-zinc-400">Локальная модель Gemma-4-E2B Q4</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded p-1 text-zinc-500 hover:text-zinc-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4 text-xs">
          <div>
            <label className="block text-[11px] font-medium text-zinc-300 mb-1">
              Опишите задачу или воронку бота человеческим языком:
            </label>
            <textarea
              rows={4}
              placeholder="Например: Сделай бота-визитку для фотографа с кнопками портфолио, прайс-лист и форма записи на фотосессию с запросом номера телефона..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full rounded-md border border-zinc-800 bg-zinc-950 p-3 text-zinc-200 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* Quick presets */}
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[10px] text-zinc-500 py-1">Примеры:</span>
            {[
              'Бот записи на консультацию',
              'Квиз-опросник с подсчетом баллов',
              'Служба поддержки с ИИ'
            ].map((preset) => (
              <button
                key={preset}
                onClick={() => setPrompt(preset)}
                className="rounded-md border border-zinc-800 bg-zinc-900/60 px-2 py-0.5 text-[10px] text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
              >
                {preset}
              </button>
            ))}
          </div>

          {errorMsg && (
            <p className="rounded bg-rose-500/10 p-2 text-rose-300 text-[11px]">{errorMsg}</p>
          )}

          <button
            disabled={loading || !prompt.trim()}
            onClick={handleGenerate}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500 active:scale-98 transition-all shadow-lg disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Генерируем узлы и связи...</span>
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4" />
                <span>Сгенерировать граф на холсте ✨</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
