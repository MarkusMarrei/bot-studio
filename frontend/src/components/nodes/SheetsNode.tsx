import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Table, Trash2 } from 'lucide-react';
import { useGraphStore } from '../../store/useGraphStore';
import { useTranslation } from '../../i18n/useTranslation';
import type { NodeData } from '../../types/graph';

export const SheetsNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const { t } = useTranslation();
  const { activeSimulatorNodeId, updateNodeData, deleteNode } = useGraphStore();
  const isSimActive = activeSimulatorNodeId === id;
  const nodeData = data as NodeData;

  return (
    <div
      className={`group relative min-w-[240px] rounded-xl border bg-white p-3.5 shadow-md transition-all duration-200 ${
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
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
            <Table className="h-4 w-4" />
          </div>
          <span className="text-xs font-semibold text-slate-800">
            {nodeData.label || t('node.sheets_title', 'ЗАПИСЬ В ТАБЛИЦУ')}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <select
            value={nodeData.storage_type || 'csv'}
            onChange={(e) => updateNodeData(id, { storage_type: e.target.value as any })}
            className="nodrag nowheel rounded border border-slate-200 bg-slate-50 px-1 py-0.5 text-[10px] font-semibold text-teal-700 uppercase focus:outline-none"
          >
            <option value="csv">CSV</option>
            <option value="google_sheets">Sheets</option>
            <option value="sqlite">SQLite</option>
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

      {/* Inline File Name Field */}
      <div className="mt-2.5">
        <label className="text-[10px] font-medium text-slate-500 block mb-0.5">
          {t('node.sheets_table_name', 'Имя таблицы / файла:')}
        </label>
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs">
          <span className="text-slate-400 font-mono text-[11px]">leads_</span>
          <input
            type="text"
            value={nodeData.table_name || 'data'}
            onChange={(e) => updateNodeData(id, { table_name: e.target.value })}
            className="nodrag nowheel flex-1 bg-transparent font-mono text-xs font-semibold text-slate-800 focus:outline-none"
          />
          <span className="text-slate-400 font-mono text-[11px]">.csv</span>
        </div>
      </div>

      <div className="mt-2 rounded-lg bg-slate-50 p-2 text-[10px] text-slate-500">
        <span className="text-teal-700 font-medium">{t('node.sheets_lead_log', 'Записывает: timestamp, user_id, username, form_data')}</span>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !border-2 !border-[#0f172a] !bg-[#FF4438]"
      />
    </div>
  );
};
