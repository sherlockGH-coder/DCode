import React, { useEffect, useRef, useState } from 'react';
import type { Message } from '../../shared/types';
import { useConversationTodos } from '../hooks/useConversationTodos';
import { IconCheck } from './icons';

interface TaskProgressAccessoryProps {
  activeConversationId: string | null;
  activeProject: string | null;
  messages: Message[];
  isAgentRunning: boolean;
}

interface CompletedSnapshot {
  total: number;
}

const COMPLETION_VISIBLE_MS = 1800;

const Spinner: React.FC = () => (
  <svg
    className="animate-[ai-micro-spin_0.9s_linear_infinite]"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden
  >
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

const CompletedIcon: React.FC = () => (
  <span
    data-todo-status="completed"
    className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-border-strong text-text-primary"
  >
    <IconCheck size={10} className="shrink-0 text-current" />
  </span>
);

const TodoStatusIcon: React.FC<{ status: string }> = ({ status }) => {
  if (status === 'completed') return <CompletedIcon />;
  if (status === 'in_progress') {
    return (
      <span
        data-todo-status="in_progress"
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-text-secondary"
      >
        <Spinner />
      </span>
    );
  }
  return (
    <span
      data-todo-status="pending"
      className="h-4 w-4 shrink-0 rounded-full border border-border-strong"
    />
  );
};

const TaskProgressAccessory: React.FC<TaskProgressAccessoryProps> = ({
  activeConversationId,
  activeProject,
  messages,
  isAgentRunning,
}) => {
  const { todos, completedCount, hasActiveTodo } = useConversationTodos(
    activeProject,
    activeConversationId,
    messages,
  );
  const [expanded, setExpanded] = useState(false);
  const [completedSnapshot, setCompletedSnapshot] = useState<CompletedSnapshot | null>(null);
  const previousHadActiveTodo = useRef(false);
  const previousTotal = useRef(0);

  useEffect(() => {
    setExpanded(false);
    setCompletedSnapshot(null);
    previousHadActiveTodo.current = false;
    previousTotal.current = 0;
  }, [activeConversationId]);

  useEffect(() => {
    let hideTimer: number | undefined;

    if (hasActiveTodo) {
      previousHadActiveTodo.current = true;
      previousTotal.current = todos.length;
      setCompletedSnapshot(null);
    } else if (previousHadActiveTodo.current && previousTotal.current > 0) {
      previousHadActiveTodo.current = false;
      setExpanded(false);
      setCompletedSnapshot({ total: previousTotal.current });
      hideTimer = window.setTimeout(() => setCompletedSnapshot(null), COMPLETION_VISIBLE_MS);
    }

    return () => {
      if (hideTimer !== undefined) window.clearTimeout(hideTimer);
    };
  }, [hasActiveTodo, todos.length]);

  if (!hasActiveTodo && !completedSnapshot) return null;

  if (completedSnapshot) {
    return (
      <div
        data-testid="task-progress-complete"
        className="inline-flex min-h-8 items-center gap-2 rounded-full border border-hairline bg-bg-main px-3.5 py-1.5 text-[12px] shadow-card"
      >
        <CompletedIcon />
        <span className="tabular-nums text-text-secondary">
          步骤 {completedSnapshot.total} / {completedSnapshot.total}
        </span>
      </div>
    );
  }

  return (
    <div
      data-testid="task-progress-accessory"
      className="relative inline-flex"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      <div
        data-testid="task-progress-panel"
        className={`pointer-events-none absolute bottom-full left-1/2 z-40 mb-2 w-[min(340px,80vw)] -translate-x-1/2 rounded-[14px] border border-hairline bg-bg-main shadow-floating transition-[opacity,transform] duration-200 ease-[var(--ease-standard)] ${
          expanded ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'
        }`}
        aria-hidden={!expanded}
        inert={!expanded ? true : undefined}
        style={{ pointerEvents: expanded ? 'auto' : 'none' }}
      >
        <div className="max-h-[min(320px,50vh)] overflow-y-auto px-3.5 py-2 custom-scrollbar">
          {todos.map((item) => (
            <div key={item.id} className="grid grid-cols-[16px_minmax(0,1fr)] items-start gap-2.5 py-1.5">
              <span className="flex h-[18px] w-4 items-center justify-center text-text-secondary">
                <TodoStatusIcon status={item.status} />
              </span>
              <span
                className={`min-w-0 break-words text-[12px] leading-relaxed ${
                  item.status === 'completed'
                    ? 'text-text-tertiary'
                    : item.status === 'in_progress'
                      ? 'text-text-primary'
                      : 'text-text-secondary'
                }`}
              >
                {item.title}
              </span>
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        className="inline-flex min-h-8 items-center gap-2 rounded-full border border-hairline bg-bg-main px-3.5 py-1.5 text-left shadow-card transition-colors duration-150 hover:bg-bg-hover"
        aria-label={expanded ? '收起待办事项' : '展开待办事项'}
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
        onFocus={() => setExpanded(true)}
        onBlur={() => setExpanded(false)}
      >
        <span className="flex h-4 w-4 shrink-0 items-center justify-center text-text-secondary">
          {isAgentRunning ? <Spinner /> : <span className="h-1.5 w-1.5 rounded-full bg-text-tertiary" />}
        </span>
        <span className="shrink-0 text-[12px] tabular-nums text-text-secondary">
          步骤 {completedCount} / {todos.length}
        </span>
      </button>
    </div>
  );
};

export default React.memo(TaskProgressAccessory);
