import { ipcMain } from 'electron';
import { taskManager } from './manager';
import { resolveKnownProjectPath } from '../projectScope';
import type { TaskInput, TaskUpdateInput, TaskStatus, TaskScope } from '../../shared/types';

export { taskManager } from './manager';

export function registerTaskIpc(): void {
  ipcMain.handle('task:create', (_event, scope: TaskScope, input: TaskInput, projectPath: string | null, conversationId?: string | null) => {
    return taskManager.create(scope, input, resolveScopeProjectPath(scope, projectPath), conversationId) ?? undefined;
  });

  ipcMain.handle('task:get', (_event, id: string) => {
    return taskManager.get(id) ?? undefined;
  });

  ipcMain.handle('task:list', (_event, status?: TaskStatus, scope?: TaskScope, conversationId?: string | null) => {
    return taskManager.list(status, scope, conversationId);
  });

  ipcMain.handle('task:update', (_event, id: string, input: TaskUpdateInput, projectPath: string | null) => {
    return taskManager.update(id, input, resolveKnownProjectPath(projectPath)) ?? undefined;
  });

  ipcMain.handle('task:delete', (_event, id: string, projectPath: string | null) => {
    return taskManager.remove(id, resolveKnownProjectPath(projectPath));
  });
}

function resolveScopeProjectPath(scope: TaskScope, projectPath: string | null): string | null {
  return scope === 'project' ? resolveKnownProjectPath(projectPath) : null;
}
