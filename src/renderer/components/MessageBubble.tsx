import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { closeMarkdown } from '../utils/streamingMarkdown';
import { safeUrlTransform } from '../utils/urlTransform';
import { linkifyFilePaths } from '../utils/linkifyFilePaths';
import { buildPreviewFromPath } from '../utils/filePreview';
import { parseDbTimestamp } from '../utils/messageTime';
import MarkdownShadowDOMRenderer from './MarkdownShadowDOMRenderer';
import HtmlShadowRenderer from './HtmlShadowRenderer';
import RenderUnitView from './RenderUnitView';
import MarkdownBlock from './MarkdownBlock';
import { createMarkdownComponents } from './MarkdownRenderers';
import { splitBlocks } from '../utils/streamingBlocks';
import ChatInput from './ChatInput';
import { IconCheck, IconLayers, IconUndo } from './icons';
import { useModelsContext, usePreviewActions } from '../contexts/AppContext';
import { parseLeadingSlashCommand } from '../utils/slashCommands';
import { parseLocalFileReference } from '../utils/localFileReference';
import type { Message, Attachment, ToolItem } from '../../shared/types';
import type { RenderUnit } from '../utils/tool-pipeline';
import AssistantFooter from './message-bubble/AssistantFooter';
import ReasoningPanel from './message-bubble/ReasoningPanel';
import UserAttachments from './message-bubble/UserAttachments';
import {
  ALLOWED_ELEMENTS,
  DISALLOWED_ELEMENTS,
  USER_SLASH_COMMAND_CLASS,
  cleanErrorText,
  stripMarkdown,
} from './message-bubble/utils';
import { areMessageBubblePropsEqual } from './message-bubble/areMessageBubblePropsEqual';

