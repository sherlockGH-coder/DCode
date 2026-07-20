import { app, BrowserWindow, nativeImage } from 'electron';
import { join } from 'node:path';

const WINDOW_CONFIG = {
  DEFAULT_WIDTH: 1000,
  DEFAULT_HEIGHT: 800,
  TITLE: 'DCode',
} as const;

export const TRAFFIC_LIGHT_POSITIONS = {
  expandedSidebar: { x: 20, y: 24 },
  collapsedSidebar: { x: 20, y: 14 },
} as const;

const windows = new Set<BrowserWindow>();

export function getMainWindow(): BrowserWindow | null {
  const firstWindow = windows.values().next().value as BrowserWindow | undefined;
  return firstWindow ?? BrowserWindow.getAllWindows()[0] ?? null;
}

export function createMainWindow(): BrowserWindow {
  const isMacOS = process.platform === 'darwin';
  const iconExtension = process.platform === 'darwin' ? 'icns' : 'png';
  const iconPath = join(app.getAppPath(), `resources/icon.${iconExtension}`);

  const win = new BrowserWindow({
    width: WINDOW_CONFIG.DEFAULT_WIDTH,
    height: WINDOW_CONFIG.DEFAULT_HEIGHT,
    title: WINDOW_CONFIG.TITLE,
    icon: iconPath,
    backgroundColor: isMacOS ? '#00000000' : '#F7F7F6',
    ...(isMacOS && {
      titleBarStyle: 'hidden',
      trafficLightPosition: TRAFFIC_LIGHT_POSITIONS.expandedSidebar,
      transparent: true,
      vibrancy: 'sidebar',
      visualEffectState: 'active',
    }),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  windows.add(win);
  win.on('closed', () => {
    windows.delete(win);
  });

  loadRenderer(win);
  bindMediaPermission(win);
  bindFullscreenEvents(win);

  return win;
}

export function ensureMainWindow(): void {
  const existing = getMainWindow();
  if (existing) {
    if (existing.isMinimized()) existing.restore();
    existing.show();
    existing.focus();
  } else {
    createMainWindow();
  }
}

export function setupDockIcon(): void {
  if (process.platform !== 'darwin') return;

  const icnsPath = join(app.getAppPath(), 'resources/icon.icns');
  const pngPath = join(app.getAppPath(), 'resources/icon.png');

  let image = nativeImage.createFromPath(icnsPath);
  if (image.isEmpty()) {
    image = nativeImage.createFromPath(pngPath);
  }

  if (!image.isEmpty()) {
    app.dock?.setIcon(image);
  }
}

function loadRenderer(win: BrowserWindow): void {
  const rendererUrl = process.env.ELECTRON_RENDERER_URL;
  if (rendererUrl && rendererUrl.trim()) {
    win.loadURL(rendererUrl);
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

function bindMediaPermission(win: BrowserWindow): void {
  win.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') {
      callback(webContents.id === win.webContents.id);
      return;
    }
    callback(false);
  });
}

function bindFullscreenEvents(win: BrowserWindow): void {
  win.on('enter-full-screen', () => {
    win.webContents.send('window:fullscreen-changed', true);
  });
  win.on('leave-full-screen', () => {
    win.webContents.send('window:fullscreen-changed', false);
  });
}
