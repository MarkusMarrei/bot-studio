import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';

interface Props {
  content: string;
  isUser?: boolean;
}

export const ChatMessageContent: React.FC<Props> = ({ content, isUser }) => {
  if (isUser) {
    return <p className="whitespace-pre-wrap">{content}</p>;
  }

  // Parse code blocks vs markdown prose
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-2 text-xs leading-relaxed text-slate-800">
      {parts.map((part, index) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const lines = part.slice(3, -3).trim().split('\n');
          let language = lines[0].trim();
          let codeLines = lines;
          if (language && !language.includes(' ') && lines.length > 1) {
            codeLines = lines.slice(1);
          } else {
            language = 'code';
          }
          const codeText = codeLines.join('\n');

          return <CodeBlock key={index} code={codeText} language={language} />;
        }

        return <ProseBlock key={index} text={part} />;
      })}
    </div>
  );
};

const CodeBlock: React.FC<{ code: string; language: string }> = ({ code, language }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-2 overflow-hidden rounded-xl border border-slate-800 bg-[#141822] text-slate-200 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-800/80 bg-[#1c2230] px-3 py-1.5 text-[10px] text-slate-400">
        <span className="font-mono font-semibold uppercase tracking-wider text-slate-300">
          {language || 'code'}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-slate-700/60 hover:text-white transition-colors cursor-pointer"
          title={t('common.copy_code_tooltip', 'Скопировать код в буфер')}
        >
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          <span>{copied ? t('common.copied', 'Скопировано') : t('common.copy', 'Копировать')}</span>
        </button>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-[11px] leading-relaxed text-amber-200 selection:bg-red-500/30">
        <code>{code}</code>
      </pre>
    </div>
  );
};

const ProseBlock: React.FC<{ text: string }> = ({ text }) => {
  const paragraphs = text.split('\n\n').filter((p) => p.trim());

  return (
    <>
      {paragraphs.map((p, pIdx) => {
        const lines = p.split('\n');

        return (
          <div key={pIdx} className="space-y-1">
            {lines.map((line, lIdx) => {
              const trimmed = line.trim();

              // Headings
              if (trimmed.startsWith('### ')) {
                return (
                  <h4 key={lIdx} className="font-bold text-slate-900 text-xs mt-2 mb-1">
                    {renderInlineFormatting(trimmed.slice(4))}
                  </h4>
                );
              }
              if (trimmed.startsWith('## ')) {
                return (
                  <h3 key={lIdx} className="font-bold text-slate-900 text-sm mt-2.5 mb-1">
                    {renderInlineFormatting(trimmed.slice(3))}
                  </h3>
                );
              }
              if (trimmed.startsWith('# ')) {
                return (
                  <h2 key={lIdx} className="font-extrabold text-slate-900 text-base mt-3 mb-1.5">
                    {renderInlineFormatting(trimmed.slice(2))}
                  </h2>
                );
              }

              // List items
              if (/^[-*•]\s+/.test(trimmed)) {
                return (
                  <div key={lIdx} className="flex items-start gap-1.5 pl-1.5">
                    <span className="text-red-500 font-bold select-none">•</span>
                    <span>{renderInlineFormatting(trimmed.replace(/^[-*•]\s+/, ''))}</span>
                  </div>
                );
              }

              // Numbered list items
              if (/^\d+\.\s+/.test(trimmed)) {
                const match = trimmed.match(/^(\d+)\.\s+(.*)/);
                if (match) {
                  return (
                    <div key={lIdx} className="flex items-start gap-1.5 pl-1.5">
                      <span className="font-bold text-slate-500 font-mono text-[11px] select-none">
                        {match[1]}.
                      </span>
                      <span>{renderInlineFormatting(match[2])}</span>
                    </div>
                  );
                }
              }

              return (
                <p key={lIdx} className="leading-relaxed">
                  {renderInlineFormatting(line)}
                </p>
              );
            })}
          </div>
        );
      })}
    </>
  );
};

// Formats **bold**, `code`, and *italic*
function renderInlineFormatting(text: string): React.ReactNode {
  // Regex splitting by bold (**text**), inline code (`code`), or italic (*text*)
  const tokens = text.split(/(\*\*.*?\*\*|`.*?`|\*.*?\*)/g);

  return tokens.map((token, i) => {
    if (token.startsWith('**') && token.endsWith('**') && token.length >= 4) {
      return (
        <strong key={i} className="font-bold text-slate-900">
          {token.slice(2, -2)}
        </strong>
      );
    }
    if (token.startsWith('`') && token.endsWith('`') && token.length >= 2) {
      return (
        <code
          key={i}
          className="rounded bg-slate-200/80 px-1 py-0.5 font-mono text-[10.5px] font-semibold text-red-600"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    if (token.startsWith('*') && token.endsWith('*') && token.length >= 2) {
      return (
        <em key={i} className="italic text-slate-700">
          {token.slice(1, -1)}
        </em>
      );
    }
    return token;
  });
}
