import React from 'react';
import {
  IconChevronRight,
} from './icons';
import { collapsePath } from '../utils/collapsePath';
import type { Task, TaskStatus } from '../../shared/types';

export const TASK_GROUPS: Array<{ status: TaskStatus; title: string }> = [
  { status: 'in_progress', title: '正在执行' },
  { status: 'pending', title: '待处理' },
  { status: 'completed', title: '已完成' },
  { status: 'cancelled', title: '已取消' },
];

export function cleanDirectory(path: string): string {
  const collapsed = collapsePath(path);
  const clean = collapsed.startsWith('./')
    ? collapsed.slice(2)
    : collapsed.startsWith('~/')
      ? collapsed.slice(2)
      : collapsed;
  const idx = clean.lastIndexOf('/');
  return idx === -1 ? '' : clean.slice(0, idx);
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function summarize(tasks: Task[]) {
  return {
    total: tasks.length,
    pending: tasks.filter((task) => task.status === 'pending').length,
    inProgress: tasks.filter((task) => task.status === 'in_progress').length,
    completed: tasks.filter((task) => task.status === 'completed').length,
    cancelled: tasks.filter((task) => task.status === 'cancelled').length,
  };
}

export const EmptyState: React.FC<{
  illustration: React.ReactNode;
  title: string;
  description: string;
}> = ({ illustration, title, description }) => (
  <div className="flex h-full min-h-0 flex-col items-center justify-center px-5 py-6 text-center select-none">
    <div className="mb-4 flex items-center justify-center text-text-tertiary/40">
      {illustration}
    </div>
    <div className="text-[12.5px] font-bold text-text-secondary">{title}</div>
    <div className="mt-1 max-w-[240px] text-[11px] leading-relaxed text-text-tertiary">{description}</div>
  </div>
);

export const SectionHeader: React.FC<{ title: string; count?: number; action?: React.ReactNode }> = ({ title, count, action }) => (
  <div className="flex h-9 items-center justify-between border-b border-border/50 px-3.5">
    <div className="flex min-w-0 items-center gap-2">
      <span className="truncate text-[11px] font-bold uppercase text-text-tertiary">{title}</span>
      {count !== undefined && (
        <span className="rounded bg-black/[0.045] px-1.5 py-0.5 text-[10px] font-semibold text-text-tertiary">
          {count}
        </span>
      )}
    </div>
    {action}
  </div>
);

export const TaskRow: React.FC<{
  task: Task;
  selected?: boolean;
  mode: 'complete' | 'select';
  density?: 'normal' | 'compact';
  onClick: () => void;
}> = ({ task, selected = false, mode, density = 'normal', onClick }) => {
  const muted = task.status === 'completed' || task.status === 'cancelled';
  const label = mode === 'complete' ? `标记任务为完成：${task.title}` : `查看任务详情：${task.title}`;
  const rowPadding = density === 'compact' ? 'px-3.5 py-2.5' : 'px-3.5 py-3';
  const isCompleteModeDisabled = mode === 'complete' && muted;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isCompleteModeDisabled}
      aria-label={label}
      aria-pressed={mode === 'select' ? selected : undefined}
      className={`group grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-2.5 border-none bg-transparent ${rowPadding} text-left transition-colors focus:outline-none focus:ring-2 focus:ring-accent/30 ${
        selected ? 'bg-accent/[0.055]' : 'hover:bg-black/[0.025]'
      } ${isCompleteModeDisabled ? 'cursor-default' : 'cursor-pointer'}`}
    >
      <span className="min-w-0">
        <span className={`block break-words text-[12.5px] font-semibold leading-snug ${muted ? 'text-text-tertiary line-through' : 'text-text-primary'}`}>
          {task.title}
        </span>
        {task.description && !muted && (
          <span className="mt-1 line-clamp-2 block break-words text-[11px] leading-relaxed text-text-secondary/75">
            {task.description}
          </span>
        )}
        {(task.blockedBy.length > 0 || task.isBackground) && !muted && (
          <span className="mt-1.5 flex flex-wrap gap-1.5">
            {task.blockedBy.length > 0 && <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">等待 {task.blockedBy.length} 项</span>}
            {task.isBackground && <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">后台</span>}
          </span>
        )}
      </span>
      {mode === 'complete' && <IconChevronRight size={13} className="mt-0.5 text-text-tertiary/45 opacity-0 transition-opacity group-hover:opacity-100" />}
    </button>
  );
};
