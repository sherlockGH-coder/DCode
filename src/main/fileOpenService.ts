import { app as electronApp, nativeImage, shell } from 'electron';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, stat } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import { promisify } from 'node:util';
import type { FileOpenOption, FileOpenResult } from '../shared/types';

interface AppCandidate {
  id: string;
  name: string;
  bundleNames: string[];
  extraPaths?: string[];
  opensDirectory?: boolean;
}

interface ResolvedFileOpenOption extends FileOpenOption {
  appPath?: string;
}

const execFileAsync = promisify(execFile);
const APP_SCAN_DEPTH = 2;
const EDITOR_OPTION_IDS = new Set(['app:vscode', 'app:cursor', 'app:zed']);
const iconCache = new Map<string, string | undefined>();

const APP_CANDIDATES: AppCandidate[] = [
  { id: 'vscode', name: 'VS Code', bundleNames: ['Visual Studio Code.app'] },
  { id: 'cursor', name: 'Cursor', bundleNames: ['Cursor.app'] },
  { id: 'zed', name: 'Zed', bundleNames: ['Zed.app'] },
  {
    id: 'terminal',
    name: 'Terminal',
    bundleNames: ['Terminal.app'],
    extraPaths: ['/System/Applications/Utilities/Terminal.app', '/Applications/Utilities/Terminal.app'],
    opensDirectory: true,
  },
  { id: 'iterm2', name: 'iTerm2', bundleNames: ['iTerm.app', 'iTerm2.app'], opensDirectory: true },
  { id: 'warp', name: 'Warp', bundleNames: ['Warp.app'], opensDirectory: true },
  { id: 'xcode', name: 'Xcode', bundleNames: ['Xcode.app'] },
  { id: 'intellij-idea', name: 'IntelliJ IDEA', bundleNames: ['IntelliJ IDEA.app'] },
  { id: 'goland', name: 'GoLand', bundleNames: ['GoLand.app'] },
  { id: 'webstorm', name: 'WebStorm', bundleNames: ['WebStorm.app'] },
  { id: 'pycharm', name: 'PyCharm', bundleNames: ['PyCharm.app'] },
  { id: 'trae', name: 'Trae', bundleNames: ['Trae.app'] },
  { id: 'kiro', name: 'Kiro', bundleNames: ['Kiro.app'] },
];

export async function getFileOpenOptions(finalPath: string): Promise<FileOpenOption[]> {
  const resolvedOptions = await resolveFileOpenOptions(finalPath);
  return resolvedOptions.map(({ appPath, ...option }) => option);
}

export async function openResolvedPath(finalPath: string, optionId: string): Promise<FileOpenResult> {
  if (optionId === 'default') return openDefault(finalPath);
  if (optionId === 'reveal') return revealFile(finalPath);

  const option = (await resolveFileOpenOptions(finalPath)).find((item) => item.id === optionId);
  if (!option || option.target !== 'app' || !option.appPath) {
    return openFailure('app', '打开方式不可用。');
  }

  if (process.platform !== 'darwin') {
    return openFailure('app', `${option.name} 打开方式当前仅支持 macOS。`, option.name);
  }

  const targetPath = option.opensDirectory ? dirname(finalPath) : finalPath;
  try {
    await execFileAsync('open', ['-a', option.appPath, targetPath]);
    return { success: true, target: 'app', name: option.name };
  } catch (err) {
    return openFailure('app', formatExecError(err, option.name), option.name);
  }
}

async function resolveFileOpenOptions(finalPath: string): Promise<ResolvedFileOpenOption[]> {
  const defaultOption = await createDefaultOption(finalPath);
  if (process.platform !== 'darwin') return [defaultOption];

  const appIndex = await createAppIndex();
  const appOptions = await Promise.all(
    APP_CANDIDATES.map((candidate) => resolveAppOption(candidate, appIndex)),
  );
  const installedOptions = appOptions.filter((option): option is ResolvedFileOpenOption => option !== null);
  const editorOptions = installedOptions.filter((option) => EDITOR_OPTION_IDS.has(option.id));
  const otherOptions = installedOptions.filter((option) => !EDITOR_OPTION_IDS.has(option.id));
  return editorOptions.length > 0
    ? [...editorOptions, defaultOption, ...otherOptions]
    : [defaultOption, ...otherOptions];
}

async function createDefaultOption(finalPath: string): Promise<ResolvedFileOpenOption> {
  return {
    id: 'default',
    name: 'Default app',
    target: 'default',
    iconDataUrl: await getIconDataUrl(finalPath),
  };
}

async function resolveAppOption(
  candidate: AppCandidate,
  appIndex: Map<string, string>,
): Promise<ResolvedFileOpenOption | null> {
  const appPath = await findCandidateAppPath(candidate, appIndex);
  if (!appPath) return null;

  return {
    id: `app:${candidate.id}`,
    name: candidate.name,
    target: 'app',
    iconDataUrl: await getIconDataUrl(appPath),
    opensDirectory: candidate.opensDirectory,
    appPath,
  };
}

async function findCandidateAppPath(
  candidate: AppCandidate,
  appIndex: Map<string, string>,
): Promise<string | null> {
  for (const path of candidate.extraPaths ?? []) {
    if (await isDirectory(path)) return path;
  }

  for (const bundleName of candidate.bundleNames) {
    const appPath = appIndex.get(bundleName.toLowerCase());
    if (appPath) return appPath;
  }

  return null;
}

