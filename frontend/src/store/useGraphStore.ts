import { create } from 'zustand';
import {
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge
} from '@xyflow/react';
import type { NodeType, NodeData, GraphMetadata, AuditReport } from '../types/graph';

export interface SimulatorMessage {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  nodeId?: string;
  buttons?: { id: string; text: string }[];
  mediaUrl?: string;
  mediaType?: 'photo' | 'video' | 'audio';
}

interface GraphState {
  nodes: Node<NodeData>[];
  edges: Edge[];
  selectedNodeId: string | null;
  metadata: GraphMetadata;
  auditReport: AuditReport | null;
  
  // Simulator & Bolt-tracing telemetry
  isSimulatorOpen: boolean;
  activeSimulatorNodeId: string | null;
  activePersistentKeyboard: { nodeId: string; buttons: { id: string; text: string }[] } | null;
  simulatorMessages: SimulatorMessage[];
  simulatorVariables: Record<string, string>;
  
  // Actions
  onNodesChange: (changes: NodeChange<Node<NodeData>>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  setNodes: (nodes: Node<NodeData>[]) => void;
  setEdges: (edges: Edge[]) => void;
  addNode: (type: NodeType, position?: { x: number; y: number }) => void;
  updateNodeData: (id: string, data: Partial<NodeData>) => void;
  deleteNode: (id: string) => void;
  selectNode: (id: string | null) => void;
  setMetadata: (metadata: Partial<GraphMetadata>) => void;
  setAuditReport: (report: AuditReport | null) => void;
  
  // Simulator Actions
  toggleSimulator: () => void;
  sendUserMessage: (text: string) => void;
  clickSimulatorButton: (nodeId: string, buttonId: string) => void;
  executeSimulatorNode: (nodeId: string) => void;
  resetSimulator: () => void;
  loadTemplate: (templateNodes: any[], templateEdges: any[]) => void;

  // Project Management Actions
  clearCanvas: () => void;
  saveProject: () => void;
  loadProjectFromFile: (content: string) => boolean;
}

const INITIAL_NODES: Node<NodeData>[] = [
  {
    id: 'start_1',
    type: 'start',
    position: { x: 100, y: 150 },
    data: { label: '/start', command: '/start', description: 'Entry point via /start command' }
  },
  {
    id: 'msg_1',
    type: 'message',
    position: { x: 350, y: 150 },
    data: {
      label: 'Welcome Message',
      text: '👋 Hello! I am your new Telegram bot designed in Bot Studio.\n\nHow can I help you today?',
      buttons: [
        { id: 'btn_about', text: 'ℹ️ About Me', action_type: 'callback' },
        { id: 'btn_help', text: '🛠 Help', action_type: 'callback' }
      ]
    }
  }
];

const INITIAL_EDGES: Edge[] = [
  {
    id: 'e_start_msg',
    source: 'start_1',
    target: 'msg_1',
    animated: false,
    style: { stroke: '#64748b', strokeWidth: 2 }
  }
];

const getInitialState = () => {
  try {
    const raw = localStorage.getItem('botstudio_saved_project_v3');
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data.nodes) && data.nodes.length > 0) {
        return {
          nodes: data.nodes,
          edges: (data.edges || []).map((e: any) => ({
            ...e,
            animated: false,
            style: e.style || { stroke: '#64748b', strokeWidth: 2 }
          })),
          metadata: data.metadata || {
            name: 'BotStudioBot',
            version: '1.0.0',
            description: 'Telegram-бот, скомпилированный через Bot Studio IDE'
          }
        };
      }
    }
  } catch {}
  return {
    nodes: INITIAL_NODES,
    edges: INITIAL_EDGES,
    metadata: {
      name: 'BotStudioBot',
      version: '1.0.0',
      description: 'Telegram-бот, скомпилированный через Bot Studio IDE'
    }
  };
};

const initialSaved = getInitialState();

