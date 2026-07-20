import React from 'react';
import type { PlanUpdateItem, Task, ToolItem } from '../../../shared/types';
import { IconCheck, IconChevronRight, IconGlobe, IconLayers, IconPlug, IconX, getFileIcon } from '../icons';

export const ProgressIllustration: React.FC = () => (
  <svg width="112" height="64" viewBox="0 0 112 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="dark:opacity-80">
    <rect x="18" y="2" width="76" height="56" rx="5" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-black/[0.14] dark:text-white/[0.14]" />
    <rect x="39" y="2" width="34" height="9" rx="2" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-black/[0.14] dark:text-white/[0.14]" />
    <line x1="29" y1="20" x2="55" y2="20" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="text-black/[0.08] dark:text-white/[0.08]" />
    <line x1="29" y1="27" x2="42" y2="27" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="text-black/[0.06] dark:text-white/[0.06]" />
    <circle cx="27" cy="20" r="5" fill="currentColor" stroke="currentColor" strokeWidth="0.8" className="text-black/[0.18] dark:text-white/[0.22]" />
    <polyline points="24.5 20 26.2 21.7 29.5 18.3" fill="none" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="dark:stroke-[#1E1E20]" />
    <line x1="29" y1="37" x2="65" y2="37" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="text-black/[0.14] dark:text-white/[0.16]" />
    <line x1="29" y1="44" x2="48" y2="44" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="text-black/[0.08] dark:text-white/[0.10]" />
    <circle cx="27" cy="37" r="5" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-black/[0.16] dark:text-white/[0.20]" />
    <circle cx="27" cy="51" r="2.5" fill="currentColor" className="text-black/[0.10] dark:text-white/[0.14]" />
  </svg>
);

export const FolderIllustration: React.FC = () => (
  <svg width="112" height="64" viewBox="0 0 112 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="dark:opacity-80">
    <rect x="6" y="10" width="44" height="50" rx="4" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-black/[0.14] dark:text-white/[0.14]" />
    <rect x="6" y="10" width="44" height="9" rx="4" className="text-black/[0.05] dark:text-white/[0.06]" />
    <rect x="6" y="15" width="44" height="4" rx="0" className="text-black/[0.05] dark:text-white/[0.06]" />
    <line x1="14" y1="26" x2="42" y2="26" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="text-black/[0.08] dark:text-white/[0.08]" />
    <line x1="14" y1="33" x2="38" y2="33" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="text-black/[0.06] dark:text-white/[0.06]" />
    <line x1="14" y1="40" x2="40" y2="40" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="text-black/[0.08] dark:text-white/[0.08]" />
    <rect x="14" y="47" width="30" height="4" rx="1.5" className="text-emerald-500/[0.12] dark:text-emerald-400/[0.15]" fill="currentColor" />
    <rect x="56" y="4" width="44" height="50" rx="4" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-black/[0.16] dark:text-white/[0.18]" />
    <rect x="56" y="4" width="44" height="9" rx="4" className="text-black/[0.06] dark:text-white/[0.08]" />
    <rect x="56" y="9" width="44" height="4" rx="0" className="text-black/[0.06] dark:text-white/[0.08]" />
    <line x1="64" y1="20" x2="92" y2="20" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="text-black/[0.08] dark:text-white/[0.08]" />
    <line x1="64" y1="27" x2="88" y2="27" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="text-black/[0.06] dark:text-white/[0.06]" />
    <line x1="64" y1="34" x2="90" y2="34" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="text-black/[0.08] dark:text-white/[0.08]" />
    <rect x="64" y="41" width="26" height="4" rx="1.5" className="text-amber-500/[0.12] dark:text-amber-400/[0.15]" fill="currentColor" />
    <path d="M52 35 L52 35" stroke="none" fill="none" />
    <path d="M50 35 Q54 28 58 32" fill="none" stroke="currentColor" strokeWidth="1.0" strokeDasharray="2 2" className="text-black/[0.10] dark:text-white/[0.12]" />
  </svg>
);

