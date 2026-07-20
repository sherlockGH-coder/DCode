import React from 'react';
import ChatPanel from '../components/ChatPanel';
import ChatInput from '../components/ChatInput';
import ArtifactPanel from '../components/ArtifactPanel';
import TaskProgressAccessory from '../components/TaskProgressAccessory';
import Sidebar from '../components/Sidebar';
import AppHeader from '../components/AppHeader';
import TerminalPanel from '../components/TerminalPanel';
import SearchModal from '../components/SearchModal';
import ApprovalPanel from '../components/ApprovalPanel';
import QuestionDialog from '../components/QuestionDialog';
import PlanApprovalPanel from '../components/PlanApprovalPanel';
import SettingsPage from '../components/settings/SettingsPage';
import OverlayView from '../components/OverlayView';
import FolderSelector from '../components/FolderSelector';
import WorkspaceDock from './WorkspaceDock';
import ImageLightboxHost from './ImageLightboxHost';
import WelcomePanel from '../components/WelcomePanel';
import WelcomeBranchSelector from '../components/WelcomeBranchSelector';
import type { useAppContext } from '../contexts/AppContext';
import type { useConversations } from '../hooks/useConversations';
import type { useMessages } from '../hooks/useMessages';
import type { useChatPresentation } from '../hooks/useChatPresentation';
import type { useSkills } from '../hooks/useSkills';
import type { Attachment, Project, ProjectCreateInput, ToolItem, Message, ConversationModeState, PlanDecisionResult } from '../../shared/types';
import type { NavView } from '../hooks/useNavHistory';

type AppContextValue = ReturnType<typeof useAppContext>;
type ConversationsState = ReturnType<typeof useConversations>;
type MessagesState = ReturnType<typeof useMessages>;
type SkillsState = ReturnType<typeof useSkills>;
type ChatPresentationState = ReturnType<typeof useChatPresentation>;

interface AppViewHandlers {
  handleSelectConversation: (convId: string) => void;
  handleNewConversation: () => Promise<void>;
  handleNewGlobalConversation: () => Promise<void>;
  handleNewProjectConversation: (projectPath: string) => Promise<void>;
  handleDeleteConversation: (convId: string) => Promise<void>;
  handleRenameConversation: (convId: string, title: string) => Promise<void>;
  handleOpenSettings: () => void;
  handleToggleRightPanel: () => void;
  handleToggleBottomPanel: () => void;
  handleInputSend: (userInput: string, attachments?: Attachment[]) => Promise<void>;
  handleModeChange: (mode: 'execute' | 'plan') => Promise<void>;
  handlePlanDecision: (input: { token: string; decision: 'approve' | 'reject'; strategy?: 'same_context' | 'fresh_context'; feedback?: string }) => Promise<PlanDecisionResult>;
  abortSend: () => void;
  handleReasoningEffortChange: (effort: string | undefined) => void;
  handleQuestionSubmit: (toolCallId: string, answers: Record<string, string>) => void;
  handleCloseOverlay: () => void;
  handleOpenSearch: () => void;
  handleCloseSearch: () => void;
  handleSelectFromSearch: (convId: string, projectPath: string | null) => void;
  handleSelectDraftProject: (path: string | null) => void;
  handleAddExistingDraftProject: () => Promise<Project | null>;
  handleCreateDraftProject: (input: ProjectCreateInput) => Promise<Project | null>;
  handleApprovalConfirm: MessagesState['handleApprovalConfirm'];
}

