import React, { useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Sparkles, Globe, Sliders, Eye, EyeOff, Check, Trash2, ShieldAlert } from 'lucide-react';
import { useGraphStore } from '../../store/useGraphStore';
import { useTranslation } from '../../i18n/useTranslation';
import type { NodeData } from '../../types/graph';

export const AiAssistantNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const { t } = useTranslation();
  const { activeSimulatorNodeId, updateNodeData, deleteNode } = useGraphStore();
  const isSimActive = activeSimulatorNodeId === id;
  const nodeData = data as NodeData;

  const [activeTab, setActiveTab] = useState<'connection' | 'settings'>('connection');
  const [showApiKey, setShowApiKey] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const baseUrl = nodeData.ai_base_url || 'https://api.openai.com/v1';
  const modelName = nodeData.ai_model || 'gpt-4o-mini';
  const apiKey = nodeData.ai_api_key || '';
  const limitType = nodeData.ai_limit_type || 'per_hour';
  const limitCount = nodeData.ai_limit_count ?? 15;
  const systemPrompt = nodeData.ai_system_prompt || 'You are a helpful and smart AI assistant in Telegram.';
  const welcomeText = nodeData.ai_welcome_text ?? '👋 Здравствуйте! Я ИИ-ассистент. Чем я могу вам помочь? Напишите ваш вопрос прямо в чат.';
  const limitText = nodeData.ai_limit_text ?? '⚠️ Вы достигли лимита бесплатных сообщений к ИИ-ассистенту. Пожалуйста, обратитесь к администратору или вернитесь в главное меню.';

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const setPreset = (url: string, model: string) => {
    updateNodeData(id, {
      ai_base_url: url,
      ai_model: model
    });
  };

  return (
    <div
      className={`group relative min-w-[320px] max-w-[350px] rounded-xl border bg-white p-3.5 shadow-md transition-all duration-200 ${
        selected
          ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-lg'
          : 'border-slate-200 hover:border-slate-300'
      } ${
        isSimActive
          ? 'border-indigo-500 ring-4 ring-indigo-500/30 shadow-indigo-500/20 shadow-xl'
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
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-800 tracking-wide">
                {nodeData.label || t('node.ai_title', 'AI')}
              </span>
              <span className="rounded bg-indigo-50 px-1.5 py-0.2 text-[9px] font-semibold text-indigo-600 border border-indigo-100">
                API
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium leading-none mt-0.5 truncate max-w-[170px]">
              {modelName || t('node.ai_integration_desc', 'LLM интеграция')}
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

      {/* 2 Tabs: Connection and Settings */}
      <div className="mt-2.5 flex rounded-lg bg-slate-100 p-0.5 text-[11px] font-semibold text-slate-600">
        <button
          type="button"
          onClick={() => setActiveTab('connection')}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-1 transition-all cursor-pointer ${
            activeTab === 'connection'
              ? 'bg-white text-indigo-600 shadow-2xs font-bold'
              : 'hover:text-slate-900'
          }`}
        >
          <Globe className="h-3 w-3" />
          <span>{t('node.ai_tab_connection', 'Подключение')}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-1 transition-all cursor-pointer ${
            activeTab === 'settings'
              ? 'bg-white text-indigo-600 shadow-2xs font-bold'
              : 'hover:text-slate-900'
          }`}
        >
          <Sliders className="h-3 w-3" />
          <span>{t('node.ai_tab_settings', 'Настройки')}</span>
        </button>
      </div>

      {/* TAB 1: Connection (Base URL, Model, API Key) */}
      {activeTab === 'connection' && (
        <div className="mt-3 space-y-2.5">
          {/* Base URL */}
          <div>
            <div className="flex items-center justify-between mb-0.5">
              <label className="text-[10px] font-medium text-slate-500">
                {t('node.ai_base_url', 'Базовый URL (Base URL)')}
              </label>
            </div>
            <input
              type="text"
              value={baseUrl}
              placeholder="https://api.openai.com/v1"
              onChange={(e) => updateNodeData(id, { ai_base_url: e.target.value })}
              className="nodrag nowheel w-full rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 py-1 text-xs text-slate-800 font-mono placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none"
            />
            {/* Presets */}
            <div className="mt-1 flex items-center gap-1 flex-wrap">
              <button
                type="button"
                onClick={() => setPreset('https://api.openai.com/v1', 'gpt-4o-mini')}
                className="text-[9px] bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 rounded px-1.5 py-0.5 transition-colors cursor-pointer"
              >
                OpenAI
              </button>
              <button
                type="button"
                onClick={() => setPreset('https://openrouter.ai/api/v1', 'meta-llama/llama-3.1-8b-instruct:free')}
                className="text-[9px] bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 rounded px-1.5 py-0.5 transition-colors cursor-pointer"
              >
                OpenRouter
              </button>
              <button
                type="button"
                onClick={() => setPreset('https://api.groq.com/openai/v1', 'llama-3.1-8b-instant')}
                className="text-[9px] bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 rounded px-1.5 py-0.5 transition-colors cursor-pointer"
              >
                Groq
              </button>
              <button
                type="button"
                onClick={() => setPreset('http://127.0.0.1:8081/v1', 'gemma-4-E2B')}
                className="text-[9px] bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 rounded px-1.5 py-0.5 transition-colors cursor-pointer"
              >
                {t('node.ai_preset_local', 'Локальный')}
              </button>
            </div>
          </div>

          {/* Model Name */}
          <div>
            <label className="text-[10px] font-medium text-slate-500 block mb-0.5">
              {t('node.ai_model_name', 'Название модели (Model)')}
            </label>
            <input
              type="text"
              value={modelName}
              placeholder="gpt-4o-mini, claude-3-5-sonnet, llama-3.1-8b..."
              onChange={(e) => updateNodeData(id, { ai_model: e.target.value })}
              className="nodrag nowheel w-full rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 py-1 text-xs text-slate-800 font-semibold placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none"
            />
          </div>

          {/* API Key */}
          <div>
            <label className="text-[10px] font-medium text-slate-500 block mb-0.5">
              {t('node.ai_api_key', 'API-ключ (API Key)')}
            </label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                placeholder="sk-proj-..."
                onChange={(e) => updateNodeData(id, { ai_api_key: e.target.value })}
                className="nodrag nowheel w-full rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 py-1 pr-7 text-xs text-slate-800 font-mono placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                title={showApiKey ? t('node.ai_hide_key', 'Скрыть ключ') : t('node.ai_show_key', 'Показать ключ')}
              >
                {showApiKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Settings (Welcome message, Rate limit, Limit text, System Prompt, Save) */}
      {activeTab === 'settings' && (
        <div className="mt-3 space-y-2.5">
          {/* Welcome Message upon entry */}
          <div>
            <label className="text-[10px] font-semibold text-slate-700 block mb-0.5">
              {t('node.ai_welcome_label', 'Приветственное сообщение (при переходе к AI)')}
            </label>
            <textarea
              rows={2}
              placeholder={t('node.ai_welcome_placeholder', '👋 Здравствуйте! Я ИИ-ассистент. Задайте мне любой вопрос...')}
              value={welcomeText}
              onChange={(e) => updateNodeData(id, { ai_welcome_text: e.target.value })}
              className="nodrag nowheel w-full resize-none rounded-lg border border-slate-200 bg-slate-50/50 p-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none"
            />
            <p className="text-[9px] text-slate-400 mt-0.5 leading-tight">
              {t('node.ai_welcome_desc', 'Отправляется пользователю, когда он открывает ассистента.')}
            </p>
          </div>

          {/* Rate Limit Dropdown */}
          <div>
            <div className="flex items-center gap-1 mb-1">
              <ShieldAlert className="h-3 w-3 text-indigo-500" />
              <label className="text-[10px] font-semibold text-slate-700">
                {t('node.ai_limit_title', 'Ограничение сообщений (Антиспам)')}
              </label>
            </div>
            <select
              value={limitType}
              onChange={(e) => updateNodeData(id, { ai_limit_type: e.target.value as 'none' | 'total' | 'per_hour' })}
              className="nodrag nowheel w-full rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 py-1 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none cursor-pointer"
            >
              <option value="none">{t('node.ai_limit_none', 'Без ограничений')}</option>
              <option value="per_hour">{t('node.ai_limit_per_hour', 'Ограничение сообщений в час')}</option>
              <option value="total">{t('node.ai_limit_total', 'Абсолютный лимит (всего сообщений до блокировки)')}</option>
            </select>
          </div>

          {/* Limit Count Number Input */}
          {limitType !== 'none' && (
            <div className="rounded-lg bg-indigo-50/40 p-2 border border-indigo-100">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-medium text-indigo-950">
                  {limitType === 'per_hour'
                    ? t('node.ai_limit_per_hour_label', 'Сообщений за 1 час:')
                    : t('node.ai_limit_total_label', 'Всего сообщений:')}
                </span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={limitCount}
                    onChange={(e) => updateNodeData(id, { ai_limit_count: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="nodrag nowheel w-16 rounded border border-indigo-200 bg-white px-1.5 py-0.5 text-xs font-bold text-indigo-700 text-center focus:outline-none"
                  />
                  <span className="text-[10px] font-semibold text-indigo-600">
                    {t('node.ai_unit_pcs', 'шт.')}
                  </span>
                </div>
              </div>
              <p className="text-[9px] text-indigo-600/80 leading-tight">
                {limitType === 'per_hour'
                  ? t('node.ai_limit_per_hour_desc', '⏱ Человек сможет отправить не более {count} сообщений в течение часа.').replace('{count}', String(limitCount))
                  : t('node.ai_limit_total_desc', '🔒 Доступ блокируется после отправки {count} сообщений.').replace('{count}', String(limitCount))}
              </p>
            </div>
          )}

          {/* Limit Reached Message */}
          {limitType !== 'none' && (
            <div>
              <label className="text-[10px] font-semibold text-slate-700 block mb-0.5">
                {t('node.ai_limit_text_label', 'Сообщение при исчерпании лимита')}
              </label>
              <textarea
                rows={2}
                placeholder={t('node.ai_limit_text_placeholder', '⚠️ Вы исчерпали лимит сообщений к ИИ...')}
                value={limitText}
                onChange={(e) => updateNodeData(id, { ai_limit_text: e.target.value })}
                className="nodrag nowheel w-full resize-none rounded-lg border border-slate-200 bg-slate-50/50 p-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none"
              />
              <p className="text-[9px] text-slate-400 mt-0.5 leading-tight">
                {t('node.ai_limit_text_desc', 'Отправляется при попытке отправить сообщение сверх лимита.')}
              </p>
            </div>
          )}

          {/* System Prompt */}
          <div>
            <label className="text-[10px] font-medium text-slate-500 block mb-0.5">
              {t('node.ai_system_prompt_label', 'Системный промпт (роль бота)')}
            </label>
            <textarea
              rows={2}
              placeholder={t('node.ai_system_prompt_placeholder', 'Опишите инструкции для AI...')}
              value={systemPrompt}
              onChange={(e) => updateNodeData(id, { ai_system_prompt: e.target.value })}
              className="nodrag nowheel w-full resize-none rounded-lg border border-slate-200 bg-slate-50/50 p-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none"
            />
          </div>

          {/* Save Button */}
          <button
            type="button"
            onClick={handleSave}
            className={`w-full flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              saveSuccess
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.98] shadow-xs'
            }`}
          >
            {saveSuccess ? (
              <>
                <Check className="h-3.5 w-3.5" />
                <span>{t('node.ai_saved_success', 'Настройки сохранены!')}</span>
              </>
            ) : (
              <span>{t('node.ai_save_btn', 'Сохранить настройки')}</span>
            )}
          </button>
        </div>
      )}

      {/* Target execution handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !border-2 !border-[#0f172a] !bg-[#FF4438]"
      />
    </div>
  );
};
