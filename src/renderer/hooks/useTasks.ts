import { useState, useEffect, useCallback } from 'react';
import type { Task, TaskInput, TaskUpdateInput, TaskStatus, TaskScope } from '../../shared/types';

interface UseTasksResult {
  tasks: Task[];
  isLoading: boolean;
  refresh: () => Promise<void>;
  create: (scope: TaskScope, input: TaskInput) => Promise<Task | undefined>;
  update: (id: string, input: TaskUpdateInput) => Promise<Task | undefined>;
  remove: (id: string) => Promise<boolean>;
}

export function useTasks(projectPath: string | null, conversationId: string | null): UseTasksResult {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const list = await window.deepseekApi.taskList(undefined, undefined, conversationId);
      setTasks(list);
    } catch (err) {
      console.error('[useTasks] failed to list tasks:', err);
    } finally {
      setIsLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    setIsLoading(true);
    refresh();
    const unsub = window.deepseekApi.onTasksChanged(() => {
      refresh();
    });
    return unsub;
  }, [refresh, projectPath, conversationId]);

  const create = useCallback(
    async (scope: TaskScope, input: TaskInput) => {
      const result = await window.deepseekApi.taskCreate(scope, input, projectPath);
      await refresh();
      return result;
    },
    [projectPath, refresh],
  );

  const update = useCallback(
    async (id: string, input: TaskUpdateInput) => {
      const result = await window.deepseekApi.taskUpdate(id, input, projectPath);
      await refresh();
      return result;
    },
    [projectPath, refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      const result = await window.deepseekApi.taskDelete(id, projectPath);
      await refresh();
      return result;
    },
    [projectPath, refresh],
  );

  return { tasks, isLoading, refresh, create, update, remove };
}
