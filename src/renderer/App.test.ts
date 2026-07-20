import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { parseHTML } from 'linkedom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Conversation, Message, ToolItem } from '../shared/types';
import App from './App';

const mocks = vi.hoisted(() => {
  const userMessage: Message = {
    id: 'user_1',
    role: 'user',
    content: '分析项目',
    created_at: '2026-06-16 01:00:00',
    turnId: 'user_1',
    attemptNo: 0,
  };

  const assistantMessage: Message = {
    id: 'assistant_1',
    role: 'assistant',
    content: '最终答案',
    reasoning_content: '最终回复的思考过程',
    created_at: '2026-06-16 01:00:38',
    duration: 38_000,
    turnId: 'user_1',
    attemptNo: 1,
    seq: 0,
  };

  const conversation: Conversation = {
    id: 'conv_1',
    title: '分析项目',
    project_path: '/tmp/project',
    created_at: '2026-06-16 01:00:00',
    updated_at: '2026-06-16 01:00:38',
  };

  return {
    messages: [userMessage, assistantMessage],
    conversations: [conversation],
    sidebarCollapsed: true,
    rightPanelCollapsed: true,
    setPreview: vi.fn(),
    setSidebarCollapsed: vi.fn(),
    setTrafficLightPosition: vi.fn(async () => undefined),
    setRightPanelCollapsed: vi.fn(),
    setBottomPanelCollapsed: vi.fn(),
    handleModelChange: vi.fn(),
    selectProject: vi.fn(),
    addProject: vi.fn(),
    createProject: vi.fn(),
    removeProject: vi.fn(),
    pickProjectParentDirectory: vi.fn(),
    handleNewConversation: vi.fn(),
    handleSelectConversation: vi.fn(),
    handleDeleteConversation: vi.fn(),
    setConversationId: vi.fn(),
    setMessages: vi.fn(),
    setActiveAttempts: vi.fn(),
    loadConversations: vi.fn(),
    deleteMessagesFromTurn: vi.fn(),
    sendMessage: vi.fn(),
    abortSend: vi.fn(),
    isConversationActive: vi.fn(() => false),
    rebindActiveRequests: vi.fn(),
    handleApprovalConfirm: vi.fn(),
    navigate: vi.fn(),
    replaceCurrentConversationId: vi.fn(),
    pruneByConversationId: vi.fn(),
  };
});

vi.mock('./contexts/AppContext', () => ({
  useAppContext: () => ({
    sidebar: {
      sidebarRef: { current: null },
      collapsed: mocks.sidebarCollapsed,
      width: 260,
      setCollapsed: mocks.setSidebarCollapsed,
      handleResizeStart: vi.fn(),
    },
    models: {
      models: ['deepseek-v4-flash'],
      selectedModel: 'deepseek-v4-flash',
      handleModelChange: mocks.handleModelChange,
    },
    project: {
      activeProject: '/tmp/project',
      projects: [{ path: '/tmp/project', name: 'project' }],
      selectProject: mocks.selectProject,
      addProject: mocks.addProject,
      createProject: mocks.createProject,
      removeProject: mocks.removeProject,
      pickProjectParentDirectory: mocks.pickProjectParentDirectory,
    },
    settings: {
      settings: {
        compact: {
          contextLimit: 1_000_000,
        },
      },
    },
    rightPanel: {
      collapsed: mocks.rightPanelCollapsed,
      setCollapsed: mocks.setRightPanelCollapsed,
    },
    bottomPanel: {
      collapsed: true,
      setCollapsed: mocks.setBottomPanelCollapsed,
    },
    windowChrome: {
      isMacOS: true,
      isFullscreen: false,
    },
    preview: null,
    setPreview: mocks.setPreview,
    previews: [],
    activeTitle: null,
    setActiveTitle: vi.fn(),
    closeTab: vi.fn(),
    activeImage: null,
    setActiveImage: vi.fn(),
  }),
  useModelsContext: () => ({
    models: ['deepseek-v4-flash'],
    selectedModel: 'deepseek-v4-flash',
    handleModelChange: mocks.handleModelChange,
  }),
  usePreviewActions: () => ({
    setPreview: mocks.setPreview,
  }),
}));

