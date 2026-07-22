import type { AppSettings, Conversation, Message, ProjectState } from '../../shared/types';

const PROJECT_PATH = '/Users/demo/Code/DeepSeek-App';
const CONVERSATION_ID = 'preview-conversation';
const TURN_ID = 'preview-turn';

const previewSettings: AppSettings = {
  schemaVersion: 1,
  api: {
    protocol: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    models: ['claude-sonnet-4-6', 'claude-haiku-4-5'],
    defaultModel: 'claude-sonnet-4-6',
    apiKeySet: true,
  },
  apiProfiles: [{
    id: 'default',
    name: 'Anthropic Compatible',
    protocol: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    models: ['claude-sonnet-4-6', 'claude-haiku-4-5'],
    defaultModel: 'claude-sonnet-4-6',
    apiKeySet: true,
  }],
  activeApiProfileId: 'default',
  prompt: { systemPromptOverride: '' },
  permissions: {
    bashExec: 'default',
    bashWhitelist: [],
    skills: { disabled: [] },
  },
  search: { tavilyApiKeySet: false },
  compact: {
    model: '',
    autoThreshold: 0.8,
    keepRecentTurns: 3,
    contextLimit: 262144,
  },
  speech: {
    provider: 'openai-compatible',
    baseUrl: 'https://api.openai.com/v1',
    model: 'whisper-1',
    language: 'zh',
    maxDurationSeconds: 60,
    apiKeySet: false,
  },
  vision: {
    enabled: false,
    provider: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-6',
    apiKeySet: false,
  },
};

const previewProjectState: ProjectState = {
  projects: [{
    path: PROJECT_PATH,
    name: 'DeepSeek-App',
    environment: 'local',
    addedAt: Date.now() - 86400000,
  }],
  activeProject: PROJECT_PATH,
};

const previewConversations: Conversation[] = [{
  id: CONVERSATION_ID,
  title: '审查 coding agent harness',
  project_path: PROJECT_PATH,
  created_at: '2026-07-10 04:00:00',
  updated_at: '2026-07-10 05:00:00',
  activeAttempts: { [TURN_ID]: 1 },
}];

const previewMessages: Message[] = [
  {
    id: TURN_ID,
    role: 'user',
    content: '检查这个项目的 agent loop、工具调用和前端展示，修复高风险问题。',
    turnId: TURN_ID,
    attemptNo: 0,
    seq: 0,
    created_at: '2026-07-10 04:00:00',
  },
  {
    id: 'preview-assistant-1',
    role: 'assistant',
    content: '我先确认执行边界与消息流，再检查工具调度和权限策略。',
    reasoning_content: '需要同时追踪主进程调度、IPC 持久化和渲染层重建，避免只修复视觉症状。',
    tool_calls: [
      {
        id: 'preview-read',
        type: 'function',
        function: { name: 'read_file', arguments: JSON.stringify({ file_path: `${PROJECT_PATH}/src/main/agentLoop.ts` }) },
      },
      {
        id: 'preview-grep',
        type: 'function',
        function: { name: 'grep', arguments: JSON.stringify({ pattern: 'isConcurrencySafe', path: `${PROJECT_PATH}/src` }) },
      },
    ],
    turnId: TURN_ID,
    attemptNo: 1,
    seq: 1,
    duration: 4200,
    completed_at: Date.now() - 7200,
  },
  {
    id: 'preview-tool-read',
    role: 'tool',
    content: 'Read 426 lines.',
    tool_call_id: 'preview-read',
    name: 'read_file',
    metadata: { kind: 'read', path: `${PROJECT_PATH}/src/main/agentLoop.ts`, lineCount: 426, truncated: false },
    turnId: TURN_ID,
    attemptNo: 1,
    seq: 2,
  },
  {
    id: 'preview-tool-grep',
    role: 'tool',
    content: '12 matches in 8 files.',
    tool_call_id: 'preview-grep',
    name: 'grep',
    metadata: { kind: 'grep', pattern: 'isConcurrencySafe', matchCount: 12, fileCount: 8 },
    turnId: TURN_ID,
    attemptNo: 1,
    seq: 3,
  },
  {
    id: 'preview-assistant-2',
    role: 'assistant',
    content: '已确认非并发安全工具可能重叠执行，并且中止信号没有传到底层命令。现在修复调度器并补回归测试。',
    tool_calls: [
      {
        id: 'preview-edit',
        type: 'function',
        function: { name: 'edit_file', arguments: JSON.stringify({ file_path: `${PROJECT_PATH}/src/main/agent-loop/toolExecution.ts` }) },
      },
      {
        id: 'preview-test',
        type: 'function',
        function: { name: 'bash_exec', arguments: JSON.stringify({ command: 'pnpm test' }) },
      },
    ],
    turnId: TURN_ID,
    attemptNo: 1,
    seq: 4,
    duration: 6500,
    completed_at: Date.now() - 1100,
  },
  {
    id: 'preview-tool-edit',
    role: 'tool',
    content: 'Updated scheduler.',
    tool_call_id: 'preview-edit',
    name: 'edit_file',
    metadata: {
      kind: 'edit',
      path: `${PROJECT_PATH}/src/main/agent-loop/toolExecution.ts`,
      linesAdded: 48,
      linesDeleted: 61,
      diff: '@@ -12,4 +12,8 @@\n- run all tools in parallel\n+ batch read-only tools\n+ serialize mutations',
    },
    turnId: TURN_ID,
    attemptNo: 1,
    seq: 5,
  },
  {
    id: 'preview-tool-test',
    role: 'tool',
    content: 'Test Files 63 passed\nTests 237 passed',
    tool_call_id: 'preview-test',
    name: 'bash_exec',
    metadata: { kind: 'exec', command: 'pnpm test', exitCode: 0, duration: 2860, outputLines: 2 },
    turnId: TURN_ID,
    attemptNo: 1,
    seq: 6,
  },
  {
    id: 'preview-assistant-final',
    role: 'assistant',
    content: '关键风险已经收敛：写入类工具按顺序执行，安全读取仍可并行；用户中止会传入底层命令；项目外文件读取需要确认；agent loop 增加轮数上限。验证已通过。',
    usage: {
      prompt_tokens: 18240,
      completion_tokens: 1240,
      total_tokens: 19480,
      prompt_cache_hit_tokens: 14800,
      prompt_cache_miss_tokens: 3440,
    },
    duration: 12300,
    completed_at: Date.now(),
    turnId: TURN_ID,
    attemptNo: 1,
    seq: 7,
  },
];