async function createAppIndex(): Promise<Map<string, string>> {
  const roots = [
    '/Applications',
    join(electronApp.getPath('home'), 'Applications'),
    '/Applications/Utilities',
    '/System/Applications',
    '/System/Applications/Utilities',
  ];
  const entries = await Promise.all(roots.map((root) => collectAppBundles(root, APP_SCAN_DEPTH)));
  return entries.flat().reduce((index, appPath) => {
    const name = appPath.split('/').pop()?.toLowerCase();
    if (name && !index.has(name)) index.set(name, appPath);
    return index;
  }, new Map<string, string>());
}

async function collectAppBundles(root: string, depth: number): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  const nested = await Promise.all(entries.map(async (entry) => {
    if (!entry.isDirectory()) return [];
    const path = join(root, entry.name);
    if (entry.name.endsWith('.app')) return [path];
    if (depth <= 0) return [];
    return collectAppBundles(path, depth - 1);
  }));
  return nested.flat();
}

async function getIconDataUrl(path: string): Promise<string | undefined> {
  if (iconCache.has(path)) return iconCache.get(path);
  const icon = path.endsWith('.app')
    ? await getAppBundleIconDataUrl(path) ?? await getSystemFileIconDataUrl(path)
    : await getSystemFileIconDataUrl(path);
  iconCache.set(path, icon);
  return icon;
}

async function getAppBundleIconDataUrl(appPath: string): Promise<string | undefined> {
  const resourcesDir = join(appPath, 'Contents', 'Resources');
  const iconPath = await resolveBundleIconPath(appPath, resourcesDir);
  if (!iconPath) return undefined;
  return createImageDataUrl(iconPath);
}

async function resolveBundleIconPath(appPath: string, resourcesDir: string): Promise<string | null> {
  const iconName = await readBundleIconName(appPath);
  const candidates = iconName
    ? buildIconPathCandidates(resourcesDir, iconName)
    : await findFallbackIcnsFiles(resourcesDir);

  for (const candidate of candidates) {
    if (await isFile(candidate)) return candidate;
  }
  return null;
}

async function readBundleIconName(appPath: string): Promise<string | null> {
  const infoPath = join(appPath, 'Contents', 'Info.plist');
  try {
    const { stdout } = await execFileAsync('/usr/bin/plutil', [
      '-extract',
      'CFBundleIconFile',
      'raw',
      '-o',
      '-',
      infoPath,
    ]);
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

function buildIconPathCandidates(resourcesDir: string, iconName: string): string[] {
  const normalizedName = iconName.trim();
  if (!normalizedName) return [];
  const nameWithExt = extname(normalizedName) ? normalizedName : `${normalizedName}.icns`;
  return [
    join(resourcesDir, normalizedName),
    join(resourcesDir, nameWithExt),
    join(resourcesDir, basename(nameWithExt)),
  ];
}

async function findFallbackIcnsFiles(resourcesDir: string): Promise<string[]> {
  const entries = await readdir(resourcesDir).catch(() => []);
  return entries
    .filter((entry) => entry.toLowerCase().endsWith('.icns'))
    .map((entry) => join(resourcesDir, entry));
}

async function createImageDataUrl(imagePath: string): Promise<string | undefined> {
  const directImage = nativeImage.createFromPath(imagePath);
  if (!directImage.isEmpty()) return normalizeIconImage(directImage);

  if (process.platform === 'darwin' && imagePath.toLowerCase().endsWith('.icns')) {
    return convertIcnsToPngDataUrl(imagePath);
  }

  return undefined;
}

async function convertIcnsToPngDataUrl(iconPath: string): Promise<string | undefined> {
  try {
    const cacheDir = join(electronApp.getPath('userData'), 'icon-cache');
    await mkdir(cacheDir, { recursive: true });
    const cacheKey = createHash('sha1').update(iconPath).digest('hex');
    const pngPath = join(cacheDir, `${cacheKey}.png`);
    await execFileAsync('/usr/bin/sips', ['-s', 'format', 'png', iconPath, '--out', pngPath]);

    const convertedImage = nativeImage.createFromPath(pngPath);
    if (!convertedImage.isEmpty()) return normalizeIconImage(convertedImage);
    const pngBytes = await readFile(pngPath);
    return `data:image/png;base64,${pngBytes.toString('base64')}`;
  } catch {
    return undefined;
  }
}

function normalizeIconImage(image: Electron.NativeImage): string {
  return image.resize({ width: 64, height: 64, quality: 'best' }).toDataURL();
}

async function getSystemFileIconDataUrl(path: string): Promise<string | undefined> {
  try {
    const image = await electronApp.getFileIcon(path, { size: 'normal' });
    return image.isEmpty() ? undefined : normalizeIconImage(image);
  } catch {
    return undefined;
  }
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

async function openDefault(finalPath: string): Promise<FileOpenResult> {
  const error = await shell.openPath(finalPath);
  return error ? openFailure('default', error) : { success: true, target: 'default', name: 'Default app' };
}

function revealFile(finalPath: string): FileOpenResult {
  shell.showItemInFolder(finalPath);
  return { success: true, target: 'reveal', name: 'Finder' };
}

function openFailure(target: FileOpenResult['target'], error: string, name?: string): FileOpenResult {
  return { success: false, target, name, error };
}

function formatExecError(err: unknown, appName: string): string {
  const details = err instanceof Error ? err.message : String(err);
  return `无法用 ${appName} 打开文件：${details}`;
}