vi.mock('./hooks/useConversations', () => ({
  useConversations: () => ({
    conversationId: 'conv_1',
    setConversationId: mocks.setConversationId,
    messages: mocks.messages,
    setMessages: mocks.setMessages,
    conversations: mocks.conversations,
    activeAttempts: {},
    setActiveAttempts: mocks.setActiveAttempts,
    loadConversations: mocks.loadConversations,
    loadMessages: vi.fn(),
    handleNewConversation: mocks.handleNewConversation,
    handleSelectConversation: mocks.handleSelectConversation,
    handleDeleteConversation: mocks.handleDeleteConversation,
    deleteMessagesFromTurn: mocks.deleteMessagesFromTurn,
  }),
}));

vi.mock('./hooks/useMessages', () => ({
  useMessages: () => ({
    sendMessage: mocks.sendMessage,
    abortSend: mocks.abortSend,
    isConversationActive: mocks.isConversationActive,
    rebindActiveRequests: mocks.rebindActiveRequests,
    retryInfo: null,
    turnTimers: {},
    handleApprovalConfirm: mocks.handleApprovalConfirm,
  }),
}));

vi.mock('./hooks/useChatOrchestrator', () => ({
  useChatOrchestrator: () => ({
    handleSend: vi.fn(),
    handleRetry: vi.fn(),
    abortSend: vi.fn(),
    isLoading: false,
  }),
}));

vi.mock('./hooks/useChatActivityPhase', () => ({
  useChatActivityPhase: () => ({
    visible: false,
  }),
}));

vi.mock('./hooks/useToolRenderUnits', () => ({
  useToolRenderUnits: () => ({
    units: [],
    segmentMessageMap: new Map(),
    tailUnitsByMessageId: new Map(),
  }),
}));

vi.mock('./hooks/useNavHistory', () => ({
  useNavHistory: () => ({
    navigate: mocks.navigate,
    replaceCurrentConversationId: mocks.replaceCurrentConversationId,
    pruneByConversationId: mocks.pruneByConversationId,
  }),
}));

vi.mock('./components/ChatPanel', async () => {
  const ReactActual = await vi.importActual<typeof import('react')>('react');
  return {
    default: ({ items }: { items: React.ReactNode[] }) => ReactActual.createElement(
      'div',
      { 'data-testid': 'chat-panel' },
      items,
    ),
  };
});

vi.mock('./components/ChatInput', async () => {
  const ReactActual = await vi.importActual<typeof import('react')>('react');
  return {
    default: ({ topAccessory, statusAccessory }: { topAccessory?: React.ReactNode; statusAccessory?: React.ReactNode }) => ReactActual.createElement(
      'div',
      { 'data-testid': 'chat-input' },
      topAccessory,
      statusAccessory,
      ReactActual.createElement('div', { 'data-testid': 'chat-input-composer' }),
    ),
  };
});

vi.mock('./components/Sidebar', async () => {
  const ReactActual = await vi.importActual<typeof import('react')>('react');
  return {
    default: () => ReactActual.createElement('div', { 'data-testid': 'sidebar' }),
  };
});

vi.mock('./components/AppHeader', async () => {
  const ReactActual = await vi.importActual<typeof import('react')>('react');
  return {
    default: ({ onNewConversation, rightContent }: { onNewConversation: () => void; rightContent?: React.ReactNode }) => ReactActual.createElement(
      'div',
      { 'data-testid': 'app-header' },
      ReactActual.createElement(
        'button',
        { 'data-testid': 'app-header-new-conversation', onClick: onNewConversation },
        '新对话',
      ),
      rightContent,
    ),
  };
});

vi.mock('./components/ArtifactPanel', async () => {
  const ReactActual = await vi.importActual<typeof import('react')>('react');
  return {
    default: () => ReactActual.createElement('div', { 'data-testid': 'artifact-panel' }),
  };
});

vi.mock('./components/TaskProgressAccessory', async () => {
  const ReactActual = await vi.importActual<typeof import('react')>('react');
  return {
    default: () => ReactActual.createElement('div', { 'data-testid': 'task-progress-accessory' }),
  };
});

vi.mock('./components/TerminalPanel', async () => {
  const ReactActual = await vi.importActual<typeof import('react')>('react');
  return {
    default: () => ReactActual.createElement('div', { 'data-testid': 'terminal-panel' }),
  };
});

vi.mock('./components/SearchModal', async () => {
  const ReactActual = await vi.importActual<typeof import('react')>('react');
  return {
    default: () => ReactActual.createElement('div', { 'data-testid': 'search-modal' }),
  };
});

vi.mock('./components/settings/SettingsPage', async () => {
  const ReactActual = await vi.importActual<typeof import('react')>('react');
  return {
    default: () => ReactActual.createElement('div', { 'data-testid': 'settings-page' }),
  };
});

