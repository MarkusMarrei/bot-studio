import React, { useMemo } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant
} from '@xyflow/react';
import { useGraphStore } from '../../store/useGraphStore';

import { StartNode } from '../nodes/StartNode';
import { MessageNode } from '../nodes/MessageNode';
import { KeyboardNode } from '../nodes/KeyboardNode';
import { TimerNode } from '../nodes/TimerNode';
import { MediaNode } from '../nodes/MediaNode';
import { InputNode } from '../nodes/InputNode';
import { AiAssistantNode } from '../nodes/AiAssistantNode';
import { SheetsNode } from '../nodes/SheetsNode';
import { NotifyAdminNode } from '../nodes/NotifyAdminNode';
import { CustomCodeNode } from '../nodes/CustomCodeNode';
import { FlowingArrowEdge } from './FlowingArrowEdge';

export const Canvas: React.FC = () => {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    selectNode
  } = useGraphStore();

  const nodeTypes = useMemo(
    () => ({
      start: StartNode,
      message: MessageNode,
      keyboard: KeyboardNode,
      timer: TimerNode,
      media: MediaNode,
      input: InputNode,
      ai_assistant: AiAssistantNode,
      sheets: SheetsNode,
      notify_admin: NotifyAdminNode,
      custom_code: CustomCodeNode
    }),
    []
  );

  const edgeTypes = useMemo(
    () => ({
      default: FlowingArrowEdge,
      flowing: FlowingArrowEdge
    }),
    []
  );

  return (
    <div className="relative h-full w-full bg-[#f8fafc]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={(_, node) => selectNode(node.id)}
        onPaneClick={() => selectNode(null)}
        fitView
        snapToGrid
        snapGrid={[16, 16]}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{
          animated: false,
          style: { stroke: '#64748b', strokeWidth: 2 }
        }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1.5}
          color="#cbd5e1"
        />
        <Controls position="bottom-left" />
        {/* MiniMap removed as per user instruction to maximize canvas space */}
      </ReactFlow>
    </div>
  );
};
