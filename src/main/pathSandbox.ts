import { realpathSync } from 'node:fs';
import { isAbsolute, resolve, relative, sep, basename, dirname, join } from 'node:path';
import { homedir } from 'node:os';

interface ResolvedPath {
  /** Normalized absolute path, realpath-resolved where possible. */
  absolutePath: string;
  /** Whether it is inside projectRoot; false when projectRoot is null, which does not mean it was denied. */
  isInside: boolean;
  /** Whether symlinks were resolved, for debugging cases where isInside is unexpected. */
  symlinkResolved: boolean;
}

/** Expand ~ and ~/foo to the user's home directory. */
function expandTilde(input: string): string {
  if (input === '~') return homedir();
  if (input.startsWith('~/') || input.startsWith('~\\')) {
    return join(homedir(), input.slice(2));
  }
  return input;
}

/** realpath wrapper: when a path does not exist, resolve the deepest existing ancestor and append missing segments. */
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
      } catch {}
    }
  }
}

/**
 * Normalize input to an absolute path and determine whether it is inside projectRoot.
 *
 * @param input Original input path, which may be relative, absolute, or contain ~.
 * @param projectRoot Absolute project root; null means there is no project, as in a legacy conversation.
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
 * Determine whether absPath is inside dirAbs, including dirAbs itself.
 *
 * Use path.relative and '..' instead of string-prefix comparisons:
 *   - correct across platforms; path.relative preserves case on macOS APFS while comparing appropriately;
 *   - naturally excludes ambiguous prefix-only paths such as `/Users/foo` and `/Users/foobar`.
 */
export function isPathInsideDir(absPath: string, dirAbs: string): boolean {
  const rel = relative(dirAbs, absPath);
  if (rel === '') return true;
  if (rel.startsWith('..' + sep) || rel === '..') return false;
  if (isAbsolute(rel)) return false;
  return true;
}