interface AppViewProps {
  sidebar: AppContextValue['sidebar'];
  models: AppContextValue['models'];
  project: AppContextValue['project'];
  rightPanel: AppContextValue['rightPanel'];
  bottomPanel: AppContextValue['bottomPanel'];
  activeImage: AppContextValue['activeImage'];
  setActiveImage: AppContextValue['setActiveImage'];
  conv: ConversationsState;
  view: NavView;
  isMacOS: boolean;
  isFullscreen: boolean;
  isSearchOpen: boolean;
  showChatHeaderTitle: boolean;
  chatTitle: string;
  currentConvProjectName: string | null;
  chatItems: ChatPresentationState['chatItems'];
  chatContentVersion: string;
  pendingApprovalItem: ToolItem | null;
  pendingApprovalItems: ToolItem[];
  isQuestionItem: boolean;
  recentEdits: ChatPresentationState['recentEdits'];
  visibleMessages: Message[];
  chatProjectPath: string | null;
  contextUsagePercent: number | null;
  contextLimit?: number;
  speechMaxDurationSeconds: number;
  skills: SkillsState;
  reasoningEffort?: string;
  isLoading: boolean;
  planModeState: ConversationModeState | null;
  planModeTransitioning: boolean;
  handlers: AppViewHandlers;
}

type WelcomeViewProps = Pick<
  AppViewProps,
  | 'models'
  | 'project'
  | 'chatProjectPath'
  | 'contextUsagePercent'
  | 'contextLimit'
  | 'speechMaxDurationSeconds'
  | 'skills'
  | 'reasoningEffort'
  | 'isLoading'
  | 'planModeState'
  | 'handlers'
>;

const WelcomeView: React.FC<WelcomeViewProps> = ({
  models,
  project,
  chatProjectPath,
  contextUsagePercent,
  contextLimit,
  speechMaxDurationSeconds,
  skills,
  reasoningEffort,
  isLoading,
  planModeState,
  handlers,
}) => {
  const [quickAction, setQuickAction] = React.useState<{ command: string; revision: number } | null>(null);

  const handleQuickAction = React.useCallback((command: string) => {
    setQuickAction((current) => ({ command: `${command} `, revision: (current?.revision ?? 0) + 1 }));
  }, []);

  const clearQuickAction = React.useCallback(() => {
    setQuickAction(null);
  }, []);

  return (
    <div className="welcome-stage flex-1 overflow-y-auto">
      <div className="welcome-layout">
        <WelcomePanel onQuickAction={handleQuickAction} />
        <div className="welcome-composer">
          <div className="welcome-project-row">
            <FolderSelector
              variant="inline"
              placement="top"
              projects={project.projects}
              activeProject={chatProjectPath}
              onSelectProject={handlers.handleSelectDraftProject}
              onAddExistingProject={handlers.handleAddExistingDraftProject}
              onCreateProject={handlers.handleCreateDraftProject}
              onPickProjectParent={project.pickProjectParentDirectory}
            />
            <WelcomeBranchSelector activeProject={chatProjectPath} />
          </div>
          <ChatInput
            key={quickAction?.revision ?? 0}
            onSend={handlers.handleInputSend}
            onAbort={handlers.abortSend}
            isLoading={isLoading}
            models={models.models}
            selectedModel={models.selectedModel}
            onModelChange={models.handleModelChange}
            reasoningEffort={reasoningEffort}
            onReasoningEffortChange={handlers.handleReasoningEffortChange}
            activeProject={chatProjectPath}
            contextUsagePercent={contextUsagePercent}
            contextLimit={contextLimit}
            speechMaxDurationSeconds={speechMaxDurationSeconds}
            skills={skills.skills}
            mode={planModeState?.mode === 'plan' ? 'plan' : 'execute'}
            onModeChange={handlers.handleModeChange}
            isWelcome={true}
            initialValue={quickAction?.command ?? ''}
            autoFocus={quickAction !== null}
            onAfterSend={clearQuickAction}
            showWelcomeProjectFooter={false}
          />
        </div>
      </div>
    </div>
  );
};

