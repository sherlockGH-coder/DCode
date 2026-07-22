/**
 * ==============================================================================
 * src/renderer/types/global.d.ts — 全局类型声明
 * ==============================================================================
 * 定义所有挂载到 window 对象上的全局类型和接口
 * ==============================================================================
 */

import type { ToolResultMetadata, Project, ProjectCreateInput, ProjectState, Attachment, AppSettings, AppSettingsPatch, SkillScope, SkillSummary, Skill, McpScope, McpServerConfig, McpServerStatus, CronJobScope, CronJobInput, CronJobSummary, CronValidateResult, CronRunRecord, Memory, Task, TaskInput, TaskUpdateInput, TaskStatus, TaskScope, SpeechTranscriptionResult, ChangeUndoEntry, ChangeUndoResult, FileOpenOption, FileOpenResult, PendingApprovalRequest, AgentRunSummary, GitActionResult, GitCommitStatus, ConversationModeState, SetConversationModeRequest, MarkPlanPresentedRequest, PlanPresentationToken, PlanDecisionRequest, PlanDecisionResult, PlanExecutionRequest } from '../../shared/types';

declare global {
  interface Window {
    /**
     * Electron 环境信息
     */
    electronEnv?: {
      platform: string;
      getHomeDir: () => Promise<string>;
      isFullScreen: () => Promise<boolean>;
      setTrafficLightPosition: (sidebarCollapsed: boolean) => Promise<void>;
      openNewWindow: () => Promise<void>;
      onFullscreenChanged: (callback: (isFullScreen: boolean) => void) => () => void;
    };

    /**
     * DeepSeek API 接口
     */
    deepseekApi: {

      sendMessage: (
        messages: Array<{ role: string; content: string }>,
        model?: string,
        conversationId?: string,
        attachments?: Attachment[],
        reasoningEffort?: string,
        turnId?: string,
        attemptNo?: number,
        planExecution?: PlanExecutionRequest,
      ) => Promise<void>;
      abortChat: (conversationId?: string) => Promise<void>;
      truncateMessages: (conversationId: string, messageId: string) => Promise<void>;
      compactConversation: (conversationId: string) => Promise<{
        summary: string;
        boundaryMessageId: string | null;
        compactedCount: number;
      }>;
      onChunk: (callback: (conversationId: string, content: string) => void) => () => void;
      onReasoningChunk: (callback: (conversationId: string, content: string) => void) => () => void;
      onDone: (callback: (conversationId: string) => void) => () => void;
      onError: (callback: (conversationId: string, errorMessage: string) => void) => () => void;
      onToolCallStart: (callback: (conversationId: string, toolCall: { id: string; name: string; arguments: string }) => void) => () => void;
      onToolCallEnd: (callback: (conversationId: string, result: { tool_call_id: string; name: string; content: string; contentBlocks?: import('../../shared/types').ToolResultContentBlock[]; error?: boolean; metadata?: ToolResultMetadata }) => void) => () => void;
      onAssistantMessage: (callback: (conversationId: string, msg: { id: string; usage?: any; duration?: number }) => void) => () => void;
      onToolMessagePersisted: (callback: (conversationId: string, msg: { tool_call_id: string; id: string }) => void) => () => void;
      onStreamRetry: (callback: (conversationId: string, info: { attempt: number; maxAttempts: number; delayMs: number; reason: string }) => void) => () => void;
      agentsList: () => Promise<AgentRunSummary[]>;
      onAgentsChanged: (callback: (agents: AgentRunSummary[]) => void) => () => void;
      getConversationModeState: (conversationId: string) => Promise<ConversationModeState>;
      setConversationMode: (request: SetConversationModeRequest) => Promise<ConversationModeState>;
      markPlanPresented: (request: MarkPlanPresentedRequest) => Promise<PlanPresentationToken>;
      getPlanArtifact: (planId: string) => Promise<import('../../shared/types').PlanArtifact | null>;
      decidePlan: (request: PlanDecisionRequest) => Promise<PlanDecisionResult>;
      onConversationModeStateChanged: (callback: (state: ConversationModeState) => void) => () => void;

      getModels: () => Promise<string[]>;
      transcribeSpeech: (audioBuffer: ArrayBuffer, mimeType: string) => Promise<SpeechTranscriptionResult>;

      createConversation: (title: string, projectPath: string | null) => Promise<string>;
      getConversations: (projectPath?: string | null) => Promise<any[]>;
      updateConversationTitle: (id: string, title: string) => Promise<void>;
      deleteConversation: (id: string) => Promise<void>;
      addMessage: (conversationId: string, role: string, content: string | null, toolCalls?: any[], toolCallId?: string, metadata?: ToolResultMetadata, reasoningContent?: string, attachments?: Attachment[], name?: string, error?: boolean, usage?: any, duration?: number, turnId?: string, attemptNo?: number, seq?: number, id?: string, contentBlocks?: import('../../shared/types').ToolResultContentBlock[], contextEpoch?: number, origin?: string, planArtifactId?: string) => Promise<string>;
      getMessages: (conversationId: string) => Promise<any[]>;
      deleteMessagesFromTurn: (conversationId: string, turnId: string) => Promise<void>;
      getActiveAttempts: (conversationId: string) => Promise<Record<string, number>>;
      setActiveAttempts: (conversationId: string, map: Record<string, number>) => Promise<void>;

      projectGetState: () => Promise<ProjectState>;
      projectAdd: (folderPath?: string) => Promise<Project | null>;
      projectPickParentDirectory: () => Promise<string | null>;
      projectCreate: (input: ProjectCreateInput) => Promise<Project>;
      projectRemove: (folderPath: string) => Promise<boolean>;
      projectSetActive: (folderPath: string | null) => Promise<boolean>;
      onProjectChanged: (callback: (state: ProjectState) => void) => () => void;

      onApprovalRequest: (callback: (req: PendingApprovalRequest) => void) => () => void;
      approvalListPending: (conversationId?: string | null) => Promise<PendingApprovalRequest[]>;
      approvalRespond: (
        toolCallId: string,
        allowed: boolean,
        reason?: string,
        rememberForSession?: boolean,
        scope?: { kind: 'outOfScopeDir'; dir: string },
        answers?: Record<string, string>,
      ) => Promise<boolean>;

      pickFiles: () => Promise<Attachment[]>;
      statPath: (path: string) => Promise<Attachment | null>;
      pasteClipboardImage: () => Promise<Attachment | null>;
      readFileContent: (filePath: string) => Promise<{ content: string; name: string; path: string } | null>;

      getSettings: () => Promise<AppSettings>;
      patchSettings: (patch: AppSettingsPatch) => Promise<AppSettings>;
      setApiKey: (plaintext: string) => Promise<void>;
      setApiProfileApiKey: (profileId: string, plaintext: string) => Promise<void>;
      setTavilyApiKey: (plaintext: string) => Promise<void>;
      setSpeechApiKey: (plaintext: string) => Promise<void>;
      setVisionApiKey: (plaintext: string) => Promise<void>;
      resetSettings: () => Promise<AppSettings>;
      getDbPath: () => Promise<string>;
      openDbDir: () => Promise<void>;
      openFile: (filePath: string) => Promise<void>;
      getFileOpenOptions: (filePath: string) => Promise<FileOpenOption[]>;
      openFileWith: (filePath: string, optionId: string) => Promise<FileOpenResult>;
      onSettingsChanged: (callback: (settings: AppSettings) => void) => () => void;

      getMemories: () => Promise<Memory[]>;
      createMemory: (payload: {
        key: string;
        content: string;
        scope: 'user' | 'project';
        projectPath?: string | null;
      }) => Promise<{ success: boolean; id?: string; error?: string }>;
      deleteMemory: (id: string) => Promise<{ success: boolean }>;
      deleteAllMemories: () => Promise<{ success: boolean }>;
      updateMemory: (id: string, content: string) => Promise<{ success: boolean }>;

      taskCreate: (scope: TaskScope, input: TaskInput, projectPath: string | null, conversationId?: string | null) => Promise<Task | undefined>;
      taskGet: (id: string) => Promise<Task | undefined>;
      taskList: (status?: TaskStatus, scope?: TaskScope, conversationId?: string | null) => Promise<Task[]>;
      taskUpdate: (id: string, input: TaskUpdateInput, projectPath: string | null) => Promise<Task | undefined>;
      taskDelete: (id: string, projectPath: string | null) => Promise<boolean>;
      onTasksChanged: (callback: () => void) => () => void;

      skillsList: (projectPath: string | null) => Promise<SkillSummary[]>;
      skillsRead: (name: string, projectPath: string | null) => Promise<Skill | null>;
      skillsWrite: (
        scope: 'user' | 'project',
        payload: { name: string; description: string; allowedTools?: string[]; body: string },
        projectPath: string | null,
      ) => Promise<boolean>;
      skillsDelete: (
        scope: 'user' | 'project',
        name: string,
        projectPath: string | null,
      ) => Promise<boolean>;
      skillsToggle: (name: string, enabled: boolean) => Promise<void>;
      skillsOpenDir: (scope: SkillScope, projectPath: string | null) => Promise<boolean>;
      skillsWatchProject: (projectPath: string | null) => Promise<void>;
      onSkillsChanged: (callback: () => void) => () => void;

      mcpListStatus: () => Promise<McpServerStatus[]>;
      mcpAdd: (
        scope: McpScope,
        name: string,
        config: McpServerConfig,
        projectPath: string | null,
      ) => Promise<boolean>;
      mcpUpdate: (
        scope: McpScope,
        name: string,
        config: McpServerConfig,
        projectPath: string | null,
      ) => Promise<boolean>;
      mcpRemove: (
        scope: McpScope,
        name: string,
        projectPath: string | null,
      ) => Promise<boolean>;
      mcpToggle: (scope: McpScope, name: string, enabled: boolean) => Promise<boolean>;
      mcpRestart: (scope: McpScope, name: string) => Promise<boolean>;
      onMcpChanged: (callback: () => void) => () => void;

      cronList: () => Promise<CronJobSummary[]>;
      cronAdd: (
        scope: CronJobScope,
        input: CronJobInput,
        projectPath: string | null,
      ) => Promise<CronJobSummary | null>;
      cronUpdate: (
        scope: CronJobScope,
        id: string,
        input: CronJobInput,
        projectPath: string | null,
      ) => Promise<boolean>;
      cronRemove: (
        scope: CronJobScope,
        id: string,
        projectPath: string | null,
      ) => Promise<boolean>;
      cronToggle: (scope: CronJobScope, id: string, enabled: boolean) => Promise<boolean>;
      cronRunNow: (scope: CronJobScope, id: string) => Promise<boolean>;
      cronNextRun: (pattern: string) => Promise<CronValidateResult>;
      cronOpenDir: (scope: CronJobScope, projectPath: string | null) => Promise<boolean>;
      cronRuns: (scope: CronJobScope, jobId: string, projectPath: string | null) => Promise<CronRunRecord[]>;
      cronConversations: (jobId?: string | null) => Promise<any[]>;
      onCronChanged: (callback: () => void) => () => void;

      gitGetBranches: (folderPath: string) => Promise<{ currentBranch: string; branches: string[] } | null>;
      gitCheckoutBranch: (folderPath: string, branch: string) => Promise<{ success: boolean; error?: string }>;
      gitGetChangedFiles: (folderPath: string) => Promise<{ files: string[]; hasGit: boolean }>;
      gitGetFileDiff: (folderPath: string, file: string) => Promise<string>;
      gitGetCommitStatus: (folderPath: string) => Promise<GitCommitStatus>;
      gitCommit: (folderPath: string, message: string, includeUnstaged: boolean) => Promise<GitActionResult>;
      gitPush: (folderPath: string) => Promise<GitActionResult>;
      undoChanges: (entries: ChangeUndoEntry[]) => Promise<ChangeUndoResult>;
    };

    /**
     * 对话列表变更订阅
     */
    conversationsApi: {
      onChanged: (callback: () => void) => () => void;
    };

    /**
     * 终端（PTY）API
     */
    terminalApi: {
      create: (
        sessionId: string,
        opts?: { cwd?: string | null; cols?: number; rows?: number },
      ) => Promise<{
        sessionId: string;
        pid: number;
        cwd: string;
        shell: string;
        userLabel: string;
      }>;
      write: (sessionId: string, data: string) => Promise<boolean>;
      resize: (sessionId: string, cols: number, rows: number) => Promise<boolean>;
      kill: (sessionId: string) => Promise<boolean>;
      attach: (sessionId: string) => Promise<boolean>;
      onData: (sessionId: string, callback: (data: string) => void) => () => void;
      onExit: (
        sessionId: string,
        callback: (info: { exitCode: number; signal?: number }) => void,
      ) => () => void;
    };
  }
}

declare module '*.png' {
  const src: string;
  export default src;
}

declare module '*.svg' {
  const src: string;
  export default src;
}

declare module '*.jpg' {
  const src: string;
  export default src;
}

declare module '*.css';

export {};
