import React, { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { PlanArtifact, PlanDecisionResult } from '../../shared/types';
import MarkdownBlock from './MarkdownBlock';
import { IconPlan } from './icons';
import { ActionButton, CheckIcon, XIcon } from './approval/ActionButton';
import { createMarkdownComponents } from './MarkdownRenderers';
import { usePreviewActions } from '../contexts/AppContext';
import { buildPreviewFromPath } from '../utils/filePreview';
import { parseLocalFileReference } from '../utils/localFileReference';

interface Props {
  plan: PlanArtifact;
  modeRevision: number;
  onDecision: (input: {
    token: string;
    decision: 'approve' | 'reject';
    strategy?: 'same_context' | 'fresh_context';
    feedback?: string;
  }) => Promise<PlanDecisionResult>;
}

type PlanAction = 'approve_same' | 'approve_fresh' | 'reject';

const PLAN_ACTIONS: PlanAction[] = ['approve_same', 'approve_fresh', 'reject'];

function nodeText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join('');
  if (React.isValidElement<{ children?: ReactNode }>(node)) return nodeText(node.props.children);
  return '';
}

const PlanApprovalPanel: React.FC<Props> = ({ plan, modeRevision, onDecision }) => {
  const [token, setToken] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [rejectExpanded, setRejectExpanded] = useState(false);
  const [error, setError] = useState('');
  const [selectedAction, setSelectedAction] = useState<PlanAction>('approve_same');
  const selectedActionRef = useRef<PlanAction>('approve_same');
  const panelRef = useRef<HTMLDivElement>(null);
  const feedbackInputRef = useRef<HTMLTextAreaElement>(null);
  const { setPreview } = usePreviewActions();

  const handleLocalFileClick = useCallback(async (href: string, event: React.MouseEvent) => {
    event.preventDefault();
    const { path, line } = parseLocalFileReference(href);
    const preview = await buildPreviewFromPath(path, line);
    if (preview) setPreview(preview);
  }, [setPreview]);

  const markdownComponents = useMemo(() => {
    const shared = createMarkdownComponents(handleLocalFileClick);
    return {
      ...shared,
      h1: ({ children, ...props }: any) => (
        nodeText(children).trim() === plan.title ? null : <h1 {...props}>{children}</h1>
      ),
      p: ({ children, ...props }: any) => (
        nodeText(children).trim() === plan.summary ? null : <p {...props}>{children}</p>
      ),
    };
  }, [handleLocalFileClick, plan.summary, plan.title]);

  useEffect(() => {
    let active = true;
    let secondFrame = 0;
    setToken(null);
    // 双 rAF 确保计划完成两帧渲染后才签发审批 token
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        void window.deepseekApi.markPlanPresented({
          conversationId: plan.conversationId,
          planId: plan.id,
          version: plan.version,
          contentHash: plan.contentHash,
          modeRevision,
        }).then((grant) => {
          if (active) setToken(grant.token);
        }).catch((reason) => {
          if (active) setError(reason instanceof Error ? reason.message : String(reason));
        });
      });
    });
    return () => {
      active = false;
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
    };
  }, [modeRevision, plan.contentHash, plan.conversationId, plan.id, plan.version]);

  useEffect(() => {
    selectedActionRef.current = 'approve_same';
    setSelectedAction('approve_same');
    panelRef.current?.focus();
  }, [plan.id]);

  useEffect(() => {
    if (rejectExpanded) feedbackInputRef.current?.focus();
  }, [rejectExpanded]);

  const submitDecision = useCallback((action: PlanAction) => {
    if (!token || submitting) return;
    setSubmitting(true);
    setError('');
    const input = action === 'reject'
      ? { token, decision: 'reject' as const, feedback: feedback.trim() || undefined }
      : {
          token,
          decision: 'approve' as const,
          strategy: action === 'approve_same' ? 'same_context' as const : 'fresh_context' as const,
        };
    onDecision(input).catch((reason) => {
      setError(reason instanceof Error ? reason.message : String(reason));
      setSubmitting(false);
    });
  }, [feedback, onDecision, submitting, token]);

  const selectAction = useCallback((action: PlanAction) => {
    selectedActionRef.current = action;
    setSelectedAction(action);
  }, []);

  const respond = useCallback((action: PlanAction) => {
    selectAction(action);
    if (action === 'reject' && !rejectExpanded) {
      setRejectExpanded(true);
      return;
    }
    submitDecision(action);
  }, [rejectExpanded, selectAction, submitDecision]);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const index = PLAN_ACTIONS.indexOf(selectedActionRef.current);
      selectAction(PLAN_ACTIONS[(index + direction + PLAN_ACTIONS.length) % PLAN_ACTIONS.length]);
      event.currentTarget.focus();
      return;
    }

    if (event.key === 'Tab' && selectedActionRef.current === 'reject' && !rejectExpanded) {
      event.preventDefault();
      setRejectExpanded(true);
      return;
    }

    if (event.key === 'Enter' && target === event.currentTarget) {
      event.preventDefault();
      respond(selectedActionRef.current);
    }
  }, [rejectExpanded, respond, selectAction]);

  return (
    <div
      ref={panelRef}
      data-testid="plan-approval-panel"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label="计划审批"
      className="plan-approval-panel flex max-h-[min(72vh,720px)] flex-col overflow-hidden rounded-[12px] border border-hairline bg-bg-main outline-none transition-[border-color,box-shadow] focus-visible:border-accent/45 focus-visible:ring-[3px] focus-visible:ring-accent-bg animate-[menu-in_150ms_ease-out]"
    >
      <header className="plan-approval-header flex shrink-0 items-center gap-2.5 border-b border-hairline px-4 py-3 sm:px-5">
        <IconPlan size={14} className="shrink-0 text-text-secondary" />
        <span className="plan-status-dot" aria-hidden />
        <span className="text-[12px] font-medium text-text-secondary">实施计划 · 等待批准</span>
      </header>

      <div className="plan-document-layout min-h-0 flex-1">
        <div data-testid="plan-document-scroll" className="plan-document-scroll custom-scrollbar min-h-0 overflow-y-auto">
          <div className="markdown-body plan-markdown-body">
            <MarkdownBlock text={plan.markdown} isTail={false} components={markdownComponents} />
          </div>
        </div>
      </div>

      <footer className="plan-approval-actions shrink-0 border-t border-hairline px-4 py-3 sm:px-5">
        <div className="grid grid-cols-1 gap-2">
          <ActionButton
            action="approve_same"
            variant="primary"
            title="批准，保留上下文执行"
            icon={<CheckIcon />}
            selected={selectedAction === 'approve_same'}
            disabled={!token || submitting}
            testId="plan-approve-same"
            onSelect={selectAction}
            onClick={() => respond('approve_same')}
          />
          <ActionButton
            action="approve_fresh"
            variant="secondary"
            title="批准，清空上下文执行"
            icon={<SweepIcon />}
            selected={selectedAction === 'approve_fresh'}
            disabled={!token || submitting}
            testId="plan-approve-fresh"
            onSelect={selectAction}
            onClick={() => respond('approve_fresh')}
          />
          <ActionButton
            action="reject"
            variant={rejectExpanded ? 'dangerActive' : 'danger'}
            title="继续规划"
            icon={<XIcon />}
            selected={selectedAction === 'reject'}
            disabled={!token || submitting}
            testId="plan-reject-toggle"
            onSelect={selectAction}
            onClick={() => respond('reject')}
          />
        </div>

        {rejectExpanded && (
          <div className="mt-3 flex flex-col gap-2 rounded-[10px] border border-hairline bg-diff-del-bg p-2.5">
            <textarea
              ref={feedbackInputRef}
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  event.stopPropagation();
                  submitDecision('reject');
                }
              }}
              onFocus={() => selectAction('reject')}
              placeholder="可选：告诉 AI 计划需要如何调整…"
              rows={3}
              className="max-h-[240px] min-h-[76px] w-full resize-y rounded-[8px] border border-hairline bg-bg-main px-3 py-2 text-[13px] leading-5 text-text-primary outline-none placeholder:text-text-tertiary focus:border-accent/45 focus:ring-[3px] focus:ring-accent-bg"
              disabled={submitting}
            />
            <div className="flex shrink-0 justify-end gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  setRejectExpanded(false);
                  setFeedback('');
                  panelRef.current?.focus();
                }}
                className="h-9 rounded-[8px] px-3 text-[13px] font-medium text-text-secondary transition-colors hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-50 border-0 bg-transparent cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                data-testid="plan-reject"
                disabled={!token || submitting}
                onClick={() => submitDecision('reject')}
                className="h-9 rounded-[8px] bg-diff-del px-3 text-[13px] font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 border-0 cursor-pointer"
              >
                重新规划
              </button>
            </div>
          </div>
        )}

        {error ? <p className="mt-2 text-[12px] text-diff-del">{error}</p> : null}
      </footer>
    </div>
  );
};

const SweepIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M1 4v6h6" />
    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
  </svg>
);

export default PlanApprovalPanel;
