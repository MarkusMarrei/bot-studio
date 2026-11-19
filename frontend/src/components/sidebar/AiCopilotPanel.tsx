import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Settings,
  Send,
  Loader2,
  Mic,
  MicOff,
  Paperclip,
  X,
  FileText,
  FileSpreadsheet,
  Download,
  Play,
  Cpu,
  ChevronRight,
  ChevronLeft,
  Wand2,
  FileCode,
  ShieldCheck
} from 'lucide-react';
import { useGraphStore } from '../../store/useGraphStore';
import { getLayoutedElements } from '../canvas/autoLayout';
import { useTranslation } from '../../i18n/useTranslation';
import { ChatMessageContent } from './ChatMessageContent';

interface RAGDoc {
  filename: string;
  extension?: string;
  char_count: number;
  text: string;
  preview: string;
}

interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  generatedGraph?: any;
  attachedDocName?: string;
}

interface AiCopilotPanelProps {
  onOpenLegacyImport?: () => void;
}

export const AiCopilotPanel: React.FC<AiCopilotPanelProps> = ({ onOpenLegacyImport }) => {
  const { t, currentLanguageInfo } = useTranslation();
  const { nodes, edges, loadTemplate } = useGraphStore();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Model & Server Status
  const [engineStatus, setEngineStatus] = useState<{
    is_online: boolean;
    is_loaded: boolean;
    model_downloaded: boolean;
    file_size_mb: number;
    status_text: string;
    model_name: string;
  }>({
    is_online: true,
    is_loaded: false,
    model_downloaded: false,
    file_size_mb: 0,
    status_text: '',
    model_name: 'gemma-4-E4B-Q4_K_M.gguf'
  });

  const modelToPull = 'google/gemma-4-E4B-Q4_K_M';
  const [pulling, setPulling] = useState(false);
  const [pullMessage, setPullMessage] = useState('');

  // RAG Attached Documents
  const [attachedDocs, setAttachedDocs] = useState<RAGDoc[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voice Input (Web Speech API with 3-second silence detector)
  const [isListening, setIsListening] = useState(false);
  const speechRecognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<any>(null);
  const baseInputRef = useRef<string>('');
  const finalTranscriptRef = useRef<string>('');

  // Chat Feed
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: t('ai.welcome_msg', '👋 Здравствуйте! Я ваш ИИ-Ассистент (Gemma-4-E4B Q4). Опишите задачу, и я сгенерирую сценарий или помогу доработать логику бота.')
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchStatus();
  }, []);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/ai/status');
      const data = await res.json();
      setEngineStatus(data);
    } catch {
      // offline
    }
  };

  const handlePullModel = async () => {
    if (!modelToPull.trim()) return;
    setPulling(true);
    setPullMessage(t('ai.settings_downloading', 'Загрузка модели...'));
    try {
      const res = await fetch('/api/ai/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelToPull.trim() })
      });
      const data = await res.json();
      setPullMessage(data.message || 'Complete');
      fetchStatus();
    } catch (err: any) {
      setPullMessage(`Error: ${err.message}`);
    } finally {
      setPulling(false);
    }
  };

  const handleLaunchDaemon = async () => {
    try {
      setPullMessage('Запуск встроенного движка llama.cpp...');
      const res = await fetch('/api/ai/launch', { method: 'POST' });
      const data = await res.json();
      setPullMessage(data.message || 'Встроенный движок запущен и готов к работе');
      setTimeout(fetchStatus, 1500);
    } catch (e: any) {
      setPullMessage(`Ошибка запуска: ${e.message}`);
    }
  };

  // ==========================================
  // RAG Document Upload Handler
  // ==========================================
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingDoc(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/ai/upload-rag', {
          method: 'POST',
          body: formData
        });
        const docInfo: RAGDoc = await res.json();
        setAttachedDocs((prev) => [...prev, docInfo]);
      }
    } catch (err: any) {
      console.error('Failed to parse document:', err);
    } finally {
      setUploadingDoc(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeDoc = (filename: string) => {
    setAttachedDocs((prev) => prev.filter((d) => d.filename !== filename));
  };

  // ==========================================
  // Voice Input (Dynamic language + 3-second silence detector)
  // ==========================================
  const toggleVoiceInput = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(t('ai.voice_unsupported', 'Ваш браузер не поддерживает распознавание речи. Рекомендуется использовать Chrome или Edge.'));
      return;
    }

    if (isListening) {
      stopVoice();
      return;
    }

    try {
      baseInputRef.current = chatInput;
      finalTranscriptRef.current = '';

      const recognition = new SpeechRecognition();
      // Dynamically bind to current UI language!
      const langInfo = currentLanguageInfo();
      recognition.lang = langInfo.speechCode || 'ru-RU';
      recognition.continuous = true;
      recognition.interimResults = true;

      const resetSilenceTimer = () => {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          stopVoice();
        }, 3000);
      };

      recognition.onstart = () => {
        setIsListening(true);
        resetSilenceTimer();
      };

      recognition.onresult = (event: any) => {
        resetSilenceTimer();
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          const part = res[0]?.transcript || '';
          if (res.isFinal) {
            finalTranscriptRef.current += (finalTranscriptRef.current ? ' ' : '') + part.trim();
          } else {
            interimTranscript += part;
          }
        }
        const spoken = (finalTranscriptRef.current + (interimTranscript ? ' ' + interimTranscript.trim() : '')).trim();
        const base = baseInputRef.current.trim();
        const combined = base ? (spoken ? `${base} ${spoken}` : base) : spoken;
        setChatInput(combined);
      };

      recognition.onerror = () => {
        stopVoice();
      };

      recognition.onend = () => {
        setIsListening(false);
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      };

      speechRecognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.error('Speech recognition error:', e);
      setIsListening(false);
    }
  };

  const stopVoice = () => {
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
    setIsListening(false);
    baseInputRef.current = '';
    finalTranscriptRef.current = '';
  };

  // ==========================================
  // Chat Actions
  // ==========================================
  const handleSendChat = async (e?: React.FormEvent, directMessage?: string) => {
    if (e) e.preventDefault();
    const query = directMessage || chatInput;
    if (!query.trim() || chatLoading) return;

    stopVoice();

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text: query.trim(),
      attachedDocName: attachedDocs.length > 0 ? attachedDocs.map((d) => d.filename).join(', ') : undefined
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query.trim(),
          graph: { nodes, edges },
          documents: attachedDocs
        })
      });

      const data = await res.json();
      const aiMsg: ChatMessage = {
        id: `ai_${Date.now()}`,
        sender: 'ai',
        text: data.reply || t('ai.thinking', 'Готово!'),
        generatedGraph: data.generated_graph
      };
      setChatMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      setChatMessages((prev) => [
        ...prev,
        {
          id: `ai_err_${Date.now()}`,
          sender: 'ai',
          text: `⚠️ Ошибка соединения с ИИ-сервером: ${err.message}`
        }
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  // Apply Graph onto Canvas
  const handleApplyGraph = (graph: any) => {
    if (!graph || !graph.nodes) return;
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      graph.nodes.map((n: any, idx: number) => ({
        id: n.id || `node_${idx}`,
        type: n.type || 'message',
        position: { x: 120 * idx, y: 150 },
        data: n.data || {}
      })),
      graph.edges || []
    );

    loadTemplate(layoutedNodes, layoutedEdges);
  };

  // Quick Action Chips
  const handleQuickChip = (type: string) => {
    if (type === 'create') {
      setChatInput(t('ai.prompt_create_prefix', 'Создай бота для '));
    } else if (type === 'reverse') {
      if (onOpenLegacyImport) {
        onOpenLegacyImport();
      } else {
        setChatInput(t('ai.prompt_reverse_code', 'Вот код моего старого бота, перенеси его в визуальный граф:\n\n```python\n# Вставьте ваш код сюда\n```'));
      }
    } else if (type === 'audit') {
      handleSendChat(undefined, t('ai.prompt_audit', 'Проведи логический аудит текущего графа: проверь тупики, оборванные связи и подскажи улучшения.'));
    } else if (type === 'rag') {
      fileInputRef.current?.click();
    }
  };

  if (isCollapsed) {
    return (
      <div className="flex h-full w-12 flex-col justify-between items-center border-l border-slate-200 bg-white shadow-xs select-none z-20">
        {/* Top: Expand Button */}
        <div className="flex flex-col items-center p-2 border-b border-slate-100 w-full">
          <button
            onClick={() => setIsCollapsed(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-xs cursor-pointer group"
            title={t('ai.expand_tooltip', 'Развернуть ИИ-Ассистент')}
          >
            <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          </button>
        </div>

        {/* Center: Vertical Label Bar (Click to expand) */}
        <div
          onClick={() => setIsCollapsed(false)}
          className="flex-1 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-slate-50 transition-colors w-full py-6"
          title={t('ai.click_to_expand', 'Нажмите, чтобы развернуть')}
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 text-red-500">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <span
            className="text-[11px] font-bold text-slate-600 tracking-wider uppercase select-none"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            {t('ai.panel_title', 'ИИ-Ассистент')}
          </span>
        </div>

        {/* Bottom: Connection status dot */}
        <div className="p-3 flex justify-center items-center border-t border-slate-100 w-full">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              engineStatus.is_loaded
                ? 'bg-emerald-500 ring-2 ring-emerald-100'
                : engineStatus.model_downloaded
                ? 'bg-amber-400 ring-2 ring-amber-100'
                : 'bg-slate-300 ring-2 ring-slate-100'
            }`}
            title={engineStatus.is_loaded ? t('ai.status_ram', 'Gemma-4-E2B Q4 • В памяти (RAM)') : (engineStatus.model_downloaded ? t('ai.status_downloaded', 'Скачана ({mb} MB)').replace('{mb}', String(engineStatus.file_size_mb)) : t('ai.local_mode', 'Локальный режим'))}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-[380px] flex-col border-l border-slate-200 bg-white shadow-xs select-none">
      {/* Hidden File Input for RAG */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        multiple
        accept=".md,.txt,.pdf,.docx,.doc,.xlsx,.xls,.csv"
        className="hidden"
      />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 bg-slate-50/70">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-500 shadow-xs">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <span>{t('ai.panel_title', 'ИИ-Ассистент')}</span>
              <span
                className={`flex h-2 w-2 rounded-full ${
                  engineStatus.is_loaded ? 'bg-emerald-500' : (engineStatus.model_downloaded ? 'bg-amber-400' : 'bg-slate-300')
                }`}
                title={engineStatus.is_loaded ? t('ai.status_ram', 'Gemma-4-E2B Q4 • В памяти (RAM)') : (engineStatus.model_downloaded ? t('ai.status_downloaded', 'Скачана ({mb} MB)').replace('{mb}', String(engineStatus.file_size_mb)) : t('ai.status_waiting_download', 'Ожидает скачивания'))}
              />
            </h2>
            <p className="text-[10px] text-slate-500 font-medium">
              {engineStatus.is_loaded ? t('ai.status_ram', 'Gemma-4-E2B Q4 • В памяти (RAM)') : (engineStatus.model_downloaded ? t('ai.status_downloaded', 'Скачана ({mb} MB)').replace('{mb}', String(engineStatus.file_size_mb)) : t('ai.local_mode', 'Локальный режим'))}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Settings Gear Button (Шестерёночка) */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`rounded-lg p-1.5 transition-colors cursor-pointer ${
              showSettings
                ? 'bg-red-50 text-red-500'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
            }`}
            title={t('ai.settings_tooltip', 'Настройки встроенной модели')}
          >
            <Settings className="h-4 w-4" />
          </button>
          <button
            onClick={() => setIsCollapsed(true)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
            title={t('ai.collapse_tooltip', 'Свернуть панель')}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Settings Drawer (при клике на шестеренку) */}
      {showSettings && (
        <div className="border-b border-slate-200 bg-slate-50 p-4 text-xs space-y-3 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800 flex items-center gap-1.5">
              <Cpu className="h-4 w-4 text-red-500" />
              <span>{t('ai.settings_title', 'Встроенный движок (llama.cpp · Gemma-4-E2B)')}</span>
            </h3>
            <button
              onClick={() => setShowSettings(false)}
              className="text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-slate-500 block mb-1">
              {t('ai.settings_model_name', 'Локальная модель (GGUF)')}
            </label>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-2xs">
              <span className="font-mono text-xs font-semibold text-slate-800">
                {engineStatus.model_name || 'gemma-4-E4B-Q4_K_M.gguf'}
              </span>
              <span className={`rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                engineStatus.is_loaded
                  ? 'bg-emerald-50 text-emerald-600'
                  : engineStatus.model_downloaded
                  ? 'bg-amber-50 text-amber-600'
                  : 'bg-slate-100 text-slate-600'
              }`}>
                {engineStatus.is_loaded
                  ? t('ai.status_in_ram', 'В памяти (RAM)')
                  : engineStatus.model_downloaded
                  ? `${engineStatus.file_size_mb} MB`
                  : t('ai.status_waiting_download', 'Ожидает скачивания')}
              </span>
            </div>
            <p className="mt-1 text-[10px] text-slate-500 leading-tight">
              {engineStatus.is_loaded
                ? t('ai.status_engine_ready', 'Встроенный движок llama.cpp активен и готов к работе')
                : engineStatus.model_downloaded
                ? t('ai.status_model_ready_to_launch', 'Модель загружена ({size} MB). Нажмите «Запустить».').replace('{size}', engineStatus.file_size_mb.toString())
                : t('ai.status_waiting_download', 'Ожидает скачивания')}
            </p>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              disabled={pulling}
              onClick={handlePullModel}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-[#FF4438] px-3 py-1.5 font-semibold text-white hover:bg-red-600 disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
            >
              {pulling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              <span>{pulling ? t('ai.settings_downloading', 'Загрузка...') : t('ai.settings_download_btn', 'Скачать')}</span>
            </button>

            <button
              onClick={handleLaunchDaemon}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              title={t('ai.settings_start_tooltip', 'Запустить встроенный движок')}
            >
              <Play className="h-3.5 w-3.5 fill-current text-slate-600" />
              <span>{t('ai.settings_start_ollama', 'Запустить')}</span>
            </button>
          </div>

          {pullMessage && (
            <div className="rounded-lg bg-slate-200/80 p-2.5 text-[11px] text-slate-700 leading-normal space-y-1.5">
              <p>{pullMessage}</p>
            </div>
          )}
        </div>
      )}

      {/* Main Spacious Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
        {chatMessages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.sender === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            {/* Attachment indicator if user sent document */}
            {msg.attachedDocName && (
              <span className="text-[10px] text-slate-400 mb-1 flex items-center gap-1">
                <FileText className="h-3 w-3 text-red-500" />
                <span>{msg.attachedDocName}</span>
              </span>
            )}

            <div
              className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-2xs select-text ${
                msg.sender === 'user'
                  ? 'bg-[#1E222D] text-white rounded-br-xs'
                  : 'bg-slate-100 text-slate-800 rounded-bl-xs border border-slate-200/70'
              }`}
            >
              <ChatMessageContent content={msg.id === 'welcome' ? t('ai.welcome_msg', msg.text) : msg.text} isUser={msg.sender === 'user'} />
            </div>

            {/* Interactive Apply Scenario button if AI generated a graph */}
            {msg.generatedGraph && (
              <div className="mt-2 w-full max-w-[90%] rounded-xl border border-red-200 bg-red-50/50 p-2 text-xs">
                <div className="mb-1.5 flex items-center gap-1 text-[11px] font-bold text-red-600">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>{msg.generatedGraph.summary || t('ai.scenario_ready', 'Сценарий готов')}</span>
                </div>
                <p className="text-[10px] text-slate-600 mb-2">
                  {t('ai.nodes_count', 'Узлов:')} {msg.generatedGraph.nodes?.length || 0} • {t('ai.edges_count', 'Связей:')} {msg.generatedGraph.edges?.length || 0}
                </p>
                <button
                  onClick={() => handleApplyGraph(msg.generatedGraph)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#FF4438] py-1.5 text-xs font-bold text-white hover:bg-red-600 transition-colors shadow-xs cursor-pointer"
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  <span>{t('ai.apply_scenario', 'Применить сценарий на холст ✨')}</span>
                </button>
              </div>
            )}
          </div>
        ))}

        {chatLoading && (
          <div className="flex items-center gap-2 text-xs text-slate-400 italic py-1">
            <Loader2 className="h-4 w-4 animate-spin text-red-500" />
            <span>{t('ai.thinking', 'ИИ-Ассистент думает над решением...')}</span>
          </div>
        )}
        <div ref={chatBottomRef} />
      </div>

      {/* RAG Attached Files Preview Chips */}
      {attachedDocs.length > 0 && (
        <div className="border-t border-slate-100 bg-slate-50/80 px-3 py-1.5 flex flex-wrap gap-1.5">
          {attachedDocs.map((doc) => (
            <div
              key={doc.filename}
              className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-700 shadow-2xs"
            >
              {(doc.extension || '').includes('xls') || (doc.extension || '') === '.csv' ? (
                <FileSpreadsheet className="h-3 w-3 text-teal-600" />
              ) : (
                <FileText className="h-3 w-3 text-red-500" />
              )}
              <span className="font-medium max-w-[120px] truncate">{doc.filename}</span>
              <button
                onClick={() => removeDoc(doc.filename)}
                className="text-slate-400 hover:text-red-500 ml-0.5 cursor-pointer"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Quick Suggestion Chips */}
      <div className="border-t border-slate-100 bg-white px-3 py-1.5 flex items-center gap-1.5 overflow-x-auto text-[10px]">
        <button
          onClick={() => handleQuickChip('create')}
          className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-600 hover:border-red-400 hover:text-red-600 transition-colors shrink-0 cursor-pointer"
        >
          <Sparkles className="h-2.5 w-2.5 text-red-500" />
          <span>{t('ai.chip_create', 'Создать бота')}</span>
        </button>

        <button
          onClick={() => handleQuickChip('reverse')}
          className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-600 hover:border-orange-400 hover:text-orange-600 transition-colors shrink-0 cursor-pointer"
        >
          <FileCode className="h-2.5 w-2.5 text-orange-500" />
          <span>{t('ai.chip_reverse', 'Перенести код')}</span>
        </button>

        <button
          onClick={() => handleQuickChip('audit')}
          className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-600 hover:border-emerald-400 hover:text-emerald-600 transition-colors shrink-0 cursor-pointer"
        >
          <ShieldCheck className="h-2.5 w-2.5 text-emerald-500" />
          <span>{t('ai.chip_audit', 'Аудит')}</span>
        </button>

        <button
          onClick={() => handleQuickChip('rag')}
          className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-600 hover:border-blue-400 hover:text-blue-600 transition-colors shrink-0 cursor-pointer"
        >
          <Paperclip className="h-2.5 w-2.5 text-blue-500" />
          <span>{t('ai.chip_rag', 'Файл (RAG)')}</span>
        </button>
      </div>

      {/* Multi-line Input Bar (3-4 sentences in height) with Voice, File & Send */}
      <form
        onSubmit={(e) => handleSendChat(e)}
        className="border-t border-slate-200 bg-slate-50/80 p-2.5"
      >
        <div
          className={`relative rounded-2xl border bg-white shadow-2xs transition-all ${
            isListening
              ? 'border-red-500 ring-2 ring-red-500/20'
              : 'border-slate-200 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-500/10'
          }`}
        >
          {/* Multi-line Text Area (3-4 lines height by default) */}
          <textarea
            rows={3}
            placeholder={
              isListening
                ? t('ai.voice_listening', 'Слушаю вас...')
                : t('ai.chat_placeholder', 'Напишите запрос или прикрепите ТЗ...')
            }
            value={chatInput}
            onChange={(e) => {
              if (isListening) stopVoice();
              setChatInput(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendChat();
              }
            }}
            className="nodrag nowheel w-full resize-none bg-transparent px-3.5 pt-2.5 pb-1 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none min-h-[66px] max-h-[140px] leading-relaxed"
          />

          {/* Action Toolbar below text: File attach, Voice, Send */}
          <div className="flex items-center justify-between px-2 pb-2 pt-0.5 border-t border-slate-100/70">
            <div className="flex items-center gap-1">
              {/* RAG File Upload button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingDoc}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
                title={t('ai.attach_file_tooltip', 'Прикрепить файл (MD, TXT, PDF, Word, Excel)')}
              >
                {uploadingDoc ? (
                  <Loader2 className="h-4 w-4 animate-spin text-red-500" />
                ) : (
                  <Paperclip className="h-4 w-4" />
                )}
              </button>

              {/* Voice Input Button */}
              <button
                type="button"
                onClick={toggleVoiceInput}
                className={`rounded-lg p-1.5 transition-all cursor-pointer ${
                  isListening
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
                }`}
                title={isListening ? t('ai.voice_stop_tooltip', 'Остановить запись') : t('ai.voice_start_tooltip', 'Ввод голосом')}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>

              <span className="text-[10px] text-slate-400 ml-1 select-none hidden sm:inline">
                Enter ↵ / Shift+Enter ⇧↵
              </span>
            </div>

            {/* Send Button */}
            <button
              type="submit"
              disabled={!chatInput.trim() || chatLoading}
              className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#FF4438] text-white hover:bg-red-600 disabled:opacity-40 transition-all shadow-xs shrink-0 cursor-pointer active:scale-95"
              title={t('ai.send_tooltip', 'Отправить (Enter)')}
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
