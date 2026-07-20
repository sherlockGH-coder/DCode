import { useMemo } from 'react';
import type { Message, PlanUpdateItem, TaskStatus, ToolItem } from '../../shared/types';
import { extractToolItems } from '../utils/tool-pipeline/extractToolItems';
import { useTasks } from './useTasks';

export type ConversationTodoStatus = PlanUpdateItem['status'];

export interface ConversationTodoItem {
  id: string;
  title: string;
  description?: string;
  status: ConversationTodoStatus;
  source: 'plan' | 'task';
}

export type PlanUpdateToolItem = Extract<ToolItem, { kind: 'plan_update' }>;

const isResolved = (status: ConversationTodoStatus): boolean =>
  status === 'completed';

export function useConversationTodos(
  activeProject: string | null,
  activeConversationId: string | null,
  messages: Message[],
) {
  const tasksApi = useTasks(activeProject, activeConversationId);

  const sessionTasks = useMemo(() => {
    if (!activeConversationId) return [];
    return tasksApi.tasks.filter((task) => task.conversationId === activeConversationId);
  }, [activeConversationId, tasksApi.tasks]);

  const latestPlanUpdate = useMemo<PlanUpdateToolItem | null>(() => {
    const toolItems = extractToolItems(messages);
    for (let index = toolItems.length - 1; index >= 0; index -= 1) {
      const item = toolItems[index];
      if (item.kind === 'plan_update') return item;
    }
    return null;
  }, [messages]);

  const sortedSessionTasks = useMemo(() => {
    const order: Record<TaskStatus, number> = {
      in_progress: 0,
      pending: 1,
      completed: 2,
      cancelled: 3,
    };
    return [...sessionTasks].sort((left, right) => order[left.status] - order[right.status]);
  }, [sessionTasks]);

  const todos = useMemo<ConversationTodoItem[]>(() => {
    const planTodos = (latestPlanUpdate?.plan ?? []).map((item, index) => ({
      id: `plan-${index}-${item.step}`,
      title: item.step,
      status: item.status,
      source: 'plan' as const,
    }));
    const taskTodos = sortedSessionTasks.flatMap((task) => (
      task.status === 'cancelled'
        ? []
        : [{
            id: `task-${task.id}`,
            title: task.title,
            description: task.description || undefined,
            status: task.status,
            source: 'task' as const,
          }]
    ));
    return [...planTodos, ...taskTodos];
  }, [latestPlanUpdate, sortedSessionTasks]);

  const activeTodo = todos.find((item) => item.status === 'in_progress')
    ?? todos.find((item) => item.status === 'pending')
    ?? null;
  const completedCount = todos.filter((item) => isResolved(item.status)).length;

  return {
    ...tasksApi,
    latestPlanUpdate,
    sessionTasks,
    sortedSessionTasks,
    todos,
    activeTodo,
    completedCount,
    hasActiveTodo: activeTodo !== null,
  };
}
