import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { app } from 'electron';
import { PROXY_ENV_KEYS } from './proxyEnv';
import { debugLog } from './debug';
import { computeSignature, readCache, writeCache } from './shell-env/cache';

const MARKER = '___DEEPSEEK_SHELL_ENV_MARKER_97531___';

/**
 * Timeout limit for the first parse when no cache is available.
 *
 * It used to be 15 s on every startup, so a stuck rc file could blank the app for 15 seconds.
 * Now only the true first startup can block, and the timeout is shorter.
 */
const FIRST_RUN_TIMEOUT_MS = 8_000;

/** Timeout for background reparsing; it can be longer because nothing is blocked. */
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
 * Keep `-i`.
 *
 * Many users put `export PATH=…` in `.zshrc`, which is sourced only by interactive shells.
 * Removing `-i` would save most of the time but miss those settings, so preserve correctness
 * and use the cache to pay the cost once per rc change instead of once per startup.
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

/** Async version for refreshing the cache in the background without blocking the main thread. */
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

/** Keep only keys we care about to reduce cache size and avoid writing all sensitive variables to disk. */
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

/** Reparse and refresh the cache in the background; failures are logged without affecting the current process. */
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
 * Parse and merge login-shell environment variables.
 *
 * Apply a cache immediately without blocking; reparse an expired signature in the background for the next startup.
 * Wait synchronously only when parsing has never succeeded, which is the true first startup.
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

  // First startup: no usable value exists, so parse synchronously.
  debugLog('shellEnv', 'No cache available, resolving environment via', shell);
  const envBlock = dumpShellEnv(shell, FIRST_RUN_TIMEOUT_MS);
  if (envBlock === null) return;

  const picked = pickMergeableKeys(parseEnvBlock(envBlock));
  const merged = mergeIntoProcessEnv(picked);
  if (dir) writeCache(dir, signature, picked);

  debugLog('shellEnv', `Merged ${merged} environment variable(s) from shell`);
}
