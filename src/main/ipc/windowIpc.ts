import { BrowserWindow, ipcMain } from 'electron';
import { homedir } from 'node:os';
import { createMainWindow, TRAFFIC_LIGHT_POSITIONS } from '../windowManager';

export function registerWindowIpc(): void {
  ipcMain.handle('window:homeDir', (): string => {
    return homedir();
  });

  ipcMain.handle('window:isFullScreen', (event): boolean => {
    return BrowserWindow.fromWebContents(event.sender)?.isFullScreen() ?? false;
  });

  ipcMain.handle('window:setTrafficLightPosition', (event, sidebarCollapsed: boolean): void => {
    if (process.platform !== 'darwin') return;

    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;

    const position = sidebarCollapsed
      ? TRAFFIC_LIGHT_POSITIONS.collapsedSidebar
      : TRAFFIC_LIGHT_POSITIONS.expandedSidebar;
    win.setWindowButtonPosition({ ...position });
  });

  ipcMain.handle('window:new', (): void => {
    const win = createMainWindow();
    win.show();
    win.focus();
  });
}
