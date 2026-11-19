import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { LayoutGrid, Plus, X, Trash2 } from 'lucide-react';
import { useGraphStore } from '../../store/useGraphStore';
import { useTranslation } from '../../i18n/useTranslation';
import type { NodeData, ButtonItem } from '../../types/graph';

export const KeyboardNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const { t } = useTranslation();
  const { activeSimulatorNodeId, updateNodeData, deleteNode } = useGraphStore();
  const isSimActive = activeSimulatorNodeId === id;
  const nodeData = data as NodeData;
  const buttons = nodeData.buttons || [];

  const addButton = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newBtn: ButtonItem = {
      id: `btn_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      text: `Button ${buttons.length + 1}`,
      action_type: 'callback'
    };
    updateNodeData(id, { buttons: [...buttons, newBtn] });
  };

  const removeButton = (btnId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    updateNodeData(id, { buttons: buttons.filter((b) => b.id !== btnId) });
  };

  const updateButtonText = (btnId: string, text: string) => {
    updateNodeData(id, {
      buttons: buttons.map((b) => (b.id === btnId ? { ...b, text } : b))
    });
  };

  // Determine grid description for user
  const getLayoutHint = () => {
    const len = buttons.length;
    if (len <= 1) return t('node.keyboard_layout_full', 'Во всю ширину (1 колонка)');
    if (len === 2) return t('node.keyboard_layout_half', 'Разделение 50% / 50% (2 колонки)');
    if (len === 4) return t('node.keyboard_layout_grid', 'Сеточка 2х2 (по 2 в ряд)');
    return t('node.keyboard_layout_adaptive', 'Адаптивная сетка (по 2 в ряд)');
  };

  return (
    <div
      className={`group relative min-w-[280px] max-w-[320px] rounded-xl border bg-white p-3.5 shadow-md transition-all duration-200 ${
        selected
          ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-lg'
          : 'border-slate-200 hover:border-slate-300'
      } ${
        isSimActive
          ? 'border-indigo-500 ring-4 ring-indigo-500/30 shadow-indigo-500/20 shadow-xl'
          : ''
      }`}
    >
      {/* Target execution handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !border-2 !border-[#0f172a] !bg-[#FF4438]"
      />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <LayoutGrid className="h-4 w-4" />
          </div>
          <div>
            <input
              type="text"
              value={nodeData.label || t('node.keyboard_title', 'НИЖНЕЕ МЕНЮ')}
              onChange={(e) => updateNodeData(id, { label: e.target.value })}
              className="nodrag nowheel rounded border border-transparent px-1 py-0.5 text-xs font-bold text-slate-800 hover:border-slate-200 focus:border-indigo-500 focus:bg-white focus:outline-none max-w-[150px]"
            />
            <p className="text-[10px] text-slate-400 font-medium leading-none px-1 mt-0.5">
              {t('node.keyboard_subtitle', 'Постоянные Reply-кнопки')}
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

      {/* Prompt Message Textarea */}
      <div className="mt-2.5">
        <label className="text-[10px] font-medium text-slate-500 block mb-1">
          {t('node.keyboard_prompt_label', 'Текст сообщения над меню')}
        </label>
        <textarea
          rows={2}
          placeholder={t('node.keyboard_prompt_placeholder', 'Выберите пункт меню...')}
          value={nodeData.text || ''}
          onChange={(e) => updateNodeData(id, { text: e.target.value })}
          className="nodrag nowheel w-full resize-none rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-800 leading-relaxed placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none"
        />
      </div>

      {/* Buttons Manager with Outgoing Handles */}
      <div className="mt-2.5">
        <div className="flex items-center justify-between mb-1.5 px-0.5">
          <label className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
            {t('node.keyboard_buttons_label', 'Кнопки меню')} ({buttons.length})
          </label>
          <span className="text-[9px] font-medium text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
            {getLayoutHint()}
          </span>
        </div>

        <div className="space-y-1.5">
          {buttons.map((btn, index) => (
            <div
              key={btn.id}
              className="relative flex items-center justify-between rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs shadow-2xs hover:border-slate-300"
            >
              <span className="text-[10px] text-slate-400 font-mono mr-1.5">{index + 1}.</span>
              <input
                type="text"
                value={btn.text}
                onChange={(e) => updateButtonText(btn.id, e.target.value)}
                className="nodrag nowheel flex-1 bg-transparent text-xs font-semibold text-slate-800 focus:outline-none pr-2"
                placeholder={t('node.keyboard_btn_placeholder', 'Текст кнопки...')}
              />
              <button
                onClick={(e) => removeButton(btn.id, e)}
                className="rounded p-0.5 text-slate-400 hover:text-red-500 cursor-pointer"
                title={t('node.keyboard_del_btn', 'Удалить кнопку')}
              >
                <X className="h-3 w-3" />
              </button>

              {/* Individual Button Outgoing Handle */}
              <Handle
                type="source"
                position={Position.Right}
                id={btn.id}
                className="!absolute !right-[-7px] !top-1/2 !-translate-y-1/2 !h-3 !w-3 !border-2 !border-[#0f172a] !bg-[#FF4438] z-20"
              />
            </div>
          ))}

          {/* Add button inline */}
          <button
            onClick={addButton}
            className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-indigo-200 bg-indigo-50/30 py-1.5 text-[11px] font-semibold text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50 transition-all cursor-pointer"
          >
            <Plus className="h-3 w-3" />
            <span>{t('node.keyboard_add_btn', 'Добавить постоянную кнопку')}</span>
          </button>
        </div>
      </div>

      {/* Mini Visual Grid Preview */}
      {buttons.length > 0 && (
        <div className="mt-3 rounded-lg bg-slate-50 p-2 border border-slate-100">
          <span className="text-[9px] font-semibold text-slate-400 block mb-1.5">
            {t('node.keyboard_preview_label', 'Предпросмотр сетки внизу чата:')}
          </span>
          <div
            className={`grid gap-1 ${
              buttons.length === 1
                ? 'grid-cols-1'
                : buttons.length === 2
                ? 'grid-cols-2'
                : buttons.length === 4
                ? 'grid-cols-2'
                : 'grid-cols-2'
            }`}
          >
            {buttons.map((btn, idx) => {
              const isLastOdd = buttons.length % 2 === 1 && idx === buttons.length - 1;
              return (
                <div
                  key={btn.id}
                  className={`truncate rounded bg-white px-1.5 py-1 text-center text-[10px] font-semibold text-slate-700 border border-slate-200/80 shadow-2xs ${
                    isLastOdd ? 'col-span-2' : ''
                  }`}
                >
                  {btn.text || t('node.keyboard_btn_default', 'Кнопка')}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Default Outgoing Handle (if no buttons yet) */}
      {buttons.length === 0 && (
        <Handle
          type="source"
          position={Position.Right}
          className="!h-3 !w-3 !border-2 !border-[#0f172a] !bg-[#FF4438]"
        />
      )}
    </div>
  );
};
