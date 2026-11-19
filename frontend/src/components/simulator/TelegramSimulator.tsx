import React, { useState, useEffect, useRef } from 'react';
import { Send, RotateCcw, X, Info } from 'lucide-react';
import { useGraphStore } from '../../store/useGraphStore';
import { useTranslation } from '../../i18n/useTranslation';

export const TelegramSimulator: React.FC = () => {
  const { t } = useTranslation();

  const renderTelegramFormattedText = (rawText: string) => {
    if (!rawText) return null;

    // Convert markdown to HTML tags first
    let formatted = rawText
      .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
      .replace(/```([\s\S]*?)```/g, '<pre>$1</pre>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br/>');

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(`<body>${formatted}</body>`, 'text/html');

      const domToReact = (node: Node, key: string | number): React.ReactNode => {
        if (node.nodeType === Node.TEXT_NODE) {
          return node.textContent;
        }

        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          const tagName = el.tagName.toLowerCase();
          const children = Array.from(el.childNodes).map((child, idx) => domToReact(child, `${key}-${idx}`));

          switch (tagName) {
            case 'b':
            case 'strong':
              return <strong key={key} className="font-bold text-slate-900">{children}</strong>;
            case 'i':
            case 'em':
              return <em key={key} className="italic text-slate-700">{children}</em>;
            case 'u':
              return <u key={key} className="underline">{children}</u>;
            case 's':
            case 'del':
            case 'strike':
              return <del key={key} className="line-through text-slate-500">{children}</del>;
            case 'code':
              return (
                <code key={key} className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] text-red-600 border border-slate-200">
                  {children}
                </code>
              );
            case 'pre':
              return (
                <pre key={key} className="my-1.5 overflow-x-auto rounded-lg bg-slate-900 p-2 font-mono text-[10px] text-emerald-400">
                  {children}
                </pre>
              );
            case 'a':
              return (
                <a
                  key={key}
                  href={el.getAttribute('href') || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline hover:text-blue-800"
                >
                  {children}
                </a>
              );
            case 'br':
              return <br key={key} />;
            default:
              return <span key={key}>{children}</span>;
          }
        }
        return null;
      };

      return Array.from(doc.body.childNodes).map((child, idx) => domToReact(child, idx));
    } catch {
      return <span className="whitespace-pre-wrap">{rawText}</span>;
    }
  };
  const {
    isSimulatorOpen,
    toggleSimulator,
    simulatorMessages,
    activeSimulatorNodeId,
    activePersistentKeyboard,
    sendUserMessage,
    clickSimulatorButton,
    resetSimulator
  } = useGraphStore();

  const [inputVal, setInputVal] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isSimulatorOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [simulatorMessages, isSimulatorOpen]);

  if (!isSimulatorOpen) return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) return;
    sendUserMessage(inputVal.trim());
    setInputVal('');
  };

  return (
    <div className="absolute right-6 top-16 bottom-6 z-40 flex w-[350px] flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
      {/* Telegram Mockup Header */}
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/90 px-4 py-3 select-none">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-red-500 font-bold text-xs">
            BS
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-800">BotStudio Bot</h3>
            <span className="text-[10px] text-emerald-600 font-medium">online</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={resetSimulator}
            className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors cursor-pointer"
            title={t('simulator.reset', 'Сбросить')}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={toggleSimulator}
            className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors cursor-pointer"
            title={t('modal.close', 'Закрыть')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4 text-xs bg-[#F8FAFC]">
        {simulatorMessages.map((msg) => {
          const isSystem = msg.id.startsWith('sys_') || msg.text.startsWith('🔔') || msg.text.startsWith('📊') || msg.text.startsWith('⚡') || msg.text.startsWith('🔀');

          if (isSystem) {
            return (
              <div key={msg.id} className="flex justify-center my-1">
                <div className="max-w-[95%] rounded-xl bg-slate-100/90 border border-slate-200 px-3 py-1.5 text-[11px] text-slate-600 shadow-2xs flex items-start gap-1.5 leading-snug">
                  <Info className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span className="whitespace-pre-wrap">{msg.text}</span>
                </div>
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.sender === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2 shadow-xs ${
                  msg.sender === 'user'
                    ? 'bg-[#1E222D] text-white rounded-br-none'
                    : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none'
                }`}
              >
                {msg.mediaUrl && (
                  <div className="mb-2 overflow-hidden rounded-lg">
                    {msg.mediaType === 'photo' ? (
                      <img
                        src={msg.mediaUrl}
                        alt="Bot Media"
                        className="max-h-48 w-full object-cover rounded-lg"
                      />
                    ) : msg.mediaType === 'video' ? (
                      <video
                        src={msg.mediaUrl}
                        controls
                        className="max-h-48 w-full rounded-lg bg-black"
                      />
                    ) : (
                      <audio src={msg.mediaUrl} controls className="w-full mt-1" />
                    )}
                  </div>
                )}
                <div className="leading-relaxed">{renderTelegramFormattedText(msg.text)}</div>
              </div>

              {/* Inline Buttons */}
              {msg.buttons && msg.buttons.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {msg.buttons.map((btn) => (
                    <button
                      key={btn.id}
                      onClick={() => clickSimulatorButton(msg.nodeId || activeSimulatorNodeId || '', btn.id)}
                      className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-50 hover:border-red-300 active:scale-95 transition-all shadow-xs cursor-pointer"
                    >
                      {btn.text}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Persistent Reply Keyboard at Bottom */}
      {activePersistentKeyboard && activePersistentKeyboard.buttons && activePersistentKeyboard.buttons.length > 0 && (
        <div className="border-t border-slate-200 bg-slate-100/95 p-2 backdrop-blur-xs select-none animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="mb-1 flex items-center justify-between px-1">
            <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
              {t('simulator.bottom_menu', 'Постоянное меню бота')}
            </span>
            <span className="text-[9px] text-slate-400">
              {activePersistentKeyboard.buttons.length === 1
                ? '1 кнопка (100%)'
                : activePersistentKeyboard.buttons.length === 2
                ? '2 кнопки (50/50)'
                : activePersistentKeyboard.buttons.length === 4
                ? 'сетка 2х2'
                : 'адаптивная сетка'}
            </span>
          </div>
          <div
            className={`grid gap-1.5 ${
              activePersistentKeyboard.buttons.length === 1
                ? 'grid-cols-1'
                : activePersistentKeyboard.buttons.length === 2
                ? 'grid-cols-2'
                : activePersistentKeyboard.buttons.length === 4
                ? 'grid-cols-2'
                : 'grid-cols-2'
            }`}
          >
            {activePersistentKeyboard.buttons.map((btn, idx) => {
              const isLastOdd =
                activePersistentKeyboard.buttons.length % 2 === 1 &&
                idx === activePersistentKeyboard.buttons.length - 1;
              return (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => clickSimulatorButton(activePersistentKeyboard.nodeId, btn.id)}
                  className={`flex items-center justify-center rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-xs border border-slate-200/90 hover:bg-slate-50 hover:border-slate-300 active:scale-[0.98] transition-all cursor-pointer ${
                    isLastOdd ? 'col-span-2' : ''
                  }`}
                >
                  <span className="truncate">{btn.text}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Input bar */}
      <form
        onSubmit={handleSend}
        className="flex items-center gap-2 border-t border-slate-100 bg-white p-2.5"
      >
        <input
          type="text"
          placeholder={t('simulator.input_placeholder', 'Напишите боту...')}
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-red-500 focus:bg-white focus:outline-none"
        />
        <button
          type="submit"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FF4438] text-white hover:bg-red-600 transition-colors shadow-xs cursor-pointer"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
};
