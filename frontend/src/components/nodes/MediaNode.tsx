import React, { useRef } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Image, Video, Music, Upload, Link, Trash2, FileCheck } from 'lucide-react';
import { useGraphStore } from '../../store/useGraphStore';
import { useTranslation } from '../../i18n/useTranslation';
import type { NodeData } from '../../types/graph';

export const MediaNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const { t } = useTranslation();
  const { activeSimulatorNodeId, updateNodeData, deleteNode } = useGraphStore();
  const isSimActive = activeSimulatorNodeId === id;
  const nodeData = data as NodeData;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mediaType = nodeData.media_type || 'photo';
  const mediaSource = nodeData.media_source || 'url';
  const mediaUrl = nodeData.media_url || '';
  const mediaFileName = nodeData.media_file_name || '';
  const caption = nodeData.caption || '';

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      updateNodeData(id, {
        media_source: 'upload',
        media_url: result,
        media_file_name: file.name
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div
      className={`group relative min-w-[300px] max-w-[340px] rounded-xl border bg-white p-3.5 shadow-md transition-all duration-200 ${
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

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept={
          mediaType === 'photo'
            ? 'image/*'
            : mediaType === 'video'
            ? 'video/*'
            : 'audio/*'
        }
        className="hidden"
      />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
            {mediaType === 'photo' ? (
              <Image className="h-4 w-4" />
            ) : mediaType === 'video' ? (
              <Video className="h-4 w-4" />
            ) : (
              <Music className="h-4 w-4" />
            )}
          </div>
          <div>
            <span className="text-xs font-bold text-slate-800">
              {nodeData.label || t('node.media_title', 'МУЛЬТИМЕДИА')}
            </span>
            <p className="text-[10px] text-slate-400 font-medium leading-none mt-0.5">
              {mediaType === 'photo'
                ? t('node.media_type_photo', 'Изображение / Фото')
                : mediaType === 'video'
                ? t('node.media_type_video', 'Видеоролик')
                : t('node.media_type_audio', 'Аудио / Голосовое')}
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

      {/* Media Type Tabs: Photo | Video | Audio */}
      <div className="mt-3 flex rounded-lg bg-slate-100 p-0.5 text-[11px] font-semibold text-slate-600">
        <button
          type="button"
          onClick={() => updateNodeData(id, { media_type: 'photo' })}
          className={`flex-1 flex items-center justify-center gap-1 rounded-md py-1 transition-all cursor-pointer ${
            mediaType === 'photo'
              ? 'bg-white text-slate-900 shadow-2xs font-bold'
              : 'hover:text-slate-900'
          }`}
        >
          <Image className="h-3 w-3 text-purple-500" />
          <span>{t('node.media_tab_photo', 'Фото')}</span>
        </button>

        <button
          type="button"
          onClick={() => updateNodeData(id, { media_type: 'video' })}
          className={`flex-1 flex items-center justify-center gap-1 rounded-md py-1 transition-all cursor-pointer ${
            mediaType === 'video'
              ? 'bg-white text-slate-900 shadow-2xs font-bold'
              : 'hover:text-slate-900'
          }`}
        >
          <Video className="h-3 w-3 text-blue-500" />
          <span>{t('node.media_tab_video', 'Видео')}</span>
        </button>

        <button
          type="button"
          onClick={() => updateNodeData(id, { media_type: 'audio' })}
          className={`flex-1 flex items-center justify-center gap-1 rounded-md py-1 transition-all cursor-pointer ${
            mediaType === 'audio'
              ? 'bg-white text-slate-900 shadow-2xs font-bold'
              : 'hover:text-slate-900'
          }`}
        >
          <Music className="h-3 w-3 text-emerald-500" />
          <span>{t('node.media_tab_audio', 'Аудио')}</span>
        </button>
      </div>

      {/* Source Selector: URL vs Upload */}
      <div className="mt-2.5 flex items-center justify-between">
        <span className="text-[10px] font-semibold text-slate-500">
          {t('node.media_source_label', 'Источник медиа:')}
        </span>
        <div className="flex gap-1 text-[10px]">
          <button
            type="button"
            onClick={() => updateNodeData(id, { media_source: 'url' })}
            className={`px-2 py-0.5 rounded cursor-pointer ${
              mediaSource === 'url' ? 'bg-purple-100 text-purple-700 font-bold' : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            {t('node.media_source_url', 'Ссылка (URL)')}
          </button>
          <button
            type="button"
            onClick={() => updateNodeData(id, { media_source: 'upload' })}
            className={`px-2 py-0.5 rounded cursor-pointer ${
              mediaSource === 'upload' ? 'bg-purple-100 text-purple-700 font-bold' : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            {t('node.media_source_upload', 'Файл с ПК')}
          </button>
        </div>
      </div>

      {/* Input depending on Source */}
      <div className="mt-2">
        {mediaSource === 'url' ? (
          <div className="relative">
            <input
              type="text"
              placeholder={t('node.media_url_placeholder', 'Вставьте прямую ссылку на фото, видео или аудио...')}
              value={mediaUrl.startsWith('data:') ? '' : mediaUrl}
              onChange={(e) => updateNodeData(id, { media_url: e.target.value, media_file_name: '' })}
              className="nodrag nowheel w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-7 pr-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-red-500 focus:bg-white focus:outline-none"
            />
            <Link className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-purple-300 bg-purple-50/50 px-3 py-2 text-xs font-semibold text-purple-700 hover:bg-purple-100/60 transition-colors cursor-pointer"
            >
              <Upload className="h-3.5 w-3.5 text-purple-500" />
              <span>
                {mediaFileName
                  ? t('node.media_replace_file', 'Заменить файл')
                  : t('node.media_choose_file', 'Выбрать файл')}
              </span>
            </button>
            {mediaFileName && (
              <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium max-w-[100px] truncate" title={mediaFileName}>
                <FileCheck className="h-3 w-3 shrink-0" />
                <span className="truncate">{mediaFileName}</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Live Preview if media exists */}
      {mediaUrl && (
        <div className="mt-2.5 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
          {mediaType === 'photo' ? (
            <img
              src={mediaUrl}
              alt="Preview"
              className="h-28 w-full object-cover"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : mediaType === 'video' ? (
            <div className="relative flex h-24 w-full items-center justify-center bg-slate-900 text-white">
              <Video className="h-8 w-8 text-purple-400 opacity-80" />
              <span className="absolute bottom-1.5 left-2 text-[10px] font-mono text-slate-300">
                {t('node.media_type_video', 'Видеоролик')}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-2.5 text-xs text-slate-700">
              <Music className="h-5 w-5 text-emerald-500" />
              <span className="font-mono text-[11px] truncate">
                {mediaFileName || t('node.media_type_audio', 'Аудио / Голосовое')}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Caption Textarea */}
      <div className="mt-2.5">
        <label className="text-[10px] font-medium text-slate-500 block mb-0.5">
          {t('node.media_caption_label', 'Подпись к медиа (Caption)')}
        </label>
        <textarea
          rows={2}
          value={caption}
          placeholder={t('node.media_caption_placeholder', 'Текст описания к медиафайлу...')}
          onChange={(e) => updateNodeData(id, { caption: e.target.value })}
          className="nodrag nowheel w-full resize-none rounded-lg border border-slate-200 bg-slate-50/50 p-2 text-xs text-slate-800 placeholder-slate-400 focus:border-red-500 focus:bg-white focus:outline-none"
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
