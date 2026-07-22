import React, { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { ToolItem } from '../../shared/types';
import { IconFile, IconGlobe, IconSearch, IconSidebarTerminal } from './icons';
import { rememberSessionAllow, keyForApproval } from '../utils/approvalSession';
import DiffView from './preview/DiffView';
import { ActionButton, CheckIcon, LockIcon, XIcon } from './approval/ActionButton';

interface ApprovalPanelProps {
  item: ToolItem;
  total?: number;
  index?: number;
  onConfirm?: (
    toolCallId: string,
    allowed: boolean,
    feedback?: string,
    rememberForSession?: boolean,
    scope?: { kind: 'outOfScopeDir'; dir: string },
  ) => void;
}

type ApprovalAction = 'allow' | 'allow_session' | 'deny';

const APPROVAL_ACTIONS: ApprovalAction[] = ['allow', 'allow_session', 'deny'];

export function isDenyFeedbackSubmitShortcut(event: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey'>): boolean {
  return event.key === 'Enter' && (event.metaKey || event.ctrlKey);
}

const ICON_MAP: Record<string, React.FC<{ size?: number; className?: string }>> = {
  file: IconFile,
  terminal: IconSidebarTerminal,
  search: IconSearch,
  globe: IconGlobe,
};

const getCategoryName = (kind: string): string => {
  const names: Record<string, string> = {
    exec: '终端命令',
    read: '读取文件',
    write: '写入文件',
    edit: '编辑文件',
    grep: '内容搜索',
    glob: '文件检索',
    web_search: '网页搜索',
    web_fetch: '网页抓取',
    task: '任务管理',
    tool: '外部工具',
  };
  return names[kind] || '工具执行';
};

const ApprovalPanel: React.FC<ApprovalPanelProps> = ({ item, total = 1, index = 0, onConfirm }) => {
  const [submitting, setSubmitting] = useState(false);
  const [denyExpanded, setDenyExpanded] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [selectedAction, setSelectedAction] = useState<ApprovalAction>('allow');
  const selectedActionRef = useRef<ApprovalAction>('allow');
  const panelRef = useRef<HTMLDivElement>(null);
  const denyInputRef = useRef<HTMLTextAreaElement>(null);

  const commandText = getCommandText(item);
  const outOfScope = item.approvalOutOfScope;
  const allowedDir = outOfScope ? parentDir(outOfScope.absolutePath) : null;
  const IconComponent = ICON_MAP[getIconType(item.kind)] ?? IconFile;
  const diffFilePath = item.kind === 'edit' || item.kind === 'write' ? item.path : undefined;
  const diffFileName = getFileName(diffFilePath);
  const diffStats = useMemo(() => {
    if (!item.approvalDiffPreview) return null;
    return getDiffStats(item.approvalDiffPreview);
  }, [item.approvalDiffPreview]);

  useEffect(() => {
    selectedActionRef.current = 'allow';
    setSelectedAction('allow');
    panelRef.current?.focus();
  }, [item.toolCallId]);

  useEffect(() => {
    if (denyExpanded) denyInputRef.current?.focus();
  }, [denyExpanded]);

  const submitDecision = useCallback((action: ApprovalAction) => {
    if (submitting) return;
    setSubmitting(true);
    const { rememberForSession, scope } = getSessionScope(action, item, outOfScope, allowedDir);
    const allowed = action !== 'deny';
    const reason = action === 'deny' ? feedback.trim() : undefined;

    if (onConfirm) {
      onConfirm(item.toolCallId, allowed, reason || undefined, rememberForSession, scope);
      return;
    }

    window.deepseekApi
      .approvalRespond(item.toolCallId, allowed, reason || undefined, rememberForSession, scope)
      .catch((err) => {
        console.error('[ApprovalPanel]', err);
        setSubmitting(false);
      });
  }, [allowedDir, feedback, item, onConfirm, outOfScope, submitting]);

  const selectAction = useCallback((action: ApprovalAction) => {
    selectedActionRef.current = action;
    setSelectedAction(action);
  }, []);

  const respond = useCallback((action: ApprovalAction) => {
    selectAction(action);
    if (action === 'deny' && !denyExpanded) {
      setDenyExpanded(true);
      return;
    }
    submitDecision(action);
  }, [denyExpanded, selectAction, submitDecision]);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const index = APPROVAL_ACTIONS.indexOf(selectedActionRef.current);
      selectAction(APPROVAL_ACTIONS[(index + direction + APPROVAL_ACTIONS.length) % APPROVAL_ACTIONS.length]);
      event.currentTarget.focus();
      return;
    }

    if (event.key === 'Tab' && selectedActionRef.current === 'deny' && !denyExpanded) {
      event.preventDefault();
      setDenyExpanded(true);
      return;
    }

    if (event.key === 'Enter' && target === event.currentTarget) {
      event.preventDefault();
      submitDecision(selectedActionRef.current);
    }
  }, [denyExpanded, selectAction, submitDecision]);

  const getOption2Title = () => {
    if (outOfScope && allowedDir) {
      return '允许，本会话内此目录不再询问';
    }
    if (item.kind === 'exec' && item.command) {
      const cmdName = item.command.trim().split(/\s+/)[0] || 'command';
      return `允许，本会话内 "${cmdName}" 不再询问`;
    }
    if (item.kind === 'tool' && item.toolName) {
      return `允许，本会话内 "${item.toolName}" 不再询问`;
    }
    if (['read', 'write', 'edit'].includes(item.kind)) {
      return '允许，本会话内文件操作不再询问';
    }
    return '允许，本会话内此工具不再询问';
  };

  return (
    <div
      ref={panelRef}
      data-testid="approval-panel"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label="审批选项"
      className="flex max-h-[min(60vh,600px)] flex-col overflow-hidden rounded-[10px] border border-hairline bg-bg-main outline-none transition-[border-color,box-shadow] focus-visible:border-accent/45 focus-visible:ring-[3px] focus-visible:ring-accent-bg animate-[menu-in_150ms_ease-out]"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-hairline px-4 py-2.5 sm:px-5">
        <div className="flex items-center gap-2 text-text-secondary">
          <IconComponent size={14} className="shrink-0" />
          <span className="text-[12px] font-medium">
            {getCategoryName(item.kind)}
          </span>
        </div>
        {total > 1 && (
          <span className="shrink-0 rounded-[5px] bg-bg-chip px-1.5 py-0.5 text-[11px] font-normal text-text-tertiary">
            {index + 1} / {total}
          </span>
        )}
      </div>

      <div className="shrink-0 px-4 py-3.5 sm:px-5 flex flex-col gap-2.5">
        {commandText ? (
          <code
            className="block max-w-full overflow-x-auto whitespace-nowrap rounded-[10px] border border-hairline bg-bg-block px-3.5 py-2.5 font-mono text-[12.5px] text-text-primary"
            title={commandText}
          >
            {item.kind === 'exec' ? (
              <>
                <span className="text-text-tertiary select-none">$ </span>
                {commandText}
              </>
            ) : (
              commandText
            )}
          </code>
        ) : (
          <div className="text-[13px] leading-5 text-text-secondary">
            确认执行此操作
          </div>
        )}
        {item.approvalDescription && (
          <div className="text-[12px] text-text-tertiary leading-relaxed" title={item.approvalDescription}>
            {item.approvalDescription}
          </div>
        )}
      </div>

      {outOfScope && (
        <div className="shrink-0 border-t border-hairline px-4 py-2.5 sm:px-5">
          <div className="text-[12px] font-medium text-amber-600">路径在当前项目之外</div>
          <div className="mt-0.5 break-all font-mono text-[11px] leading-5 text-text-tertiary">
            {outOfScope.absolutePath}
          </div>
        </div>
      )}

      {item.approvalDiffPreview && diffStats && (
        <div
          data-testid="approval-diff-card"
          className="mx-4 mb-3.5 flex min-h-0 flex-col overflow-hidden rounded-[10px] border border-hairline bg-bg-main sm:mx-5"
        >
          <div className="flex min-h-10 shrink-0 items-center gap-4 border-b border-hairline px-5 py-2 text-[13px]">
            <span className="min-w-0 truncate font-medium text-text-secondary">
              {diffFileName}
            </span>
            <span className="flex shrink-0 items-center gap-1.5 font-mono text-[13px] font-medium">
              <span className="text-diff-add">
                +{diffStats.added}
              </span>
              <span className="text-diff-del">
                -{diffStats.deleted}
              </span>
            </span>
          </div>
          <div className="min-h-0 overflow-y-auto">
            <DiffView
              diff={item.approvalDiffPreview}
              filename={diffFilePath}
              variant="review"
              className="bg-transparent"
            />
          </div>
        </div>
      )}

      <div className="shrink-0 border-t border-hairline px-4 py-3 sm:px-5">
        <div className="grid grid-cols-1 gap-2">
          <ActionButton
            action="allow"
            variant="primary"
            title="允许"
            icon={<CheckIcon />}
            selected={selectedAction === 'allow'}
            disabled={submitting}
            onSelect={selectAction}
            onClick={() => respond('allow')}
          />
          <ActionButton
            action="allow_session"
            variant="secondary"
            title={getOption2Title()}
            icon={<LockIcon />}
            selected={selectedAction === 'allow_session'}
            disabled={submitting}
            onSelect={selectAction}
            onClick={() => respond('allow_session')}
          />
          <ActionButton
            action="deny"
            variant={denyExpanded ? 'dangerActive' : 'danger'}
            title="拒绝"
            icon={<XIcon />}
            selected={selectedAction === 'deny'}
            disabled={submitting}
            onSelect={selectAction}
            onClick={() => respond('deny')}
          />
        </div>

        {outOfScope && allowedDir && (
          <div className="mt-2 truncate font-mono text-[11px] text-text-tertiary" title={allowedDir}>
            本会话允许的路径：{allowedDir}
          </div>
        )}

        {denyExpanded && (
          <div className="mt-3 flex flex-col gap-2 rounded-[10px] border border-hairline bg-diff-del-bg p-2.5">
            <textarea
              ref={denyInputRef}
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
              onKeyDown={(event) => {
                if (isDenyFeedbackSubmitShortcut(event)) {
                  event.preventDefault();
                  event.stopPropagation();
                  submitDecision('deny');
                }
              }}
              onFocus={() => selectAction('deny')}
              placeholder="可选：告诉 AI 应当改做什么…"
              rows={3}
              className="max-h-[240px] min-h-[76px] w-full resize-y rounded-[8px] border border-hairline bg-bg-main px-3 py-2 text-[13px] leading-5 text-text-primary outline-none placeholder:text-text-tertiary focus:border-accent/45 focus:ring-[3px] focus:ring-accent-bg"
              disabled={submitting}
            />
            <div className="flex shrink-0 justify-end gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  setDenyExpanded(false);
                  setFeedback('');
                  panelRef.current?.focus();
                }}
                className="h-9 rounded-[8px] px-3 text-[13px] font-medium text-text-secondary transition-colors hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-50 border-0 bg-transparent cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => respond('deny')}
                className="h-9 rounded-[8px] bg-diff-del px-3 text-[13px] font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 border-0 cursor-pointer"
              >
                确认拒绝
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

function getSessionScope(
  action: ApprovalAction,
  item: ToolItem,
  outOfScope: ToolItem['approvalOutOfScope'],
  allowedDir: string | null,
): { rememberForSession: boolean; scope?: { kind: 'outOfScopeDir'; dir: string } } {
  if (action !== 'allow_session') return { rememberForSession: false };
  if (outOfScope && allowedDir) {
    return { rememberForSession: true, scope: { kind: 'outOfScopeDir', dir: allowedDir } };
  }

  const approvalKind = toolItemKindToApprovalKind(item.kind);
  const command = item.kind === 'exec' ? item.command : item.kind === 'tool' ? item.toolName : '';
  rememberSessionAllow(keyForApproval(approvalKind, command));
  return { rememberForSession: false };
}

function getCommandText(item: ToolItem): string | undefined {
  switch (item.kind) {
    case 'exec': return item.command;
    case 'read':
    case 'write':
    case 'edit': return item.path;
    case 'grep':
    case 'glob': return item.pattern;
    case 'web_search': return item.query;
    case 'web_fetch': return item.url;
    case 'task': return item.title || item.taskId || item.action;
    case 'tool': return item.input ? `${item.toolName} ${item.input}` : item.toolName;
    default: return undefined;
  }
}

function getIconType(kind: string): string {
  if (['read', 'write', 'edit', 'task'].includes(kind)) return 'file';
  if (kind === 'exec' || kind === 'tool') return 'terminal';
  if (kind === 'grep' || kind === 'glob') return 'search';
  if (kind === 'web_search' || kind === 'web_fetch') return 'globe';
  if (kind === 'memory') return 'memory';
  return 'file';
}

function toolItemKindToApprovalKind(kind: string): string {
  switch (kind) {
    case 'exec': return 'bash_exec';
    case 'read': return 'read_file';
    case 'write': return 'write_file';
    case 'edit': return 'edit_file';
    case 'task':
    case 'tool': return 'external_tool';
    default: return kind;
  }
}

function parentDir(absPath: string): string {
  const sep = absPath.includes('\\') && !absPath.startsWith('/') ? '\\' : '/';
  const idx = absPath.lastIndexOf(sep);
  if (idx <= 0) return absPath;
  return absPath.slice(0, idx);
}

function getFileName(path?: string): string {
  if (!path) return 'Diff preview';
  return path.split(/[\\/]/).pop() || path;
}

function getDiffStats(diff: string): { added: number; deleted: number; changed: number } {
  let added = 0;
  let deleted = 0;

  for (const line of diff.split('\n')) {
    if (line.startsWith('+++') || line.startsWith('---')) continue;
    if (line.startsWith('+')) added++;
    else if (line.startsWith('-')) deleted++;
  }

  return { added, deleted, changed: added + deleted };
}

export default ApprovalPanel;
