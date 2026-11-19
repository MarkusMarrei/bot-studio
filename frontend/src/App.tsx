import React, { useState } from 'react';
import { Header } from './components/header/Header';
import { NodePalette } from './components/sidebar/NodePalette';
import { Canvas } from './components/canvas/Canvas';
import { AiCopilotPanel } from './components/sidebar/AiCopilotPanel';
import { TelegramSimulator } from './components/simulator/TelegramSimulator';
import { ExportModal } from './components/modals/ExportModal';
import { LiveRunModal } from './components/modals/LiveRunModal';
import { ImportLegacyModal } from './components/modals/ImportLegacyModal';

export const App: React.FC = () => {
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isLiveRunOpen, setIsLiveRunOpen] = useState(false);
  const [isLegacyImportOpen, setIsLegacyImportOpen] = useState(false);

  return (
    <div className="flex h-screen w-screen flex-col bg-[#f8fafc] text-slate-800 overflow-hidden font-sans select-none">
      {/* Top Header */}
      <Header
        onOpenExport={() => setIsExportOpen(true)}
        onOpenLiveRun={() => setIsLiveRunOpen(true)}
      />

      {/* Main Workspace */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Left: Collapsible Node Palette */}
        <NodePalette />

        {/* Center: Spacious Graph Canvas */}
        <div className="relative flex-1 h-full overflow-hidden">
          <Canvas />
          <TelegramSimulator />
        </div>

        {/* Right: Dedicated AI Copilot Panel (with gear icon, model launcher, text-to-graph) */}
        <AiCopilotPanel onOpenLegacyImport={() => setIsLegacyImportOpen(true)} />
      </div>

      {/* Modals */}
      <ExportModal isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} />
      <LiveRunModal isOpen={isLiveRunOpen} onClose={() => setIsLiveRunOpen(false)} />
      <ImportLegacyModal isOpen={isLegacyImportOpen} onClose={() => setIsLegacyImportOpen(false)} />
    </div>
  );
};

export default App;