const AppView: React.FC<AppViewProps> = ({
  sidebar,
  models,
  project,
  rightPanel,
  bottomPanel,
  activeImage,
  setActiveImage,
  conv,
  view,
  isMacOS,
  isFullscreen,
  isSearchOpen,
  showChatHeaderTitle,
  chatTitle,
  currentConvProjectName,
  chatItems,
  chatContentVersion,
  pendingApprovalItem,
  pendingApprovalItems,
  isQuestionItem,
  recentEdits,
  visibleMessages,
  chatProjectPath,
  contextUsagePercent,
  contextLimit,
  speechMaxDurationSeconds,
  skills,
  reasoningEffort,
  isLoading,
  planModeState,
  planModeTransitioning,
  handlers,
}) => (
  <div className="app-stage flex flex-row h-screen w-full bg-transparent relative overflow-hidden">
    <div
      className="contents"
      inert={view === 'settings' ? true : undefined}
      aria-hidden={view === 'settings' ? true : undefined}
    >
    <div
      ref={sidebar.sidebarRef}
      className={`sidebar-shell shrink-0 flex flex-col min-h-0 h-full min-w-0 overflow-hidden transition-[width] duration-[0.24s] ease-[cubic-bezier(0.32,0.72,0,1)] will-change-[width]${sidebar.collapsed ? ' pointer-events-none' : ''}`}
      style={{ width: sidebar.collapsed ? 0 : sidebar.width }}
      aria-hidden={sidebar.collapsed}
    >
      <Sidebar
        isMacOS={isMacOS}
        isFullscreen={isFullscreen}
        conversations={conv.conversations}
        activeConversationId={conv.conversationId}
        onSelectConversation={handlers.handleSelectConversation}
        onNewConversation={handlers.handleNewConversation}
        onNewGlobalConversation={handlers.handleNewGlobalConversation}
        onNewProjectConversation={handlers.handleNewProjectConversation}
        onDeleteConversation={handlers.handleDeleteConversation}
        onRenameConversation={handlers.handleRenameConversation}
        onCollapseSidebar={() => sidebar.setCollapsed(true)}
        projects={project.projects}
        onAddProject={() => project.addProject()}
        onRemoveProject={project.removeProject}
        onOpenSearch={handlers.handleOpenSearch}
        activeView={view}
        onOpenSettings={handlers.handleOpenSettings}
      />
      <button
        type="button"
        className={`sidebar-resize-handle group absolute right-1 top-2 bottom-2 z-50 w-2 m-0 p-0 border-none cursor-col-resize bg-transparent transition-opacity duration-[0.22s] ${sidebar.collapsed ? 'opacity-0 pointer-events-none' : ''}`}
        aria-label="调整侧栏宽度"
        onMouseDown={sidebar.handleResizeStart}
        disabled={sidebar.collapsed}
        tabIndex={sidebar.collapsed ? -1 : 0}
      >
        <span className="absolute inset-y-0 -left-1 -right-1 cursor-col-resize" />
        <span className="sidebar-resize-indicator absolute top-3 bottom-3 left-1/2 w-px -translate-x-1/2 bg-transparent transition-[width,background-color] duration-150 group-hover:w-[3px] group-hover:bg-black/[0.06] dark:group-hover:bg-white/[0.07] group-active:w-[3px] group-active:bg-black/[0.1] dark:group-active:bg-white/[0.11]" />
      </button>
    </div>
    {!sidebar.collapsed ? (
      <button
        type="button"
        className="mobile-sidebar-scrim"
        aria-label="收起侧栏"
        onClick={() => sidebar.setCollapsed(true)}
      />
    ) : null}
    <div className={`app-main-shell flex flex-row flex-1 min-w-0 h-full relative overflow-hidden ${sidebar.collapsed ? 'app-main-shell--flush' : ''}`}>
      <div className="app-primary-surface flex flex-col flex-1 min-w-0 h-full relative overflow-hidden">
        <div className="shrink-0 z-30">
          <AppHeader
            isMacOS={isMacOS}
            isFullscreen={isFullscreen}
            sidebarCollapsed={sidebar.collapsed}
            chatTitle={showChatHeaderTitle ? chatTitle : ''}
            projectName={showChatHeaderTitle ? currentConvProjectName : null}
            onShowSidebar={() => sidebar.setCollapsed(false)}
            onNewConversation={handlers.handleNewConversation}
            rightContent={
              view !== 'settings' && rightPanel.collapsed ? (
                <WorkspaceDock
                  artifactPanelActive={!rightPanel.collapsed}
                  terminalActive={!bottomPanel.collapsed}
                  onToggleRightPanel={handlers.handleToggleRightPanel}
                  onToggleBottomPanel={handlers.handleToggleBottomPanel}
                />
              ) : null
            }
          />
        </div>
        <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
          <div className="flex flex-col flex-1 min-w-0 h-full bg-transparent relative overflow-hidden">
            <main className="flex-1 flex flex-col min-h-0 relative z-10">
              {chatItems.length === 0 ? (
                <WelcomeView
                  chatProjectPath={chatProjectPath}
                  contextUsagePercent={contextUsagePercent}
                  contextLimit={contextLimit}
                  isLoading={isLoading}
                  models={models}
                  project={project}
                  reasoningEffort={reasoningEffort}
                  skills={skills}
                  speechMaxDurationSeconds={speechMaxDurationSeconds}
                  planModeState={planModeState}
                  handlers={handlers}
                />
              ) : (
                <div className="relative flex flex-1 min-h-0 min-w-0 overflow-hidden">
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                    <ChatPanel
                      items={chatItems}
                      contentVersion={chatContentVersion}
                      bottomPadding={20}
                    />
                    <div className="chat-input-dock shrink-0 relative z-20 px-4 md:px-8">
                      <div className="animate-[content-fade-in_180ms_cubic-bezier(0.32,0.72,0,1)_both]">
                        <ChatInput
                          onSend={handlers.handleInputSend}
                          onAbort={handlers.abortSend}
                          isLoading={isLoading}
                          models={models.models}
                          selectedModel={models.selectedModel}
                          onModelChange={models.handleModelChange}
                          reasoningEffort={reasoningEffort}
                          onReasoningEffortChange={handlers.handleReasoningEffortChange}
                          activeProject={chatProjectPath}
                          contextUsagePercent={contextUsagePercent}
                          contextLimit={contextLimit}
                          speechMaxDurationSeconds={speechMaxDurationSeconds}
                          skills={skills.skills}
                          mode={planModeState?.mode === 'plan' ? 'plan' : 'execute'}
                          onModeChange={handlers.handleModeChange}
                          statusAccessory={!pendingApprovalItem ? (
                            <TaskProgressAccessory
                              activeConversationId={conv.conversationId}
                              activeProject={chatProjectPath}
                              messages={visibleMessages}
                              isAgentRunning={isLoading}
                            />
                          ) : undefined}
                          topAccessory={planModeState?.activePlan ? (
                            <PlanApprovalPanel
                              key={planModeState.activePlan.id}
                              plan={planModeState.activePlan}
                              modeRevision={planModeState.modeRevision}
                              onDecision={handlers.handlePlanDecision}
                            />
                          ) : pendingApprovalItem ? (
                            isQuestionItem ? (
                              <QuestionDialog
                                key={`question-${pendingApprovalItem.toolCallId}`}
                                item={pendingApprovalItem as ToolItem & { kind: 'ask_user_question' }}
                                onSubmit={handlers.handleQuestionSubmit}
                              />
                            ) : (
                              <ApprovalPanel
                                key={`approval-${pendingApprovalItem.toolCallId}`}
                                item={pendingApprovalItem}
                                total={pendingApprovalItems.length}
                                index={0}
                                onConfirm={handlers.handleApprovalConfirm}
                              />
                            )
                          ) : planModeTransitioning ? (
                            <div className="rounded-[10px] border border-hairline bg-bg-main px-4 py-3 text-[12px] text-text-secondary">正在切换模式…</div>
                          ) : undefined}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </main>

            <button
              type="button"
              className="shrink-0 h-1.5 m-0 p-0 border-none cursor-row-resize bg-transparent self-stretch transition-opacity duration-200 hover:bg-accent/10 active:bg-accent/20"
              aria-label="调整底板高度"
              onMouseDown={bottomPanel.handleResizeStart}
              disabled={bottomPanel.collapsed}
              tabIndex={bottomPanel.collapsed ? -1 : 0}
              style={bottomPanel.collapsed ? { height: 0, minHeight: 0, opacity: 0, pointerEvents: 'none' } : undefined}
            />
            <div
              ref={bottomPanel.panelRef}
              className="bottom-panel-surface shrink-0 flex flex-col min-h-0 w-full overflow-hidden transition-[height] duration-[0.22s] ease-[cubic-bezier(0.32,0.72,0,1)]"
              style={{ height: bottomPanel.collapsed ? 0 : bottomPanel.size }}
              aria-hidden={bottomPanel.collapsed}
            >
              <TerminalPanel
                cwd={chatProjectPath}
                resizeTick={bottomPanel.size}
                visible={!bottomPanel.collapsed}
                onAllClosed={() => bottomPanel.setCollapsed(true)}
              />
            </div>
          </div>
        </div>
      </div>

      <div
        ref={rightPanel.panelRef}
        className="right-panel-frame workspace-panel-shell shrink-0 flex flex-col min-h-0 h-full min-w-0 overflow-hidden relative z-20 transition-[width] duration-[0.24s] ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{ width: rightPanel.collapsed ? 0 : rightPanel.size }}
        aria-hidden={rightPanel.collapsed}
      >
        <button
          type="button"
          className={`right-panel-resize-handle group absolute left-1 top-2 bottom-2 z-50 w-2 m-0 p-0 border-none cursor-col-resize bg-transparent transition-opacity duration-[0.22s] ${rightPanel.collapsed ? 'opacity-0 pointer-events-none' : ''}`}
          aria-label="调整右面板宽度"
          onMouseDown={rightPanel.handleResizeStart}
          disabled={rightPanel.collapsed}
          tabIndex={rightPanel.collapsed ? -1 : 0}
        >
          <span className="absolute inset-y-0 -left-1 -right-1 cursor-col-resize" />
          <span className="right-panel-resize-indicator absolute top-3 bottom-3 left-1/2 w-px -translate-x-1/2 bg-transparent transition-[width,background-color] duration-150 group-hover:w-[3px] group-hover:bg-black/[0.06] dark:group-hover:bg-white/[0.07] group-active:w-[3px] group-active:bg-black/[0.1] dark:group-active:bg-white/[0.11]" />
        </button>
        <div className="right-panel-card-frame flex flex-1 min-h-0 min-w-0 p-2">
          <div className="workspace-surface right-panel-card flex flex-1 flex-col min-h-0 min-w-0 overflow-hidden">
            <ArtifactPanel
              recentEdits={recentEdits}
              activeProject={chatProjectPath}
            />
          </div>
        </div>
      </div>
    </div>
    </div>

    <OverlayView
      isOpen={view === 'settings'}
      onClose={handlers.handleCloseOverlay}
      title="设置"
      isMacOS={isMacOS}
      isFullscreen={isFullscreen}
      hideHeader={true}
    >
      <SettingsPage
        activeProject={chatProjectPath}
        onClose={handlers.handleCloseOverlay}
        isMacOS={isMacOS}
        isFullscreen={isFullscreen}
        onJumpConversation={handlers.handleSelectConversation}
      />
    </OverlayView>
    <SearchModal
      isOpen={isSearchOpen}
      onClose={handlers.handleCloseSearch}
      onSelect={handlers.handleSelectFromSearch}
      projects={project.projects}
    />
    <ImageLightboxHost
      activeImage={activeImage}
      setActiveImage={setActiveImage}
      isMacOS={isMacOS}
    />
  </div>
);

export default AppView;
