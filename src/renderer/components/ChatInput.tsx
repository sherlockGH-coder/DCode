import React, { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react';
import type { Attachment, SkillSummary } from '../../shared/types';
import { useVoiceInput } from '../hooks/useVoiceInput';
import AttachmentList from './chat-input/AttachmentList';
import InputToolbar from './chat-input/InputToolbar';
import ModelSelector from './chat-input/ModelSelector';
import ProjectBranchSelector from './chat-input/ProjectBranchSelector';
import SendButton from './chat-input/SendButton';
import SlashCommandMenu from './chat-input/SlashCommandMenu';
import VoiceInputPanel from './chat-input/VoiceInputPanel';
import { useChatInputAttachments } from './chat-input/useAttachments';
import { useSlashCommands } from './chat-input/useSlashCommands';
import {
  BUILTIN_SLASH_COMMAND_NAMES,
  CompactContextRing,
  buildSlashCommandPayload,
  formatCompactSlashCommandDescription,
  insertTextAtSelection,
} from './chat-input/utils';

export { BUILTIN_SLASH_COMMAND_NAMES, CompactContextRing, formatCompactSlashCommandDescription } from './chat-input/utils';

interface ChatInputProps {
  onSend: (message: string, attachments: Attachment[]) => void;
  onAbort: () => void;
  isLoading: boolean;
  models: string[];
  selectedModel: string;
  onModelChange: (model: string) => void;
  reasoningEffort?: string;
  onReasoningEffortChange: (effort: string | undefined) => void;
  activeProject?: string | null;
  topAccessory?: React.ReactNode;
  /** Status content attached to the top edge of the composer surface. */
  statusAccessory?: React.ReactNode;
  footer?: React.ReactNode;
  projectSelector?: React.ReactNode;
  isWelcome?: boolean;
  /** Inline mode reuses the composer chrome without the bottom dock spacing. */
  inline?: boolean;
  /** Initial textarea content, used by inline edit/retry composer instances. */
  initialValue?: string;
  /** Initial attachment chips, used by inline edit/retry composer instances. */
  initialAttachments?: Attachment[];
  placeholder?: string;
  autoFocus?: boolean;
  onCancel?: () => void;
  onAfterSend?: () => void;
  contextUsagePercent?: number | null;
  contextLimit?: number;
  speechMaxDurationSeconds?: number;
  skills?: SkillSummary[];
  mode?: 'execute' | 'plan';
  onModeChange?: (mode: 'execute' | 'plan') => void;
  showWelcomeProjectFooter?: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  onAbort,
  isLoading,
  models,
  selectedModel,
  onModelChange,
  reasoningEffort,
  onReasoningEffortChange,
  activeProject,
  topAccessory,
  statusAccessory,
  footer,
  projectSelector,
  isWelcome = false,
  inline = false,
  initialValue = '',
  initialAttachments,
  placeholder = '描述任务、问题或想要修改的内容…',
  autoFocus = false,
  onCancel,
  onAfterSend,
  contextUsagePercent,
  speechMaxDurationSeconds = 60,
  skills = [],
  mode = 'execute',
  onModeChange,
  showWelcomeProjectFooter = true,
}) => {
  const [inputValue, setInputValue] = useState(initialValue);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isComposing = useRef(false);
  const {
    attachments,
    isDraggingOver,
    imageAttachments,
    fileAttachments,
    clearAttachments,
    removeAttachment,
    handlePickFiles,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handlePaste,
  } = useChatInputAttachments({ initialAttachments, isLoading });

  const insertTranscribedText = useCallback((text: string) => {
    setInputValue((currentValue) => {
      const selectionStart = inputRef.current?.selectionStart ?? currentValue.length;
      const selectionEnd = inputRef.current?.selectionEnd ?? selectionStart;
      const next = insertTextAtSelection(currentValue, text, selectionStart, selectionEnd);
      window.setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.setSelectionRange(next.cursor, next.cursor);
      }, 0);
      return next.value;
    });
  }, []);

  const voiceInput = useVoiceInput({
    maxDurationMs: speechMaxDurationSeconds * 1000,
    onTranscribed: insertTranscribedText,
  });

  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const scrollHeight = textarea.scrollHeight;
    const maxHeight = 320;
    if (scrollHeight > maxHeight) {
      textarea.style.height = `${maxHeight}px`;
      textarea.style.overflowY = 'auto';
    } else {
      textarea.style.height = `${scrollHeight}px`;
      textarea.style.overflowY = 'hidden';
    }
  }, [inputValue]);

  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const plusMenuRef = useRef<HTMLDivElement>(null);

  const [gitInfo, setGitInfo] = useState<{ currentBranch: string; branches: string[] } | null>(null);
  const [isBranchMenuOpen, setIsBranchMenuOpen] = useState(false);
  const branchMenuRef = useRef<HTMLDivElement>(null);

  const hasMultipleBranches = gitInfo && gitInfo.branches.length > 1;

  const {
    slashMenuRef,
    scrollContainerRef,
    slashOpen,
    setSlashOpen,
    slashIndex,
    setSlashIndex,
    slashFilter,
    setSlashFilter,
    selectedSlashCommand,
    setSelectedSlashCommand,
    builtinFiltered,
    skillFiltered,
    filteredCommands,
    checkSlashTrigger,
    selectSlashCommand,
  } = useSlashCommands({
    contextUsagePercent,
    inputRef,
    inputValue,
    setInputValue,
    skills,
  });

  useEffect(() => {
    setInputValue(initialValue);
    setSelectedSlashCommand(null);
  }, [initialValue, setSelectedSlashCommand]);

  useEffect(() => {
    if (!autoFocus) return;
    const textarea = inputRef.current;
    if (!textarea) return;
    textarea.focus();
    const cursor = textarea.value.length;
    if (typeof textarea.setSelectionRange === 'function') {
      textarea.setSelectionRange(cursor, cursor);
    }
  }, [autoFocus]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) {
        setIsModelMenuOpen(false);
      }
      if (slashMenuRef.current && !slashMenuRef.current.contains(e.target as Node)) {
        setSlashOpen(false);
      }
      if (branchMenuRef.current && !branchMenuRef.current.contains(e.target as Node)) {
        setIsBranchMenuOpen(false);
      }
      if (plusMenuRef.current && !plusMenuRef.current.contains(e.target as Node)) {
        setIsPlusMenuOpen(false);
      }
    };
    if (isModelMenuOpen || slashOpen || isBranchMenuOpen || isPlusMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isModelMenuOpen, slashOpen, isBranchMenuOpen, isPlusMenuOpen]);

  useEffect(() => {
    if (!activeProject) {
      setGitInfo(null);
      return;
    }

    let isMounted = true;
    const fetchGitInfo = async () => {
      try {
        const info = await window.deepseekApi.gitGetBranches(activeProject);
        if (isMounted) {
          setGitInfo(info);
        }
      } catch (err) {
        console.warn('[ChatInput] 获取 Git 分支信息失败:', err);
        if (isMounted) {
          setGitInfo(null);
        }
      }
    };

    fetchGitInfo();

    const timer = setInterval(fetchGitInfo, 10000);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [activeProject]);

  const handleCheckoutBranch = async (branch: string) => {
    if (!activeProject || isLoading) return;
    try {
      const res = await window.deepseekApi.gitCheckoutBranch(activeProject, branch);
      if (res.success) {
        const info = await window.deepseekApi.gitGetBranches(activeProject);
        setGitInfo(info);
        setIsBranchMenuOpen(false);
      } else {
        alert(`切换分支失败: ${res.error}`);
      }
    } catch (err: any) {
      alert(`切换分支失败: ${err.message || err}`);
    }
  };

  const handleSend = () => {
    const text = buildSlashCommandPayload(selectedSlashCommand, inputValue);
    if ((!text && attachments.length === 0) || isLoading || voiceInput.isBusy || voiceInput.isRecording) return;

    onSend(text, attachments);
    setInputValue('');
    setSelectedSlashCommand(null);
    clearAttachments();
    inputRef.current?.focus();
    onAfterSend?.();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (slashOpen && filteredCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashIndex((i) => (i + 1) % filteredCommands.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashIndex((i) => (i - 1 + filteredCommands.length) % filteredCommands.length);
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey && !isComposing.current) {
        e.preventDefault();
        selectSlashCommand(filteredCommands[slashIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setSlashOpen(false);
        setSlashFilter('');
        return;
      }
    }
    if (
      e.key === 'Backspace'
      && selectedSlashCommand
      && inputValue.length === 0
      && (inputRef.current?.selectionStart ?? 0) === 0
    ) {
      e.preventDefault();
      setSelectedSlashCommand(null);
      return;
    }
    if (e.key === 'Escape' && onCancel) {
      e.preventDefault();
      onCancel();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey && !isComposing.current) {
      e.preventDefault();
      handleSend();
    }
  };

  const inputShellClass = isWelcome
    ? `welcome-input-shell relative flex flex-col overflow-visible ${isDraggingOver ? 'is-dragging' : ''}`
    : `composer-surface flex flex-col overflow-visible rounded-[16px] ${isDraggingOver ? 'is-dragging border-accent/50' : ''}`;

  const inputSurfaceClass = isWelcome
    ? `welcome-input-surface relative z-10 flex flex-col overflow-visible ${isDraggingOver ? 'is-dragging' : ''}`
    : 'contents';

  const inputFooterClass = isWelcome
    ? 'composer-toolbar welcome-input-footer flex items-center gap-2 bg-transparent'
    : 'composer-toolbar flex items-center gap-2 pb-2.5 pt-0.5 px-3 bg-transparent';

  const footerPanelClass = `flex items-center gap-3 px-4 sm:px-5 py-2.5 bg-bg-sidebar border-t border-hairline select-none ${
    isWelcome
      ? 'rounded-b-[16px]'
      : 'rounded-b-[14px]'
  }`;

  const projectBranchSelector = (
    <ProjectBranchSelector
      projectSelector={projectSelector}
      activeProject={activeProject}
      gitInfo={gitInfo}
      branchMenuRef={branchMenuRef}
      isBranchMenuOpen={isBranchMenuOpen}
      hasMultipleBranches={hasMultipleBranches}
      isLoading={isLoading}
      onBranchMenuOpenChange={setIsBranchMenuOpen}
      onCheckoutBranch={handleCheckoutBranch}
    />
  );

  return (
    <div className={inline ? 'w-full relative z-10 bg-transparent' : `shrink-0 w-full relative z-10 ${isWelcome ? 'pt-0 pb-2 px-0 bg-transparent' : 'pt-0 pb-5 bg-transparent'}`}>
      <div className={inline ? 'w-full' : isWelcome ? 'w-full' : 'mx-auto w-full max-w-[760px]'}>
      {topAccessory && (
        <div className="mb-2">
          {topAccessory}
        </div>
      )}
      {!isWelcome && statusAccessory && (
        <div className="mb-2 flex w-full justify-center">
          {statusAccessory}
        </div>
      )}
      <AttachmentList
        attachments={attachments}
        imageAttachments={imageAttachments}
        fileAttachments={fileAttachments}
        onRemove={removeAttachment}
      />
      {                                                                 }
      <div className="relative" ref={slashMenuRef}>
        <SlashCommandMenu
          open={slashOpen}
          filter={slashFilter}
          index={slashIndex}
          filteredCommands={filteredCommands}
          builtinFiltered={builtinFiltered}
          skillFiltered={skillFiltered}
          scrollContainerRef={scrollContainerRef}
          onHoverIndex={setSlashIndex}
          onSelect={selectSlashCommand}
        />
      </div>
      <div
        data-testid="chat-input-composer"
        className={inputShellClass}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className={inputSurfaceClass}>
          {                  }
          <div
            className={`${isWelcome ? 'welcome-input-compose-row' : 'px-4'} flex items-start gap-3 relative min-h-[52px]`}
          >
            {selectedSlashCommand && (
              <div
                className="mt-2.5 inline-flex max-w-[220px] select-none items-center gap-1.5 text-[14.5px] font-medium leading-[1.5] text-accent sm:max-w-[240px]"
                title={selectedSlashCommand.description}
              >
                <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center" aria-hidden>
                  {selectedSlashCommand.icon}
                </span>
                <span className="min-w-0 truncate leading-none">{selectedSlashCommand.name}</span>
              </div>
            )}
            <textarea
              ref={inputRef}
              className="block min-h-[44px] min-w-[180px] flex-1 border-none bg-transparent px-0 py-2.5 text-[14.5px] leading-[1.6] text-text-primary outline-none resize-none font-[inherit] placeholder:text-text-tertiary disabled:opacity-55"
              placeholder={
                selectedSlashCommand
                  ? ''
                  : isLoading
                  ? 'DeepSeek 正在回复…'
                  : placeholder
              }
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                checkSlashTrigger(e.target.value, e.target.selectionStart ?? e.target.value.length);
              }}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              onCompositionStart={() => { isComposing.current = true; }}
              onCompositionEnd={() => { isComposing.current = false; }}
              disabled={isLoading}
              rows={1}
            />
          </div>

          <VoiceInputPanel voiceInput={voiceInput} />

          <InputToolbar
            className={inputFooterClass}
            plusMenuRef={plusMenuRef}
            isPlusMenuOpen={isPlusMenuOpen}
            isLoading={isLoading}
            voiceInput={voiceInput}
            onPlusMenuOpenChange={setIsPlusMenuOpen}
            onPickFiles={handlePickFiles}
            modelSelector={
              <ModelSelector
                isWelcomeStyle={isWelcome}
                isOpen={isModelMenuOpen}
                menuRef={modelMenuRef}
                reasoningEffort={reasoningEffort}
                isLoading={isLoading}
                models={models}
                selectedModel={selectedModel}
                onOpenChange={setIsModelMenuOpen}
                onModelChange={onModelChange}
                onReasoningEffortChange={onReasoningEffortChange}
              />
            }
            sendButton={
              <SendButton
                isLoading={isLoading}
                canSend={inputValue.trim() !== '' || !!selectedSlashCommand || attachments.length > 0}
                disabled={voiceInput.isBusy || voiceInput.isRecording}
                onAbort={onAbort}
                onSend={handleSend}
              />
            }
            mode={mode}
            onModeChange={onModeChange}
          />

          {isWelcome && showWelcomeProjectFooter && (projectSelector || activeProject || gitInfo) && (
            <div className="composer-project-footer flex min-h-10 items-center border-t border-hairline bg-bg-block px-4 py-1.5">
              {projectBranchSelector}
            </div>
          )}
        </div>

        {footer && (
          <div className={footerPanelClass}>
            {footer}
          </div>
        )}
      </div>
      </div>
    </div>
  );
};

export default ChatInput;
