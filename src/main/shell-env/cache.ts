import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Disk cache for shell environment variables.
 *
 * Parsing a login shell requires one complete rc chain (`zsh -i -l`), which usually takes 300 ms to 2 s
 * on machines with oh-my-zsh, nvm, or conda. Previously every cold start paid this cost synchronously
 * before creating the window, appearing as a blank screen.
 *
 * Cache the result using a signature of the shell path and each rc file's mtime:
 * reuse it directly when unchanged; when changed, render with the old value and reparse in the background.
 */

/** Increment when the cache format or merged-key set changes to invalidate old caches. */
const CACHE_VERSION = 1;

const CACHE_FILENAME = 'shell-env-cache.json';

/** rc files included in the signature, covering common zsh and bash layouts. */
const RC_FILENAMES = [
  '.zshenv',
  '.zprofile',
  '.zshrc',
  '.zlogin',
  '.bash_profile',
  '.bash_login',
  '.bashrc',
  '.profile',
];

interface ShellEnvCacheEntry {
  version: number;
  signature: string;
  env: Record<string, string>;
}

export function cachePath(userDataDir: string): string {
  return join(userDataDir, CACHE_FILENAME);
}

/**
 * Calculate the cache signature from the shell path and each rc file's mtime and size.
 * Record missing files as `-` so creating a new .zshrc also changes the signature.
 */
export function computeSignature(shell: string, homeDir: string): string {
  const parts = [`v${CACHE_VERSION}`, shell];
  for (const name of RC_FILENAMES) {
    try {
      const info = statSync(join(homeDir, name));
      parts.push(`${name}:${info.mtimeMs}:${info.size}`);
    } catch {
      parts.push(`${name}:-`);
    }
  }
  return parts.join('|');
}

export function readCache(userDataDir: string): ShellEnvCacheEntry | null {
  try {
    const raw = readFileSync(cachePath(userDataDir), 'utf-8');
    const parsed = JSON.parse(raw) as ShellEnvCacheEntry;
    if (parsed?.version !== CACHE_VERSION) return null;
    if (!parsed.env || typeof parsed.env !== 'object') return null;
    if (typeof parsed.signature !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeCache(userDataDir: string, signature: string, env: Record<string, string>): void {
  try {
    const entry: ShellEnvCacheEntry = { version: CACHE_VERSION, signature, env };
    writeFileSync(cachePath(userDataDir), JSON.stringify(entry), 'utf-8');
  } catch (err) {
    console.warn('[shellEnv] Failed to persist cache:', err instanceof Error ? err.message : String(err));
  }
}
