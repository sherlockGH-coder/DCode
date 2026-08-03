import React, { useEffect, useState } from 'react';
import type { PlanArtifact, ToolItem } from '../../shared/types';
import MarkdownBlock from './MarkdownBlock';
import { IconPlan } from './icons';
import { ChevronGlyph } from './tool-item-card/chrome';

type PlanArtifactItem = Extract<ToolItem, { kind: 'plan_artifact' }>;

const STATUS_BADGES: Record<PlanArtifact['status'], { label: string; className: string }> = {
  pending_approval: { label: 'Awaiting approval', className: 'bg-accent-bg text-accent' },
  approved: { label: 'Approved', className: 'bg-diff-add-bg text-diff-add' },
  rejected: { label: 'Rejected', className: 'bg-diff-del-bg text-diff-del' },
  superseded: { label: 'Superseded', className: 'bg-bg-chip text-text-tertiary' },
};

/** Plan artifact card in the chat stream: show title/status collapsed and the full plan when expanded. */
const PlanArtifactCard: React.FC<{ item: PlanArtifactItem }> = ({ item }) => {
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState<PlanArtifact | undefined>(item.plan);

  useEffect(() => {
    setPlan(item.plan);
  }, [item.plan]);

  // Decisions change the plan status, so refresh when the mode state changes.
  useEffect(() => {
    const planId = item.plan?.id;
    if (!planId) return;
    const api = window.deepseekApi;
    if (typeof api?.getPlanArtifact !== 'function') return;
    let active = true;
    const refresh = () => {
      void api.getPlanArtifact(planId).then((latest) => {
        if (active && latest) setPlan(latest);
      }).catch(() => {});
    };
    refresh();
    const unsubscribe = typeof api.onConversationModeStateChanged === 'function'
      ? api.onConversationModeStateChanged((state) => {
          if (state.conversationId === item.plan?.conversationId) refresh();
        })
      : undefined;
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [item.plan?.id, item.plan?.conversationId]);

  const title = plan?.title ?? item.title ?? 'Implementation plan';
  const badge = plan ? STATUS_BADGES[plan.status] : undefined;

  return (
    <div data-testid="plan-artifact-card" className="w-full overflow-hidden rounded-[10px] border border-hairline bg-bg-main">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent px-3.5 py-2.5 text-left transition-colors hover:bg-bg-hover"
      >
        <IconPlan size={14} className="shrink-0 text-text-secondary" />
        <span className="shrink-0 text-[12px] font-medium text-text-secondary">Implementation plan</span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-text-primary" title={title}>
          {title}
        </span>
        {plan && (
          <span className="shrink-0 rounded-[5px] bg-bg-chip px-1.5 py-0.5 text-[11px] text-text-tertiary">
            v{plan.version}
          </span>
        )}
        {badge && (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.className}`}>
            {badge.label}
          </span>
        )}
        <span className="shrink-0 text-[10px] text-text-tertiary">
          <ChevronGlyph open={open} />
        </span>
      </button>
      {open && (
        <div className="max-h-[420px] overflow-y-auto border-t border-hairline px-3.5 py-3 text-[13px]">
          {plan ? (
            <MarkdownBlock text={plan.markdown} isTail={false} components={{}} />
          ) : (
            <p className="m-0 text-[12px] text-text-tertiary">Plan content is unavailable</p>
          )}
        </div>
      )}
    </div>
  );
};

export default PlanArtifactCard;
