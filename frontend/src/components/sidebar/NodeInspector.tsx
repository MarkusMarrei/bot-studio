import React, { useState } from 'react';
import { Trash2, Sparkles, Plus, X, Upload } from 'lucide-react';
import { useGraphStore } from '../../store/useGraphStore';

export const NodeInspector: React.FC = () => {
  const { nodes, selectedNodeId, updateNodeData, deleteNode } = useGraphStore();
  const [magicLoading, setMagicLoading] = useState(false);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  if (!selectedNode) {
    return (
      <div className="h-full w-80 border-l border-zinc-800 bg-[#0d0d10] p-4 text-center text-zinc-500">
        <p className="mt-20 text-xs">Выберите ноду на холсте для редактирования её свойств</p>
      </div>
    );
  }

  const { id, type, data } = selectedNode;

  const handleMagicPen = async (action: string) => {
    if (!data.text) return;
    setMagicLoading(true);
    try {
      const res = await fetch('/api/ai/magic-pen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: data.text, action })
      });
      const json = await res.json();
      if (json.result) {
        updateNodeData(id, { text: json.result });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setMagicLoading(false);
    }
  };

  const addButton = () => {
    const currentButtons = data.buttons || [];
    const newBtn = {
      id: `btn_${Date.now()}`,
      text: `Кнопка ${currentButtons.length + 1}`,
      action_type: 'callback' as const
    };
    updateNodeData(id, { buttons: [...currentButtons, newBtn] });
  };

  const removeButton = (btnId: string) => {
    const currentButtons = data.buttons || [];
    updateNodeData(id, { buttons: currentButtons.filter((b) => b.id !== btnId) });
  };

  const updateButtonText = (btnId: string, text: string) => {
    const currentButtons = data.buttons || [];
    updateNodeData(id, {
      buttons: currentButtons.map((b) => (b.id === btnId ? { ...b, text } : b))
    });
  };

  return (
    <div className="h-full w-80 border-l border-zinc-800 bg-[#0d0d10] overflow-y-auto p-4">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-cyan-400">
            {type} Node
          </span>
          <h3 className="text-sm font-semibold text-zinc-100">{data.label || id}</h3>
        </div>
        <button
          onClick={() => deleteNode(id)}
          className="rounded p-1.5 text-zinc-500 hover:bg-rose-500/10 hover:text-rose-400"
          title="Удалить узел"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 space-y-4 text-xs">
        {/* Label field */}
        <div>
          <label className="block text-[11px] font-medium text-zinc-400 mb-1">
            Название (метка)
          </label>
          <input
            type="text"
            value={data.label || ''}
            onChange={(e) => updateNodeData(id, { label: e.target.value })}
            className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-zinc-200 focus:border-cyan-500 focus:outline-none"
          />
        </div>

        {/* Start Node Specific */}
        {type === 'start' && (
          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1">
              Команда запуска
            </label>
            <input
              type="text"
              value={data.command || '/start'}
              onChange={(e) => updateNodeData(id, { command: e.target.value })}
              className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-zinc-200 focus:border-cyan-500 focus:outline-none"
            />
          </div>
        )}

        {/* Message Node Specific */}
        {type === 'message' && (
          <>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-medium text-zinc-400">
                  Текст сообщения
                </label>
                <div className="flex items-center gap-1">
                  <button
                    disabled={magicLoading}
                    onClick={() => handleMagicPen('friendly')}
                    className="flex items-center gap-1 rounded bg-indigo-500/10 px-1.5 py-0.5 text-[10px] text-indigo-400 hover:bg-indigo-500/20"
                    title="ИИ-ручка: Сделать дружелюбнее"
                  >
                    <Sparkles className="h-2.5 w-2.5" />
                    <span>{magicLoading ? '...' : '✨ Улучшить'}</span>
                  </button>
                </div>
              </div>
              <textarea
                rows={4}
                value={data.text || ''}
                onChange={(e) => updateNodeData(id, { text: e.target.value })}
                className="w-full rounded-md border border-zinc-800 bg-zinc-900 p-2 text-zinc-200 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            {/* Media Image Dropzone / Path */}
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                Прикрепить изображение
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="URL или assets/photo.jpg"
                  value={data.image_path || ''}
                  onChange={(e) => updateNodeData(id, { image_path: e.target.value })}
                  className="flex-1 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-200 focus:border-cyan-500 focus:outline-none"
                />
                <label className="flex h-8 items-center justify-center gap-1 rounded bg-zinc-800 px-2.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700 cursor-pointer transition-colors shrink-0">
                  <Upload className="h-3.5 w-3.5" />
                  <span>Файл</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        updateNodeData(id, { image_path: reader.result as string });
                      };
                      reader.readAsDataURL(file);
                    }}
                    className="hidden"
                  />
                </label>
              </div>
              {data.image_path && (
                <div className="relative mt-2 overflow-hidden rounded border border-zinc-800 bg-zinc-950">
                  <img
                    src={data.image_path.startsWith('data:') || data.image_path.startsWith('http') ? data.image_path : `/api/media/local?path=${encodeURIComponent(data.image_path)}`}
                    alt="Preview"
                    className="max-h-24 w-full object-cover rounded"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => updateNodeData(id, { image_path: '' })}
                    className="absolute right-1 top-1 rounded bg-black/70 p-1 text-white hover:bg-red-600 transition-colors cursor-pointer"
                    title="Удалить"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>

            {/* Inline Buttons Manager */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-medium text-zinc-400">
                  Инлайн-кнопки
                </label>
                <button
                  onClick={addButton}
                  className="flex items-center gap-1 rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-700"
                >
                  <Plus className="h-3 w-3" />
                  <span>Добавить</span>
                </button>
              </div>

              <div className="space-y-1.5">
                {(data.buttons || []).map((btn) => (
                  <div key={btn.id} className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={btn.text}
                      onChange={(e) => updateButtonText(btn.id, e.target.value)}
                      className="w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 focus:border-cyan-500 focus:outline-none"
                    />
                    <button
                      onClick={() => removeButton(btn.id)}
                      className="rounded p-1 text-zinc-500 hover:text-rose-400"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Input Node Specific */}
        {type === 'input' && (
          <>
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                Имя переменной для сохранения
              </label>
              <input
                type="text"
                value={data.variable_name || ''}
                onChange={(e) => updateNodeData(id, { variable_name: e.target.value })}
                className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 font-mono text-zinc-200 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                Тип данных
              </label>
              <select
                value={data.input_type || 'text'}
                onChange={(e) => updateNodeData(id, { input_type: e.target.value as any })}
                className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-zinc-200 focus:border-cyan-500 focus:outline-none"
              >
                <option value="text">Любой текст</option>
                <option value="number">Число (валидация)</option>
                <option value="phone">Телефон</option>
                <option value="email">Email</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                Текст вопроса
              </label>
              <input
                type="text"
                value={data.text || ''}
                onChange={(e) => updateNodeData(id, { text: e.target.value })}
                className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-zinc-200 focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </>
        )}


        {/* Timer Node Specific */}
        {type === 'timer' && (
          <>
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                Режим таймера
              </label>
              <select
                value={data.timer_mode || 'after'}
                onChange={(e) => updateNodeData(id, { timer_mode: e.target.value as any })}
                className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-200 focus:border-cyan-500 focus:outline-none"
              >
                <option value="after">Задержка шага (После)</option>
                <option value="inactivity">Таймаут бездействия</option>
                <option value="date">Точная дата и время</option>
              </select>
            </div>

            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className="block text-[10px] text-zinc-400 mb-1">Дни</label>
                <input
                  type="number"
                  min="0"
                  value={data.timer_days ?? 0}
                  onChange={(e) => updateNodeData(id, { timer_days: Math.max(0, parseInt(e.target.value) || 0) })}
                  className="w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 text-center"
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-400 mb-1">Часы</label>
                <input
                  type="number"
                  min="0"
                  max="23"
                  value={data.timer_hours ?? 0}
                  onChange={(e) => updateNodeData(id, { timer_hours: Math.max(0, parseInt(e.target.value) || 0) })}
                  className="w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 text-center"
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-400 mb-1">Минуты</label>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={data.timer_minutes ?? 0}
                  onChange={(e) => updateNodeData(id, { timer_minutes: Math.max(0, parseInt(e.target.value) || 0) })}
                  className="w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 text-center"
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-400 mb-1">Секунды</label>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={data.timer_seconds ?? 0}
                  onChange={(e) => updateNodeData(id, { timer_seconds: Math.max(0, parseInt(e.target.value) || 0) })}
                  className="w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 text-center"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                Сообщение при срабатывании (необязательно)
              </label>
              <textarea
                rows={2}
                placeholder="Оставьте пустым для бесшумного перехода..."
                value={data.timer_text || ''}
                onChange={(e) => updateNodeData(id, { timer_text: e.target.value })}
                className="w-full rounded-md border border-zinc-800 bg-zinc-900 p-2 text-xs text-zinc-200 focus:border-cyan-500 focus:outline-none"
              />
              <span className="text-[10px] text-zinc-500">Если пусто — таймер перейдет к следующему шагу без отправки сообщения.</span>
            </div>
          </>
        )}

        {/* AI Assistant Node Specific */}
        {type === 'ai_assistant' && (
          <>
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                Приветственное сообщение (при входе)
              </label>
              <textarea
                rows={2}
                placeholder="👋 Здравствуйте! Я ИИ-ассистент..."
                value={data.ai_welcome_text ?? '👋 Здравствуйте! Я ИИ-ассистент. Чем я могу вам помочь? Напишите ваш вопрос прямо в чат.'}
                onChange={(e) => updateNodeData(id, { ai_welcome_text: e.target.value })}
                className="w-full rounded-md border border-zinc-800 bg-zinc-900 p-2 text-zinc-200 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                Модель ИИ
              </label>
              <input
                type="text"
                value={data.ai_model || 'gpt-4o-mini'}
                onChange={(e) => updateNodeData(id, { ai_model: e.target.value })}
                className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 font-mono text-zinc-200 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                Базовый URL (API Base URL)
              </label>
              <input
                type="text"
                value={data.ai_base_url || 'https://api.openai.com/v1'}
                onChange={(e) => updateNodeData(id, { ai_base_url: e.target.value })}
                className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 font-mono text-zinc-200 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                API-ключ
              </label>
              <input
                type="password"
                placeholder="sk-proj-..."
                value={data.ai_api_key || ''}
                onChange={(e) => updateNodeData(id, { ai_api_key: e.target.value })}
                className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 font-mono text-zinc-200 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                Ограничение сообщений (Антиспам)
              </label>
              <select
                value={data.ai_limit_type || 'per_hour'}
                onChange={(e) => updateNodeData(id, { ai_limit_type: e.target.value as any })}
                className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-zinc-200 focus:border-cyan-500 focus:outline-none"
              >
                <option value="none">Без ограничений</option>
                <option value="per_hour">Ограничение сообщений в час</option>
                <option value="total">Абсолютный лимит (всего сообщений)</option>
              </select>
            </div>

            {data.ai_limit_type !== 'none' && (
              <>
                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Лимит сообщений (шт.)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={data.ai_limit_count ?? 15}
                    onChange={(e) => updateNodeData(id, { ai_limit_count: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 font-mono text-zinc-200 focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Сообщение при исчерпании лимита
                  </label>
                  <textarea
                    rows={2}
                    placeholder="⚠️ Вы исчерпали лимит сообщений к ИИ-ассистенту..."
                    value={data.ai_limit_text ?? '⚠️ Вы достигли лимита бесплатных сообщений к ИИ-ассистенту. Пожалуйста, обратитесь к администратору или вернитесь в главное меню.'}
                    onChange={(e) => updateNodeData(id, { ai_limit_text: e.target.value })}
                    className="w-full rounded-md border border-zinc-800 bg-zinc-900 p-2 text-zinc-200 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                Системный промпт (Инструкция)
              </label>
              <textarea
                rows={3}
                value={data.ai_system_prompt || ''}
                onChange={(e) => updateNodeData(id, { ai_system_prompt: e.target.value })}
                className="w-full rounded-md border border-zinc-800 bg-zinc-900 p-2 text-zinc-200 focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </>
        )}

        {/* Notify Admin Node Specific */}
        {type === 'notify_admin' && (
          <>
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                Telegram User ID администратора
              </label>
              <input
                type="text"
                placeholder="123456789"
                value={data.admin_id || ''}
                onChange={(e) => updateNodeData(id, { admin_id: e.target.value })}
                className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 font-mono text-zinc-200 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                Шаблон уведомления
              </label>
              <textarea
                rows={2}
                value={data.notification_template || ''}
                onChange={(e) => updateNodeData(id, { notification_template: e.target.value })}
                className="w-full rounded-md border border-zinc-800 bg-zinc-900 p-2 text-zinc-200 focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </>
        )}

        {/* Custom Code Node Specific */}
        {type === 'custom_code' && (
          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1">
              Python код хендлера
            </label>
            <textarea
              rows={8}
              value={data.code || ''}
              onChange={(e) => updateNodeData(id, { code: e.target.value })}
              className="w-full rounded-md border border-zinc-800 bg-zinc-950 p-2 font-mono text-xs text-amber-300 focus:border-cyan-500 focus:outline-none"
            />
          </div>
        )}
      </div>
    </div>
  );
};
