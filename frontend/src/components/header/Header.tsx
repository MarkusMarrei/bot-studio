import React, { useState, useRef } from 'react';
import {
  Smartphone,
  Play,
  Download,
  LayoutGrid,
  Layers,
  ChevronDown,
  Trash2,
  Save,
  FolderOpen,
  CheckCircle2
} from 'lucide-react';
import { useGraphStore } from '../../store/useGraphStore';
import { getLayoutedElements } from '../canvas/autoLayout';
import { useTranslation } from '../../i18n/useTranslation';
import { LanguageSelector } from './LanguageSelector';

interface HeaderProps {
  onOpenExport: () => void;
  onOpenLiveRun: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenExport,
  onOpenLiveRun
}) => {
  const { t } = useTranslation();
  const {
    nodes,
    edges,
    setNodes,
    setEdges,
    isSimulatorOpen,
    toggleSimulator,
    loadTemplate,
    clearCanvas,
    saveProject,
    loadProjectFromFile
  } = useGraphStore();

  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAutoLayout = () => {
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(nodes, edges);
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  };

  const handleSelectTemplate = async (templateId: string) => {
    setTemplatesOpen(false);
    try {
      const res = await fetch('/api/templates');
      const templates = await res.json();
      const selected = templates.find((t: any) => t.id === templateId);
      if (selected) {
        const { nodes: lNodes, edges: lEdges } = getLayoutedElements(selected.nodes, selected.edges);
        loadTemplate(lNodes, lEdges);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSave = () => {
    saveProject();
    setToastMsg(t('header.project_saved_toast', 'Проект сохранён в браузере!'));
    setTimeout(() => setToastMsg(null), 2500);
  };

  const handleConfirmClear = () => {
    clearCanvas();
    setShowClearConfirm(false);
    setToastMsg(t('header.canvas_cleared_toast', 'Холст очищен'));
    setTimeout(() => setToastMsg(null), 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const ok = loadProjectFromFile(content);
        if (ok) {
          setToastMsg(t('header.project_loaded_toast', 'Проект успешно загружен!'));
          setTimeout(() => setToastMsg(null), 2500);
        } else {
          alert('Не удалось прочитать файл проекта. Убедитесь, что это корректный .json файл Bot Studio.');
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <header className="relative flex h-14 w-full items-center justify-between border-b border-slate-200 bg-white px-4 select-none shadow-xs z-30">
      {/* Toast Notification Banner */}
      {toastMsg && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-xl animate-in fade-in slide-in-from-top-2 duration-150">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Left: Branding with user's official logo icon */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          {/* Logo icon */}
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white p-0.5 shadow-xs overflow-hidden">
            <img
              src="/BotStudio.jpg"
              alt="Bot Studio Logo"
              className="h-full w-full object-contain"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>

          <div>
            <div className="flex items-center gap-1.5 leading-none">
              <span className="text-sm font-black tracking-tight text-[#1E222D]">
                BOT STUDIO
              </span>
              <span className="rounded bg-slate-100 px-1 py-0.5 text-[9px] font-bold text-slate-600 uppercase">
                {t('header.ide', 'IDE')}
              </span>
            </div>
            <p className="text-[9px] font-bold tracking-wider text-[#FF4438] uppercase mt-0.5">
              {t('header.visual_programming', 'Visual Programming')}
            </p>
          </div>
        </div>

        <div className="h-4 w-[1px] bg-slate-200 mx-1" />

        {/* Templates dropdown */}
        <div className="relative">
          <button
            onClick={() => setTemplatesOpen(!templatesOpen)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-all shadow-xs cursor-pointer"
          >
            <Layers className="h-3.5 w-3.5 text-slate-500" />
            <span>{t('header.templates', 'Шаблоны')}</span>
            <ChevronDown className="h-3 w-3 text-slate-400" />
          </button>

          {templatesOpen && (
            <div className="absolute left-0 mt-1.5 w-60 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl z-50 text-xs animate-in fade-in duration-100">
              <button
                onClick={() => handleSelectTemplate('portfolio_lead_gen')}
                className="flex w-full items-center gap-2 rounded-lg p-2 text-left text-slate-700 hover:bg-slate-50 hover:text-red-600 transition-colors cursor-pointer"
              >
                <span>{t('header.template_portfolio', '💼 Портфолио & Заявки')}</span>
              </button>
              <button
                onClick={() => handleSelectTemplate('ai_assistant_bot')}
                className="flex w-full items-center gap-2 rounded-lg p-2 text-left text-slate-700 hover:bg-slate-50 hover:text-red-600 transition-colors cursor-pointer"
              >
                <span>{t('header.template_ai', '🤖 ИИ-Консультант (Gemma 4)')}</span>
              </button>
            </div>
          )}
        </div>

        {/* Auto-layout button */}
        <button
          onClick={handleAutoLayout}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-all shadow-xs cursor-pointer"
          title={t('header.auto_layout_tooltip', 'Автоматически выровнять граф (Dagre / Сугияма)')}
        >
          <LayoutGrid className="h-3.5 w-3.5 text-slate-500" />
          <span>{t('header.auto_layout', 'Выровнять')}</span>
        </button>

        {/* Clear Canvas button */}
        <div className="relative">
          <button
            onClick={() => setShowClearConfirm(!showClearConfirm)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-red-300 hover:text-red-600 hover:bg-red-50/50 transition-all shadow-xs cursor-pointer"
            title={t('header.clear_canvas', 'Очистить холст')}
          >
            <Trash2 className="h-3.5 w-3.5 text-slate-400" />
            <span>{t('header.clear_canvas', 'Очистить')}</span>
          </button>

          {showClearConfirm && (
            <div className="absolute left-0 mt-1.5 w-64 rounded-xl border border-red-200 bg-white p-3 shadow-xl z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
              <p className="font-semibold text-slate-800 mb-2 leading-snug">
                {t('header.clear_confirm', 'Очистить весь холст? Все узлы будут удалены.')}
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="rounded-lg px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  onClick={handleConfirmClear}
                  className="rounded-lg bg-red-500 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-red-600 transition-colors cursor-pointer"
                >
                  {t('header.clear_canvas', 'Очистить')}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="h-4 w-[1px] bg-slate-200 mx-1" />

        {/* Save Project button */}
        <button
          onClick={handleSave}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-all shadow-xs cursor-pointer"
          title="Сохранить проект в браузере и скачать .json файл"
        >
          <Save className="h-3.5 w-3.5 text-slate-500" />
          <span>{t('header.save_project', 'Сохранить')}</span>
        </button>

        {/* Open Project button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-all shadow-xs cursor-pointer"
          title="Загрузить ранее сохраненный проект (.json)"
        >
          <FolderOpen className="h-3.5 w-3.5 text-slate-500" />
          <span>{t('header.open_project', 'Открыть')}</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2.5">
        {/* Organic Language Selector Dropdown */}
        <LanguageSelector />

        <div className="h-4 w-[1px] bg-slate-200 mx-0.5" />

        {/* Live Test */}
        <button
          onClick={onOpenLiveRun}
          className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-all shadow-xs cursor-pointer"
        >
          <Play className="h-3.5 w-3.5 fill-current" />
          <span>{t('header.live_test', 'Live Test в Telegram')}</span>
        </button>

        {/* Offline Simulator Toggle */}
        <button
          onClick={toggleSimulator}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all shadow-xs cursor-pointer ${
            isSimulatorOpen
              ? 'bg-[#1E222D] text-white'
              : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Smartphone className="h-3.5 w-3.5" />
          <span>{t('header.simulator', 'Симулятор')}</span>
        </button>

        {/* Build / Export button in Coral Red */}
        <button
          onClick={onOpenExport}
          className="flex items-center gap-1.5 rounded-lg bg-[#FF4438] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#ef4444] active:scale-95 transition-all shadow-sm cursor-pointer"
        >
          <Download className="h-4 w-4" />
          <span>{t('header.build', 'Собрать (Build)')}</span>
        </button>
      </div>
    </header>
  );
};
