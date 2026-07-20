import { app, clipboard, ipcMain, BrowserWindow, dialog, nativeImage, shell } from 'electron';
import { mkdir, readFile, stat, readdir, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { settingsManager } from '../settings';
import * as db from '../database';
import { inferAttachmentFromPath } from '../attachments';
import { getFileOpenOptions, openResolvedPath } from '../fileOpenService';
import { invalidateModelCache } from './modelIpc';
import { IPC_EVENTS } from '../../shared/types';
import type { Attachment, AppSettingsPatch, FileOpenOption, FileOpenResult } from '../../shared/types';
import { projectManager } from '../project';
import { isPathInsideDir, resolveInside } from '../pathSandbox';
import { registerLocalFilePreviewPath, registerLocalFilePreviewPaths } from '../localFileProtocol';

function broadcastSettingsChanged(): void {
  const s = settingsManager.getPublic();
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(IPC_EVENTS.SETTINGS_CHANGED, s);
  }
}

async function findFileRecursively(dir: string, targetPath: string): Promise<string | null> {
  const IGNORE_DIRS = new Set(['node_modules', '.git', 'build', 'out', 'dist', '.ace-tool', 'release', '.DS_Store', 'node_modules', '.svelte-kit']);
  const cleanTarget = targetPath.replace(/\\/g, '/');
  const targetParts = cleanTarget.split('/');
  const targetFilename = targetParts[targetParts.length - 1];

  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isFile() && entry.name.toLowerCase() === targetFilename.toLowerCase()) {
        const absPath = join(dir, entry.name);
        const normalizedAbs = absPath.replace(/\\/g, '/');
        if (normalizedAbs.toLowerCase().endsWith(cleanTarget.toLowerCase())) {
          return absPath;
        }
      }
    }

    for (const entry of entries) {
      if (entry.isDirectory() && !IGNORE_DIRS.has(entry.name)) {
        const found = await findFileRecursively(join(dir, entry.name), targetPath);
        if (found) return found;
      }
    }
  } catch {

  }
  return null;
}

async function resolvePreviewPath(rawPath: string, activeProject: string | null): Promise<string | null> {
  const projectRoots = knownProjectRoots(activeProject);
  const { absolutePath } = resolveInside(rawPath, activeProject);

  try {
    await stat(absolutePath);
    return isInsideKnownProject(absolutePath, projectRoots) ? absolutePath : null;
  } catch {

  }

  if (isAbsolute(rawPath)) return null;

  for (const projectRoot of projectRoots) {
    const foundPath = await findFileRecursively(projectRoot, rawPath);
    if (foundPath && isInsideKnownProject(foundPath, [projectRoot])) return foundPath;
  }

  return null;
}

function knownProjectRoots(activeProject: string | null): string[] {
  return [
    ...(activeProject ? [activeProject] : []),
    ...projectManager.getState().projects
      .map((project) => project.path)
      .filter((projectPath) => projectPath !== activeProject),
  ];
}

function isInsideKnownProject(filePath: string, projectRoots: string[]): boolean {
  return projectRoots.some((projectRoot) => isPathInsideDir(filePath, projectRoot));
}

async function resolveFileForAction(filePath: string): Promise<string | null> {
  if (typeof filePath !== 'string' || !filePath.trim()) return null;
  const activeProject = projectManager.getState().activeProject;
  const projectPath = await resolvePreviewPath(filePath, activeProject);
  if (projectPath) return projectPath;

  if (!isAbsolute(filePath)) return null;
  try {
    const fileStat = await stat(filePath);
    return fileStat.isFile() ? filePath : null;
  } catch {
    return null;
  }
}

