import { ipcRenderer } from 'electron';
import type { AppSettings, AppSettingsPatch, FileOpenOption, FileOpenResult } from '../../shared/types';
import { subscribe } from '../bridge';

export const settingsApi = {
  /** Get current settings; API keys are returned only as configured/unconfigured booleans. */
  getSettings: (): Promise<AppSettings> => {
    return ipcRenderer.invoke('settings:get');
  },

  /** Partially update settings, excluding apiKeySet. */
  patchSettings: (patch: AppSettingsPatch): Promise<AppSettings> => {
    return ipcRenderer.invoke('settings:patch', patch);
  },

  /** Set the API key separately so plaintext does not pass through the patch channel. */
  setApiKey: (plaintext: string): Promise<void> => {
    return ipcRenderer.invoke('settings:setApiKey', plaintext);
  },

  /** Set the API key for a specific API profile separately so plaintext does not pass through the patch channel. */
  setApiProfileApiKey: (profileId: string, plaintext: string): Promise<void> => {
    return ipcRenderer.invoke('settings:setApiProfileApiKey', profileId, plaintext);
  },

  /** Set the Tavily API key separately. */
  setTavilyApiKey: (plaintext: string): Promise<void> => {
    return ipcRenderer.invoke('settings:setTavilyApiKey', plaintext);
  },

  /** Set the voice-input API key separately. */
  setSpeechApiKey: (plaintext: string): Promise<void> => {
    return ipcRenderer.invoke('settings:setSpeechApiKey', plaintext);
  },

  /** Set the vision API key separately. */
  setVisionApiKey: (plaintext: string): Promise<void> => {
    return ipcRenderer.invoke('settings:setVisionApiKey', plaintext);
  },

  /** Restore default settings without changing API keys. */
  resetSettings: (): Promise<AppSettings> => {
    return ipcRenderer.invoke('settings:reset');
  },

  /** Get the database file path. */
  getDbPath: (): Promise<string> => {
    return ipcRenderer.invoke('settings:getDbPath');
  },

  /** Open the database directory in the system file manager. */
  openDbDir: (): Promise<void> => {
    return ipcRenderer.invoke('settings:openDbDir');
  },

  /** Open a file with the system default application. */
  openFile: (filePath: string): Promise<void> => {
    return ipcRenderer.invoke('file:open', filePath);
  },

  /** Get available open-with options. */
  getFileOpenOptions: (filePath: string): Promise<FileOpenOption[]> => {
    return ipcRenderer.invoke('file:getOpenOptions', filePath);
  },

  /** Open a file with a selected application. */
  openFileWith: (filePath: string, optionId: string): Promise<FileOpenResult> => {
    return ipcRenderer.invoke('file:openWith', filePath, optionId);
  },

  /** Subscribe to settings changes and sync updates from other windows. */
  onSettingsChanged: (callback: (settings: AppSettings) => void): (() => void) => {
    return subscribe('settings:changed', callback);
  },
};
