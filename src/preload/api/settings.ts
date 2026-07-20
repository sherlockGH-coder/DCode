import { ipcRenderer } from 'electron';
import type { AppSettings, AppSettingsPatch, FileOpenOption, FileOpenResult } from '../../shared/types';
import { subscribe } from '../bridge';

export const settingsApi = {
  /** 获取当前设置（API Key 仅返回已设/未设布尔值） */
  getSettings: (): Promise<AppSettings> => {
    return ipcRenderer.invoke('settings:get');
  },

  /** 部分更新设置（apiKeySet 除外） */
  patchSettings: (patch: AppSettingsPatch): Promise<AppSettings> => {
    return ipcRenderer.invoke('settings:patch', patch);
  },

  /** 独立设置 API Key（避免明文流经 patch 通道） */
  setApiKey: (plaintext: string): Promise<void> => {
    return ipcRenderer.invoke('settings:setApiKey', plaintext);
  },

  /** 独立设置指定 API 配置的 API Key（避免明文流经 patch 通道） */
  setApiProfileApiKey: (profileId: string, plaintext: string): Promise<void> => {
    return ipcRenderer.invoke('settings:setApiProfileApiKey', profileId, plaintext);
  },

  /** 独立设置 Tavily API Key */
  setTavilyApiKey: (plaintext: string): Promise<void> => {
    return ipcRenderer.invoke('settings:setTavilyApiKey', plaintext);
  },

  /** 独立设置语音输入 API Key */
  setSpeechApiKey: (plaintext: string): Promise<void> => {
    return ipcRenderer.invoke('settings:setSpeechApiKey', plaintext);
  },

  /** 独立设置图像识别 Vision API Key */
  setVisionApiKey: (plaintext: string): Promise<void> => {
    return ipcRenderer.invoke('settings:setVisionApiKey', plaintext);
  },

  /** 恢复默认设置（不动 API Key） */
  resetSettings: (): Promise<AppSettings> => {
    return ipcRenderer.invoke('settings:reset');
  },

  /** 获取数据库文件路径 */
  getDbPath: (): Promise<string> => {
    return ipcRenderer.invoke('settings:getDbPath');
  },

  /** 在系统文件管理器中打开数据库目录 */
  openDbDir: (): Promise<void> => {
    return ipcRenderer.invoke('settings:openDbDir');
  },

  /** 用系统默认应用打开文件 */
  openFile: (filePath: string): Promise<void> => {
    return ipcRenderer.invoke('file:open', filePath);
  },

  /** 获取可用打开方式 */
  getFileOpenOptions: (filePath: string): Promise<FileOpenOption[]> => {
    return ipcRenderer.invoke('file:getOpenOptions', filePath);
  },

  /** 选择打开方式打开文件 */
  openFileWith: (filePath: string, optionId: string): Promise<FileOpenResult> => {
    return ipcRenderer.invoke('file:openWith', filePath, optionId);
  },

  /** 订阅设置变化（其他窗口修改后同步） */
  onSettingsChanged: (callback: (settings: AppSettings) => void): (() => void) => {
    return subscribe('settings:changed', callback);
  },
};
