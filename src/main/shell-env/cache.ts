import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * shell 环境变量的磁盘缓存。
 *
 * 解析登录 shell 需要跑一次完整的 rc 链（`zsh -i -l`），在装了
 * oh-my-zsh / nvm / conda 的机器上通常要 300ms～2s。之前每次冷启动都要
 * 同步付这个代价，而且发生在建窗之前，直接表现为白屏。
 *
 * 结果按「shell 路径 + 各 rc 文件 mtime」签名缓存：签名没变就直接复用，
 * 变了也先用旧值渲染，再在后台重新解析。
 */

/** 缓存格式或合并键集合变化时递增，使旧缓存自动失效。 */
const CACHE_VERSION = 1;

const CACHE_FILENAME = 'shell-env-cache.json';

/** 参与签名的 rc 文件，覆盖 zsh / bash 两套常见布局。 */
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
 * 计算缓存签名：shell 路径 + 每个 rc 文件的 mtime/size。
 * 文件不存在就记为 `-`，这样「新建 .zshrc」同样会让签名变化。
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
