import { app, protocol, net } from 'electron';
import { resolve, isAbsolute, join } from 'node:path';
import { pathToFileURL } from 'node:url';

protocol.registerSchemesAsPrivileged([
  { scheme: 'local-file', privileges: { secure: true, supportFetchAPI: true, stream: true } }
]);
import { statSync } from 'node:fs';
import { resolveLocalFileRequestPath } from './localFileProtocol';

import { resolveShellEnvironment } from './shellEnv';
import { projectManager } from './project';
import { settingsManager } from './settings';
import { mcpManager, registerMcpIpc } from './mcp';
import { taskManager, registerTaskIpc } from './tasks';
import {
  createMainWindow,
  ensureMainWindow,
  setupDockIcon,
} from './windowManager';

import { registerApprovalIpc } from './approvalService';
import { registerTerminalIpc, killAllTerminalSessions } from './terminalManager';
import { closeDatabase } from './database';
import { registerSkillsIpc } from './skills';
import { registerModelIpc } from './ipc/modelIpc';
import { registerChatIpc } from './ipc/chatIpc';
import { registerDbIpc } from './ipc/dbIpc';
import { registerCompactIpc } from './ipc/compactIpc';
import { registerProjectIpc, handleOpenFolder } from './ipc/projectIpc';
import { registerSettingsIpc } from './ipc/settingsIpc';
import { registerWindowIpc } from './ipc/windowIpc';
import { registerSpeechIpc } from './ipc/speechIpc';
import { registerPlanIpc } from './ipc/planIpc';
import { registerAgentsIpc } from './agents';
import { setupApplicationMenu } from './menu';
import { applyContentSecurityPolicy } from './security';
import { debugLog } from './debug';

const APP_NAME = 'DeepSeek';

app.setName(APP_NAME);

if (!app.isPackaged) {
  app.setName(`${APP_NAME}-Dev`);
  app.setPath('userData', process.env.DEEPSEEK_E2E_USER_DATA_DIR || join(app.getPath('appData'), `${APP_NAME}-Dev`));
}

const gotTheLock = app.isPackaged ? app.requestSingleInstanceLock() : true;
if (!gotTheLock) {
  app.quit();
} else {

  let folderToOpenOnStart: string | null = null;

  app.on('open-file', (event, path) => {
    event.preventDefault();
    debugLog('App', 'Received open-file event, path:', path);

    let targetDir = path;
    try {
      const stats = statSync(path);
      if (!stats.isDirectory()) {
        targetDir = resolve(path, '..');
      }

      if (app.isReady()) {
        safeRun('open folder', () => handleOpenFolder(targetDir));
        createMainWindow();
      } else {
        folderToOpenOnStart = targetDir;
      }
    } catch (err) {
      console.warn('[App] Failed to resolve open-file path:', path, err);
    }
  });

  app.on('second-instance', (event, argv, workingDirectory) => {
    debugLog('App', 'Received second-instance invocation, arguments:', argv);
    const win = createMainWindow();
    win.show();
    win.focus();

    const folderPath = parseFolderPathFromArgs(argv, workingDirectory);
    if (folderPath) {
      safeRun('open folder', () => handleOpenFolder(folderPath));
    }
  });

  resolveShellEnvironment();

  projectManager.load();
  settingsManager.load();

  registerApprovalIpc();
  registerTerminalIpc();
  registerSkillsIpc();
  registerModelIpc();
  registerChatIpc();
  registerDbIpc();
  registerCompactIpc();
  registerProjectIpc();
  registerSettingsIpc();
  registerSpeechIpc();
  registerPlanIpc();
  registerAgentsIpc();
  registerMcpIpc();
  registerTaskIpc();
  registerWindowIpc();

  void app.whenReady().then(() => {

    protocol.handle('local-file', (request) => {
      try {
        const filePath = resolveLocalFileRequestPath(request.url);
        if (!filePath) {
          return new Response('Local file access denied', { status: 403 });
        }
        return net.fetch(pathToFileURL(filePath).toString());
      } catch (err) {
        console.error('[Protocol] Failed to load local file:', err);
        return new Response('Error loading file', { status: 500 });
      }
    });

      // Install before creating windows or the first document cannot receive the CSP response header.
    applyContentSecurityPolicy();

    setupDockIcon();
    setupApplicationMenu();
    createMainWindow();

    if (folderToOpenOnStart) {
      // Capture the local constant first: safeRun callbacks run later and cannot access the narrowed type from the closure.
      const pendingFolder = folderToOpenOnStart;
      debugLog('App', 'App is ready; activating the cold-start pending path:', pendingFolder);
      safeRun('open folder', () => handleOpenFolder(pendingFolder));
      folderToOpenOnStart = null;
    }

    // MCP servers spawn child processes and task loading reads from disk; neither is required for the first frame.
    // Start both after creating the window to avoid competing with the renderer for CPU.
    const activeProject = projectManager.getState().activeProject;
    safeRun('mcp loadAll', () => mcpManager.loadAll(activeProject));
    safeRun('task loadAll', () => taskManager.loadAll(activeProject));
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', ensureMainWindow);

  app.on('before-quit', () => {
    safeRun('mcp stopAll', () => mcpManager.stopAll());
    // Reap PTY child processes and flush the WAL into the main database.
    try { killAllTerminalSessions(); } catch (err) { console.error('[App] terminal cleanup failed:', err); }
    try { closeDatabase(); } catch (err) { console.error('[App] database close failed:', err); }
  });
}

function safeRun(label: string, fn: () => Promise<unknown>): void {
  fn().catch((error: unknown) => {
    console.error(`[App] ${label} failed:`, error);
  });
}

function parseFolderPathFromArgs(argv: string[], workingDirectory: string): string | null {

  const args = argv.slice(1).filter((arg) => !arg.startsWith('-'));

  for (const arg of args) {
    try {
      const fullPath = isAbsolute(arg) ? arg : resolve(workingDirectory, arg);
      const stats = statSync(fullPath);
      if (stats.isDirectory()) {
        return fullPath;
      } else {
        return resolve(fullPath, '..');
      }
    } catch {}
  }
  return null;
}