export const ContextIllustration: React.FC = () => (
  <svg width="112" height="64" viewBox="0 0 112 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="dark:opacity-80">
    <circle cx="56" cy="28" r="12" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-black/[0.16] dark:text-white/[0.18]" />
    <ellipse cx="56" cy="28" rx="5" ry="12" fill="none" stroke="currentColor" strokeWidth="0.9" className="text-black/[0.10] dark:text-white/[0.12]" />
    <line x1="44" y1="28" x2="68" y2="28" stroke="currentColor" strokeWidth="0.9" className="text-black/[0.10] dark:text-white/[0.12]" />
    <circle cx="18" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-blue-500/[0.25] dark:text-blue-400/[0.30]" />
    <path d="M14 10 L17 10 M20 7v6" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="text-blue-500/[0.30] dark:text-blue-400/[0.35]" />
    <line x1="25" y1="14" x2="44" y2="22" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2 3" className="text-black/[0.08] dark:text-white/[0.10]" />
    <circle cx="94" cy="14" r="7" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-teal-500/[0.25] dark:text-teal-400/[0.30]" />
    <rect x="89.5" y="10.5" width="3" height="3" rx="0.5" fill="currentColor" className="text-teal-500/[0.30] dark:text-teal-400/[0.35]" />
    <rect x="93.5" y="10.5" width="3" height="3" rx="0.5" fill="currentColor" className="text-teal-500/[0.30] dark:text-teal-400/[0.35]" />
    <rect x="89.5" y="14.5" width="3" height="3" rx="0.5" fill="currentColor" className="text-teal-500/[0.30] dark:text-teal-400/[0.35]" />
    <rect x="93.5" y="14.5" width="3" height="3" rx="0.5" fill="currentColor" className="text-teal-500/[0.30] dark:text-teal-400/[0.35]" />
    <line x1="87" y1="18" x2="68" y2="24" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2 3" className="text-black/[0.08] dark:text-white/[0.10]" />
    <circle cx="56" cy="56" r="7" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-emerald-500/[0.25] dark:text-emerald-400/[0.30]" />
    <path d="M53 56h2l0.5-3h1l0.5 3h2" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500/[0.30] dark:text-emerald-400/[0.35]" />
    <line x1="56" y1="40" x2="56" y2="49" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2 3" className="text-black/[0.08] dark:text-white/[0.10]" />
  </svg>
);

