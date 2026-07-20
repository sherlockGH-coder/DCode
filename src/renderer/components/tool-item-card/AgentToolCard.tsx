import React, { useMemo, useState } from 'react';
import type { ToolItem } from '../../../shared/types';
import { IconRobot } from '../icons';
import { ChevronGlyph, ToolDetailFrame } from './chrome';
import OutputPreview from './OutputPreview';
import { getOutput } from './utils';

type AgentDisplaySummary = {
  id?: string;
  conversationId?: string;
  taskName?: string;
  role?: string;
  status?: string;
  result?: string;
  error?: string;
};

type ParsedAgentOutput = {
  parsed: boolean;
  agent?: AgentDisplaySummary;
  agents?: AgentDisplaySummary[];
  resultText?: string;
  timedOut?: boolean;
};

function stringField(value: Record<string, unknown>, key: string): string | undefined {
  const field = value[key];
  return typeof field === 'string' && field.length > 0 ? field : undefined;
}

function agentSummaryFromUnknown(value: unknown): AgentDisplaySummary | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  return {
    id: stringField(record, 'id'),
    conversationId: stringField(record, 'conversationId'),
    taskName: stringField(record, 'taskName'),
    role: stringField(record, 'role'),
    status: stringField(record, 'status'),
    result: stringField(record, 'result'),
    error: stringField(record, 'error'),
  };
}

function textFromUnknown(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim().length > 0) return value;
  if (value == null) return undefined;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function parseAgentOutput(output?: string): ParsedAgentOutput {
  if (!output) return { parsed: false };
  try {
    const parsed = JSON.parse(output) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { parsed: false };
    }
    const record = parsed as Record<string, unknown>;
    const agent = agentSummaryFromUnknown(record.agent);
    const agents = Array.isArray(record.agents)
      ? record.agents.flatMap((entry) => {
        const summary = agentSummaryFromUnknown(entry);
        return summary ? [summary] : [];
      })
      : undefined;
    return {
      parsed: true,
      agent,
      agents,
      resultText: textFromUnknown(record.result) ?? agent?.result ?? agent?.error,
      timedOut: typeof record.timedOut === 'boolean' ? record.timedOut : undefined,
    };
  } catch {
    return { parsed: false };
  }
}

const AgentToolCard: React.FC<{ item: Extract<ToolItem, { kind: 'agent' }>; hideIcon?: boolean }> = ({ item, hideIcon = false }) => {
  const [open, setOpen] = useState(false);
  const output = getOutput(item);
  const parsedOutput = useMemo(() => parseAgentOutput(output), [output]);
  const agents = item.agents?.length ? item.agents : parsedOutput.agents ?? [];
  const singleAgent: AgentDisplaySummary = {
    ...parsedOutput.agent,
    id: parsedOutput.agent?.id ?? item.agentId,
    taskName: parsedOutput.agent?.taskName ?? item.taskName,
    role: parsedOutput.agent?.role ?? item.role,
    status: parsedOutput.agent?.status ?? item.agentStatus,
  };
  const resultText = parsedOutput.resultText ?? (parsedOutput.parsed ? undefined : output);
  const title = agents.length > 1
    ? `${agents.length} 个子 Agent`
    : (singleAgent.taskName || singleAgent.id || '子 Agent');
  const hasSingleAgentDetail = !!singleAgent.id || !!singleAgent.role || !!singleAgent.conversationId;
  const hasExpandableContent = !!resultText || agents.length > 0 || hasSingleAgentDetail;

  const isRunning = item.status === 'running' || item.status === 'pending'
    || (item.action === 'spawn' && (item.timedOut || parsedOutput.timedOut));
  const isError = item.status === 'error' || !!singleAgent.error;
  const statusText = isError
    ? '失败'
    : isRunning
      ? (item.timedOut || parsedOutput.timedOut ? '后台运行中' : '运行中')
      : item.action === 'close'
        ? '已关闭'
        : '已完成';

  const renderAgentRow = (agent: AgentDisplaySummary, index: number) => (
    <div key={agent.id ?? index} className="flex min-w-0 items-center gap-2 text-[12px] text-text-secondary">
      <span className="min-w-0 truncate font-mono">{agent.taskName || agent.id || 'Agent'}</span>
      {agent.role && (
        <span className="shrink-0 text-[11px] text-text-tertiary">{agent.role}</span>
      )}
      {agent.status && (
        <span className="shrink-0 text-[11px] text-text-tertiary">{agent.status}</span>
      )}
    </div>
  );

  const rowColor = isError
    ? 'text-text-secondary hover:text-text-primary'
    : isRunning
      ? 'text-text-secondary'
      : 'text-text-secondary hover:text-text-primary';

  return (
    <div className="w-full overflow-hidden">
      <button
        type="button"
        data-testid="tool-item-row"
        onClick={hasExpandableContent ? () => setOpen((v) => !v) : undefined}
        className={`tool-item-row-surface group/agent-row flex min-h-6 w-fit max-w-full items-center gap-[9px] border-0 bg-transparent py-1 text-left transition-colors duration-150 ${rowColor} ${
          hasExpandableContent ? 'cursor-pointer' : 'cursor-default'
        }`}
        aria-expanded={hasExpandableContent ? open : undefined}
      >
        {!hideIcon && (
          <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-current opacity-75">
            <IconRobot size={15} className="text-current" />
          </span>
        )}
        <span className="shrink-0 text-[13.5px] text-current">子 Agent</span>
        <span className="min-w-0 truncate font-mono text-[13.5px] text-current" title={title}>{title}</span>
        <span className={`shrink-0 text-[13px] ${isError ? 'text-diff-del' : 'text-text-tertiary'}`}>· {statusText}</span>
        {hasExpandableContent && (
          <span className="shrink-0 text-[10px] text-text-tertiary">
            <ChevronGlyph open={open} />
          </span>
        )}
      </button>
      {open && hasExpandableContent && (
        <ToolDetailFrame testId="agent-tool-detail-frame" className="ml-2 mt-1 space-y-1.5 px-3 py-2 text-text-secondary">
          {agents.length > 0 && (
            <div className="space-y-1">
              {agents.map(renderAgentRow)}
            </div>
          )}
          {agents.length === 0 && hasSingleAgentDetail && (
            <div className="space-y-1 text-[12px] text-text-tertiary">
              {singleAgent.id && (
                <div className="flex min-w-0 gap-2">
                  <span className="shrink-0">agent_id</span>
                  <span className="min-w-0 truncate font-mono text-text-secondary">{singleAgent.id}</span>
                </div>
              )}
              {singleAgent.conversationId && (
                <div className="flex min-w-0 gap-2">
                  <span className="shrink-0">conversation</span>
                  <span className="min-w-0 truncate font-mono text-text-secondary">{singleAgent.conversationId}</span>
                </div>
              )}
              {item.timedOut || parsedOutput.timedOut ? (
                <div className="text-text-tertiary">
                  仍在后台运行，稍后用 wait_agent 和该 agent_id 获取结果。
                </div>
              ) : null}
            </div>
          )}
          {resultText ? <OutputPreview output={resultText} /> : null}
        </ToolDetailFrame>
      )}
    </div>
  );
};

export default AgentToolCard;
