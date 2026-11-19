import React, { useState, useEffect } from 'react';
import { Download, X, Copy, Check, Terminal, ExternalLink } from 'lucide-react';
import { useGraphStore } from '../../store/useGraphStore';
import { useTranslation } from '../../i18n/useTranslation';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const { nodes, edges, metadata } = useGraphStore();
  const [activeTab, setActiveTab] = useState<'preview' | 'deploy'>('preview');
  const [selectedFile, setSelectedFile] = useState<string>('bot.py');
  const [files, setFiles] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchPreview();
    }
  }, [isOpen]);

  const fetchPreview = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/compile/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes: nodes.map((n) => ({
            id: n.id,
            type: n.type,
            position: n.position,
            data: n.data
          })),
          edges: edges.map((e) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            sourceHandle: e.sourceHandle,
            targetHandle: e.targetHandle
          })),
          metadata
        })
      });
      const data = await res.json();
      if (data.files) {
        setFiles(data.files);
        if (!data.files[selectedFile]) {
          setSelectedFile(Object.keys(data.files)[0] || 'bot.py');
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadZip = async () => {
    try {
      const res = await fetch('/api/compile/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes: nodes.map((n) => ({
            id: n.id,
            type: n.type,
            position: n.position,
            data: n.data
          })),
          edges: edges.map((e) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            sourceHandle: e.sourceHandle,
            targetHandle: e.targetHandle
          })),
          metadata
        })
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${metadata.name.toLowerCase()}_aiogram3.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCopyCode = () => {
    if (!files[selectedFile]) return;
    navigator.clipboard.writeText(files[selectedFile]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="relative flex h-[85vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {t('modal.export_title', 'Сборка и экспорт проекта (Build)')}
            </h2>
            <p className="text-xs text-slate-500">
              aiogram 3.x • Async Python • Production Architecture
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors cursor-pointer"
            title={t('modal.close', 'Закрыть')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs Bar */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-2 bg-white">
          <div className="flex gap-2 text-xs">
            <button
              onClick={() => setActiveTab('preview')}
              className={`rounded-lg px-3 py-1.5 font-semibold transition-all cursor-pointer ${
                activeTab === 'preview'
                  ? 'bg-red-50 text-red-600'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Source Code
            </button>
            <button
              onClick={() => setActiveTab('deploy')}
              className={`rounded-lg px-3 py-1.5 font-semibold transition-all cursor-pointer ${
                activeTab === 'deploy'
                  ? 'bg-red-50 text-red-600'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              1-Click Deploy (Render.com)
            </button>
          </div>

          <button
            onClick={handleDownloadZip}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg bg-[#FF4438] px-4 py-1.5 text-xs font-bold text-white hover:bg-red-600 active:scale-95 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <Download className="h-4 w-4" />
            <span>{t('modal.export_download_zip', 'Скачать полный ZIP-архив бота')}</span>
          </button>
        </div>

        {/* Content Area */}
        {activeTab === 'preview' ? (
          <div className="flex flex-1 overflow-hidden">
            {/* File List */}
            <div className="w-52 border-r border-slate-100 bg-slate-50/50 p-3 space-y-1 overflow-y-auto">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Files:
              </span>
              {Object.keys(files).map((filename) => (
                <button
                  key={filename}
                  onClick={() => setSelectedFile(filename)}
                  className={`flex w-full items-center rounded-lg px-2.5 py-1.5 text-xs font-mono transition-all text-left cursor-pointer ${
                    selectedFile === filename
                      ? 'bg-white font-bold text-red-600 shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {filename}
                </button>
              ))}
            </div>

            {/* Code Viewer */}
            <div className="flex-1 flex flex-col bg-[#1E222D] overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-700/60 px-4 py-2 bg-[#181a24]">
                <span className="font-mono text-xs text-slate-300">{selectedFile}</span>
                <button
                  onClick={handleCopyCode}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              <pre className="flex-1 overflow-auto p-4 font-mono text-xs text-slate-200 leading-relaxed">
                <code>{files[selectedFile] || '...'}</code>
              </pre>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-8 text-xs text-slate-700 space-y-6 bg-slate-50/40">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Terminal className="h-4 w-4 text-red-500" />
                Render.com Free Hosting 24/7 (No Terminal or VPS Required)
              </h3>
              <p className="mt-1 text-slate-500">
                The downloaded ZIP bundle already contains pre-configured <code className="text-red-600 font-semibold">render.yaml</code> and <code className="text-red-600 font-semibold">Dockerfile</code>.
              </p>
            </div>

            <ol className="list-decimal list-inside space-y-4 text-slate-700 leading-relaxed font-medium">
              <li className="pl-2">
                <strong className="text-slate-900">Download the ZIP archive</strong> and upload its files into your new <strong>GitHub</strong> repository.
              </li>
              <li className="pl-2">
                Open <a href="https://render.com" target="_blank" rel="noreferrer" className="text-red-500 underline inline-flex items-center gap-1">Render.com <ExternalLink className="h-3 w-3" /></a> and click <strong>New + ➔ Background Worker</strong>.
              </li>
              <li className="pl-2">
                Connect your GitHub repository. Render automatically reads the configuration and installs all packages.
              </li>
              <li className="pl-2">
                Under <strong>Environment Variables</strong>, enter <code className="text-emerald-600 font-bold">BOT_TOKEN</code> with your Telegram bot token from @BotFather.
              </li>
              <li className="pl-2">
                Click <strong>Deploy</strong>. Your bot will run online 24/7!
              </li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
};