vi.mock('./components/OverlayView', async () => {
  const ReactActual = await vi.importActual<typeof import('react')>('react');
  return {
    default: () => ReactActual.createElement('div', { 'data-testid': 'overlay-view' }),
  };
});

describe('App completed turn rendering', () => {
  let root: Root | null = null;
  let container: HTMLElement;

  beforeEach(() => {
    const { window } = parseHTML('<!doctype html><html><body><div id="root"></div></body></html>');
    Object.assign(globalThis, {
      window,
      document: window.document,
      HTMLElement: window.HTMLElement,
      Event: window.Event,
      Node: window.Node,
      IS_REACT_ACT_ENVIRONMENT: true,
    });
    Object.assign(window, {
      electronEnv: {
        platform: 'darwin',
        getHomeDir: async () => '/Users/test',
        isFullScreen: async () => false,
        setTrafficLightPosition: mocks.setTrafficLightPosition,
        openNewWindow: async () => undefined,
        onFullscreenChanged: () => () => undefined,
      },
    });
    container = window.document.getElementById('root') as HTMLElement;
    root = createRoot(container);
    mocks.sidebarCollapsed = true;
    mocks.rightPanelCollapsed = true;
    mocks.setSidebarCollapsed.mockClear();
    mocks.setTrafficLightPosition.mockClear();
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    vi.restoreAllMocks();
  });

  it('collapses final assistant reasoning into an exploration activity summary', () => {
    act(() => {
      root?.render(React.createElement(App));
    });

    const processedButton = container.querySelector('[data-testid="processed-summary-toggle"]') as HTMLButtonElement | null;

    expect(processedButton).not.toBeNull();
    expect(processedButton?.textContent).toContain('已处理');
    expect(processedButton?.textContent).toContain('38s');
    expect(container.textContent).toContain('最终答案');
    expect(container.querySelector('[data-testid="exploration-activity-summary"]')).toBeNull();

    act(() => {
      processedButton?.dispatchEvent(new window.Event('click', { bubbles: true }));
    });

    const reasoningToggle = container.querySelector('[data-testid="reasoning-activity-toggle"]') as HTMLButtonElement;
    expect(reasoningToggle.textContent).toContain('已深度思考，思考了 38秒');
    expect(container.textContent).not.toContain('最终回复的思考过程');

    act(() => {
      reasoningToggle.dispatchEvent(new window.Event('click', { bubbles: true }));
    });
    expect(container.textContent).toContain('最终回复的思考过程');
  });

  it('keeps consecutive reasoning runs collapsed independently around assistant text', () => {
    const originalMessages = mocks.messages;
    try {
      mocks.messages = [
        {
          id: 'user_1',
          role: 'user',
          content: '分析项目',
          created_at: '2026-06-16 01:00:00',
          turnId: 'user_1',
          attemptNo: 0,
        },
        {
          id: 'assistant_1_mid',
          role: 'assistant',
          content: '先检查代码结构',
          reasoning_content: '中间步骤的思考过程',
          created_at: '2026-06-16 01:00:10',
          duration: 10_000,
          turnId: 'user_1',
          attemptNo: 1,
          seq: 0,
        },
        {
          id: 'assistant_1_final',
          role: 'assistant',
          content: '最终答案',
          reasoning_content: '最终回复的思考过程',
          created_at: '2026-06-16 01:00:38',
          duration: 28_000,
          turnId: 'user_1',
          attemptNo: 1,
          seq: 1,
        },
      ];

      act(() => {
        root?.render(React.createElement(App));
      });

      const processedToggle = container.querySelector('[data-testid="processed-summary-toggle"]') as HTMLButtonElement;
      expect(processedToggle).not.toBeNull();
      expect(container.textContent).toContain('最终答案');

      act(() => {
        processedToggle.dispatchEvent(new window.Event('click', { bubbles: true }));
      });

      const processedButtons = Array.from(
        container.querySelectorAll('[data-testid="reasoning-activity-toggle"]'),
      ) as HTMLButtonElement[];
      expect(processedButtons).toHaveLength(2);
      expect(processedButtons[0].textContent).toContain('已深度思考，思考了 10秒');
      expect(processedButtons[1].textContent).toContain('已深度思考，思考了 28秒');

      act(() => {
        processedButtons[0].dispatchEvent(new window.Event('click', { bubbles: true }));
      });

      expect(container.textContent).toContain('先检查代码结构');
      expect(container.textContent).toContain('中间步骤的思考过程');
    } finally {
      mocks.messages = originalMessages;
    }
  });

  it('groups consecutive exploration and keeps terminal commands standalone', () => {
    const originalMessages = mocks.messages;
    try {
      mocks.messages = [
        {
          id: 'user_activity', role: 'user', content: '检查项目', turnId: 'user_activity', attemptNo: 0,
        },
        {
          id: 'assistant_explore_1', role: 'assistant', content: '', reasoning_content: '先定位代码',
          duration: 61_000, turnId: 'user_activity', attemptNo: 1, seq: 0,
          toolItems: [
            {
              id: 'read_activity', toolCallId: 'call_read_activity', name: 'read_file', kind: 'read',
              status: 'done', timestamp: 1, path: '/tmp/project/src/App.tsx', lineCount: 22,
            },
            {
              id: 'grep_activity', toolCallId: 'call_grep_activity', name: 'grep', kind: 'grep',
              status: 'done', timestamp: 2, pattern: 'MessageBubble', matchCount: 3, fileCount: 1,
            },
          ],
        },
        {
          id: 'assistant_explore_2', role: 'assistant', content: '', reasoning_content: '继续验证结果',
          duration: 4_000, turnId: 'user_activity', attemptNo: 1, seq: 1,
          toolItems: [{
            id: 'grep_activity_2', toolCallId: 'call_grep_activity_2', name: 'grep', kind: 'grep',
            status: 'done', timestamp: 4, pattern: 'failed', matchCount: 0, fileCount: 0,
          }],
        },
        {
          id: 'assistant_exec', role: 'assistant', content: '', turnId: 'user_activity', attemptNo: 1, seq: 2,
          toolItems: [{
            id: 'exec_activity', toolCallId: 'call_exec_activity', name: 'bash_exec', kind: 'exec',
            status: 'done', timestamp: 3, command: 'pnpm test', exitCode: 0,
          }],
        },
        {
          id: 'assistant_activity_final', role: 'assistant', content: '检查完成',
          turnId: 'user_activity', attemptNo: 1, seq: 3,
        },
      ];

      act(() => root?.render(React.createElement(App)));

      const processedToggle = container.querySelector('[data-testid="processed-summary-toggle"]') as HTMLButtonElement;
      expect(processedToggle).not.toBeNull();
      expect(container.textContent).not.toContain('pnpm test');

      act(() => {
        processedToggle.dispatchEvent(new window.Event('click', { bubbles: true }));
      });

      const summaries = Array.from(
        container.querySelectorAll('[data-testid="exploration-activity-summary"]'),
      ) as HTMLButtonElement[];
      expect(summaries).toHaveLength(2);
      expect(summaries[0].textContent).toContain('思考了 1分1秒，读取 1 个文件，搜索 1 次');
      expect(summaries[0].getAttribute('data-tool-icon')).toBe('book');
      expect(summaries[1].getAttribute('data-tool-icon')).toBe('search');
      const processedContent = container.querySelector('[data-testid="processed-summary-content"]') as HTMLElement;
      const standaloneCommand = container.querySelector('[data-testid="tool-item-row"]') as HTMLButtonElement;
      expect(processedContent.className).not.toContain('pl-[25px]');
      expect(summaries[0].className).not.toContain('px-2');
      expect(summaries[1].className).not.toContain('px-2');
      expect(standaloneCommand.className).not.toContain('px-2');
      expect(container.textContent).toContain('已运行');
      expect(container.textContent).toContain('pnpm test');
      expect(container.textContent).toContain('检查完成');
    } finally {
      mocks.messages = originalMessages;
    }
  });

  it('navigates to the persisted empty conversation created from the header', async () => {
    mocks.handleNewConversation.mockResolvedValueOnce('conv_empty');

    await act(async () => {
      root?.render(React.createElement(App));
    });

    const newConversationButton = container.querySelector('[data-testid="app-header-new-conversation"]') as HTMLButtonElement;

    await act(async () => {
      newConversationButton.dispatchEvent(new window.Event('click', { bubbles: true }));
    });

    expect(mocks.handleNewConversation).toHaveBeenCalledWith('/tmp/project');
    expect(mocks.navigate).toHaveBeenCalledWith({ view: 'chat', conversationId: 'conv_empty' });
  });

  it('removes the old task monitor popover and header control', async () => {
    await act(async () => {
      root?.render(React.createElement(App));
    });

    expect(container.querySelector('[data-testid="task-monitor-popover"]')).toBeNull();
    expect(container.querySelector('[aria-label="显示任务监控"]')).toBeNull();
  });

  it('places task progress above the composer without changing workspace controls', async () => {
    await act(async () => {
      root?.render(React.createElement(App));
    });

    const composer = container.querySelector('[data-testid="chat-input-composer"]');
    const progress = container.querySelector('[data-testid="task-progress-accessory"]');

    expect(composer?.contains(progress)).toBe(false);
    expect(container.querySelector('[data-testid="chat-input"]')?.contains(progress)).toBe(true);
    expect(container.querySelector('[aria-label="显示产物面板"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="显示终端"]')).not.toBeNull();
  });

  it('replaces task progress with a pending approval above the composer', async () => {
    const originalMessages = mocks.messages;
    const approvalItem: ToolItem = {
      id: 'approval_exec',
      toolCallId: 'call_approval_exec',
      name: 'bash_exec',
      kind: 'exec',
      status: 'awaiting_approval',
      timestamp: 0,
      command: 'pnpm test',
    };
    mocks.messages = [
      ...originalMessages,
      { id: 'assistant_approval', role: 'assistant', content: '', toolItems: [approvalItem] },
    ];

    try {
      await act(async () => {
        root?.render(React.createElement(App));
      });

      expect(container.querySelector('[data-testid="task-progress-accessory"]')).toBeNull();
      expect(container.textContent).toContain('终端命令');
      expect(container.textContent).toContain('pnpm test');
      expect(container.querySelector('[data-testid="chat-input-composer"]')).not.toBeNull();
    } finally {
      mocks.messages = originalMessages;
    }
  });

  it('places the workspace and its resize affordance inside the floating card frame', async () => {
    await act(async () => {
      root?.render(React.createElement(App));
    });

    const shell = container.querySelector('.workspace-panel-shell');
    const card = shell?.querySelector('.workspace-surface.right-panel-card');
    const resizeHandle = shell?.querySelector('button.right-panel-resize-handle');
    const resizeIndicator = resizeHandle?.querySelector('.right-panel-resize-indicator');

    expect(shell?.contains(card ?? null)).toBe(true);
    expect(shell?.contains(resizeHandle ?? null)).toBe(true);
    expect(resizeIndicator?.className).toContain('top-3 bottom-3');
  });

  it('keeps task monitoring out of the workspace header while the workspace is open', async () => {
    mocks.rightPanelCollapsed = false;

    await act(async () => {
      root?.render(React.createElement(App));
    });

    const mainHeader = container.querySelector('[data-testid="app-header"]');
    const artifactPanel = container.querySelector('[data-testid="artifact-panel"]');

    expect(mainHeader?.querySelector('[aria-label="显示任务监控"]')).toBeNull();
    expect(mainHeader?.querySelector('[aria-label="隐藏产物面板"]')).toBeNull();
    expect(mainHeader?.querySelector('[aria-label="显示终端"]')).toBeNull();
    expect(artifactPanel?.querySelector('[aria-label="显示任务监控"]')).toBeNull();
  });

  it('provides a dismiss layer when the sidebar is open on a narrow layout', async () => {
    mocks.sidebarCollapsed = false;

    await act(async () => {
      root?.render(React.createElement(App));
    });

    const dismissLayer = container.querySelector('button.mobile-sidebar-scrim') as HTMLButtonElement | null;
    const sidebarShell = container.querySelector('.sidebar-shell');
    const resizeHandle = container.querySelector('button.sidebar-resize-handle');
    const resizeIndicator = resizeHandle?.querySelector('.sidebar-resize-indicator');

    expect(dismissLayer).not.toBeNull();
    expect(dismissLayer?.getAttribute('aria-label')).toBe('收起侧栏');
    expect(sidebarShell?.contains(resizeHandle)).toBe(true);
    expect(resizeIndicator?.className).toContain('top-3 bottom-3');

    act(() => {
      dismissLayer?.dispatchEvent(new window.Event('click', { bubbles: true }));
    });

    expect(mocks.setSidebarCollapsed).toHaveBeenCalledWith(true);
  });

  it('syncs the native traffic-light position with sidebar state', async () => {
    await act(async () => {
      root?.render(React.createElement(App));
    });

    expect(mocks.setTrafficLightPosition).toHaveBeenLastCalledWith(true);

    mocks.sidebarCollapsed = false;
    await act(async () => {
      root?.render(React.createElement(App));
    });

    expect(mocks.setTrafficLightPosition).toHaveBeenLastCalledWith(false);
  });
});
