import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { app } from 'electron';
import { PROXY_ENV_KEYS } from './proxyEnv';
import { debugLog } from './logger';
import { computeSignature, readCache, writeCache } from './shell-env/cache';

const MARKER = '___DEEPSEEK_SHELL_ENV_MARKER_97531___';

/**
 * 首次解析（无任何缓存可用）时的超时上限。
 *
 * 原来是 15s，且每次启动都会走到——一个卡住的 rc 文件能让应用白屏 15 秒。
 * 现在只有真正的第一次启动才可能阻塞，超时也收紧了。
 */
const FIRST_RUN_TIMEOUT_MS = 8_000;

/** 后台重新解析的超时，可以放宽，因为不阻塞任何东西。 */
const BACKGROUND_TIMEOUT_MS = 20_000;

const KEYS_TO_MERGE = [
  'PATH',
  'HOME',

  'NVM_DIR',
  'NVM_BIN',
  'NVM_INC',
  'VOLTA_HOME',
  'FNM_DIR',
  'FNM_MULTISHELL_PATH',
  'PNPM_HOME',
  'BUN_INSTALL',

  'CARGO_HOME',
  'GOPATH',
  'GOROOT',
  'JAVA_HOME',
  'PYENV_ROOT',
  'RBENV_ROOT',
  'DENO_INSTALL',

  ...PROXY_ENV_KEYS,
];

function pickShell(): string {
  if (process.platform === 'win32') {
    return process.env.COMSPEC || 'cmd.exe';
  }
  const fromEnv = process.env.SHELL;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  if (existsSync('/bin/zsh')) return '/bin/zsh';
  if (existsSync('/bin/bash')) return '/bin/bash';
  return '/bin/sh';
}

/**
 * 保留 `-i`。
 *
 * 很多用户把 `export PATH=…` 写在 `.zshrc` 里，而 `.zshrc` 只有交互式 shell 才会
 * source。去掉 `-i` 能省下大部分耗时，但会漏掉这些配置——所以这里选择保住正确性，
 * 靠缓存把开销降到每次 rc 变更付一次，而不是每次启动都付。
 */
const SHELL_ARGS = ['-i', '-l', '-c'] as const;

function envDumpScript(): string {
  return `printf '%s\\n' '${MARKER}' && env && printf '%s\\n' '${MARKER}'`;
}

function extractEnvBlock(stdout: string, stderr: string): string | null {
  const startIdx = stdout.indexOf(MARKER);
  const endIdx = stdout.lastIndexOf(MARKER);

  if (startIdx === -1 || startIdx === endIdx) {
    console.warn(
      '[shellEnv] Markers not found. stdout length:',
      stdout.length,
      'stderr:',
      stderr.trim() || '(none)',
    );
    return null;
  }

  return stdout.slice(startIdx + MARKER.length, endIdx).trim();
}

function dumpShellEnv(shell: string, timeoutMs: number): string | null {
  const result = spawnSync(shell, [...SHELL_ARGS, envDumpScript()], {
    encoding: 'utf-8',
    timeout: timeoutMs,
    maxBuffer: 1024 * 1024,
    env: process.env,
  });

  if (result.error) {
    console.warn('[shellEnv] Shell spawn failed:', result.error.message);
    return null;
  }

  if (result.status !== 0) {
    console.warn(
      `[shellEnv] Shell exited with status ${result.status}:`,
      result.stderr?.trim() || '(no stderr)',
    );
    return null;
  }

  return extractEnvBlock(result.stdout || '', result.stderr || '');
}

/** 异步版本，用于后台刷新缓存——不阻塞主线程。 */
function dumpShellEnvAsync(shell: string): Promise<string | null> {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;

    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const child = spawn(shell, [...SHELL_ARGS, envDumpScript()], { env: process.env });

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish(null);
    }, BACKGROUND_TIMEOUT_MS);

    child.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf-8'); });
    child.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf-8'); });

    child.on('error', (err) => {
      clearTimeout(timer);
      console.warn('[shellEnv] Background shell spawn failed:', err.message);
      finish(null);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        console.warn(`[shellEnv] Background shell exited with status ${code}`);
        finish(null);
        return;
      }
      finish(extractEnvBlock(stdout, stderr));
    });
  });
}

function parseEnvBlock(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of block.split('\n')) {
    const eqIdx = line.indexOf('=');
    if (eqIdx <= 0) continue;
    out[line.slice(0, eqIdx)] = line.slice(eqIdx + 1);
  }
  return out;
}

/** 只保留我们关心的键，缓存体积小、也避免把敏感变量整份落盘。 */
function pickMergeableKeys(shellEnv: Record<string, string>): Record<string, string> {
  const picked: Record<string, string> = {};
  for (const key of KEYS_TO_MERGE) {
    if (shellEnv[key]) picked[key] = shellEnv[key];
  }
  return picked;
}

function mergeIntoProcessEnv(env: Record<string, string>): number {
  let merged = 0;
  for (const key of KEYS_TO_MERGE) {
    if (env[key] && env[key] !== process.env[key]) {
      process.env[key] = env[key];
      merged++;
    }
  }
  return merged;
}

function userDataDir(): string | null {
  try {
    return app.getPath('userData');
  } catch {
    return null;
  }
}

/** 后台重新解析并刷新缓存；失败只记日志，不影响当前进程。 */
function revalidateInBackground(shell: string, signature: string, dir: string): void {
  void dumpShellEnvAsync(shell).then((envBlock) => {
    if (envBlock === null) return;
    const picked = pickMergeableKeys(parseEnvBlock(envBlock));
    if (Object.keys(picked).length === 0) return;
    writeCache(dir, signature, picked);
    debugLog('shellEnv', 'Background revalidation refreshed the cache');
  });
}

/**
 * 解析并合并登录 shell 的环境变量。
 *
 * 有缓存就立刻应用、绝不阻塞；签名过期时在后台重新解析，下次启动生效。
 * 只有从未成功解析过（真正的首次启动）才会同步等待。
 */
export function resolveShellEnvironment(): void {
  if (process.platform === 'win32') return;

  const shell = pickShell();
  const dir = userDataDir();
  const signature = computeSignature(shell, homedir());
  const cached = dir ? readCache(dir) : null;

  if (cached) {
    const merged = mergeIntoProcessEnv(cached.env);
    debugLog('shellEnv', `Applied cached environment (${merged} var(s) merged)`);

    if (cached.signature !== signature && dir) {
      debugLog('shellEnv', 'Cache signature is stale, revalidating in background');
      revalidateInBackground(shell, signature, dir);
    }
    return;
  }

  // 首次启动：没有任何可用值，只能同步解析
  debugLog('shellEnv', 'No cache available, resolving environment via', shell);
  const envBlock = dumpShellEnv(shell, FIRST_RUN_TIMEOUT_MS);
  if (envBlock === null) return;

  const picked = pickMergeableKeys(parseEnvBlock(envBlock));
  const merged = mergeIntoProcessEnv(picked);
  if (dir) writeCache(dir, signature, picked);

  debugLog('shellEnv', `Merged ${merged} environment variable(s) from shell`);
}