const noopSubscription = () => () => undefined;

export function installPreviewBridge(): void {
  const isLocalPreview = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (!isLocalPreview || window.deepseekApi) return;

  let settings = structuredClone(previewSettings);
  const baseApi: Partial<Window['deepseekApi']> = {
    getModels: async () => [...settings.api.models],
    getSettings: async () => structuredClone(settings),
    patchSettings: async (patch) => {
      settings = {
        ...settings,
        api: { ...settings.api, ...(patch.api ?? {}) },
        prompt: { ...settings.prompt, ...(patch.prompt ?? {}) },
        compact: { ...settings.compact, ...(patch.compact ?? {}) },
      };
      return structuredClone(settings);
    },
    resetSettings: async () => structuredClone(previewSettings),
    getConversations: async () => structuredClone(previewConversations),
    getMessages: async () => structuredClone(previewMessages),
    getActiveAttempts: async () => ({ [TURN_ID]: 1 }),
    setActiveAttempts: async () => undefined,
    projectGetState: async () => structuredClone(previewProjectState),
    projectSetActive: async () => true,
    approvalListPending: async () => [],
    agentsList: async () => [],
    taskList: async () => [],
    skillsList: async () => [],
    skillsWatchProject: async () => undefined,
    mcpListStatus: async () => [],
    cronList: async () => [],
    cronRuns: async () => [],
    cronConversations: async () => [],
    getMemories: async () => [],
    getFileOpenOptions: async () => [],
    gitGetBranches: async () => ({ currentBranch: 'main', branches: ['main', 'feature/harness'] }),
    gitGetChangedFiles: async () => ({ files: [], hasGit: true }),
    gitGetCommitStatus: async () => ({
      hasGit: true,
      branch: 'main',
      additions: 215,
      deletions: 188,
      hasChanges: true,
      hasStagedChanges: false,
      hasUnstagedChanges: true,
      aheadCount: 0,
      hasRemote: true,
      hasUpstream: true,
    }),
    gitCommit: async () => ({ success: true }),
    gitPush: async () => ({ success: true }),
    onChunk: noopSubscription,
    onReasoningChunk: noopSubscription,
    onDone: noopSubscription,
    onError: noopSubscription,
    onToolCallStart: noopSubscription,
    onToolCallEnd: noopSubscription,
    onAssistantMessage: noopSubscription,
    onToolMessagePersisted: noopSubscription,
    onStreamRetry: noopSubscription,
    onAgentsChanged: noopSubscription,
    onProjectChanged: noopSubscription,
    onApprovalRequest: noopSubscription,
    onSettingsChanged: noopSubscription,
    onTasksChanged: noopSubscription,
    onSkillsChanged: noopSubscription,
    onMcpChanged: noopSubscription,
    onCronChanged: noopSubscription,
  };

  window.deepseekApi = new Proxy(baseApi, {
    get(target, property) {
      const existing = target[property as keyof typeof target];
      if (existing) return existing;
      if (typeof property === 'string' && property.startsWith('on')) return noopSubscription;
      return async () => undefined;
    },
  }) as Window['deepseekApi'];

  window.conversationsApi = { onChanged: noopSubscription };
  window.electronEnv = {
    platform: 'darwin',
    getHomeDir: async () => '/Users/demo',
    isFullScreen: async () => false,
    setTrafficLightPosition: async () => undefined,
    openNewWindow: async () => undefined,
    onFullscreenChanged: noopSubscription,
  };
  window.terminalApi = {
    create: async (sessionId) => ({ sessionId, pid: 0, cwd: PROJECT_PATH, shell: '/bin/zsh', userLabel: 'preview' }),
    write: async () => true,
    resize: async () => true,
    kill: async () => true,
    attach: async () => true,
    onData: noopSubscription,
    onExit: noopSubscription,
  };
}