export function registerSettingsIpc(): void {
  ipcMain.handle('settings:get', () => {
    return settingsManager.getPublic();
  });

  ipcMain.handle('settings:patch', (_event, patch: AppSettingsPatch) => {
    const updated = settingsManager.patch(patch);
    invalidateModelCache();
    broadcastSettingsChanged();
    return updated;
  });

  ipcMain.handle('settings:setApiKey', (_event, plaintext: string) => {
    settingsManager.setApiKey(plaintext);
    invalidateModelCache();
    broadcastSettingsChanged();
  });

  ipcMain.handle('settings:setApiProfileApiKey', (_event, profileId: string, plaintext: string) => {
    settingsManager.setApiKeyForProfile(profileId, plaintext);
    invalidateModelCache();
    broadcastSettingsChanged();
  });

  ipcMain.handle('settings:setTavilyApiKey', (_event, plaintext: string) => {
    settingsManager.setTavilyApiKey(plaintext);
    broadcastSettingsChanged();
  });

  ipcMain.handle('settings:setSpeechApiKey', (_event, plaintext: string) => {
    settingsManager.setSpeechApiKey(plaintext);
    broadcastSettingsChanged();
  });

  ipcMain.handle('settings:setVisionApiKey', (_event, plaintext: string) => {
    settingsManager.setVisionApiKey(plaintext);
    broadcastSettingsChanged();
  });

  ipcMain.handle('settings:reset', () => {
    const updated = settingsManager.reset();
    invalidateModelCache();
    broadcastSettingsChanged();
    return updated;
  });

  ipcMain.handle('settings:openDbDir', async () => {
    await shell.openPath(db.getDbDir());
  });

  ipcMain.handle('settings:getDbPath', () => {
    return db.getDbPath();
  });

  ipcMain.handle('clipboard:pasteImage', async (): Promise<Attachment | null> => {
    const image = clipboard.readImage();
    if (image.isEmpty()) return null;

    const pngBuffer = image.toPNG();
    if (!pngBuffer || pngBuffer.length === 0) return null;

    const dir = join(app.getPath('userData'), 'clipboard-images');
    await mkdir(dir, { recursive: true });

    const filePath = join(dir, `${randomUUID()}.png`);
    await writeFile(filePath, pngBuffer);

    const attachment = await inferAttachmentFromPath(filePath);
    if (attachment) registerLocalFilePreviewPath(attachment.path);
    return attachment;
  });

  ipcMain.handle('dialog:openFiles', async (): Promise<Attachment[]> => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      title: '选择要附加的文件',
    });
    if (result.canceled || result.filePaths.length === 0) return [];
    const attachments = await Promise.all(
      result.filePaths.map((p) => inferAttachmentFromPath(p)),
    );
    const filtered = attachments.filter((a): a is Attachment => a !== null);
    registerLocalFilePreviewPaths(filtered.map((attachment) => attachment.path));
    return filtered;
  });

  ipcMain.handle('fs:statPath', async (_event, rawPath: string): Promise<Attachment | null> => {
    if (typeof rawPath !== 'string' || rawPath.trim() === '') return null;
    const attachment = await inferAttachmentFromPath(rawPath);
    if (attachment) registerLocalFilePreviewPath(attachment.path);
    return attachment;
  });

  ipcMain.handle('file:open', async (_event, filePath: string) => {
    const finalPath = await resolveFileForAction(filePath);
    if (!finalPath) throw new Error('文件不存在，或不在已注册项目范围内。');
    const result = await openResolvedPath(finalPath, 'default');
    if (!result.success) throw new Error(result.error);
  });

  ipcMain.handle('file:getOpenOptions', async (_event, filePath: string): Promise<FileOpenOption[]> => {
    const finalPath = await resolveFileForAction(filePath);
    if (!finalPath) return [];
    return getFileOpenOptions(finalPath);
  });

  ipcMain.handle('file:openWith', async (_event, filePath: string, optionId: string): Promise<FileOpenResult> => {
    const finalPath = await resolveFileForAction(filePath);
    if (!finalPath) {
      return { success: false, target: 'default', error: '文件不存在，或不在已注册项目范围内。' };
    }
    return openResolvedPath(finalPath, optionId);
  });

  ipcMain.handle('fs:readFile', async (_event, filePath: string): Promise<{ content: string; name: string; path: string } | null> => {
    if (typeof filePath !== 'string' || !filePath.trim()) return null;
    try {
      const activeProject = projectManager.getState().activeProject;
      const finalPath = await resolvePreviewPath(filePath, activeProject);
      if (!finalPath) return null;

      const content = await readFile(finalPath, 'utf-8');
      const name = finalPath.split('/').pop() || finalPath;
      return { content, name, path: finalPath };
    } catch {
      return null;
    }
  });
}
