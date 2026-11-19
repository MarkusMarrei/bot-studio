import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Keyboard, Variable, Trash2 } from 'lucide-react';
import { useGraphStore } from '../../store/useGraphStore';
import { useTranslation } from '../../i18n/useTranslation';
import type { NodeData } from '../../types/graph';

export const InputNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const { t } = useTranslation();
  const { activeSimulatorNodeId, updateNodeData, deleteNode } = useGraphStore();
  const isSimActive = activeSimulatorNodeId === id;
  const nodeData = data as NodeData;

  return (
    <div
      className={`group relative min-w-[250px] max-w-[280px] rounded-xl border bg-white p-3.5 shadow-md transition-all duration-200 ${
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
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-500">
            <Keyboard className="h-4 w-4" />
          </div>
          <span className="text-xs font-semibold text-slate-800">
            {nodeData.label || t('palette.input', 'Опрос (FSM)')}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <select
            value={nodeData.input_type || 'text'}
            onChange={(e) => updateNodeData(id, { input_type: e.target.value as any })}
            className="nodrag nowheel rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 focus:border-red-500 focus:outline-none"
          >
            <option value="text">{t('node.input_type_text', 'Текст')}</option>
            <option value="number">{t('node.input_type_number', 'Число')}</option>
            <option value="phone">{t('node.input_type_phone', 'Телефон')}</option>
            <option value="email">{t('node.input_type_email', 'Email')}</option>
          </select>

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
      </div>

      {/* Inline Prompt Textarea */}
      <div className="mt-2.5">
        <label className="text-[10px] font-medium text-slate-500 block mb-0.5">
          {t('node.input_prompt', 'Вопрос пользователю')}
        </label>
        <textarea
          rows={2}
          placeholder={t('node.input_text_placeholder', 'Пожалуйста, введите ваш ответ...')}
          value={nodeData.text || ''}
          onChange={(e) => updateNodeData(id, { text: e.target.value })}
          className="nodrag nowheel w-full resize-none rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-red-500 focus:bg-white focus:outline-none"
        />
      </div>

      {/* Variable Name field */}
      <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs">
        <Variable className="h-3.5 w-3.5 text-amber-500 shrink-0" />
        <span className="text-[11px] text-slate-500">{t('node.save_to_var', 'В переменную:')}</span>
        <input
          type="text"
          value={nodeData.variable_name || ''}
          onChange={(e) => updateNodeData(id, { variable_name: e.target.value })}
          className="nodrag nowheel flex-1 bg-transparent font-mono text-xs font-semibold text-slate-800 focus:outline-none"
        />
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !border-2 !border-[#0f172a] !bg-[#FF4438]"
      />
    </div>
  );
};
