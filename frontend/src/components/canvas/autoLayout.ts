import dagre from '@dagrejs/dagre';
import type { Node, Edge } from '@xyflow/react';
import type { NodeData } from '../../types/graph';

export const getLayoutedElements = (
  nodes: Node<NodeData>[],
  edges: Edge[],
  direction = 'LR'
) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 100, // Generous vertical gap between node cards to prevent overlap
    ranksep: 160  // Generous horizontal spacing between stages
  });

  nodes.forEach((node) => {
    // True rendered dimensions in DOM (width ~320px, variable card heights)
    let width = 320;
    let height = 240;

    if (node.type === 'start') {
      width = 220;
      height = 110;
    } else if (node.type === 'message') {
      const btnCount = (node.data as any)?.buttons?.length || 0;
      height = Math.max(250, 150 + btnCount * 52);
    } else if (node.type === 'notify_admin') {
      height = 230;
    } else if (node.type === 'ai_assistant') {
      height = 320;
    } else if (node.type === 'custom_code') {
      width = 340;
      height = 280;
    } else if (node.type === 'timer') {
      height = 220;
    } else if (node.type === 'input') {
      height = 220;
    } else if (node.type === 'keyboard') {
      height = 240;
    }

    dagreGraph.setNode(node.id, { width, height });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const nodeWidth = (dagreGraph.node(node.id) as any)?.width || 320;
    const nodeHeight = (dagreGraph.node(node.id) as any)?.height || 240;

    return {
      ...node,
      position: {
        x: Math.round(nodeWithPosition.x - nodeWidth / 2),
        y: Math.round(nodeWithPosition.y - nodeHeight / 2)
      }
    };
  });

  return { nodes: layoutedNodes, edges };
};