export const CollapsibleSection: React.FC<{
  title: string;
  meta?: number;
  testId?: string;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  isEmpty?: boolean;
}> = ({
  title,
  meta,
  collapsed,
  onToggle,
  children,
  isEmpty = false,
}) => {
  const sectionSizeClass = isEmpty && !collapsed ? 'flex-1 min-h-0' : 'shrink-0';
  const contentSizeClass = isEmpty && !collapsed ? 'flex-1 min-h-0' : '';

  return (
    <div className={`flex flex-col ${sectionSizeClass}`}>
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
        className="flex h-9 shrink-0 items-center justify-between px-3.5 cursor-pointer hover:bg-bg-hover select-none transition-colors duration-150 group"
        aria-label={collapsed ? `展开 ${title}` : `折叠 ${title}`}
        title={collapsed ? `展开 ${title}` : `折叠 ${title}`}
        aria-expanded={!collapsed}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <IconChevronRight
            size={13}
            className={`text-text-tertiary transition-transform duration-200 group-hover:text-text-secondary ${
              collapsed ? '' : 'rotate-90'
            }`}
          />
          <h3 className="truncate text-[13px] font-medium text-text-secondary group-hover:text-text-primary transition-colors">
            {title}
          </h3>
        </div>
        {typeof meta === 'number' && meta > 0 ? (
          <span className="shrink-0 text-[12px] text-text-tertiary">{meta}</span>
        ) : null}
      </div>
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          collapsed ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'
        } ${contentSizeClass}`}
        aria-hidden={collapsed}
        inert={collapsed ? true : undefined}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="flex h-full min-h-0 flex-col overflow-y-auto px-2 pb-3 custom-scrollbar">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export const TimelineTaskRow: React.FC<{
  task: Task;
  onClick: () => void;
}> = ({ task, onClick }) => {
  const isCompleted = task.status === 'completed';
  const isCancelled = task.status === 'cancelled';
  const isRunning = task.status === 'in_progress';
  const isMuted = isCompleted || isCancelled;

  const iconEl = isCompleted ? (
    <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-accent text-white">
      <IconCheck size={9} className="text-white stroke-[2.5]" />
    </span>
  ) : isCancelled ? (
    <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border border-hairline text-text-tertiary">
      <IconX size={8} className="text-current" />
    </span>
  ) : isRunning ? (
    <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border border-accent/40 bg-accent/[0.06] text-accent">
      <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
    </span>
  ) : (
    <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border border-hairline text-text-tertiary">
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-40" />
    </span>
  );

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isCompleted}
      aria-label={isCompleted ? `任务已完成：${task.title}` : `标记任务为完成：${task.title}`}
      className={`grid w-full grid-cols-[18px_minmax(0,1fr)] gap-2 rounded-[7px] border-none bg-transparent px-2.5 py-1.5 text-left transition-colors ${
        isCompleted ? 'cursor-default' : 'cursor-pointer hover:bg-bg-hover'
      }`}
    >
      <span className="flex min-h-[24px] items-start justify-center pt-0.5">{iconEl}</span>
      <span className="min-w-0 pb-1">
        <span className="flex min-w-0 items-start gap-2">
          <span className={`min-w-0 flex-1 break-words text-[12px] font-medium leading-snug ${isMuted ? 'text-text-secondary/80 line-through' : 'text-text-primary'}`}>
            {task.title}
          </span>
        </span>
        {task.description && !isMuted && (
          <span className="mt-1 line-clamp-2 block break-words text-[11px] leading-relaxed text-text-secondary/75">
            {task.description}
          </span>
        )}
      </span>
    </button>
  );
};

export type PlanUpdateToolItem = Extract<ToolItem, { kind: 'plan_update' }>;

const PLAN_STATUS_LABELS: Record<PlanUpdateItem['status'], string> = {
  pending: '待处理',
  in_progress: '进行中',
  completed: '已完成',
};

const PlanTimelineRow: React.FC<{
  item: PlanUpdateItem;
}> = ({ item }) => {
  const isCompleted = item.status === 'completed';
  const isRunning = item.status === 'in_progress';

  return (
    <div
      className="grid w-full grid-cols-1 rounded-[7px] px-2.5 py-1.5 text-left"
      title={`${PLAN_STATUS_LABELS[item.status]}：${item.step}`}
    >
      <span className="min-w-0 pb-1">
        <span
          className={[
            'block break-words text-[13px] leading-snug',
            isCompleted ? 'font-normal text-text-secondary/75 line-through' : '',
            isRunning ? 'font-normal text-text-primary' : '',
            item.status === 'pending' ? 'font-normal text-text-secondary' : '',
          ].join(' ')}
        >
          {item.step}
        </span>
      </span>
    </div>
  );
};

export const PlanTimeline: React.FC<{ planUpdate: PlanUpdateToolItem }> = ({ planUpdate }) => (
  <div className="min-w-0">
    {planUpdate.explanation && (
      <div className="px-3 pb-1.5 pt-1 line-clamp-2 break-words text-[11px] leading-relaxed text-text-secondary/75">
        {planUpdate.explanation}
      </div>
    )}
    {planUpdate.plan.length === 0 ? (
      <div className="px-3 pb-2 text-[12px] text-text-tertiary">暂无计划步骤</div>
    ) : (
      <div className="flex flex-col">
        {planUpdate.plan.map((item, index) => (
          <PlanTimelineRow
            key={`${item.status}-${index}-${item.step}`}
            item={item}
          />
        ))}
      </div>
    )}
  </div>
);

export const ChangedFileRow: React.FC<{
  file: { path: string; name: string; diff?: string; label: string; isNew: boolean };
  onClick: () => void;
}> = ({ file, onClick }) => {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const icon = getFileIcon(ext, file.name, 'shrink-0 grayscale contrast-125');

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-[7px] border-0 bg-transparent px-2.5 py-2 text-left transition-colors hover:bg-bg-hover group"
      title={file.path}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="shrink-0 flex items-center justify-center text-text-secondary dark:text-text-tertiary">
          {icon}
        </span>
        <span className="block truncate text-[13.5px] font-normal text-text-primary leading-relaxed">
          {file.name}
        </span>
      </div>
    </button>
  );
};

function truncateUrlMiddle(url: string, maxLen: number = 42): string {
  if (url.length <= maxLen) return url;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    const path = parsed.pathname;
    if (path.length <= 6) return `${host}${path}`;
    const start = path.slice(0, 8);
    const end = path.slice(-10);
    return `${host}${start}...${end}`;
  } catch {
    const half = Math.floor((maxLen - 1) / 2);
    return url.slice(0, half) + '...' + url.slice(-half);
  }
}

export const ExternalResourceRow: React.FC<{
  resource: { key: string; name: string; type: 'search' | 'skill' | 'mcp'; status: string; detail?: string };
}> = ({ resource }) => {
  let Icon = IconGlobe;

  if (resource.type === 'skill') {
    Icon = IconLayers;
  } else if (resource.type === 'mcp') {
    Icon = IconPlug;
  } else {
    Icon = IconGlobe;
  }

  const isUrl = resource.type === 'search' && resource.name.startsWith('http');
  const displayName = isUrl ? truncateUrlMiddle(resource.name) : resource.name;

  return (
    <div
      className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-bg-hover"
      title={resource.name}
    >
      <span className="shrink-0 flex items-center justify-center text-text-secondary dark:text-text-tertiary">
        <Icon size={16} className="text-current" />
      </span>
      <div className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-normal text-text-primary leading-relaxed">
          {displayName}
        </span>
      </div>
    </div>
  );
};