export interface MessageBubbleProps {
  message: Message;
  renderUnit?: RenderUnit;
  /** 当前回复版本（1-based，用于显示） */
  responseCurrent?: number;
  /** 总回复版本数 */
  responseTotal?: number;
  /** 切换到上一个回复版本 */
  onResponsePrev?: () => void;
  /** 切换到下一个回复版本 */
  onResponseNext?: () => void;
  /** 是否渲染底部操作行（复制 + 用时）— 多轮工具回合下仅最后一条 assistant 才显示 */
  showFooter?: boolean;
  /** 是否默认显示底部操作行；历史消息仍使用 hover 显示。 */
  showFooterByDefault?: boolean;
  isGenerating?: boolean;
  /** 隐藏思维链折叠区（用于把 reasoning 抽出到 ProcessedSummary 里渲染） */
  hideReasoning?: boolean;
  /** 跟随当前 assistant 的尾随产物；操作栏应在它们之后。 */
  trailingUnits?: RenderUnit[];
  /** 当前最终回复关联的一轮工具改动，用于底部汇总与撤销。 */
  changeItems?: ToolItem[];
  /** 覆盖默认撤销行为，用于级联撤销消息时间线。返回 false 表示撤销失败。 */
  onUndoChanges?: () => Promise<boolean>;
  undoConfirmationMessage?: string;
  /** 编辑重试：提交编辑后的内容 */
  onEditSubmit?: (editedContent: string, attachments?: Attachment[]) => void;
  /** 编辑重试：是否显示编辑入口（仅最后一条用户消息为 true） */
  isEditAvailable?: boolean;
  /** 编辑重试：对话是否正在加载（编辑中时隐藏入口） */
  isConvLoading?: boolean;
  /** 编辑态复用主输入框 composer 的模型状态 */
  reasoningEffort?: string;
  onReasoningEffortChange?: (effort: string | undefined) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, renderUnit, responseCurrent, responseTotal, onResponsePrev, onResponseNext, showFooter = true, showFooterByDefault = false, isGenerating = false, hideReasoning = false, trailingUnits = [], changeItems = [], onUndoChanges, undoConfirmationMessage, onEditSubmit, isEditAvailable, isConvLoading, reasoningEffort, onReasoningEffortChange }) => {
  const isUser = message.role === 'user';
  const isErrorMsg = !isUser && !!message.content && (message.error || message.content.startsWith('❌') || message.content.startsWith('Error:'));
  const canEditUserMessage = isUser && !!isEditAvailable && !isConvLoading && !!onEditSubmit;
  const models = useModelsContext();
  const { setPreview } = usePreviewActions();

  const handleLocalFileClick = useCallback(async (href: string, e: React.MouseEvent) => {
    e.preventDefault();
    const { path: cleanPath, line } = parseLocalFileReference(href);
    const preview = await buildPreviewFromPath(cleanPath, line);
    if (preview) {
      setPreview(preview);
    }
  }, [setPreview]);

  const markdownComponents = useMemo(
    () => createMarkdownComponents(handleLocalFileClick),
    [handleLocalFileClick],
  );

  const [thinkingStart, setThinkingStart] = useState<number | null>(null);
  const [thinkingEnd, setThinkingEnd] = useState<number | null>(null);

  const [reasoningExpanded, setReasoningExpanded] = useState(
    () => isGenerating && !!message.reasoning_content,
  );
  const prevThinkingEnd = useRef(thinkingEnd);
  useEffect(() => {
    if (prevThinkingEnd.current === null && thinkingEnd !== null) {
      setReasoningExpanded(false);
    }
    prevThinkingEnd.current = thinkingEnd;
  }, [thinkingEnd]);

  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const editContainerRef = useRef<HTMLDivElement>(null);

  const copyContent = useMemo(
    () => message.content,
    [isUser, message.content],
  );

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!isUser && message.reasoning_content && !thinkingStart) {
      setThinkingStart(Date.now());
    }
    if (!isUser && message.reasoning_content && !thinkingEnd) {
      if (message.content || !isGenerating) {
        setThinkingEnd(Date.now());
      }
    }
  }, [isUser, message.reasoning_content, message.content, isGenerating, thinkingStart, thinkingEnd]);

  useEffect(() => {
    if (!isGenerating || !thinkingStart || thinkingEnd) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isGenerating, thinkingStart, thinkingEnd]);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  const performCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {

      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyText = async () => {
    if (!copyContent) return;
    const plainText = stripMarkdown(copyContent);
    await performCopy(plainText);
  };

  const handleCopyMarkdown = async () => {
    if (!copyContent) return;
    await performCopy(copyContent);
  };

  const handleStartEdit = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleInlineEditSend = useCallback((editedContent: string, attachments: Attachment[]) => {
    if (!editedContent.trim() && attachments.length === 0) return;
    onEditSubmit?.(editedContent, attachments);
    setIsEditing(false);
  }, [onEditSubmit]);

  useEffect(() => {
    if (!isEditing) return;

    const handleOutsideMouseDown = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Node && editContainerRef.current?.contains(target)) return;
      setIsEditing(false);
    };

    document.addEventListener('mousedown', handleOutsideMouseDown, true);
    return () => document.removeEventListener('mousedown', handleOutsideMouseDown, true);
  }, [isEditing]);

  const undoEntries = useMemo(() => {
    const changes = changeItems.filter(
      (item): item is Extract<ToolItem, { kind: 'write' | 'edit' }> =>
        (item.kind === 'write' || item.kind === 'edit') && item.status === 'done' && !!item.diff,
    );
    return [...changes].reverse().map((item) => ({
      path: item.path,
      diff: item.diff ?? '',
      isNew: item.kind === 'write' ? !!item.isNew : false,
    }));
  }, [changeItems]);
  const canUndoChanges = isUser && (undoEntries.length > 0 || !!onUndoChanges);
  const [undoStatus, setUndoStatus] = useState<'idle' | 'undoing' | 'undone' | 'error'>('idle');
  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  const handleUndoChanges = useCallback(async () => {
    if (undoStatus === 'undoing' || undoStatus === 'undone') return;
    const confirmed = window.confirm(undoConfirmationMessage ?? '撤销这条回复产生的文件改动？如果文件之后又被修改，撤销会失败。');
    if (!confirmed) return;
    setUndoStatus('undoing');
    const success = onUndoChanges
      ? await onUndoChanges()
      : (await window.deepseekApi.undoChanges(undoEntries)).success;
    if (!isMountedRef.current) return;
    if (success) {
      setUndoStatus('undone');
      return;
    }
    setUndoStatus('error');
  }, [onUndoChanges, undoConfirmationMessage, undoEntries, undoStatus]);

  const completedAtMs = message.completed_at ?? parseDbTimestamp(message.created_at);
  const durationSecs = thinkingStart
    ? Math.max(1, Math.round(((thinkingEnd || now) - thinkingStart) / 1000))
    : (message.duration ? Math.round(message.duration / 1000) : 0);

  const hasStyleTag = !isUser && /<style[\s>]/i.test(message.content);
  const isPureHtmlDoc = !isUser && /^\s*(?:<!doctype\s+html|<html[\s>]|<body[\s>])/i.test(message.content);
  const usesFullDocumentPath = hasStyleTag || isPureHtmlDoc;

  const processedContent = useMemo(() => {
    if (isUser || !usesFullDocumentPath) return message.content;
    const closed = closeMarkdown(copyContent);
    return linkifyFilePaths(closed);
  }, [isUser, usesFullDocumentPath, message.content, copyContent]);

  const contentBlocks = useMemo(
    () => (isUser || usesFullDocumentPath ? [] : splitBlocks(message.content)),
    [isUser, usesFullDocumentPath, message.content],
  );
  const hasVisibleContent = !!message.content?.trim();
  const shouldShowReasoning = !isUser && !hideReasoning && !!message.reasoning_content;
  const userSlashCommand = useMemo(
    () => (isUser ? parseLeadingSlashCommand(message.content) : null),
    [isUser, message.content],
  );
  const userSlashCommandSeparator = userSlashCommand?.rest.startsWith('\n') ? '' : ' ';
  const imageAttachments = useMemo(
    () => (isUser ? (message.attachments ?? []).filter((a) => a.kind === 'image') : []),
    [isUser, message.attachments],
  );
  const fileAttachments = useMemo(
    () => (isUser ? (message.attachments ?? []).filter((a) => a.kind !== 'image') : []),
    [isUser, message.attachments],
  );

  const hasHtml = !isUser && usesFullDocumentPath && ALLOWED_ELEMENTS.test(processedContent);
  const assistantFooterVisibility = showFooterByDefault ? 'opacity-100' : 'opacity-0 group-hover:opacity-100';

  return (
    <div
      data-message-role={message.role}
      className={`flex flex-col gap-2 ${isUser ? 'items-end' : 'assistant-message-inset items-start'} relative group`}
    >
      {                     }
      {isUser && !isEditing && message.attachments && message.attachments.length > 0 && (
        <UserAttachments
          fileAttachments={fileAttachments}
          imageAttachments={imageAttachments}
          onLocalFileClick={handleLocalFileClick}
        />
      )}

      {                                                                      }
      {shouldShowReasoning && (
        <ReasoningPanel
          completedAt={message.completed_at}
          duration={message.duration}
          isGenerating={isGenerating}
          isExpanded={reasoningExpanded}
          onExpandedChange={setReasoningExpanded}
          reasoningContent={message.reasoning_content}
          thinkingEnd={thinkingEnd}
        />
      )}

      {          }
      {isUser ? (
        <>
          {isEditing ? (
            <div ref={editContainerRef} className="relative w-full">
              <ChatInput
                inline
                initialValue={message.content}
                initialAttachments={message.attachments}
                placeholder="编辑消息..."
                autoFocus
                onSend={handleInlineEditSend}
                onAbort={() => setIsEditing(false)}
                isLoading={false}
                models={models.models}
                selectedModel={models.selectedModel}
                onModelChange={models.handleModelChange}
                reasoningEffort={reasoningEffort}
                onReasoningEffortChange={onReasoningEffortChange ?? (() => undefined)}
                onCancel={() => setIsEditing(false)}
              />
            </div>
          ) : (
            <div className="flex w-full items-start gap-2">
              <div
                data-testid="user-message-bubble"
                className={`user-message-glass relative min-w-0 flex-1 px-3.5 py-2 text-text-primary rounded-[14px] rounded-br-[4px] whitespace-pre-wrap break-words ${
                  canEditUserMessage ? 'cursor-text' : ''
                }`}
                onClick={canEditUserMessage ? handleStartEdit : undefined}
                role={canEditUserMessage ? 'button' : undefined}
                tabIndex={canEditUserMessage ? 0 : undefined}
                aria-label={canEditUserMessage ? '编辑消息' : undefined}
                onKeyDown={canEditUserMessage ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleStartEdit();
                  }
                } : undefined}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="text-[15px] leading-[1.6] whitespace-pre-wrap break-words flex-1 min-w-0">
                    {userSlashCommand ? (
                      <>
                        <span className={USER_SLASH_COMMAND_CLASS} title={`/${userSlashCommand.name}`}>
                          <IconLayers size={16} className="shrink-0 text-current" />
                          <span>{userSlashCommand.name}</span>
                        </span>
                        {userSlashCommand.rest ? (
                          <span>{`${userSlashCommandSeparator}${userSlashCommand.rest}`}</span>
                        ) : null}
                      </>
                    ) : message.content}
                  </div>
                  {canUndoChanges && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUndoChanges();
                      }}
                      disabled={undoStatus === 'undoing' || undoStatus === 'undone'}
                      title={undoStatus === 'undone' ? '已撤销' : '撤销这条回复产生的文件改动'}
                      className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex shrink-0 items-center justify-center w-6 h-6 rounded-full text-text-tertiary hover:bg-bg-hover hover:text-text-primary border-none bg-transparent cursor-pointer disabled:opacity-40 disabled:cursor-default"
                    >
                      {undoStatus === 'undone' ? <IconCheck size={14} className="text-text-secondary" /> : <IconUndo size={14} />}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="relative w-full bg-transparent text-text-primary">
          <div className="flex-1 min-w-0">
          {isErrorMsg ? (
            <div className="w-full rounded-[10px] border border-hairline bg-diff-del-bg px-3.5 py-3 flex gap-2.5 items-start">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-diff-del shrink-0 mt-0.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p className="flex-1 min-w-0 text-[12.5px] text-diff-del font-mono break-all leading-relaxed">
                {cleanErrorText(message.content)}
              </p>
            </div>
          ) : hasVisibleContent ? (
            <div className="markdown-container">
              {isPureHtmlDoc ? (
                <HtmlShadowRenderer html={processedContent} />
              ) : hasStyleTag ? (
                <MarkdownShadowDOMRenderer isGenerating={isGenerating}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={hasHtml ? ([rehypeRaw] as any) : ([] as any)}
                    disallowedElements={DISALLOWED_ELEMENTS}
                    urlTransform={safeUrlTransform}
                    components={markdownComponents}
                >
                  {processedContent}
                </ReactMarkdown>
                </MarkdownShadowDOMRenderer>
              ) : (
                <div className={`markdown-body organic-markdown ${isGenerating ? 'is-generating' : ''}`}>
                  {contentBlocks.map((block, index) => (
                    <MarkdownBlock
                      key={index}
                      text={block}
                      isTail={index === contentBlocks.length - 1}
                      components={markdownComponents}
                    />
                  ))}
              </div>
              )}
            </div>
          ) : null}
          </div>

          {            }
          {renderUnit && (
            <div className={hasVisibleContent ? 'mt-2' : 'mt-0'}>
              <RenderUnitView unit={renderUnit} />
            </div>
          )}

          {trailingUnits.length > 0 && (
            <div className={(hasVisibleContent || renderUnit) ? 'mt-2 flex flex-col gap-1' : 'mt-0 flex flex-col gap-1'}>
              {trailingUnits.map((unit, index) => (
                <RenderUnitView key={`trailing-${message.id}-${index}`} unit={unit} />
              ))}
            </div>
          )}

          {                                                             }
          {showFooter && (hasVisibleContent || renderUnit || trailingUnits.length > 0) && (
            <AssistantFooter
              completedAtMs={completedAtMs}
              copied={copied}
              copyContent={copyContent}
              isMenuOpen={isMenuOpen}
              menuRef={menuRef}
              onCopyMarkdown={handleCopyMarkdown}
              onCopyText={handleCopyText}
              onMenuOpenChange={setIsMenuOpen}
              onResponseNext={onResponseNext}
              onResponsePrev={onResponsePrev}
              responseCurrent={responseCurrent}
              responseTotal={responseTotal}
              visibilityClass={assistantFooterVisibility}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default React.memo(MessageBubble, areMessageBubblePropsEqual);
