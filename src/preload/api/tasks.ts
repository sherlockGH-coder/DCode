import { ipcRenderer } from 'electron';
import type { Task, TaskInput, TaskUpdateInput, TaskStatus, TaskScope } from '../../shared/types';
import { subscribe } from '../bridge';

export const tasksApi = {
  taskCreate: (scope: TaskScope, input: TaskInput, projectPath: string | null, conversationId?: string | null): Promise<Task | undefined> => {
    return ipcRenderer.invoke('task:create', scope, input, projectPath, conversationId);
  },

  /** Get one task. */
  taskGet: (id: string): Promise<Task | undefined> => {
    return ipcRenderer.invoke('task:get', id);
  },

  /** List tasks. */
  taskList: (status?: TaskStatus, scope?: TaskScope, conversationId?: string | null): Promise<Task[]> => {
    return ipcRenderer.invoke('task:list', status, scope, conversationId);
  },

  /** Update a task. */
  taskUpdate: (id: string, input: TaskUpdateInput, projectPath: string | null): Promise<Task | undefined> => {
    return ipcRenderer.invoke('task:update', id, input, projectPath);
  },

  /** Delete a task. */
  taskDelete: (id: string, projectPath: string | null): Promise<boolean> => {
    return ipcRenderer.invoke('task:delete', id, projectPath);
  },

  /** Subscribe to task-list changes. */
  onTasksChanged: (callback: () => void): (() => void) => {
    return subscribe('task:changed', callback);
  },
};
