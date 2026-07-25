import { realpathSync, statSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { isPathInsideDir } from './pathSandbox';
import { projectManager } from './project';

const previewAllowList = new Set<string>();

function canonicalFilePath(filePath: string): string | null {
  try {
    const realPath = realpathSync.native(filePath);
    return statSync(realPath).isFile() ? realPath : null;
  } catch {
    return null;
  }
}

function parseLocalFileUrl(requestUrl: string): string | null {
  try {
    const prefix = 'local-file://';
    if (!requestUrl.startsWith(prefix)) return null;
    let pathname = decodeURIComponent(requestUrl.slice(prefix.length));
    if (process.platform === 'win32' && /^\/[A-Za-z]:[\\/]/.test(pathname)) {
      pathname = pathname.slice(1);
    }
    if (!pathname || pathname.includes('\0')) return null;
    if (!isAbsolute(pathname)) return null;
    return resolve(pathname);
  } catch {
    return null;
  }
}

function canonicalProjectRoots(projectRoots: string[]): string[] {
  return projectRoots.flatMap((root) => {
    try {
      return [realpathSync.native(root)];
    } catch {
      return [];
    }
  });
}

export function registerLocalFilePreviewPath(filePath: string): void {
  if (typeof filePath !== 'string' || !filePath.trim()) return;
  const canonical = canonicalFilePath(filePath);
  if (canonical) previewAllowList.add(canonical);
}

export function registerLocalFilePreviewPaths(filePaths: string[]): void {
  for (const filePath of filePaths) {
    registerLocalFilePreviewPath(filePath);
  }
}

export function clearLocalFilePreviewAllowListForTest(): void {
  previewAllowList.clear();
}

export function getLocalFileProjectRoots(): string[] {
  const state = projectManager.getState();
  return [
    ...(state.activeProject ? [state.activeProject] : []),
    ...state.projects
      .map((project) => project.path)
      .filter((projectPath) => projectPath !== state.activeProject),
  ];
}

export function resolveLocalFileRequestPath(
  requestUrl: string,
  projectRoots = getLocalFileProjectRoots(),
): string | null {
  const requestedPath = parseLocalFileUrl(requestUrl);
  if (!requestedPath) return null;

  const canonical = canonicalFilePath(requestedPath);
  if (!canonical) return null;
  if (previewAllowList.has(canonical)) return requestedPath;

  for (const projectRoot of canonicalProjectRoots(projectRoots)) {
    if (isPathInsideDir(canonical, projectRoot)) {
      return requestedPath;
    }
  }

  return null;
}
