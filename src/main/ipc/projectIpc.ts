import { ipcMain, BrowserWindow } from 'electron';
import { projectManager } from '../project';
import { mcpManager } from '../mcp';
import { taskManager } from '../tasks';
import { IPC_EVENTS } from '../../shared/types';
import { undoChanges } from '../changeUndoService';
import {
  checkoutGitBranch,
  commitGitChanges,
  getGitBranches,
  getGitChangedFiles,
  getGitCommitStatus,
  getGitFileDiff,
  pushGitChanges,
  resolveRegisteredProjectPath,
} from '../gitService';
import type { ChangeUndoEntry, ProjectCreateInput } from '../../shared/types';

function broadcastProjectChanged(): void {
  const state = projectManager.getState();
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(IPC_EVENTS.PROJECT_CHANGED, state);
  }
}

export function registerProjectIpc(): void {
  ipcMain.handle('project:getState', () => {
    return projectManager.getState();
  });

  ipcMain.handle('project:add', async (_event, folderPath?: string) => {
    const result = folderPath
      ? await projectManager.addProject(folderPath)
      : await projectManager.selectAndAddProject();
    if (result) broadcastProjectChanged();
    return result;
  });

  ipcMain.handle('project:pickParentDirectory', async () => {
    return projectManager.selectProjectParentDirectory();
  });

  ipcMain.handle('project:create', async (_event, input: ProjectCreateInput) => {
    const result = await projectManager.createProject(input);
    broadcastProjectChanged();
    return result;
  });

  ipcMain.handle('project:remove', (_event, folderPath: string) => {
    const ok = projectManager.removeProject(folderPath);
    if (ok) broadcastProjectChanged();
    return ok;
  });

  ipcMain.handle('project:setActive', (_event, folderPath: string | null) => {
    const ok = projectManager.setActiveProject(folderPath);
    if (ok) {
      mcpManager.refreshForProject(folderPath ?? null).catch((err) => {
        console.warn('[mcp] refreshForProject 失败:', err);
      });
      taskManager.refreshForProject(folderPath ?? null).catch((err) => {
        console.warn('[tasks] refreshForProject 失败:', err);
      });
      broadcastProjectChanged();
    }
    return ok;
  });

  ipcMain.handle('git:getBranches', async (_event, folderPath: string) => {
    const projectPath = resolveGitProjectPath(folderPath);
    if (!projectPath) return null;
    return getGitBranches(projectPath);
  });

  ipcMain.handle('git:checkoutBranch', async (_event, folderPath: string, branch: string) => {
    const projectPath = resolveGitProjectPath(folderPath);
    if (!projectPath) return { success: false, error: '项目路径未注册。' };
    return checkoutGitBranch(projectPath, branch);
  });

  ipcMain.handle('git:getChangedFiles', async (_event, folderPath: string) => {
    const projectPath = resolveGitProjectPath(folderPath);
    if (!projectPath) return { files: [], hasGit: false };
    return getGitChangedFiles(projectPath);
  });

  ipcMain.handle('git:getFileDiff', async (_event, folderPath: string, file: string) => {
    const projectPath = resolveGitProjectPath(folderPath);
    if (!projectPath) return '';

    return getGitFileDiff(projectPath, file);
  });

  ipcMain.handle('git:getCommitStatus', async (_event, folderPath: string) => {
    const projectPath = resolveGitProjectPath(folderPath);
    if (!projectPath) {
      return {
        hasGit: false,
        branch: '',
        additions: 0,
        deletions: 0,
        hasChanges: false,
        hasStagedChanges: false,
        hasUnstagedChanges: false,
        aheadCount: 0,
        hasRemote: false,
        hasUpstream: false,
      };
    }
    return getGitCommitStatus(projectPath);
  });

  ipcMain.handle('git:commit', async (_event, folderPath: string, message: string, includeUnstaged: boolean) => {
    const projectPath = resolveGitProjectPath(folderPath);
    if (!projectPath) return { success: false, error: '项目路径未注册。' };
    return commitGitChanges(projectPath, message, includeUnstaged);
  });

  ipcMain.handle('git:push', async (_event, folderPath: string) => {
    const projectPath = resolveGitProjectPath(folderPath);
    if (!projectPath) return { success: false, error: '项目路径未注册。' };
    return pushGitChanges(projectPath);
  });

  ipcMain.handle('changes:undo', async (_event, entries: ChangeUndoEntry[]) => {
    return undoChanges(entries);
  });
}

function resolveGitProjectPath(folderPath: string): string | null {
  return resolveRegisteredProjectPath(folderPath, projectManager.getState().projects);
}

export async function handleOpenFolder(folderPath: string): Promise<void> {
  const result = await projectManager.addProject(folderPath);
  if (result) {
    projectManager.setActiveProject(folderPath);
    mcpManager.refreshForProject(folderPath).catch((err) => {
      console.warn('[mcp] refreshForProject 失败:', err);
    });
    taskManager.refreshForProject(folderPath).catch((err) => {
      console.warn('[tasks] refreshForProject 失败:', err);
    });
    broadcastProjectChanged();
  }
}
