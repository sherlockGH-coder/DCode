import { contextBridge, ipcRenderer } from 'electron';
import { subscribe } from './bridge';
import { chatApi } from './api/chat';
import { modelApi } from './api/model';
import { dbApi } from './api/db';
import { projectApi } from './api/project';
import { approvalApi } from './api/approval';
import { attachmentApi } from './api/attachment';
import { settingsApi } from './api/settings';
import { tasksApi } from './api/tasks';
import { skillsApi } from './api/skills';
import { mcpApi } from './api/mcp';
import { gitApi } from './api/git';
import { terminalApi } from './api/terminal';
import { planApi } from './api/plan';

contextBridge.exposeInMainWorld('electronEnv', {
  platform: process.platform,
  getHomeDir: () => ipcRenderer.invoke('window:homeDir') as Promise<string>,
  isFullScreen: () => ipcRenderer.invoke('window:isFullScreen'),
  setTrafficLightPosition: (sidebarCollapsed: boolean) => ipcRenderer.invoke('window:setTrafficLightPosition', sidebarCollapsed),
  openNewWindow: () => ipcRenderer.invoke('window:new'),
  onFullscreenChanged: (callback: (isFullScreen: boolean) => void) => {
    return subscribe('window:fullscreen-changed', callback);
  },
});

contextBridge.exposeInMainWorld('dcodeApi', {
  ...chatApi,
  ...modelApi,
  ...dbApi,
  ...projectApi,
  ...approvalApi,
  ...attachmentApi,
  ...settingsApi,
  ...tasksApi,
  ...skillsApi,
  ...mcpApi,
  ...gitApi,
  ...planApi,
});

contextBridge.exposeInMainWorld('conversationsApi', {
  /** 订阅对话列表变更（任务创建新对话时触发） */
  onChanged: (callback: () => void): (() => void) => {
    return subscribe('conversations:changed', callback);
  },
});

contextBridge.exposeInMainWorld('terminalApi', terminalApi);
