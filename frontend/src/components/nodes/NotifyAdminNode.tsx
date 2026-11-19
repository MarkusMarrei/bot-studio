import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { BellRing, Trash2 } from 'lucide-react';
import { useGraphStore } from '../../store/useGraphStore';
import { useTranslation } from '../../i18n/useTranslation';
import type { NodeData } from '../../types/graph';

export const NotifyAdminNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const { t } = useTranslation();
  const { activeSimulatorNodeId, updateNodeData, deleteNode } = useGraphStore();
  const isSimActive = activeSimulatorNodeId === id;
  const nodeData = data as NodeData;

  return (
    <div
      className={`group relative min-w-[260px] max-w-[290px] rounded-xl border bg-white p-3.5 shadow-md transition-all duration-200 ${
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
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
            <BellRing className="h-4 w-4" />
          </div>
          <span className="text-xs font-semibold text-slate-800">
            {nodeData.label || t('node.notify_title', 'УВЕДОМЛЕНИЕ В ЛС')}
          </span>
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

      {/* Admin ID input */}
      <div className="mt-2.5">
        <label className="text-[10px] font-medium text-slate-500 block mb-0.5">
          {t('node.notify_recipient', 'Telegram ID получателя:')}
        </label>
        <input
          type="text"
          placeholder="123456789"
          value={nodeData.admin_id || ''}
          onChange={(e) => updateNodeData(id, { admin_id: e.target.value })}
          className="nodrag nowheel w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-xs font-semibold text-slate-800 focus:border-red-500 focus:bg-white focus:outline-none"
        />
      </div>

      {/* Template textarea */}
      <div className="mt-2">
        <label className="text-[10px] font-medium text-slate-500 block mb-0.5">
          {t('node.notify_template', 'Шаблон сообщения:')}
        </label>
        <textarea
          rows={2}
          value={nodeData.notification_template || ''}
          onChange={(e) => updateNodeData(id, { notification_template: e.target.value })}
          className="nodrag nowheel w-full resize-none rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-800 focus:border-red-500 focus:bg-white focus:outline-none"
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
