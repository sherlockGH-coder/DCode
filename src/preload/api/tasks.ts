import { ipcRenderer } from 'electron';
import type { Task, TaskInput, TaskUpdateInput, TaskStatus, TaskScope } from '../../shared/types';
import { subscribe } from '../bridge';

export const tasksApi = {
  taskCreate: (scope: TaskScope, input: TaskInput, projectPath: string | null, conversationId?: string | null): Promise<Task | undefined> => {
    return ipcRenderer.invoke('task:create', scope, input, projectPath, conversationId);
  },

  /** 获取单个任务 */
  taskGet: (id: string): Promise<Task | undefined> => {
    return ipcRenderer.invoke('task:get', id);
  },

  /** 列出任务 */
  taskList: (status?: TaskStatus, scope?: TaskScope, conversationId?: string | null): Promise<Task[]> => {
    return ipcRenderer.invoke('task:list', status, scope, conversationId);
  },

  /** 更新任务 */
  taskUpdate: (id: string, input: TaskUpdateInput, projectPath: string | null): Promise<Task | undefined> => {
    return ipcRenderer.invoke('task:update', id, input, projectPath);
  },

  /** 删除任务 */
  taskDelete: (id: string, projectPath: string | null): Promise<boolean> => {
    return ipcRenderer.invoke('task:delete', id, projectPath);
  },

  /** 订阅任务列表变化 */
  onTasksChanged: (callback: () => void): (() => void) => {
    return subscribe('task:changed', callback);
  },
};
