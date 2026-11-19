import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Code2, AlertTriangle, CheckCircle2, Trash2 } from 'lucide-react';
import { useGraphStore } from '../../store/useGraphStore';
import { useTranslation } from '../../i18n/useTranslation';
import type { NodeData } from '../../types/graph';

export const CustomCodeNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const { t } = useTranslation();
  const { activeSimulatorNodeId, updateNodeData, deleteNode } = useGraphStore();
  const isSimActive = activeSimulatorNodeId === id;
  const nodeData = data as NodeData;
  const needsReview = nodeData.review_status === 'needs_review';

  return (
    <div
      className={`group relative min-w-[280px] max-w-[320px] rounded-xl border bg-white p-3.5 shadow-md transition-all duration-200 ${
        selected
          ? 'border-red-500 ring-2 ring-red-500/20 shadow-lg'
          : needsReview
          ? 'border-amber-300'
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
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-50 text-orange-500">
            <Code2 className="h-4 w-4" />
          </div>
          <span className="text-xs font-semibold text-slate-800">
            {nodeData.label || t('node.custom_code_title', 'КАСТОМНЫЙ PYTHON КОД')}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {needsReview ? (
            <button
              onClick={() => updateNodeData(id, { review_status: 'verified' })}
              className="flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 hover:bg-amber-100 cursor-pointer"
              title="Нажмите, чтобы подтвердить проверку"
            >
              <AlertTriangle className="h-2.5 w-2.5 text-amber-600" />
              <span>Review</span>
            </button>
          ) : (
            <span className="flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600">
              <CheckCircle2 className="h-2.5 w-2.5" />
              <span>OK</span>
            </span>
          )}

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

      {/* Inline Python Code Textarea */}
      <div className="mt-2.5">
        <label className="text-[10px] font-medium text-slate-500 block mb-0.5">
          {t('node.custom_code_label', 'Python код хендлера')}
        </label>
        <textarea
          rows={6}
          value={nodeData.code || ''}
          onChange={(e) => updateNodeData(id, { code: e.target.value })}
          className="nodrag nowheel w-full resize-none rounded-lg border border-slate-800 bg-[#1e222d] p-2.5 font-mono text-xs text-amber-300 leading-relaxed focus:border-red-500 focus:outline-none"
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
