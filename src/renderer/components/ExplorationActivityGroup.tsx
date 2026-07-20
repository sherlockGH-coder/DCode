import React, { useEffect, useMemo, useState } from 'react';
import type { ToolItem } from '../../shared/types';
import { describeToolItem } from '../utils/toolDescriptions';
import { IconChevronRight, IconDeepThinking } from './icons';
import { ToolKindBadge, type ToolIconType } from './tool-item-card/chrome';
import ToolItemCard from './ToolItemCard';

export type ExplorationActivity =
  | { kind: 'reasoning'; id: string; content: string; durationMs?: number; isStreaming?: boolean }
  | { kind: 'tool'; id: string; item: ToolItem };

interface Props {
  activities: ExplorationActivity[];
  isProcessing?: boolean;
}

function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return `${seconds}秒`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest > 0 ? `${minutes}分${rest}秒` : `${minutes}分钟`;
}

function summaryFor(activities: ExplorationActivity[]): string {
  const thoughtMs = activities.reduce(
    (total, activity) => activity.kind === 'reasoning' ? total + (activity.durationMs ?? 0) : total,
    0,
  );
  const thoughtCount = activities.filter((activity) => activity.kind === 'reasoning').length;
  const tools = activities.flatMap((activity) => activity.kind === 'tool' ? [activity.item] : []);
  const readCount = tools.filter((item) => item.kind === 'read').length;
  const searchCount = tools.filter((item) => item.kind === 'grep' || item.kind === 'glob').length;
  const directoryCount = tools.filter((item) => item.kind === 'list_directory').length;
  const webCount = tools.filter((item) => item.kind === 'web_search' || item.kind === 'web_fetch').length;
  const visionCount = tools.filter((item) => item.kind === 'vision').length;
  const parts: string[] = [];

  if (thoughtCount > 0) {
    parts.push(thoughtMs > 0 ? `思考了 ${formatDuration(thoughtMs)}` : '已深度思考');
  }
  if (readCount > 0) parts.push(`读取 ${readCount} 个文件`);
  if (searchCount > 0) parts.push(`搜索 ${searchCount} 次`);
  if (directoryCount > 0) parts.push(`浏览 ${directoryCount} 个目录`);
  if (webCount > 0) parts.push(`查看 ${webCount} 个网页`);
  if (visionCount > 0) parts.push(`查看 ${visionCount} 张图片`);

  return parts.join('，') || '已探索';
}

function summaryIcon(activities: ExplorationActivity[]): { key: string; iconType?: ToolIconType } {
  const firstTool = activities.find((activity): activity is Extract<ExplorationActivity, { kind: 'tool' }> => activity.kind === 'tool');
  if (!firstTool) return { key: 'thinking' };
  const iconType = describeToolItem(firstTool.item).iconType;
  return { key: iconType, iconType };
}

