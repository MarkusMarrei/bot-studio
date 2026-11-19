import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Rocket, Trash2 } from 'lucide-react';
import { useGraphStore } from '../../store/useGraphStore';
import { useTranslation } from '../../i18n/useTranslation';
import type { NodeData } from '../../types/graph';

export const StartNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const { t } = useTranslation();
  const { activeSimulatorNodeId, updateNodeData, deleteNode } = useGraphStore();
  const isSimActive = activeSimulatorNodeId === id;
  const nodeData = data as NodeData;

  return (
    <div
      className={`group relative min-w-[220px] rounded-xl border bg-white p-3.5 shadow-md transition-all duration-200 ${
        selected
          ? 'border-red-500 ring-2 ring-red-500/20 shadow-lg'
          : 'border-slate-200 hover:border-slate-300'
      } ${
        isSimActive
          ? 'border-emerald-500 ring-4 ring-emerald-500/30 shadow-emerald-500/20 shadow-xl'
          : ''
      }`}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 text-red-500">
            <Rocket className="h-4 w-4" />
          </div>
          <div>
            <span className="text-[10px] font-bold tracking-wider text-red-600 uppercase">
              {t('node.entry_point', 'ENTRY POINT')}
            </span>
          </div>
        </div>

        {/* Delete Node Button */}
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

      {/* Inline Editable Command */}
      <div className="mt-2.5">
        <label className="text-[10px] font-medium text-slate-500 block mb-0.5">
          {t('node.launch_command', 'Команда запуска')}
        </label>
        <input
          type="text"
          value={nodeData.command || '/start'}
          onChange={(e) => updateNodeData(id, { command: e.target.value })}
          className="nodrag nowheel w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-800 focus:border-red-500 focus:bg-white focus:outline-none"
        />
      </div>

      {/* Inline Editable Description */}
      <div className="mt-2">
        <input
          type="text"
          placeholder={t('node.entry_point_desc', 'Описание точки входа...')}
          value={nodeData.description || ''}
          onChange={(e) => updateNodeData(id, { description: e.target.value })}
          className="nodrag nowheel w-full rounded border border-transparent px-1.5 py-0.5 text-[11px] text-slate-500 hover:border-slate-200 focus:border-red-500 focus:bg-white focus:outline-none"
        />
      </div>

      {/* Outgoing Execution Handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !border-2 !border-[#0f172a] !bg-[#FF4438]"
      />
    </div>
  );
};
