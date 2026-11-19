import React, { useState } from 'react';
import {
  Rocket,
  MessageSquare,
  LayoutGrid,
  Image,
  Clock,
  Bot,
  BellRing,
  Code2,
  ChevronDown,
  ChevronRight,
  Plus,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { useGraphStore } from '../../store/useGraphStore';
import { useTranslation } from '../../i18n/useTranslation';
import type { NodeType } from '../../types/graph';

interface PaletteItem {
  type: NodeType;
  label: string;
  desc: string;
  icon: React.ReactNode;
  color: string;
}

export const NodePalette: React.FC = () => {
  const { t } = useTranslation();
  const addNode = useGraphStore((s) => s.addNode);

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [flowOpen, setFlowOpen] = useState(true);
  const [integrationsOpen, setIntegrationsOpen] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(true);

  const flowItems: PaletteItem[] = [
    {
      type: 'start',
      label: t('palette.start', 'Старт / Команда'),
      desc: t('palette.start_desc', 'Точка входа по /start'),
      icon: <Rocket className="h-4 w-4" />,
      color: 'text-red-500 bg-red-50'
    },
    {
      type: 'message',
      label: t('palette.message', 'Отправить сообщение'),
      desc: t('palette.message_desc', 'Текст, кнопки, медиа'),
      icon: <MessageSquare className="h-4 w-4" />,
      color: 'text-blue-500 bg-blue-50'
    },
    {
      type: 'keyboard',
      label: t('palette.keyboard', 'Нижнее меню (Кнопки)'),
      desc: t('palette.keyboard_desc', 'Постоянные кнопки внизу чата'),
      icon: <LayoutGrid className="h-4 w-4" />,
      color: 'text-indigo-500 bg-indigo-50'
    },
    {
      type: 'media',
      label: t('palette.media', 'Мультимедиа'),
      desc: t('palette.media_desc', 'Фото, видео или аудио'),
      icon: <Image className="h-4 w-4" />,
      color: 'text-purple-500 bg-purple-50'
    },
    {
      type: 'timer',
      label: t('palette.timer', 'Время / Таймер'),
      desc: t('palette.timer_desc', 'Задержка, бездействие, дата'),
      icon: <Clock className="h-4 w-4" />,
      color: 'text-amber-500 bg-amber-50'
    }
  ];

  const integrationItems: PaletteItem[] = [
    {
      type: 'ai_assistant',
      label: t('palette.ai', 'AI'),
      desc: t('palette.ai_desc', 'Интеграция по API нейросетей'),
      icon: <Bot className="h-4 w-4" />,
      color: 'text-indigo-500 bg-indigo-50'
    },
    {
      type: 'notify_admin',
      label: t('palette.notify_admin', 'Уведомление админу'),
      desc: t('palette.notify_admin_desc', 'Пересылка заявки в Telegram ЛС'),
      icon: <BellRing className="h-4 w-4" />,
      color: 'text-sky-500 bg-sky-50'
    }
  ];

  const advancedItems: PaletteItem[] = [
    {
      type: 'custom_code',
      label: t('palette.custom_code', 'Свой Python-код'),
      desc: t('palette.custom_code_desc', 'Произвольный код обработчика'),
      icon: <Code2 className="h-4 w-4" />,
      color: 'text-orange-500 bg-orange-50'
    }
  ];

  if (isCollapsed) {
    return (
      <div className="flex h-full w-12 flex-col items-center border-r border-slate-200 bg-white py-3 shadow-sm select-none">
        <button
          onClick={() => setIsCollapsed(false)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer"
          title={t('palette.title', 'Палитра нод')}
        >
          <PanelLeftOpen className="h-5 w-5" />
        </button>
      </div>
    );
  }

  const renderGroup = (
    title: string,
    isOpen: boolean,
    toggle: () => void,
    items: PaletteItem[]
  ) => (
    <div className="border-b border-slate-100 pb-2">
      <button
        onClick={toggle}
        className="flex w-full items-center justify-between px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider hover:text-slate-700 cursor-pointer"
      >
        <span>{title}</span>
        {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </button>

      {isOpen && (
        <div className="mt-1 space-y-1 px-2">
          {items.map((item) => (
            <div
              key={item.type}
              onClick={() => addNode(item.type)}
              className="group flex cursor-pointer items-center justify-between rounded-lg border border-transparent p-2 text-left transition-all hover:border-slate-200 hover:bg-slate-50 hover:shadow-xs"
            >
              <div className="flex items-center gap-2.5">
                <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${item.color}`}>
                  {item.icon}
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-800 group-hover:text-red-600 transition-colors">
                    {item.label}
                  </h4>
                  <p className="text-[10px] text-slate-400">{item.desc}</p>
                </div>
              </div>
              <Plus className="h-3.5 w-3.5 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 group-hover:text-red-500" />
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="h-full w-60 border-r border-slate-200 bg-white overflow-y-auto select-none shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-3 bg-slate-50/70">
        <div>
          <h2 className="text-xs font-bold tracking-wider text-slate-800 uppercase">
            {t('palette.title', 'ПАЛИТРА НОД')}
          </h2>
          <p className="text-[10px] text-slate-400 font-medium">
            {t('palette.click_to_add', 'Клик для добавления')}
          </p>
        </div>
        <button
          onClick={() => setIsCollapsed(true)}
          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
          title={t('palette.title', 'Палитра нод')}
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      <div className="py-2">
        {renderGroup(t('palette.flow_category', 'БАЗОВЫЙ ПОТОК (FLOW)'), flowOpen, () => setFlowOpen(!flowOpen), flowItems)}
        {renderGroup(t('palette.integrations_category', 'ИНТЕГРАЦИИ (INTEGRATIONS)'), integrationsOpen, () => setIntegrationsOpen(!integrationsOpen), integrationItems)}
        {renderGroup(t('palette.advanced_category', 'ПРОДВИНУТЫЕ (ADVANCED)'), advancedOpen, () => setAdvancedOpen(!advancedOpen), advancedItems)}
      </div>
    </div>
  );
};
