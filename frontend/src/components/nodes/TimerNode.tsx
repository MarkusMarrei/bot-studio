import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Clock, Calendar, Hourglass, Trash2 } from 'lucide-react';
import { useGraphStore } from '../../store/useGraphStore';
import { useTranslation } from '../../i18n/useTranslation';
import type { NodeData } from '../../types/graph';

export const TimerNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const { t } = useTranslation();
  const { activeSimulatorNodeId, updateNodeData, deleteNode } = useGraphStore();
  const isSimActive = activeSimulatorNodeId === id;
  const nodeData = data as NodeData;

  const mode = nodeData.timer_mode || 'after';
  const days = nodeData.timer_days ?? 0;
  const hours = nodeData.timer_hours ?? 0;
  const minutes = nodeData.timer_minutes ?? 0;
  const seconds = nodeData.timer_seconds ?? 0;
  const dateVal = nodeData.timer_date || '';

  const pad = (n: number) => String(n).padStart(2, '0');

  const parseDateTime = (val?: string) => {
    if (!val) {
      const now = new Date();
      return {
        date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
        h: now.getHours(),
        m: now.getMinutes(),
        s: 0
      };
    }
    const parts = val.split('T');
    const datePart = parts[0] || '';
    const timePart = parts[1] || '00:00:00';
    const timeParts = timePart.split(':');
    return {
      date: datePart,
      h: parseInt(timeParts[0]) || 0,
      m: parseInt(timeParts[1]) || 0,
      s: parseInt(timeParts[2]) || 0
    };
  };

  const dt = parseDateTime(dateVal);

  const updateDateVal = (newDate: string, newH: number, newM: number, newS: number) => {
    const iso = `${newDate || dt.date}T${pad(newH)}:${pad(newM)}:${pad(newS)}`;
    updateNodeData(id, { timer_date: iso });
  };

  const formatSummary = () => {
    if (mode === 'date') {
      if (!dateVal) return t('node.timer_no_date', 'Дата не выбрана');
      try {
        const parts = dt.date.split('-');
        if (parts.length === 3) {
          return `📅 ${parts[2]}.${parts[1]}.${parts[0]} ${t('node.timer_at', 'в')} ${pad(dt.h)}:${pad(dt.m)}:${pad(dt.s)}`;
        }
        return `📅 ${dateVal}`;
      } catch {
        return `📅 ${dateVal}`;
      }
    }
    const parts: string[] = [];
    if (days > 0) parts.push(`${days} ${t('node.timer_unit_d', 'дн')}`);
    if (hours > 0) parts.push(`${hours} ${t('node.timer_unit_h', 'ч')}`);
    if (minutes > 0) parts.push(`${minutes} ${t('node.timer_unit_m', 'мин')}`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds} ${t('node.timer_unit_s', 'сек')}`);
    return `${mode === 'inactivity' ? t('node.timer_inactivity_prefix', '💤 Бездействие:') : t('node.timer_after_prefix', '⏱ Через:')} ${parts.join(' ')}`;
  };

  return (
    <div
      className={`group relative min-w-[320px] max-w-[350px] rounded-xl border bg-white p-3.5 shadow-md transition-all duration-200 ${
        selected
          ? 'border-red-500 ring-2 ring-red-500/20 shadow-lg'
          : 'border-slate-200 hover:border-slate-300'
      } ${
        isSimActive
          ? 'border-red-500 ring-4 ring-red-500/30 shadow-red-500/20 shadow-xl'
          : ''
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !border-2 !border-[#0f172a] !bg-[#FF4438]"
      />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-800">
              {nodeData.label || t('node.timer_title', 'ВРЕМЯ / ТАЙМЕР')}
            </span>
            <p className="text-[10px] text-slate-400 font-medium leading-none mt-0.5">
              {mode === 'inactivity'
                ? t('node.timer_inactivity_desc', 'Таймаут неактивности')
                : mode === 'after'
                ? t('node.timer_after_desc', 'Задержка шага')
                : t('node.timer_date_desc', 'Запуск по точной дате')}
            </p>
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            deleteNode(id);
          }}
          className="opacity-0 group-hover:opacity-100 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-opacity cursor-pointer"
          title={t('node.delete', 'Удалить узел')}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Mode Tabs */}
      <div className="mt-3 flex rounded-lg bg-slate-100 p-0.5 text-[11px] font-semibold text-slate-600">
        <button
          type="button"
          onClick={() => updateNodeData(id, { timer_mode: 'inactivity' })}
          className={`flex-1 flex items-center justify-center gap-1 rounded-md py-1 transition-all cursor-pointer ${
            mode === 'inactivity'
              ? 'bg-white text-slate-900 shadow-2xs font-bold'
              : 'hover:text-slate-900'
          }`}
          title={t('node.timer_tab_inactivity_tooltip', 'Сработает при отсутствии сообщений от пользователя')}
        >
          <Hourglass className="h-3 w-3" />
          <span>{t('node.timer_tab_inactivity', 'Бездействие')}</span>
        </button>

        <button
          type="button"
          onClick={() => updateNodeData(id, { timer_mode: 'after' })}
          className={`flex-1 flex items-center justify-center gap-1 rounded-md py-1 transition-all cursor-pointer ${
            mode === 'after'
              ? 'bg-white text-slate-900 shadow-2xs font-bold'
              : 'hover:text-slate-900'
          }`}
          title={t('node.timer_tab_after_tooltip', 'Сработает через заданное время после предыдущей ноды')}
        >
          <Clock className="h-3 w-3" />
          <span>{t('node.timer_tab_after', 'После')}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            updateNodeData(id, {
              timer_mode: 'date',
              timer_date: dateVal || `${dt.date}T${pad(dt.h)}:${pad(dt.m)}:${pad(dt.s)}`
            });
          }}
          className={`flex-1 flex items-center justify-center gap-1 rounded-md py-1 transition-all cursor-pointer ${
            mode === 'date'
              ? 'bg-white text-slate-900 shadow-2xs font-bold'
              : 'hover:text-slate-900'
          }`}
          title={t('node.timer_tab_date_tooltip', 'Запуск в точную дату и время по календарю')}
        >
          <Calendar className="h-3 w-3" />
          <span>{t('node.timer_tab_date', 'Дата')}</span>
        </button>
      </div>

      {/* Controls based on Mode */}
      <div className="mt-3">
        {mode === 'date' ? (
          <div className="space-y-2">
            <div>
              <label className="text-[10px] font-medium text-slate-500 block mb-1">
                {t('node.timer_date_label', '📅 Дата (Год, месяц, число)')}
              </label>
              <input
                type="date"
                value={dt.date}
                onChange={(e) => updateDateVal(e.target.value, dt.h, dt.m, dt.s)}
                className="nodrag nowheel w-full rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 text-xs text-slate-800 focus:border-red-500 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-medium text-slate-500 block mb-1">
                {t('node.timer_time_label', '⏰ Точное время (Часы : Минуты : Секунды)')}
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                <div className="flex flex-col">
                  <span className="text-[9px] text-slate-400 font-medium mb-0.5 text-center">
                    {t('node.timer_hours_hint', 'Часы (0-23)')}
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={dt.h}
                    onChange={(e) => {
                      const val = Math.min(23, Math.max(0, parseInt(e.target.value) || 0));
                      updateDateVal(dt.date, val, dt.m, dt.s);
                    }}
                    className="nodrag nowheel w-full rounded-lg border border-slate-200 bg-slate-50/50 px-2 py-1 text-xs font-semibold text-slate-800 text-center focus:border-red-500 focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="flex flex-col">
                  <span className="text-[9px] text-slate-400 font-medium mb-0.5 text-center">
                    {t('node.timer_minutes_hint', 'Мин (0-59)')}
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={dt.m}
                    onChange={(e) => {
                      const val = Math.min(59, Math.max(0, parseInt(e.target.value) || 0));
                      updateDateVal(dt.date, dt.h, val, dt.s);
                    }}
                    className="nodrag nowheel w-full rounded-lg border border-slate-200 bg-slate-50/50 px-2 py-1 text-xs font-semibold text-slate-800 text-center focus:border-red-500 focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="flex flex-col">
                  <span className="text-[9px] text-slate-400 font-medium mb-0.5 text-center">
                    {t('node.timer_seconds_hint', 'Сек (0-59)')}
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={dt.s}
                    onChange={(e) => {
                      const val = Math.min(59, Math.max(0, parseInt(e.target.value) || 0));
                      updateDateVal(dt.date, dt.h, dt.m, val);
                    }}
                    className="nodrag nowheel w-full rounded-lg border border-slate-200 bg-slate-50/50 px-2 py-1 text-xs font-semibold text-slate-800 text-center focus:border-red-500 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <label className="text-[10px] font-medium text-slate-500 block mb-1">
              {mode === 'inactivity'
                ? t('node.timer_inactivity_label', 'Период бездействия до срабатывания')
                : t('node.timer_delay_label', 'Задержка перед следующим действием')}
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              <div className="flex flex-col">
                <span className="text-[9px] text-slate-400 font-medium mb-0.5 text-center">
                  {t('node.timer_days_col', 'Дни')}
                </span>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    value={days}
                    onChange={(e) => updateNodeData(id, { timer_days: Math.max(0, parseInt(e.target.value) || 0) })}
                    className="nodrag nowheel w-full rounded-lg border border-slate-200 bg-slate-50/50 px-1.5 py-1 text-xs font-semibold text-slate-800 text-center focus:border-red-500 focus:bg-white focus:outline-none"
                  />
                  <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 pointer-events-none">
                    {t('node.timer_unit_d', 'дн')}
                  </span>
                </div>
              </div>

              <div className="flex flex-col">
                <span className="text-[9px] text-slate-400 font-medium mb-0.5 text-center">
                  {t('node.timer_hours_col', 'Часы')}
                </span>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={hours}
                    onChange={(e) => updateNodeData(id, { timer_hours: Math.max(0, parseInt(e.target.value) || 0) })}
                    className="nodrag nowheel w-full rounded-lg border border-slate-200 bg-slate-50/50 px-1.5 py-1 text-xs font-semibold text-slate-800 text-center focus:border-red-500 focus:bg-white focus:outline-none"
                  />
                  <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 pointer-events-none">
                    {t('node.timer_unit_h', 'ч')}
                  </span>
                </div>
              </div>

              <div className="flex flex-col">
                <span className="text-[9px] text-slate-400 font-medium mb-0.5 text-center">
                  {t('node.timer_minutes_col', 'Минуты')}
                </span>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={minutes}
                    onChange={(e) => updateNodeData(id, { timer_minutes: Math.max(0, parseInt(e.target.value) || 0) })}
                    className="nodrag nowheel w-full rounded-lg border border-slate-200 bg-slate-50/50 px-1.5 py-1 text-xs font-semibold text-slate-800 text-center focus:border-red-500 focus:bg-white focus:outline-none"
                  />
                  <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 pointer-events-none">
                    {t('node.timer_unit_m', 'мин')}
                  </span>
                </div>
              </div>

              <div className="flex flex-col">
                <span className="text-[9px] text-slate-400 font-medium mb-0.5 text-center">
                  {t('node.timer_seconds_col', 'Секунды')}
                </span>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    value={seconds}
                    onChange={(e) => updateNodeData(id, { timer_seconds: Math.max(0, parseInt(e.target.value) || 0) })}
                    className="nodrag nowheel w-full rounded-lg border border-slate-200 bg-slate-50/50 px-1.5 py-1 text-xs font-semibold text-slate-800 text-center focus:border-red-500 focus:bg-white focus:outline-none"
                  />
                  <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 pointer-events-none">
                    {t('node.timer_unit_s', 'сек')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Optional Custom Message on Timer End */}
        <div className="mt-2.5">
          <label className="block text-[10px] font-medium text-slate-500 mb-1">
            {t('node.timer_custom_msg_label', '💬 Сообщение при завершении (необязательно):')}
          </label>
          <input
            type="text"
            placeholder={t('node.timer_custom_msg_placeholder', 'Оставьте пустым для бесшумного перехода...')}
            value={nodeData.timer_text || ''}
            onChange={(e) => updateNodeData(id, { timer_text: e.target.value })}
            className="nodrag nowheel w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-700 placeholder:text-slate-400 focus:border-red-500 focus:bg-white focus:outline-none"
          />
        </div>

        {/* Summary Pill */}
        <div className="mt-2.5 flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 border border-slate-100">
          <span>{t('node.timer_event_label', 'Событие:')}</span>
          <span className="font-bold text-amber-700 font-mono text-[10px]">{formatSummary()}</span>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !border-2 !border-[#0f172a] !bg-[#FF4438]"
      />
    </div>
  );
};
