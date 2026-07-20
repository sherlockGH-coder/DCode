import React, { useMemo, useCallback } from 'react';
import { useAppContext } from './contexts/AppContext';
import { useConversations } from './hooks/useConversations';
import { useMessages } from './hooks/useMessages';
import { useChatActivityPhase } from './hooks/useChatActivityPhase';
import { useChatOrchestrator } from './hooks/useChatOrchestrator';
import { useToolRenderUnits } from './hooks/useToolRenderUnits';
import { useChatPresentation } from './hooks/useChatPresentation';
import { useNavHistory, type NavEntry, type NavView } from './hooks/useNavHistory';
import { useSkills, useSkillsWatcher } from './hooks/useSkills';
import { findLastUserMessage, filterActiveBranch } from './utils/branchFilter';
import { formatSlashCommandsForTitle } from './utils/slashCommands';
import { submitEditedMessageRetry } from './utils/editRetry';
import { calculateContextUsagePercent } from './utils/contextUsage';
import AppView from './app/AppView';
import { loadStoredReasoningEffort, persistReasoningEffort } from './app/reasoningEffortStorage';
import { useResponsivePanelCollapse } from './app/useResponsivePanelCollapse';
import { usePlanMode } from './hooks/usePlanMode';
import type { Attachment, ChangeUndoEntry, ProjectCreateInput } from '../shared/types';

const hasDraftProjectPath = (entry: NavEntry): boolean =>
  Object.prototype.hasOwnProperty.call(entry, 'draftProjectPath');

const UNDO_DISSOLVE_MS = 420;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