const ReasoningActivityRow: React.FC<{
  activity: Extract<ExplorationActivity, { kind: 'reasoning' }>;
}> = ({ activity }) => {
  const [expanded, setExpanded] = useState(activity.isStreaming === true);
  const effectiveExpanded = activity.isStreaming ? true : expanded;
  const duration = activity.durationMs && activity.durationMs > 0 ? `，思考了 ${formatDuration(activity.durationMs)}` : '';

  useEffect(() => {
    setExpanded(activity.isStreaming === true);
  }, [activity.isStreaming]);

  if (activity.isStreaming) {
    return (
      <div className="w-full" data-testid="reasoning-activity-row">
        <div
          data-testid="reasoning-activity-streaming-label"
          className="flex min-h-6 w-fit max-w-full items-center gap-[9px] py-1 text-accent"
        >
          <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center opacity-75">
            <IconDeepThinking size={15} className="text-current" />
          </span>
          <span className="min-w-0 text-[13.5px]">正在深度思考</span>
        </div>
        <div
          data-testid="reasoning-activity-content"
          className="ml-2 mt-1 max-h-[333px] overflow-y-auto border-l border-hairline pl-4 text-[14px] leading-[1.7] whitespace-pre-wrap break-words text-text-tertiary"
        >
          {activity.content}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full" data-testid="reasoning-activity-row">
      <button
        type="button"
        data-testid="reasoning-activity-toggle"
        aria-expanded={effectiveExpanded}
        onClick={() => setExpanded((value) => !value)}
        className="flex min-h-6 w-fit max-w-full items-center gap-[9px] border-0 bg-transparent py-1 text-left text-text-secondary transition-colors duration-150 cursor-pointer hover:text-text-primary"
      >
        <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center opacity-75">
          <IconDeepThinking size={15} className="text-current" />
        </span>
        <span className="min-w-0 text-[13.5px]">已深度思考{duration}</span>
        <IconChevronRight
          size={12}
          className={`shrink-0 text-current transition-transform duration-150 ${effectiveExpanded ? 'rotate-90' : ''}`}
        />
      </button>
      {effectiveExpanded && (
        <div
          data-testid="reasoning-activity-content"
          className="ml-2 mt-1 max-h-[333px] overflow-y-auto border-l border-hairline pl-4 text-[14px] leading-[1.7] whitespace-pre-wrap break-words text-text-tertiary"
        >
          {activity.content}
        </div>
      )}
    </div>
  );
};

const ExplorationActivityGroup: React.FC<Props> = ({ activities, isProcessing }) => {
  const [expanded, setExpanded] = useState(true);
  const effectiveExpanded = isProcessing ? true : expanded;
  const summary = useMemo(() => summaryFor(activities), [activities]);
  const icon = useMemo(() => summaryIcon(activities), [activities]);
  const onlyReasoning = activities.every((activity) => activity.kind === 'reasoning');

  useEffect(() => {
    if (!isProcessing) setExpanded(false);
  }, [isProcessing]);

  if (onlyReasoning) {
    return (
      <div className="flex w-full flex-col gap-0.5" data-testid="reasoning-only-activities">
        {activities.map((activity) => activity.kind === 'reasoning'
          ? <ReasoningActivityRow key={activity.id} activity={activity} />
          : null)}
      </div>
    );
  }

  if (isProcessing) {
    return (
      <div className="tool-item-shell w-full overflow-hidden" data-testid="exploration-activity-group">
        <div className="flex flex-col gap-0.5" data-testid="exploration-activity-details">
          {activities.map((activity) => activity.kind === 'reasoning' ? (
            <ReasoningActivityRow key={activity.id} activity={activity} />
          ) : (
            <ToolItemCard key={activity.id} item={activity.item} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="tool-item-shell w-full overflow-hidden" data-testid="exploration-activity-group">
      <button
        type="button"
        data-testid="exploration-activity-summary"
        data-tool-icon={icon.key}
        aria-expanded={effectiveExpanded}
        onClick={() => setExpanded((value) => !value)}
        className="activity-summary-row group/activity-row flex min-h-6 w-fit max-w-full items-center gap-[9px] border-0 bg-transparent py-1 text-left text-text-secondary transition-colors duration-150 cursor-pointer hover:text-text-primary"
      >
        <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-current opacity-75">
          {icon.iconType
            ? <ToolKindBadge iconType={icon.iconType} />
            : <IconDeepThinking size={15} className="text-current" />}
        </span>
        <span className="min-w-0 truncate text-[13.5px] text-current">{summary}</span>
        <IconChevronRight
          size={12}
          className={`shrink-0 text-current transition-transform duration-150 ${effectiveExpanded ? 'rotate-90' : ''}`}
        />
      </button>

      {effectiveExpanded && (
        <div className="mt-1 flex flex-col gap-0.5" data-testid="exploration-activity-details">
          {activities.map((activity) => activity.kind === 'reasoning' ? (
            <ReasoningActivityRow key={activity.id} activity={activity} />
          ) : (
            <ToolItemCard key={activity.id} item={activity.item} />
          ))}
        </div>
      )}
    </div>
  );
};

export default ExplorationActivityGroup;