export const useGraphStore = create<GraphState>((set, get) => ({
  nodes: initialSaved.nodes,
  edges: initialSaved.edges,
  selectedNodeId: null,
  metadata: initialSaved.metadata,
  auditReport: null,
  
  isSimulatorOpen: false,
  activeSimulatorNodeId: null,
  activePersistentKeyboard: null,
  simulatorMessages: [],
  simulatorVariables: {},

  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) });
  },

  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },

  onConnect: (connection) => {
    set({
      edges: addEdge(
        {
          ...connection,
          animated: false,
          style: { stroke: '#64748b', strokeWidth: 2 }
        },
        get().edges
      )
    });
  },

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) =>
    set({
      edges: edges.map((e) => ({
        ...e,
        animated: false,
        style: e.style || { stroke: '#64748b', strokeWidth: 2 }
      }))
    }),

  addNode: (type, position) => {
    const id = `node_${type}_${Date.now().toString().slice(-4)}`;
    const currentNodes = get().nodes;
    let defaultPos = position;

    if (!defaultPos) {
      if (currentNodes.length > 0) {
        const lastNode = currentNodes[currentNodes.length - 1];
        defaultPos = {
          x: (lastNode.position?.x || 300) + 360,
          y: lastNode.position?.y || 200
        };
        // Wrap horizontally if too far right
        if (defaultPos.x > 1800) {
          defaultPos.x = 350;
          defaultPos.y = (lastNode.position?.y || 200) + 340;
        }
      } else {
        defaultPos = { x: 350, y: 200 };
      }
    }

    const defaultData: NodeData = {
      label: type.toUpperCase()
    };

    if (type === 'start') {
      defaultData.command = '/start';
      defaultData.label = 'Start Command';
    } else if (type === 'message') {
      defaultData.text = 'New text message';
      defaultData.buttons = [{ id: `btn_${Date.now()}`, text: 'Button', action_type: 'callback' }];
    } else if (type === 'keyboard') {
      defaultData.label = 'Bottom Menu';
      defaultData.text = 'Main menu:';
      defaultData.buttons = [
        { id: `btn_${Date.now()}_1`, text: '🍕 Order', action_type: 'callback' },
        { id: `btn_${Date.now()}_2`, text: 'ℹ️ About Us', action_type: 'callback' }
      ];
    } else if (type === 'input') {
      defaultData.label = 'Wait Input';
      defaultData.text = 'Please enter your response:';
      defaultData.variable_name = `var_${Date.now().toString().slice(-4)}`;
      defaultData.input_type = 'text';
    } else if (type === 'ai_assistant') {
      defaultData.label = 'AI';
      defaultData.ai_base_url = 'https://api.openai.com/v1';
      defaultData.ai_model = 'gpt-4o-mini';
      defaultData.ai_api_key = '';
      defaultData.ai_system_prompt = 'You are a helpful and smart AI assistant in Telegram.';
      defaultData.ai_welcome_text = '👋 Здравствуйте! Я ИИ-ассистент. Чем я могу вам помочь? Напишите ваш вопрос прямо в чат.';
      defaultData.ai_limit_text = '⚠️ Вы достигли лимита бесплатных сообщений к ИИ-ассистенту. Пожалуйста, обратитесь к администратору или вернитесь в главное меню.';
      defaultData.ai_output_var = 'ai_reply';
      defaultData.ai_limit_type = 'per_hour';
      defaultData.ai_limit_count = 15;
    } else if (type === 'sheets') {
      defaultData.label = 'Save to Table';
      defaultData.storage_type = 'csv';
      defaultData.table_name = 'leads';
    } else if (type === 'notify_admin') {
      defaultData.label = 'Notify Admin';
      defaultData.admin_id = 'YOUR_ADMIN_ID';
      defaultData.notification_template = '🔔 New order from @{username}: {user_input}';
    } else if (type === 'timer') {
      defaultData.label = 'Timer & Delay';
      defaultData.timer_mode = 'after';
      defaultData.timer_days = 0;
      defaultData.timer_hours = 1;
      defaultData.timer_minutes = 0;
      defaultData.timer_seconds = 0;
      defaultData.timer_date = '';
    } else if (type === 'media') {
      defaultData.label = 'Multimedia';
      defaultData.media_type = 'photo';
      defaultData.media_source = 'url';
      defaultData.media_url = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80';
      defaultData.caption = 'Check out our new update! 🚀';
    } else if (type === 'custom_code') {
      defaultData.label = 'Custom Python Code';
      defaultData.code = '# Custom handler logic\nasync def custom_step(message, state):\n    pass';
      defaultData.review_status = 'verified';
    }

    const newNode: Node<NodeData> = {
      id,
      type,
      position: defaultPos,
      data: defaultData
    };

    set({ nodes: [...get().nodes, newNode], selectedNodeId: id });
  },

  updateNodeData: (id, partialData) => {
    set({
      nodes: get().nodes.map((node) => {
        if (node.id === id) {
          return {
            ...node,
            data: { ...node.data, ...partialData }
          };
        }
        return node;
      })
    });
  },

  deleteNode: (id) => {
    set({
      nodes: get().nodes.filter((n) => n.id !== id),
      edges: get().edges.filter((e) => e.source !== id && e.target !== id),
      selectedNodeId: get().selectedNodeId === id ? null : get().selectedNodeId
    });
  },

  selectNode: (id) => set({ selectedNodeId: id }),

  setMetadata: (metadata) => set({ metadata: { ...get().metadata, ...metadata } }),

  setAuditReport: (report) => set({ auditReport: report }),

  toggleSimulator: () => {
    const nextState = !get().isSimulatorOpen;
    set({ isSimulatorOpen: nextState });
    if (nextState && get().simulatorMessages.length === 0) {
      get().resetSimulator();
    }
  },

  resetSimulator: () => {
    const { nodes, edges } = get();
    const startNode = nodes.find((n) => n.type === 'start');
    if (!startNode) return;

    // Trigger bolt pulse on start node
    set({
      activeSimulatorNodeId: startNode.id,
      activePersistentKeyboard: null,
      simulatorMessages: [
        { id: '1', sender: 'user', text: startNode.data.command || '/start' }
      ],
      simulatorVariables: {}
    });

    // Follow edge to first message
    const outEdge = edges.find((e) => e.source === startNode.id);
    if (outEdge) {
      setTimeout(() => {
        get().executeSimulatorNode(outEdge.target);
      }, 400);
    }
  },

  executeSimulatorNode: (nodeId: string) => {
    const { nodes, edges, simulatorVariables } = get();
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    set({ activeSimulatorNodeId: node.id });

    if (node.type === 'message') {
      let msgText = node.data.text || '';
      for (const [k, v] of Object.entries(simulatorVariables)) {
        msgText = msgText.replace(new RegExp(`{${k}}`, 'g'), v);
      }
      let mediaUrl = node.data.image_path || undefined;
      if (mediaUrl && (mediaUrl.includes(':\\') || mediaUrl.startsWith('/') || mediaUrl.startsWith('file://'))) {
        mediaUrl = `/api/media/local?path=${encodeURIComponent(mediaUrl)}`;
      }

      set((state) => ({
        simulatorMessages: [
          ...state.simulatorMessages,
          {
            id: `bot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            sender: 'bot',
            nodeId: node.id,
            text: msgText,
            mediaUrl: mediaUrl,
            mediaType: mediaUrl ? 'photo' : undefined,
            buttons: node.data.buttons?.map((b) => ({ id: b.id, text: b.text }))
          }
        ]
      }));
    } else if (node.type === 'keyboard') {
      let msgText = node.data.text || 'Выберите нужный пункт:';
      for (const [k, v] of Object.entries(simulatorVariables)) {
        msgText = msgText.replace(new RegExp(`{${k}}`, 'g'), v);
      }
      set((state) => ({
        simulatorMessages: [
          ...state.simulatorMessages,
          {
            id: `bot_kb_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            sender: 'bot',
            nodeId: node.id,
            text: msgText
          }
        ],
        activePersistentKeyboard: {
          nodeId: node.id,
          buttons: node.data.buttons && node.data.buttons.length > 0
            ? node.data.buttons.map((b) => ({ id: b.id, text: b.text }))
            : []
        }
      }));
    } else if (node.type === 'input') {
      set((state) => ({
        simulatorMessages: [
          ...state.simulatorMessages,
          {
            id: `bot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            sender: 'bot',
            nodeId: node.id,
            text: node.data.text || `Пожалуйста, введите ${node.data.variable_name || 'данные'}:`
          }
        ]
      }));
    } else if (node.type === 'notify_admin') {
      let notifyText = node.data.notification_template || '🔔 Новая заявка доставлена администратору!';
      for (const [k, v] of Object.entries(simulatorVariables)) {
        notifyText = notifyText.replace(new RegExp(`{${k}}`, 'g'), v);
      }
      notifyText = notifyText.replace('{username}', 'User').replace('{user_input}', Object.values(simulatorVariables)[0] || '');

      set((state) => ({
        simulatorMessages: [
          ...state.simulatorMessages,
          {
            id: `sys_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            sender: 'bot',
            nodeId: node.id,
            text: `🔔 [Уведомление в ЛС] ${notifyText}`
          }
        ]
      }));

      // Automatically advance to connected node (e.g. msg_thanks)
      const outEdge = edges.find((e) => e.source === node.id);
      if (outEdge) {
        setTimeout(() => {
          get().executeSimulatorNode(outEdge.target);
        }, 500);
      }
    } else if (node.type === 'sheets') {
      const loggedVars = Object.entries(simulatorVariables).map(([k, v]) => `${k}=${v}`).join(', ') || 'нет данных';
      set((state) => ({
        simulatorMessages: [
          ...state.simulatorMessages,
          {
            id: `sys_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            sender: 'bot',
            nodeId: node.id,
            text: `📊 [Запись в Таблицу] Строка добавлена в "${node.data.table_name || 'leads'}" (${node.data.storage_type || 'CSV'}): ${loggedVars}`
          }
        ]
      }));

      const outEdge = edges.find((e) => e.source === node.id);
      if (outEdge) {
        setTimeout(() => {
          get().executeSimulatorNode(outEdge.target);
        }, 500);
      }
    } else if (node.type === 'custom_code') {
      set((state) => ({
        simulatorMessages: [
          ...state.simulatorMessages,
          {
            id: `sys_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            sender: 'bot',
            nodeId: node.id,
            text: `⚡ [Python Handler] Выполнен код: ${node.data.label || 'Кастомная логика'}`
          }
        ]
      }));

      const outEdge = edges.find((e) => e.source === node.id);
      if (outEdge) {
        setTimeout(() => {
          get().executeSimulatorNode(outEdge.target);
        }, 500);
      }
    } else if (node.type === 'timer') {
      const timerMsg = node.data.timer_text?.trim();

      // Send custom message only if explicitly configured by the user
      if (timerMsg) {
        set((state) => ({
          simulatorMessages: [
            ...state.simulatorMessages,
            {
              id: `bot_timer_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              sender: 'bot',
              nodeId: node.id,
              text: timerMsg
            }
          ]
        }));
      }

      // Smooth silent transition to next connected node (no debug spam)
      const outEdge = edges.find((e) => e.source === node.id);
      if (outEdge) {
        setTimeout(() => {
          get().executeSimulatorNode(outEdge.target);
        }, 600);
      }
    } else if (node.type === 'media') {
      const mediaType = node.data.media_type || 'photo';
      const caption = node.data.caption || '';
      let url = node.data.media_url || '';
      if (url && (url.includes(':\\') || url.startsWith('/') || url.startsWith('file://'))) {
        url = `/api/media/local?path=${encodeURIComponent(url)}`;
      }

      set((state) => ({
        simulatorMessages: [
          ...state.simulatorMessages,
          {
            id: `bot_media_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            sender: 'bot',
            nodeId: node.id,
            text: caption,
            mediaUrl: url,
            mediaType: mediaType
          }
        ]
      }));

      const outEdge = edges.find((e) => e.source === node.id);
      if (outEdge) {
        setTimeout(() => {
          get().executeSimulatorNode(outEdge.target);
        }, 600);
      }
    } else if (node.type === 'ai_assistant') {
      // Send welcome message upon transition into AI node
      const welcomeText = node.data.ai_welcome_text
        || '👋 Здравствуйте! Я ИИ-ассистент. Чем я могу вам помочь? Напишите ваш вопрос прямо в чат.';

      set((state) => ({
        simulatorMessages: [
          ...state.simulatorMessages,
          {
            id: `bot_welcome_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            sender: 'bot',
            nodeId: node.id,
            text: welcomeText
          }
        ],
        activeSimulatorNodeId: node.id
      }));

      // DO NOT automatically follow outEdge! User is now in dialogue with the AI.
      return;
    }
  },

  clickSimulatorButton: (nodeId, buttonId) => {
    const { nodes, edges } = get();

    // Resilient source node lookup:
    // 1. By explicit nodeId
    // 2. By searching which node contains this buttonId
    // 3. By activeSimulatorNodeId
    const sourceNode = (nodeId ? nodes.find((n) => n.id === nodeId) : null)
      || nodes.find((n) => n.data.buttons?.some((b) => b.id === buttonId))
      || (get().activeSimulatorNodeId ? nodes.find((n) => n.id === get().activeSimulatorNodeId) : null);

    const btn = sourceNode?.data.buttons?.find((b) => b.id === buttonId);
    const btnText = btn?.text || 'Клик';

    set((state) => ({
      simulatorMessages: [
        ...state.simulatorMessages,
        { id: `usr_${Date.now()}`, sender: 'user', text: btnText }
      ]
    }));

    if (!sourceNode) return;

    // Resilient edge lookup:
    // 1. Edge from sourceNode with sourceHandle matching buttonId
    // 2. Fallback: Edge matching buttonId as sourceHandle across all edges
    // 3. Fallback: Any edge from sourceNode if only 1 button
    const edge = edges.find((e) => e.source === sourceNode.id && e.sourceHandle === buttonId)
      || edges.find((e) => e.sourceHandle === buttonId)
      || (sourceNode.data.buttons?.length === 1 ? edges.find((e) => e.source === sourceNode.id) : null);

    if (edge) {
      setTimeout(() => {
        get().executeSimulatorNode(edge.target);
      }, 300);
    }
  },

  sendUserMessage: (text) => {
    const { nodes, edges, activeSimulatorNodeId, simulatorVariables } = get();

    // If user sends /start, reset
    if (text.trim().toLowerCase() === '/start') {
      get().resetSimulator();
      return;
    }

    // Check if input matches one of the persistent keyboard buttons
    const currentKeyboard = get().activePersistentKeyboard;
    if (currentKeyboard && currentKeyboard.buttons.length > 0) {
      const matchedBtn = currentKeyboard.buttons.find(
        (b) => b.text.trim().toLowerCase() === text.trim().toLowerCase()
      );
      if (matchedBtn) {
        get().clickSimulatorButton(currentKeyboard.nodeId, matchedBtn.id);
        return;
      }
    }

    set((state) => ({
      simulatorMessages: [
        ...state.simulatorMessages,
        { id: `usr_${Date.now()}`, sender: 'user', text }
      ]
    }));

    if (activeSimulatorNodeId) {
      const activeNode = nodes.find((n) => n.id === activeSimulatorNodeId);
      if (activeNode) {
        if (activeNode.type === 'ai_assistant') {
          // Check limits
          const limitType = activeNode.data.ai_limit_type || 'none';
          const limitCount = activeNode.data.ai_limit_count ?? 15;
          const countKey = `ai_count_${activeNode.id}`;
          const currentCount = parseInt(simulatorVariables[countKey] || '0', 10);

          if (limitType !== 'none' && currentCount >= limitCount) {
            const limitMsg = activeNode.data.ai_limit_text
              || activeNode.data.ai_limit_message
              || '⚠️ Вы достигли лимита бесплатных сообщений к ИИ-ассистенту. Пожалуйста, обратитесь к администратору или вернитесь в главное меню.';

            setTimeout(() => {
              set((state) => ({
                simulatorMessages: [
                  ...state.simulatorMessages,
                  {
                    id: `bot_limit_${Date.now()}`,
                    sender: 'bot',
                    nodeId: activeNode.id,
                    text: limitMsg
                  }
                ]
              }));
            }, 300);
            return; // Stay in AI node! Do not transition anywhere!
          }

          // Increment count
          const nextCount = currentCount + 1;
          set({ simulatorVariables: { ...simulatorVariables, [countKey]: String(nextCount) } });

          const model = activeNode.data.ai_model || 'gpt-4o-mini';
          const url = (activeNode.data.ai_base_url || 'https://api.openai.com/v1').replace(/\/+$/, '');
          const apiKey = activeNode.data.ai_api_key || '';
          const systemPrompt = activeNode.data.ai_system_prompt || 'You are a helpful and smart AI assistant in Telegram.';

          (async () => {
            let aiText = '';
            try {
              if (apiKey && url && (url.startsWith('http://') || url.startsWith('https://'))) {
                const res = await fetch(`${url}/chat/completions`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                  },
                  body: JSON.stringify({
                    model: model,
                    messages: [
                      { role: 'system', content: systemPrompt },
                      { role: 'user', content: text }
                    ],
                    temperature: 0.7
                  })
                });
                if (res.ok) {
                  const data = await res.json();
                  aiText = data.choices?.[0]?.message?.content || '';
                }
              }
            } catch (err) {
              console.warn('Direct AI API call failed', err);
            }

            if (!aiText) {
              aiText = `🤖 <b>[AI (${model})]:</b>\nОтличный вопрос! Я обработал ваш запрос «${text}» и готов помочь. Если хотите продолжить, просто напишите следующее сообщение в чат.`;
            }

            set((state) => ({
              simulatorMessages: [
                ...state.simulatorMessages,
                {
                  id: `bot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                  sender: 'bot',
                  nodeId: activeNode.id,
                  text: aiText
                }
              ]
            }));
          })();

          // User stays in AI node! Do NOT follow outEdge.
          return;
        }

        if (activeNode.type === 'input') {
          const varName = activeNode.data.variable_name || 'user_input';
          const newVars = { ...simulatorVariables, [varName]: text, user_input: text };
          set({ simulatorVariables: newVars });
        }

        const outEdge = edges.find((e) => e.source === activeNode.id);
        if (outEdge) {
          setTimeout(() => {
            get().executeSimulatorNode(outEdge.target);
          }, 300);
        }
      }
    }
  },

  loadTemplate: (templateNodes, templateEdges) => {
    // Collision-preventing layout normalizer (eliminates overlapping / "спаянные" nodes)
    const adjustedNodes = (templateNodes || []).map((n: any) => ({
      ...n,
      position: { ...(n.position || { x: 100, y: 150 }) }
    }));

    const MIN_Y_GAP = 360; // ensures at least 80-120px clean margin between node cards
    for (let pass = 0; pass < 4; pass++) {
      for (let i = 0; i < adjustedNodes.length; i++) {
        for (let j = 0; j < adjustedNodes.length; j++) {
          if (i === j) continue;
          const a = adjustedNodes[i];
          const b = adjustedNodes[j];
          // If nodes are in the same visual column (overlapping X range)
          if (Math.abs(a.position.x - b.position.x) < 260) {
            if (b.position.y >= a.position.y && b.position.y - a.position.y < MIN_Y_GAP) {
              b.position.y = a.position.y + MIN_Y_GAP;
            }
          }
        }
      }
    }

    const formattedEdges = (templateEdges || []).map((e: any) => ({
      ...e,
      animated: false,
      style: e.style || { stroke: '#64748b', strokeWidth: 2 }
    }));
    set({
      nodes: adjustedNodes,
      edges: formattedEdges,
      selectedNodeId: null,
      simulatorMessages: []
    });
    try {
      localStorage.setItem(
        'botstudio_saved_project_v3',
        JSON.stringify({
          project_name: get().metadata.name || 'BotStudioBot',
          version: '3.0.0',
          saved_at: new Date().toISOString(),
          metadata: get().metadata,
          nodes: adjustedNodes,
          edges: formattedEdges
        })
      );
    } catch {}
  },

  clearCanvas: () => {
    const cleanStart: Node<NodeData> = {
      id: 'start_1',
      type: 'start',
      position: { x: 100, y: 150 },
      data: { label: '/start', command: '/start', description: 'Entry point via /start command' }
    };
    set({
      nodes: [cleanStart],
      edges: [],
      selectedNodeId: null,
      activeSimulatorNodeId: null,
      simulatorMessages: []
    });
    try {
      localStorage.setItem(
        'botstudio_saved_project_v3',
        JSON.stringify({
          project_name: get().metadata.name || 'BotStudioBot',
          version: '3.0.0',
          saved_at: new Date().toISOString(),
          metadata: get().metadata,
          nodes: [cleanStart],
          edges: []
        })
      );
    } catch {}
  },

  saveProject: () => {
    const { nodes, edges, metadata } = get();
    const projectData = {
      project_name: metadata.name || 'BotStudioBot',
      version: '3.0.0',
      saved_at: new Date().toISOString(),
      metadata,
      nodes,
      edges
    };
    try {
      localStorage.setItem('botstudio_saved_project_v3', JSON.stringify(projectData));
    } catch {}

    const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${metadata.name || 'bot_project'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  loadProjectFromFile: (content: string) => {
    try {
      const data = JSON.parse(content);
      if (Array.isArray(data.nodes) && data.nodes.length > 0) {
        get().loadTemplate(data.nodes, data.edges || []);
        if (data.metadata) {
          get().setMetadata(data.metadata);
        }
        return true;
      }
    } catch (e) {
      console.error('Failed to parse project file:', e);
    }
    return false;
  }
}));