const App: React.FC = () => {
  const {
    sidebar,
    models,
    project,
    settings,
    rightPanel,
    bottomPanel,
    windowChrome,
    activeImage,
    setActiveImage,
  } = useAppContext();

  const [view, setView] = React.useState<NavView>('chat');
  const [reasoningEffort, setReasoningEffortState] = React.useState<string | undefined>(loadStoredReasoningEffort);
  const [draftProjectPath, setDraftProjectPath] = React.useState<string | null | undefined>(undefined);
  const [undoDismissing, setUndoDismissing] = React.useState<{ conversationId: string; turnId: string } | null>(null);
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);

  const conv = useConversations(project.activeProject);
  const chat = useMessages();
  const planMode = usePlanMode(conv.conversationId);
  const { isMacOS, isFullscreen } = windowChrome;

  React.useEffect(() => {
    if (!isMacOS || isFullscreen) return;
    void window.electronEnv?.setTrafficLightPosition(sidebar.collapsed);
  }, [isMacOS, isFullscreen, sidebar.collapsed]);

  const handleToggleRightPanel = useCallback(() => {
    rightPanel.setCollapsed(!rightPanel.collapsed);
  }, [rightPanel.collapsed, rightPanel.setCollapsed]);

  const handleToggleBottomPanel = useCallback(() => {
    bottomPanel.setCollapsed(!bottomPanel.collapsed);
  }, [bottomPanel.collapsed, bottomPanel.setCollapsed]);

  const currentConversationProjectPath = useMemo(() => {
    if (conv.conversationId) {
      const found = conv.conversations.find((c) => c.id === conv.conversationId);
      if (found) return found.project_path;
    }
    return null;
  }, [conv.conversationId, conv.conversations]);

  const chatProjectPath = conv.conversationId
    ? currentConversationProjectPath
    : (draftProjectPath !== undefined ? draftProjectPath : project.activeProject);
  const skills = useSkills(chatProjectPath ?? null);
  useSkillsWatcher(chatProjectPath ?? null);
  const speechMaxDurationSeconds = settings.settings?.speech?.maxDurationSeconds ?? 60;

  React.useEffect(() => {
    if (!draftProjectPath) return;
    const stillExists = project.projects.some((item) => item.path === draftProjectPath);
    if (!stillExists) setDraftProjectPath(undefined);
  }, [draftProjectPath, project.projects]);

  const handleReasoningEffortChange = React.useCallback((effort: string | undefined) => {
    setReasoningEffortState(effort);
    persistReasoningEffort(effort);
  }, []);

  const applyEntry = React.useCallback((entry: NavEntry) => {
    setView(entry.view);
    if (entry.view === 'chat') {
      if (entry.conversationId) {
        setDraftProjectPath(undefined);
        conv.handleSelectConversation(entry.conversationId);
      } else {
        setDraftProjectPath(hasDraftProjectPath(entry) ? entry.draftProjectPath ?? null : undefined);
        void conv.handleNewConversation();
      }
    }
  }, [conv]);

  const nav = useNavHistory({
    initial: { view: 'chat', conversationId: null },
    apply: applyEntry,
  });

  const { handleSend, handleRetry: orchestratorRetry, abortSend, isLoading } = useChatOrchestrator({
    chat,
    conv,
    selectedModel: models.selectedModel,
    activeProject: chatProjectPath,
    reasoningEffort,

    onConversationCreated: (id) => {
      setDraftProjectPath(undefined);
      nav.replaceCurrentConversationId(id);
    },
  });

  const lastUserMessage = useMemo(() => findLastUserMessage(conv.messages), [conv.messages]);

  const ensureConversation = React.useCallback(async (): Promise<string> => {
    if (conv.conversationId) return conv.conversationId;
    const id = await conv.handleNewConversation(chatProjectPath);
    if (!id) throw new Error('无法创建对话');
    return id;
  }, [chatProjectPath, conv.conversationId, conv.handleNewConversation]);

  const enterPlanMode = React.useCallback(async (conversationId: string) => {
    const current = await window.dcodeApi.getConversationModeState(conversationId);
    if (current.mode === 'plan') return current;
    return window.dcodeApi.setConversationMode({
      conversationId,
      targetMode: 'plan',
      expectedModeRevision: current.modeRevision,
    });
  }, []);

  const handleInputSend = React.useCallback(async (userInput: string, attachments: Attachment[] = []) => {
    const planMatch = userInput.match(/^\/plan(?:\s+([\s\S]*))?$/i);
    if (planMatch) {
      const conversationId = await ensureConversation();
      const state = await enterPlanMode(conversationId);
      planMode.setState(state);
      const body = planMatch[1]?.trim() ?? '';
      if (!body && attachments.length === 0) return;
      await handleSend(body, attachments, undefined, undefined, conversationId);
      planMode.setState(await window.dcodeApi.getConversationModeState(conversationId));
      return;
    }
    await handleSend(userInput, attachments);
  }, [ensureConversation, enterPlanMode, handleSend, planMode]);

  const handleModeChange = React.useCallback(async (target: 'execute' | 'plan') => {
    const conversationId = await ensureConversation();
    const current = await window.dcodeApi.getConversationModeState(conversationId);
    const next = await window.dcodeApi.setConversationMode({
      conversationId,
      targetMode: target,
      expectedModeRevision: current.modeRevision,
    });
    planMode.setState(next);
  }, [ensureConversation, planMode]);

  const handlePlanDecision = React.useCallback(async (input: {
    token: string;
    decision: 'approve' | 'reject';
    strategy?: 'same_context' | 'fresh_context';
    feedback?: string;
  }) => {
    const plan = planMode.state?.activePlan;
    if (!plan) throw new Error('计划已失效');
    const request = input.decision === 'approve'
      ? {
          conversationId: plan.conversationId,
          planId: plan.id,
          version: plan.version,
          contentHash: plan.contentHash,
          presentationToken: input.token,
          decision: 'approve' as const,
          strategy: input.strategy!,
        }
      : {
          conversationId: plan.conversationId,
          planId: plan.id,
          version: plan.version,
          contentHash: plan.contentHash,
          presentationToken: input.token,
          decision: 'reject' as const,
          feedback: input.feedback,
        };
    const result = await planMode.decide(request);
    if (result.execution) {
      const execution = result.execution;
      await handleSend(
        `执行已批准计划 v${execution.plan.version}`,
        [],
        execution.strategy === 'fresh_context' ? [] : undefined,
        {
          planId: execution.plan.id,
          strategy: execution.strategy,
          executionTurnId: execution.executionTurnId,
        },
      );
    } else if (result.replanFeedback) {
      await handleSend(result.replanFeedback, [], undefined, undefined, undefined, 'plan_rejection');
    }
    return result;
  }, [handleSend, planMode]);

  /** 编辑重试：截断消息历史后重新发送 */
  const handleEditSubmit = React.useCallback(async (editedContent: string, editedAttachments?: Attachment[]) => {
    try {
      await submitEditedMessageRetry({
        conversationId: conv.conversationId,
        messages: conv.messages,
        lastUserMessage,
        editedContent,
        editedAttachments,
        truncateMessages: window.dcodeApi.truncateMessages,
        setMessages: (nextMessages) => {
          if (!conv.conversationId) return;
          conv.setMessages(conv.conversationId, () => nextMessages);
        },
        sendMessage: handleSend,
        onTruncateError: (err) => {
          console.warn('[App] 编辑重试截断历史失败，将仅用内存上下文继续重发:', err);
        },
      });
    } catch (err) {
      console.error('[App] 编辑重试失败:', err);
    }
  }, [lastUserMessage, conv.conversationId, conv.messages, conv.setMessages, handleSend]);

  const activity = useChatActivityPhase({
    isLoading: isLoading,
    messages: conv.messages,
    lastTurnId: lastUserMessage?.id,
    retryInfo: chat.retryInfo,
  });
  const handleIndicatorRetry = React.useCallback(() => {
    if (!lastUserMessage?.id) return;

    window.dcodeApi.abortChat(conv.conversationId ?? undefined);
    orchestratorRetry(lastUserMessage.id);
  }, [lastUserMessage?.id, conv.conversationId, orchestratorRetry]);
  const handleIndicatorAbort = React.useCallback(() => {
    chat.abortSend(conv.conversationId);
  }, [chat, conv.conversationId]);

  const handleResponseNav = React.useCallback((turnId: string, direction: -1 | 1) => {
    const indexSet = new Set<number>();
    for (const m of conv.messages) {
      if (m.turnId === turnId && (m.role === 'assistant' || m.role === 'tool') && m.attemptNo !== undefined) {
        indexSet.add(m.attemptNo);
      }
    }
    const sorted = [...indexSet].sort((a, b) => a - b);
    if (sorted.length <= 1) return;

    const currentActive = conv.activeAttempts[turnId] ?? sorted[sorted.length - 1];
    const currentIdx = sorted.indexOf(currentActive);
    const nextIdx = Math.max(0, Math.min(sorted.length - 1, currentIdx + direction));
    const next = sorted[nextIdx];
    if (next === currentActive) return;
    conv.setActiveAttempts((prev) => ({ ...prev, [turnId]: next }));
  }, [conv.messages, conv.activeAttempts, conv.setActiveAttempts]);

  const handleCloseOverlay = React.useCallback(() => {
    nav.navigate({ view: 'chat', conversationId: conv.conversationId });
    setView('chat');
  }, [nav, conv.conversationId]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        setIsSearchOpen(true);
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useResponsivePanelCollapse({
    rightPanelCollapsed: rightPanel.collapsed,
    setRightPanelCollapsed: rightPanel.setCollapsed,
    sidebarCollapsed: sidebar.collapsed,
    setSidebarCollapsed: sidebar.setCollapsed,
  });

  const handleSelectFromSearch = React.useCallback((convId: string, _projectPath: string | null) => {
    setIsSearchOpen(false);
    nav.navigate({ view: 'chat', conversationId: convId });
    setView('chat');
    setDraftProjectPath(undefined);
    setTimeout(() => {
      conv.handleSelectConversation(convId);
    }, 50);
  }, [conv, nav]);

  const handleSelectConversation = React.useCallback((convId: string) => {
    nav.navigate({ view: 'chat', conversationId: convId });
    setView('chat');
    setDraftProjectPath(undefined);
    conv.handleSelectConversation(convId);
  }, [conv, nav]);

  const handleNewConversation = React.useCallback(async () => {
    const nextProjectPath = conv.conversationId
      ? currentConversationProjectPath
      : (draftProjectPath !== undefined ? draftProjectPath : project.activeProject);
    setView('chat');
    setDraftProjectPath(nextProjectPath);
    const convId = await conv.handleNewConversation(nextProjectPath);
    if (convId) {
      setDraftProjectPath(undefined);
      nav.navigate({ view: 'chat', conversationId: convId });
    } else {
      const nextEntry: NavEntry = { view: 'chat', conversationId: null };
      if (nextProjectPath !== undefined) nextEntry.draftProjectPath = nextProjectPath;
      nav.navigate(nextEntry);
    }
  }, [conv, currentConversationProjectPath, draftProjectPath, nav, project.activeProject]);

  const handleSelectDraftProject = React.useCallback((path: string | null) => {
    setDraftProjectPath(path);
    void project.selectProject(path);
  }, [project]);

  const handleAddExistingDraftProject = React.useCallback(async () => {
    const result = await project.addProject();
    if (result) {
      setDraftProjectPath(result.path);
      await project.selectProject(result.path);
    }
    return result;
  }, [project]);

  const handleCreateDraftProject = React.useCallback(async (input: ProjectCreateInput) => {
    const result = await project.createProject(input);
    if (result) {
      setDraftProjectPath(result.path);
      await project.selectProject(result.path);
    }
    return result;
  }, [project]);

  const handleNewGlobalConversation = React.useCallback(async () => {
    setView('chat');
    setDraftProjectPath(null);
    const convId = await conv.handleNewConversation(null);
    nav.navigate(convId
      ? { view: 'chat', conversationId: convId }
      : { view: 'chat', conversationId: null, draftProjectPath: null });
  }, [conv, nav]);

  const handleNewProjectConversation = React.useCallback(async (projectPath: string) => {
    setView('chat');
    setDraftProjectPath(projectPath);
    const convId = await conv.handleNewConversation(projectPath);
    nav.navigate(convId
      ? { view: 'chat', conversationId: convId }
      : { view: 'chat', conversationId: null, draftProjectPath: projectPath });
  }, [conv, nav]);

  const handleDeleteConversation = React.useCallback(async (convId: string) => {
    await conv.handleDeleteConversation(convId);
    nav.pruneByConversationId(convId);
  }, [conv, nav]);

  const handleRenameConversation = React.useCallback(async (convId: string, title: string) => {
    await window.dcodeApi.updateConversationTitle(convId, title);
    await conv.loadConversations();
  }, [conv.loadConversations]);

  const handleOpenSettings = React.useCallback(() => {
    nav.navigate({ view: 'settings', conversationId: conv.conversationId });
    setView('settings');
  }, [nav, conv.conversationId]);

  const chatTitle = useMemo(() => {

    if (conv.conversationId) {
      const current = conv.conversations.find((c) => c.id === conv.conversationId);
      if (current?.title) return formatSlashCommandsForTitle(current.title);
    }
    const firstUser = conv.messages.find((m) => m.role === 'user');
    if (!firstUser) return '';
    const t = firstUser.content.trim();
    return t ? formatSlashCommandsForTitle(t).slice(0, 20) : '';
  }, [conv.conversationId, conv.conversations, conv.messages]);

  const currentConvProjectName = useMemo(() => {
    if (!chatProjectPath) return null;
    const proj = project.projects.find((p) => p.path === chatProjectPath);
    return proj?.name ?? chatProjectPath.split('/').pop() ?? null;
  }, [chatProjectPath, project.projects]);

  const visibleMessages = useMemo(
    () => filterActiveBranch(conv.messages, conv.activeAttempts),
    [conv.messages, conv.activeAttempts],
  );

  const contextUsagePercent = useMemo(
    () => calculateContextUsagePercent(visibleMessages, settings.settings?.compact.contextLimit),
    [visibleMessages, settings.settings?.compact.contextLimit],
  );

  const handleUndoCascade = useCallback(async (turnId: string, entries: ChangeUndoEntry[]): Promise<boolean> => {
    const conversationId = conv.conversationId;
    if (!conversationId || entries.length === 0) return false;
    try {
      const result = await window.dcodeApi.undoChanges(entries);
      if (!result.success) {
        window.alert(result.error ?? '撤销失败。文件可能已经被后续修改。');
        return false;
      }
      setUndoDismissing({ conversationId, turnId });
      await delay(UNDO_DISSOLVE_MS);
      await conv.deleteMessagesFromTurn(conversationId, turnId);
      setUndoDismissing((current) => (
        current?.conversationId === conversationId && current.turnId === turnId ? null : current
      ));
      return true;
    } catch (err) {
      setUndoDismissing((current) => (
        current?.conversationId === conversationId && current.turnId === turnId ? null : current
      ));
      const message = err instanceof Error ? err.message : String(err);
      window.alert(`撤销失败: ${message}`);
      return false;
    }
  }, [conv.conversationId, conv.deleteMessagesFromTurn]);

  const { units: renderUnits, segmentMessageMap, tailUnitsByMessageId } = useToolRenderUnits(visibleMessages, isLoading);

  const { chatItems, pendingApprovalItems, recentEdits } = useChatPresentation({
    conversationId: conv.conversationId,
    conversations: conv.conversations,
    messages: conv.messages,
    activeAttempts: conv.activeAttempts,
    visibleMessages,
    renderUnits,
    segmentMessageMap,
    tailUnitsByMessageId,
    lastUserMessage,
    isLoading,
    turnTimers: chat.turnTimers,
    activity,
    reasoningEffort,
    onReasoningEffortChange: handleReasoningEffortChange,
    onEditSubmit: handleEditSubmit,
    onResponseNav: handleResponseNav,
    onUndoCascade: handleUndoCascade,
    dismissingFromTurnId: undoDismissing?.conversationId === conv.conversationId ? undoDismissing.turnId : null,
    onIndicatorRetry: handleIndicatorRetry,
    onIndicatorAbort: handleIndicatorAbort,
  });
  const pendingApprovalItem = pendingApprovalItems[0] ?? null;
  const isQuestionItem = pendingApprovalItem?.kind === 'ask_user_question';
  const showChatHeaderTitle = view === 'chat' && chatItems.length > 0;
  const chatContentVersion = useMemo(() => {
    const lastVisibleMessage = visibleMessages[visibleMessages.length - 1];
    const lastPendingApproval = pendingApprovalItems[pendingApprovalItems.length - 1];
    return [
      chatItems.length,
      lastVisibleMessage?.id ?? '',
      lastVisibleMessage?.content?.length ?? 0,
      lastVisibleMessage?.reasoning_content?.length ?? 0,
      lastPendingApproval?.toolCallId ?? '',
      activity.phase,
      activity.visible ? '1' : '0',
    ].join(':');
  }, [visibleMessages, pendingApprovalItems, activity.phase, activity.visible, chatItems.length]);

  /** AskUserQuestion 提交处理：委托给 handleApprovalConfirm，传入 answers */
  const handleQuestionSubmit = useCallback((toolCallId: string, answers: Record<string, string>) => {
    chat.handleApprovalConfirm(toolCallId, true, undefined, undefined, undefined, answers);
  }, [chat.handleApprovalConfirm]);

  return (
    <AppView
      sidebar={sidebar}
      models={models}
      project={project}
      rightPanel={rightPanel}
      bottomPanel={bottomPanel}
      activeImage={activeImage}
      setActiveImage={setActiveImage}
      conv={conv}
      view={view}
      isMacOS={isMacOS}
      isFullscreen={isFullscreen}
      isSearchOpen={isSearchOpen}
      showChatHeaderTitle={showChatHeaderTitle}
      chatTitle={chatTitle}
      currentConvProjectName={currentConvProjectName}
      chatItems={chatItems}
      chatContentVersion={chatContentVersion}
      pendingApprovalItem={pendingApprovalItem}
      pendingApprovalItems={pendingApprovalItems}
      isQuestionItem={isQuestionItem}
      recentEdits={recentEdits}
      visibleMessages={visibleMessages}
      chatProjectPath={chatProjectPath}
      contextUsagePercent={contextUsagePercent}
      contextLimit={settings.settings?.compact.contextLimit}
      speechMaxDurationSeconds={speechMaxDurationSeconds}
      skills={skills}
      reasoningEffort={reasoningEffort}
      isLoading={isLoading}
      planModeState={planMode.state}
      planModeTransitioning={planMode.isTransitioning}
      handlers={{
        handleSelectConversation,
        handleNewConversation,
        handleNewGlobalConversation,
        handleNewProjectConversation,
        handleDeleteConversation,
        handleRenameConversation,
        handleOpenSettings,
        handleToggleRightPanel,
        handleToggleBottomPanel,
        handleInputSend,
        handleModeChange,
        handlePlanDecision,
        abortSend,
        handleReasoningEffortChange,
        handleQuestionSubmit,
        handleCloseOverlay,
        handleOpenSearch: () => setIsSearchOpen(true),
        handleCloseSearch: () => setIsSearchOpen(false),
        handleSelectFromSearch,
        handleSelectDraftProject,
        handleAddExistingDraftProject,
        handleCreateDraftProject,
        handleApprovalConfirm: chat.handleApprovalConfirm,
      }}
    />
  );
};

export default App;
