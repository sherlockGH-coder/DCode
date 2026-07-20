import { realpathSync } from 'node:fs';
import { isAbsolute, resolve, relative, sep, basename, dirname, join } from 'node:path';
import { homedir } from 'node:os';

export interface ResolvedPath {
  /** 规范化后的绝对路径（已尽可能 realpath） */
  absolutePath: string;
  /** 是否在 projectRoot 内（projectRoot 为 null 时统一为 false，但不代表被拒） */
  isInside: boolean;
  /** 是否经过 symlink 解析（调试用，用于将来排查“为何 isInside 不符直觉”） */
  symlinkResolved: boolean;
}

/** 展开 ~ / ~/foo 为用户主目录 */
function expandTilde(input: string): string {
  if (input === '~') return homedir();
  if (input.startsWith('~/') || input.startsWith('~\\')) {
    return join(homedir(), input.slice(2));
  }
  return input;
}

/** realpath 包装：路径不存在时回退到最深已存在祖先，再拼回缺失片段 */
function safeRealpath(absPath: string): { path: string; resolved: boolean } {
  try {
    return { path: realpathSync.native(absPath), resolved: true };
  } catch {

    const missingParts: string[] = [];
    let cursor = absPath;

    while (true) {
      const parent = dirname(cursor);
      const name = basename(cursor);
      if (parent === cursor) return { path: absPath, resolved: false };

      missingParts.unshift(name);
      cursor = parent;

      try {
        const ancestorReal = realpathSync.native(cursor);
        return { path: join(ancestorReal, ...missingParts), resolved: true };
      } catch {

      }
    }
  }
}

/**
 * 把 input 规范化为绝对路径，并判断它是否在 projectRoot 内。
 *
 * @param input 原始输入路径（可能是相对/绝对/含 ~）
 * @param projectRoot 项目根（绝对路径），null 表示无项目（旧对话）
 */
export function resolveInside(input: string, projectRoot: string | null): ResolvedPath {
  const expanded = expandTilde(input);
  const initialAbs = isAbsolute(expanded)
    ? expanded
    : resolve(projectRoot ?? process.cwd(), expanded);

  const { path: realPath, resolved } = safeRealpath(initialAbs);

  let isInside = false;
  if (projectRoot) {
    const rootReal = safeRealpath(projectRoot).path;
    isInside = isPathInsideDir(realPath, rootReal);
  }

  return {
    absolutePath: realPath,
    isInside,
    symlinkResolved: resolved,
  };
}

/**
 * 判断 absPath 是否在 dirAbs 内（含 dirAbs 本身）。
 *
 * 用 path.relative + '..' 检查替代字符串前缀比较：
 *   - 跨平台正确（path.relative 在 macOS APFS 下保留大小写但比较合理）
 *   - 自然排除 `/Users/foo` 与 `/Users/foobar` 这种"前缀但非父目录"的歧义
 */
export function isPathInsideDir(absPath: string, dirAbs: string): boolean {
  const rel = relative(dirAbs, absPath);
  if (rel === '') return true;
  if (rel.startsWith('..' + sep) || rel === '..') return false;
  if (isAbsolute(rel)) return false;
  return true;
}
