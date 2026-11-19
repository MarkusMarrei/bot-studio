import React, { useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { MessageSquare, Plus, X, Sparkles, Image, Trash2, Upload } from 'lucide-react';
import { useGraphStore } from '../../store/useGraphStore';
import { useTranslation } from '../../i18n/useTranslation';
import type { NodeData, ButtonItem } from '../../types/graph';

export const MessageNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const { t } = useTranslation();
  const { activeSimulatorNodeId, updateNodeData, deleteNode } = useGraphStore();
  const isSimActive = activeSimulatorNodeId === id;
  const nodeData = data as NodeData;
  const buttons = nodeData.buttons || [];

  const [magicLoading, setMagicLoading] = useState(false);
  const [showImageInput, setShowImageInput] = useState(Boolean(nodeData.image_path));

  const handleMagicPen = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!nodeData.text) return;
    setMagicLoading(true);
    try {
      const res = await fetch('/api/ai/magic-pen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: nodeData.text, action: 'friendly' })
      });
      const json = await res.json();
      if (json.result) {
        updateNodeData(id, { text: json.result });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setMagicLoading(false);
    }
  };

  const addButton = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newBtn: ButtonItem = {
      id: `btn_${Date.now()}`,
      text: `${t('node.button_text', 'Кнопка')} ${buttons.length + 1}`,
      action_type: 'callback'
    };
    updateNodeData(id, { buttons: [...buttons, newBtn] });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      updateNodeData(id, { image_path: result });
    };
    reader.readAsDataURL(file);
  };

  const getImagePreviewSrc = (path?: string) => {
    if (!path) return '';
    if (path.startsWith('data:') || path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    return `/api/media/local?path=${encodeURIComponent(path)}`;
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

  return (
    <div
      className={`group relative min-w-[270px] max-w-[310px] rounded-xl border bg-white p-3.5 shadow-md transition-all duration-200 ${
        selected
          ? 'border-red-500 ring-2 ring-red-500/20 shadow-lg'
          : 'border-slate-200 hover:border-slate-300'
      } ${
        isSimActive
          ? 'border-red-500 ring-4 ring-red-500/30 shadow-red-500/20 shadow-xl'
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
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 text-red-500">
            <MessageSquare className="h-4 w-4" />
          </div>
          <input
            type="text"
            value={nodeData.label || t('node.message', 'Сообщение')}
            onChange={(e) => updateNodeData(id, { label: e.target.value })}
            className="nodrag nowheel rounded border border-transparent px-1 py-0.5 text-xs font-semibold text-slate-800 hover:border-slate-200 focus:border-red-500 focus:bg-white focus:outline-none max-w-[130px]"
          />
        </div>

        <div className="flex items-center gap-1">
          {/* Quick AI Magic Pen */}
          <button
            onClick={handleMagicPen}
            disabled={magicLoading}
            className="flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-red-50 hover:text-red-500 transition-colors cursor-pointer"
            title={t('node.magic_pen', 'Стилизовать с ИИ')}
          >
            <Sparkles className="h-2.5 w-2.5 text-red-500" />
            <span>{magicLoading ? '...' : '✨'}</span>
          </button>

          {/* Toggle Media Image */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowImageInput(!showImageInput);
            }}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
            title="Прикрепить изображение"
          >
            <Image className="h-3.5 w-3.5" />
          </button>

          {/* Delete Node */}
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

      {/* Image URL / Path Input & File Upload */}
      {showImageInput && (
        <div className="mt-2 space-y-1.5 rounded-lg border border-slate-200 bg-slate-50/80 p-2">
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              placeholder="Ссылка или путь (assets/photo.jpg)..."
              value={nodeData.image_path || ''}
              onChange={(e) => updateNodeData(id, { image_path: e.target.value })}
              className="nodrag nowheel flex-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 focus:border-red-500 focus:outline-none"
            />
            <label className="flex h-6.5 items-center justify-center gap-1 rounded bg-slate-200 px-2 text-[10px] font-medium text-slate-700 hover:bg-slate-300 cursor-pointer transition-colors shrink-0">
              <Upload className="h-3 w-3" />
              <span>Файл</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </label>
          </div>

          {nodeData.image_path && (
            <div className="relative mt-1 overflow-hidden rounded border border-slate-200 bg-black/5">
              <img
                src={getImagePreviewSrc(nodeData.image_path)}
                alt="Preview"
                className="max-h-24 w-full object-cover rounded"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <button
                type="button"
                onClick={() => updateNodeData(id, { image_path: '' })}
                className="absolute right-1 top-1 rounded bg-black/60 p-0.5 text-white hover:bg-red-600 transition-colors cursor-pointer"
                title="Удалить фото"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Inline Editable Message Textarea */}
      <div className="mt-2.5">
        <textarea
          rows={3}
          placeholder={t('node.message_text_placeholder', 'Введите текст сообщения боту...')}
          value={nodeData.text || ''}
          onChange={(e) => updateNodeData(id, { text: e.target.value })}
          className="nodrag nowheel w-full resize-none rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-800 leading-relaxed placeholder:text-slate-400 focus:border-red-500 focus:bg-white focus:outline-none"
        />
      </div>

      {/* Inline Buttons Manager */}
      <div className="mt-2 space-y-1.5">
        {buttons.map((btn) => (
          <div
            key={btn.id}
            className="relative flex items-center justify-between rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs shadow-xs hover:border-slate-300"
          >
            <input
              type="text"
              value={btn.text}
              onChange={(e) => updateButtonText(btn.id, e.target.value)}
              className="nodrag nowheel flex-1 bg-transparent text-xs font-medium text-slate-800 focus:outline-none pr-2"
            />
            <button
              onClick={(e) => removeButton(btn.id, e)}
              className="rounded p-0.5 text-slate-400 hover:text-red-500 cursor-pointer"
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
          className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 py-1 text-[11px] font-medium text-slate-600 hover:border-red-400 hover:bg-red-50/50 hover:text-red-600 transition-all cursor-pointer"
        >
          <Plus className="h-3 w-3" />
          <span>{t('node.add_button', 'Добавить кнопку')}</span>
        </button>
      </div>

      {/* Default Outgoing Handle (if no buttons) */}
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
